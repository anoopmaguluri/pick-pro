// ─── Match Processing ─────────────────────────────────────────────────────────

export const processMatches = (matchesArray, stats) => {
    const resolveParticipants = (team) => {
        if (!team) return { p1: null, p2: null };

        if (team.p1 || team.p2) {
            return { p1: team.p1 || null, p2: team.p2 || null };
        }

        // Legacy/partial data may only have `name`.
        // Support doubles strings like "A/B" as two participants.
        const rawName = typeof team.name === "string" ? team.name.trim() : "";
        if (!rawName) return { p1: null, p2: null };

        const parts = rawName.split("/").map((p) => p.trim()).filter(Boolean);
        if (parts.length >= 2) return { p1: parts[0], p2: parts[1] };

        return { p1: rawName, p2: null };
    };

    if (!matchesArray) return;
    matchesArray.forEach((m) => {
        if (m.done) {
            const aParticipants = resolveParticipants(m.tA);
            const bParticipants = resolveParticipants(m.tB);
            const p1 = aParticipants.p1;
            const p2 = aParticipants.p2;
            const p3 = bParticipants.p1;
            const p4 = bParticipants.p2;
            const aWon = m.sA > m.sB;
            const pdA = m.sA - m.sB;
            const pdB = m.sB - m.sA;

            const updateP = (pName, won, pd, pf, pa) => {
                if (!pName) return;
                if (!stats[pName])
                    stats[pName] = { name: pName, p1: pName, p2: null, p: 0, w: 0, l: 0, pd: 0, pf: 0, pa: 0, form: [] };
                stats[pName].p++;
                if (won) stats[pName].w++;
                else stats[pName].l++;
                stats[pName].pd += pd;
                stats[pName].pf += pf;
                stats[pName].pa += pa;
                stats[pName].form.push(won ? "W" : "L");
            };

            updateP(p1, aWon, pdA, m.sA, m.sB);
            updateP(p2, aWon, pdA, m.sA, m.sB);
            updateP(p3, !aWon, pdB, m.sB, m.sA);
            updateP(p4, !aWon, pdB, m.sB, m.sA);
        }
    });
};

// ─── Fixed Pairs (even, doubles) ──────────────────────────────────────────────

/**
 * Pair consecutive shuffled players into fixed teams for the whole tournament.
 * Only used for even player count + doubles.
 */
export const buildPairedTeams = (shuffledPlayers) => {
    const teams = [];
    for (let i = 0; i < shuffledPlayers.length; i += 2) {
        teams.push({
            name: `${shuffledPlayers[i]}/${shuffledPlayers[i + 1]}`,
            p1: shuffledPlayers[i],
            p2: shuffledPlayers[i + 1],
        });
    }
    return teams;
};

/**
 * True round-robin: every team plays every other team exactly once.
 * Used for fixed teams (even + doubles).
 */
export const buildRoundRobin = (teams, maxGamesPerTeam = null) => {
    // Default mode: full round-robin (existing behavior)
    if (!Number.isFinite(maxGamesPerTeam) || maxGamesPerTeam <= 0) {
        const matches = [];
        for (let i = 0; i < teams.length; i++) {
            for (let j = i + 1; j < teams.length; j++) {
                matches.push({
                    id: `m_${i}_${j}`,
                    tA: teams[i],
                    tB: teams[j],
                    sA: 0,
                    sB: 0,
                });
            }
        }
        return matches;
    }

    // Capped mode: use round-robin rounds and keep only first N rounds.
    // This preserves "no repeated opponents" while capping games/team.
    const matches = [];
    if (teams.length < 2) return matches;

    const participants = [...teams];
    if (participants.length % 2 === 1) {
        participants.push(null); // bye slot for odd team counts
    }

    const rounds = participants.length - 1;
    const maxRounds = Math.min(rounds, Math.floor(maxGamesPerTeam));
    const slotCount = participants.length;

    for (let r = 0; r < maxRounds; r++) {
        for (let i = 0; i < slotCount / 2; i++) {
            const tA = participants[i];
            const tB = participants[slotCount - 1 - i];
            if (!tA || !tB) continue;
            matches.push({
                id: `m_${matches.length}`,
                tA,
                tB,
                sA: 0,
                sB: 0,
            });
        }

        // Circle-method rotation: fix first slot, rotate the rest.
        const fixed = participants[0];
        const rotating = participants.slice(1);
        const last = rotating.pop();
        rotating.unshift(last);
        participants.splice(0, participants.length, fixed, ...rotating);
    }

    return matches;
};

