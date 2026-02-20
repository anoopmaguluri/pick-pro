import {
    processMatches,
    determineStatus,
    qualifyCount,
    intelligentSort,
} from "./gameLogic";

/**
 * Calculates standings for the currently active tournament payload.
 * This is extracted so it can run in a Web Worker.
 */
export const calculateStandings = (data) => {
    if (!data) return [];

    const hasPoolMatches = data.matches && data.matches.length > 0;
    const hasKnockouts = data.knockouts && data.knockouts.length > 0;
    const allPoolDone = hasPoolMatches && data.matches.every((m) => m.done);
    const allKnockoutsDone = hasKnockouts && data.knockouts.every((k) => k.done);
    const allMatchesDone = hasPoolMatches ? allPoolDone : (hasKnockouts ? allKnockoutsDone : false);

    // Business rule: standings should exclude knockout results for tournaments
    // with 3+ participants. Only 2-participant events include knockout scores.
    const participants = new Set();
    const addParticipant = (name) => {
        if (typeof name !== "string") return;
        const normalized = name.trim();
        if (!normalized || normalized.toUpperCase() === "TBD") return;
        participants.add(normalized);
    };
    const addTeamParticipants = (team) => {
        if (!team) return;
        if (team.p1 || team.p2) {
            addParticipant(team.p1);
            addParticipant(team.p2);
            return;
        }
        if (team.name) {
            const parts = String(team.name).split("/").map((p) => p.trim()).filter(Boolean);
            if (parts.length >= 2) {
                addParticipant(parts[0]);
                addParticipant(parts[1]);
            } else {
                addParticipant(team.name);
            }
        }
    };

    (data.players || []).forEach(addParticipant);
    (data.draftPlayers || []).forEach(addParticipant);
    (data.teams || []).forEach((team) => {
        addTeamParticipants(team);
    });
    (data.matches || []).forEach((m) => {
        addTeamParticipants(m?.tA);
        addTeamParticipants(m?.tB);
    });
    (data.knockouts || []).forEach((m) => {
        addTeamParticipants(m?.tA);
        addTeamParticipants(m?.tB);
    });

    const participantCount = participants.size;
    const includeKnockoutsInStandings = participantCount <= 2;

    // Fixed teams + team standings
    if ((data.format === "pairs" || data.format === "fixed") && data.teams) {
        const teamStats = {};

        data.teams.forEach((t) => {
            teamStats[t.name] = {
                name: t.name,
                p1: t.p1,
                p2: t.p2,
                p: 0,
                w: 0,
                l: 0,
                pd: 0,
                pf: 0,
                pa: 0,
                form: [],
            };
        });

        const updateTeamFromMatch = (m) => {
            if (!m || !m.done || !m.tA || !m.tB) return;
            if (!teamStats[m.tA.name] || !teamStats[m.tB.name]) return;
            const aWon = m.sA > m.sB;

            const updateT = (name, won, pd, pf, pa) => {
                if (teamStats[name]) {
                    teamStats[name].p++;
                    if (won) teamStats[name].w++;
                    else teamStats[name].l++;
                    teamStats[name].pd += pd;
                    teamStats[name].pf += pf;
                    teamStats[name].pa += pa;
                    teamStats[name].form.push(won ? "W" : "L");
                }
            };

            updateT(m.tA.name, aWon, m.sA - m.sB, m.sA, m.sB);
            updateT(m.tB.name, !aWon, m.sB - m.sA, m.sB, m.sA);
        };

        if (data.matches) data.matches.forEach(updateTeamFromMatch);
        if (includeKnockoutsInStandings && data.knockouts) data.knockouts.forEach(updateTeamFromMatch);

        const allMatchesForSort = [
            ...(data.matches || []),
            ...(includeKnockoutsInStandings ? (data.knockouts || []) : []),
        ];

        const scheduledCountByTeam = {};
        allMatchesForSort.forEach((m) => {
            const tA = m?.tA?.name;
            const tB = m?.tB?.name;
            if (tA) scheduledCountByTeam[tA] = (scheduledCountByTeam[tA] || 0) + 1;
            if (tB) scheduledCountByTeam[tB] = (scheduledCountByTeam[tB] || 0) + 1;
        });

        Object.values(teamStats).forEach((t) => {
            t.scheduled = scheduledCountByTeam[t.name] || 0;
        });

        const sortedTeams = intelligentSort(Object.values(teamStats), allMatchesForSort);
        const qCount = qualifyCount(sortedTeams.length);
        const totalMatchesEach = hasPoolMatches
            ? sortedTeams.length - 1
            : (includeKnockoutsInStandings && hasKnockouts ? 1 : 0);

        determineStatus(sortedTeams, qCount, totalMatchesEach, allMatchesDone);
        return sortedTeams;
    }

    // Individual / singles / mixer
    const stats = {};
    const players = data.players || data.draftPlayers || [];

    players.forEach((p) => {
        stats[p] = { name: p, p1: p, p2: null, p: 0, w: 0, l: 0, pd: 0, pf: 0, pa: 0, form: [] };
    });

    if (data.matches) processMatches(data.matches, stats);
    if (includeKnockoutsInStandings && data.knockouts) processMatches(data.knockouts, stats);

    const allMatchesForSort = [
        ...(data.matches || []),
        ...(includeKnockoutsInStandings ? (data.knockouts || []) : []),
    ];
    const sorted = intelligentSort(Object.values(stats), allMatchesForSort);

    const qCount = qualifyCount(sorted.length);

    // For mixer-doubles and singles, determine how many matches each player plays
    let matchesPerPlayer = sorted.length - 1;
    if (data.format === "mixer" && data.matches) {
        const matchCounts = {};
        data.matches.forEach((m) => {
            [m.tA.p1, m.tA.p2, m.tB.p1, m.tB.p2].forEach((p) => {
                if (p) matchCounts[p] = (matchCounts[p] || 0) + 1;
            });
        });

        if (includeKnockoutsInStandings && data.knockouts) {
            data.knockouts.forEach((m) => {
                [m.tA.p1, m.tA.p2, m.tB.p1, m.tB.p2].forEach((p) => {
                    if (p) matchCounts[p] = (matchCounts[p] || 0) + 1;
                });
            });
        }

        const counts = Object.values(matchCounts);
        matchesPerPlayer = counts.length > 0
            ? Math.round(counts.reduce((a, b) => a + b, 0) / counts.length)
            : matchesPerPlayer;
    } else if (!hasPoolMatches && includeKnockoutsInStandings && hasKnockouts) {
        matchesPerPlayer = 1;
    }

    determineStatus(sorted, qCount, matchesPerPlayer, allMatchesDone);
    return sorted;
};
