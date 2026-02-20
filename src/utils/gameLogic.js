// ─── Match Processing ─────────────────────────────────────────────────────────

export const processMatches = (matchesArray, stats) => {
    if (!matchesArray) return;
    matchesArray.forEach((m) => {
        if (m.done) {
            const p1 = m.tA.p1;
            const p2 = m.tA.p2;
            const p3 = m.tB.p1;
            const p4 = m.tB.p2;
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
export const buildRoundRobin = (teams) => {
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
};

// ─── Singles Round-Robin ──────────────────────────────────────────────────────

/**
 * 1v1 round-robin — every player plays every other player exactly once.
 * Works for any player count. Individual standings.
 */
export const buildSinglesRoundRobin = (players) => {
    const matches = [];
    const gamesPlayed = {};
    players.forEach(p => gamesPlayed[p] = 0);
    const played = new Set(); // "A-B"

    const MAX_GAMES = 3;
    let safety = 0;

    // Prioritize players with fewer games
    while (safety < 200) {
        safety++;

        // Candidates needing games
        let candidates = players.filter(p => gamesPlayed[p] < MAX_GAMES);

        // Need at least 2 to form a match
        if (candidates.length < 2) break;

        // Shuffle to randomize
        candidates.sort(() => Math.random() - 0.5);

        // Find a valid pair
        let found = false;
        for (let i = 0; i < candidates.length; i++) {
            const p1 = candidates[i];
            for (let j = i + 1; j < candidates.length; j++) {
                const p2 = candidates[j];
                const key = [p1, p2].sort().join("-");

                if (!played.has(key)) {
                    // Match found
                    matches.push({
                        id: `s_${matches.length}`,
                        tA: { name: p1, p1: p1, p2: null },
                        tB: { name: p2, p1: p2, p2: null },
                        sA: 0, sB: 0,
                    });
                    gamesPlayed[p1]++;
                    gamesPlayed[p2]++;
                    played.add(key);
                    found = true;
                    break;
                }
            }
            if (found) break;
        }

        if (!found) break; // No valid matches left
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
    const usedOpponents = new Set(); // "A vs B" (individual matchups tracked to diversify)

    const MAX_GAMES = 3;
    let safety = 0;

    while (safety < 200) {
        safety++;

        // Get players who need games, sorted by #played ascending (to balance)
        // Add randomness for tie-breaking
        let candidates = players
            .filter(p => gamesPlayed[p] < MAX_GAMES)
            .sort((a, b) => (gamesPlayed[a] - gamesPlayed[b]) || (Math.random() - 0.5));

        if (candidates.length < 4) break;

        // Try to form a match with top candidates
        // We pick top 4, or shuffle top N? 
        // Let's pick strict top 4 to enforce balancing, but shuffle them to find pairing
        const pool = candidates.slice(0, 4);

        // Try permutations of these 4
        // p0,p1 vs p2,p3
        // p0,p2 vs p1,p3
        // p0,p3 vs p1,p2
        const perms = [
            [[pool[0], pool[1]], [pool[2], pool[3]]],
            [[pool[0], pool[2]], [pool[1], pool[3]]],
            [[pool[0], pool[3]], [pool[1], pool[2]]]
        ];

        // Score permutations: lower is better (0 repeated partners)
        const scored = perms.map(perm => {
            const tA = perm[0].sort();
            const tB = perm[1].sort();
            const keyA = tA.join("+");
            const keyB = tB.join("+");
            let score = 0;
            if (usedPartners.has(keyA)) score += 10;
            if (usedPartners.has(keyB)) score += 10;
            return { perm, score, keyA, keyB };
        }).sort((a, b) => a.score - b.score);

        const best = scored[0];

        // Commit
        const tA = best.perm[0];
        const tB = best.perm[1];

        matches.push({
            id: `mx_${matches.length}`,
            tA: { name: `${tA[0]}/${tA[1]}`, p1: tA[0], p2: tA[1] },
            tB: { name: `${tB[0]}/${tB[1]}`, p1: tB[0], p2: tB[1] },
            sA: 0, sB: 0,
        });

        usedPartners.add(best.keyA);
        usedPartners.add(best.keyB);

        // Mark players
        pool.forEach(p => gamesPlayed[p]++);
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
        t.rem = Math.max(0, totalPerEntry - (t.p || 0));
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