export const getGradient = (name) => {
    if (!name || name.trim() === '') return "linear-gradient(135deg, #1f2937, #111827)";
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c1 = `hsl(${Math.abs(hash) % 360}, 70%, 40%)`;
    const c2 = `hsl(${(Math.abs(hash) + 40) % 360}, 80%, 30%)`;
    return `linear-gradient(135deg, ${c1}, ${c2})`;
};

// ─── EVENT SOURCING REDUCER ──────────────────────────────────────────────────
export const applyEventSourcing = (rawTournamentData) => {
    if (!rawTournamentData) return null;

    // Clone the base structure
    const mergedData = { ...rawTournamentData };
    const normalizeList = (value) => {
        if (!value) return [];
        if (Array.isArray(value)) return value.filter(Boolean);
        if (typeof value === "object") return Object.values(value).filter(Boolean);
        return [];
    };

    // Deep clone matches and knockouts to apply events safely
    mergedData.matches = normalizeList(mergedData.matches).map(m => ({ ...m, sA: m.sA || 0, sB: m.sB || 0 }));
    mergedData.knockouts = normalizeList(mergedData.knockouts).map(k => ({ ...k, sA: k.sA || 0, sB: k.sB || 0 }));

    // Optional score snapshot allows log compaction while preserving current scoreboard state.
    const snapshot = mergedData.scoreSnapshot;
    if (snapshot && typeof snapshot === "object") {
        if (Array.isArray(mergedData.matches) && Array.isArray(snapshot.matches)) {
            mergedData.matches.forEach((m, idx) => {
                const snap = snapshot.matches[idx];
                if (!snap) return;
                m.sA = Number.isFinite(snap.sA) ? Math.max(0, Math.trunc(snap.sA)) : (m.sA || 0);
                m.sB = Number.isFinite(snap.sB) ? Math.max(0, Math.trunc(snap.sB)) : (m.sB || 0);
            });
        }

        if (Array.isArray(mergedData.knockouts) && Array.isArray(snapshot.knockouts)) {
            mergedData.knockouts.forEach((m, idx) => {
                const snap = snapshot.knockouts[idx];
                if (!snap) return;
                m.sA = Number.isFinite(snap.sA) ? Math.max(0, Math.trunc(snap.sA)) : (m.sA || 0);
                m.sB = Number.isFinite(snap.sB) ? Math.max(0, Math.trunc(snap.sB)) : (m.sB || 0);
            });
        }
    }

    // Apply Event Sourcing stream
    let events = normalizeList(mergedData.events);

    if (events && Array.isArray(events)) {
        // Sort events chronologically
        const sortedEvents = [...events].sort((a, b) => a.ts - b.ts);
        const crossAdminWindowMs = 650;
        const lastAcceptedByAction = {}; // action -> { ts, sourceId }
        const seenClientEventIds = new Set();

        sortedEvents.forEach(evt => {
            if (evt.type === "SCORE") {
                const clientEventId = typeof evt.clientEventId === "string" ? evt.clientEventId.trim() : "";
                if (clientEventId) {
                    if (seenClientEventIds.has(clientEventId)) {
                        return;
                    }
                    seenClientEventIds.add(clientEventId);
                }

                const targetArray = evt.isKnockout ? mergedData.knockouts : mergedData.matches;
                if (targetArray && targetArray[evt.mIdx]) {
                    const scoreField = evt.team === "A" ? "sA" : "sB";

                    const actionKey = `${evt.isKnockout ? "k" : "m"}-${evt.mIdx}-${evt.team}-${evt.delta}`;
                    const sourceId = typeof evt.sourceId === "string" && evt.sourceId.trim() ? evt.sourceId.trim() : null;
                    const prevAccepted = lastAcceptedByAction[actionKey];

                    // Ignore likely duplicate taps only when they come from different admins/devices
                    // in a very short window. Same-admin rapid taps are treated as intentional.
                    if (
                        prevAccepted &&
                        sourceId &&
                        prevAccepted.sourceId &&
                        prevAccepted.sourceId !== sourceId &&
                        (evt.ts - prevAccepted.ts) < crossAdminWindowMs
                    ) {
                        return;
                    }

                    lastAcceptedByAction[actionKey] = { ts: evt.ts, sourceId };

                    const hasAbsoluteScore = Number.isFinite(evt.nextScore);
                    if (hasAbsoluteScore) {
                        targetArray[evt.mIdx][scoreField] = Math.max(0, Math.trunc(evt.nextScore));
                    } else {
                        const current = targetArray[evt.mIdx][scoreField] || 0;
                        targetArray[evt.mIdx][scoreField] = Math.max(0, current + evt.delta);
                    }
                }
            }
        });
    }

    return mergedData;
};

// ─── Singles Round-Robin ──────────────────────────────────────────────────────

/**
 * 1v1 round-robin — every player plays every other player exactly once.
 * Works for any player count. Individual standings.
 */
export const buildSinglesRoundRobin = (players) => {
    const matches = [];
    for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
            matches.push({
                id: `s_${matches.length}`,
                tA: { name: players[i], p1: players[i], p2: null },
                tB: { name: players[j], p1: players[j], p2: null },
                sA: 0,
                sB: 0,
            });
        }
    }

    return matches;
};

// ─── Mixer Doubles ────────────────────────────────────────────────────────────

/**
 * Social doubles schedule for any player count (especially odd).
 * Greedy algorithm guarantees:
 *   • No two players are partners more than once.
 *   • No same 4-player group plays twice.
 *   • Each partner pair is used at most once as a team.
 * Individual standings (each player credited per match result).
 */
export const buildMixerDoubles = (players) => {
    const matches = [];
    const gamesPlayed = {};
    players.forEach(p => gamesPlayed[p] = 0);

    const usedPartners = new Set(); // "A+B"
    const usedOpponentPairs = new Set(); // "A|B" for individual opponent pairings
    const usedTeamMatchups = new Set(); // "Team1 vs Team2"
    const usedQuartets = new Set(); // "A+B+C+D" (same 4-player group)

    const MAX_GAMES = 3;
    let safety = 0;

    const partnerKey = (a, b) => [a, b].sort().join("+");
    const opponentKey = (a, b) => [a, b].sort().join("|");
    const matchupKey = (aKey, bKey) => [aKey, bKey].sort().join(" vs ");
    const quartetKey = (arr) => [...arr].sort().join("+");

    const evaluateGroup = (group) => {
        const qKey = quartetKey(group);
        if (usedQuartets.has(qKey)) return null;

        const perms = [
            [[group[0], group[1]], [group[2], group[3]]],
            [[group[0], group[2]], [group[1], group[3]]],
            [[group[0], group[3]], [group[1], group[2]]],
        ];

        for (const perm of perms) {
            const tA = perm[0];
            const tB = perm[1];
            const keyA = partnerKey(tA[0], tA[1]);
            const keyB = partnerKey(tB[0], tB[1]);

            // Never repeat teammate pair in mixer.
            if (usedPartners.has(keyA) || usedPartners.has(keyB)) continue;

            const mKey = matchupKey(keyA, keyB);
            if (usedTeamMatchups.has(mKey)) continue;

            const oppKeys = [
                opponentKey(tA[0], tB[0]),
                opponentKey(tA[0], tB[1]),
                opponentKey(tA[1], tB[0]),
                opponentKey(tA[1], tB[1]),
            ];

            // Never repeat opponent pairings.
            if (oppKeys.some((k) => usedOpponentPairs.has(k))) continue;

            return { tA, tB, keyA, keyB, oppKeys, mKey, qKey };
        }

        return null;
    };

    const findValidSelection = (candidatePool) => {
        for (let a = 0; a < candidatePool.length; a++) {
            for (let b = a + 1; b < candidatePool.length; b++) {
                for (let c = b + 1; c < candidatePool.length; c++) {
                    for (let d = c + 1; d < candidatePool.length; d++) {
                        const group = [candidatePool[a], candidatePool[b], candidatePool[c], candidatePool[d]];
                        const selected = evaluateGroup(group);
                        if (selected) return selected;
                    }
                }
            }
        }
        return null;
    };

    while (safety < 200) {
        safety++;

        // Get players who need games, sorted by #played ascending (to balance)
        // Add randomness for tie-breaking
        let candidates = players
            .filter(p => gamesPlayed[p] < MAX_GAMES)
            .sort((a, b) => (gamesPlayed[a] - gamesPlayed[b]) || (Math.random() - 0.5));

        if (candidates.length < 4) break;

        const focusedPool = candidates.slice(0, Math.min(candidates.length, 8));
        let selected = findValidSelection(focusedPool);
        if (!selected && candidates.length > focusedPool.length) {
            selected = findValidSelection(candidates);
        }
        if (!selected) break;

        const tA = selected.tA;
        const tB = selected.tB;

        matches.push({
            id: `mx_${matches.length}`,
            tA: { name: `${tA[0]}/${tA[1]}`, p1: tA[0], p2: tA[1] },
            tB: { name: `${tB[0]}/${tB[1]}`, p1: tB[0], p2: tB[1] },
            sA: 0, sB: 0,
        });

        usedPartners.add(selected.keyA);
        usedPartners.add(selected.keyB);
        usedTeamMatchups.add(selected.mKey);
        selected.oppKeys.forEach((k) => usedOpponentPairs.add(k));
        usedQuartets.add(selected.qKey);

        // Mark players
        [tA[0], tA[1], tB[0], tB[1]].forEach((p) => {
            gamesPlayed[p]++;
        });
    }

    return matches;
};

// ─── Knockout Bracket ─────────────────────────────────────────────────────────

/**
 * Build knockout bracket.
 * numAdvancing=2 → Grand Final only (top 2)
 * numAdvancing=4 → Semi-finals + Grand Final (top 4: 1v4 and 2v3)
 */
export const buildKnockouts = (topStandings, numAdvancing, isMixer = false) => {
    const team = (s) => ({ name: s.name, p1: s.p1 ?? s.name, p2: s.p2 ?? null });

    // Special Mixer Rule: Top 4 players form mixed pairs (1&3 vs 2&4) for a direct Final
    if (isMixer && topStandings.length >= 4) {
        return [{
            id: "final",
            type: "🏆 GRAND FINAL (MIXED)",
            tA: {
                name: `${topStandings[0].name}/${topStandings[2].name}`,
                p1: topStandings[0].name,
                p2: topStandings[2].name
            },
            tB: {
                name: `${topStandings[1].name}/${topStandings[3].name}`,
                p1: topStandings[1].name,
                p2: topStandings[3].name
            },
            sA: 0, sB: 0, done: false,
        }];
    }

    if (numAdvancing <= 2 || topStandings.length < 4) {
        return [{
            id: "final",
            type: "🏆 GRAND FINAL",
            tA: team(topStandings[0]),
            tB: team(topStandings[1]),
            sA: 0, sB: 0, done: false,
        }];
    }

    return [
        {
            id: "sf1",
            type: "⚔️ SEMI FINAL 1",
            tA: team(topStandings[0]),
            tB: team(topStandings[3]),
            sA: 0, sB: 0, done: false,
        },
        {
            id: "sf2",
            type: "⚔️ SEMI FINAL 2",
            tA: team(topStandings[1]),
            tB: team(topStandings[2]),
            sA: 0, sB: 0, done: false,
        },
        {
            id: "final",
            type: "🏆 GRAND FINAL",
            tA: { name: "TBD", p1: null, p2: null },
            tB: { name: "TBD", p1: null, p2: null },
            sA: 0, sB: 0, done: false,
            pending: true,
        },
    ];
};

// ─── Standings Status ─────────────────────────────────────────────────────────

/**
 * Labels each entry in `sorted` with `.status`:
 *   "Q"       — guaranteed to qualify (cannot be bumped out)
 *   "E"       — eliminated (cannot catch up even if they win everything)
 *   "pending" — still in play
 *
 * `sorted` must already be sorted descending by wins (then PD).
 * Each entry must have: { w, p } — wins and matches played.
 * `qCount` — number of qualifying spots (2 or 4).
 * `totalMatchesEach` — total matches each entry is scheduled to play.
 */
export const determineStatus = (sorted, qCount, totalMatchesEach, allMatchesFinished = false) => {
    const n = sorted.length;
    if (n === 0) return;

    // Fallback: assume round-robin (n-1) if not provided
    const totalPerEntry = totalMatchesEach ?? (n - 1);

    sorted.forEach((t) => {
        const perEntryScheduled = Number.isFinite(t?.scheduled)
            ? Number(t.scheduled)
            : totalPerEntry;
        t.rem = Math.max(0, perEntryScheduled - (t.p || 0));
        t.maxWins = (t.w || 0) + t.rem;
    });

    const noneStarted = sorted.every((t) => t.p === 0);
    if (noneStarted) {
        sorted.forEach((t) => { t.status = "pending"; });
        return;
    }

    const calculatedAllDone = sorted.every((t) => t.rem === 0);

    // If explicit flag is true OR calculated check passes
    if (allMatchesFinished || calculatedAllDone) {
        sorted.forEach((t, i) => {
            t.status = i < qCount ? "Q" : "E";
        });
        return;
    }

    sorted.forEach((t, i) => {

        const definiteBetter = sorted.filter((o) => (o.w || 0) > t.maxWins).length;
        if (definiteBetter >= qCount) {
            t.status = "E";
        } else {
            const definiteWorse = sorted.filter((o) => o.maxWins < (t.w || 0)).length;
            if (definiteWorse >= n - qCount) {
                t.status = "Q";
            } else {
                t.status = "pending";
            }
        }

        // --- Qualification Analysis Heuristic ---
        const lastQSpot = sorted[qCount - 1];
        const winsAtLine = lastQSpot ? lastQSpot.w : 0;

        // Wins Needed: Minimum wins to reach the current line (simplified)
        const needed = Math.max(0, winsAtLine - (t.w || 0));

        // Heuristic Probability: 0 to 100
        let prob = 50;
        if (t.status === "Q") {
            prob = 100;
        } else if (t.status === "E") {
            prob = 0;
        } else {
            const diffFromLine = (t.w || 0) - winsAtLine;
            if (i < qCount) {
                // Above the line
                prob = 60 + (diffFromLine * 10) + ((qCount - i) * 2);
            } else {
                // Below the line
                prob = 40 + (diffFromLine * 10) - ((i - qCount) * 5);
            }
        }

        // Adjust for remaining matches logically
        if (t.rem === 0 && i >= qCount && t.status !== "Q") prob = 0;
        if (t.rem === 0 && i < qCount && t.status !== "E") prob = 100;

        t.analysis = {
            winsNeeded: needed,
            probability: Math.min(99, Math.max(1, prob))
        };
    });
};

// ─── Qualify Count Helper ─────────────────────────────────────────────────────

/** How many teams/players advance to knockouts based on total count */
export const qualifyCount = (numTeams) => (numTeams >= 5 ? 4 : 2);

/**
 * Pure function to determine if a new knockout round (e.g. Grand Final) 
 * should be generated based on the completion of the current round's matches.
 * 
 * @param {Array} currentKnockouts - The existing list of knockout match objects
 * @param {string} format - Tournament format ("fixed", "pairs", "mixer", etc.)
 * @param {number} pools - Number of pools (if applicable)
 * @returns {Array|null} New array of knockouts with the next round added, or null if no advancement.
 */
export const getKnockoutAdvancement = (currentKnockouts, format, pools) => {
    // Currently we only handle SF1+SF2 -> Grand Final bridge
    if (currentKnockouts.length !== 2) return null;
    if (!currentKnockouts[0].done || !currentKnockouts[1].done) return null;
    // Final already exists check
    if (currentKnockouts.some(k => k.id === "final")) return null;

    // Only advance for fixed pairs or 2-pool setups with 4-team semis
    if (format === "fixed" || format === "pairs" || pools === 2) {
        const winner1 = currentKnockouts[0].sA > currentKnockouts[0].sB
            ? currentKnockouts[0].tA
            : currentKnockouts[0].tB;
        const winner2 = currentKnockouts[1].sA > currentKnockouts[1].sB
            ? currentKnockouts[1].tA
            : currentKnockouts[1].tB;

        return [
            ...currentKnockouts,
            {
                id: "final",
                type: "🏆 GRAND FINAL",
                tA: winner1,
                tB: winner2,
                sA: 0,
                sB: 0,
                done: false,
            }
        ];
    }

    return null;
};

// ─── Intelligent Tie-Breaking ──────────────────────────────────────────────────

/**
 * Intelligent sorting logic for standings.
 * Order of resolution:
 * 1. Wins (W)
 * 2. Point Differential (PD)
 * 3. Head-to-Head (H2H) Matchups
 * 4. Points For (PF)
 * 5. Points Against (PA)
 * 6. Alphabetical (Name)
 * 
 * @param {Array} standingsArray - Array of standings objects
 * @param {Array} matches - Full array of matches to compute H2H
 * @returns {Array} The deterministically sorted standings array
 */
export const intelligentSort = (standingsArray, matches = []) => {
    return standingsArray.sort((a, b) => {
        // 1. Wins (higher is better)
        if (b.w !== a.w) return b.w - a.w;

        // 2. Point Differential (higher is better)
        if (b.pd !== a.pd) return b.pd - a.pd;

        // 3. Head-to-Head (H2H)
        // Check if these two specific entities (teams or players) played each other
        if (matches && matches.length > 0) {
            const h2hMatches = matches.filter(m => m.done && (
                // Team format checks
                (m.tA.name === a.name && m.tB.name === b.name) ||
                (m.tA.name === b.name && m.tB.name === a.name) ||
                // Singles or Mixer format checks (Player vs Player)
                (m.tA.p1 === a.name && m.tB.p1 === b.name) ||
                (m.tA.p1 === b.name && m.tB.p1 === a.name) ||
                (m.tA.p2 === a.name && m.tB.p2 === b.name) ||
                (m.tA.p2 === b.name && m.tB.p2 === a.name) ||
                (m.tA.p1 === a.name && m.tB.p2 === b.name) ||
                (m.tA.p2 === a.name && m.tB.p1 === b.name)
            ));

            if (h2hMatches.length > 0) {
                let aH2hWins = 0;
                let bH2hWins = 0;

                h2hMatches.forEach(m => {
                    const aIsTeamA = m.tA.name === a.name || m.tA.p1 === a.name || m.tA.p2 === a.name;
                    const aIsTeamB = m.tB.name === a.name || m.tB.p1 === a.name || m.tB.p2 === a.name;

                    if (aIsTeamA) {
                        if (m.sA > m.sB) aH2hWins++;
                        else if (m.sB > m.sA) bH2hWins++;
                    } else if (aIsTeamB) {
                        if (m.sB > m.sA) aH2hWins++;
                        else if (m.sA > m.sB) bH2hWins++;
                    }
                });

                if (bH2hWins !== aH2hWins) return bH2hWins - aH2hWins;
            }
        }

        // 4. Points For (PF) - higher is better
        if (b.pf !== a.pf) return (b.pf || 0) - (a.pf || 0);

        // 5. Points Against (PA) - lower is better
        if (a.pa !== b.pa) return (a.pa || 0) - (b.pa || 0);

        // 6. Alphabetical Fallback (determinstic)
        return a.name.localeCompare(b.name);
    });
};
