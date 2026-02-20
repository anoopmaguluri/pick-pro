import { applyEventSourcing, processMatches } from "./gameLogic";

export const LEADERBOARD_SCHEMA_VERSION = 1;

const sanitizeName = (name) => {
    if (typeof name !== "string") return "";
    return name.trim();
};

const toNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

const emptyStats = (name) => ({
    name,
    p: 0,
    w: 0,
    l: 0,
    pd: 0,
    pf: 0,
    pa: 0,
});

const normalizeStatsRecord = (record) => {
    const name = sanitizeName(record?.name);
    if (!name) return null;

    return {
        name,
        p: toNumber(record?.p),
        w: toNumber(record?.w),
        l: toNumber(record?.l),
        pd: toNumber(record?.pd),
        pf: toNumber(record?.pf),
        pa: toNumber(record?.pa),
    };
};

const accumulateStats = (targetByName, rawRecord, multiplier = 1) => {
    const record = normalizeStatsRecord(rawRecord);
    if (!record) return;

    const name = record.name;
    if (!targetByName[name]) {
        targetByName[name] = emptyStats(name);
    }

    targetByName[name].p += record.p * multiplier;
    targetByName[name].w += record.w * multiplier;
    targetByName[name].l += record.l * multiplier;
    targetByName[name].pd += record.pd * multiplier;
    targetByName[name].pf += record.pf * multiplier;
    targetByName[name].pa += record.pa * multiplier;
};

export const playerKeyForName = (name) => encodeURIComponent(sanitizeName(name));

const resolveParticipants = (team) => {
    if (!team) return { p1: null, p2: null };

    if (team.p1 || team.p2) {
        return { p1: team.p1 || null, p2: team.p2 || null };
    }

    const rawName = sanitizeName(team.name);
    if (!rawName) return { p1: null, p2: null };

    const parts = rawName.split("/").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) return { p1: parts[0], p2: parts[1] };

    return { p1: rawName, p2: null };
};

export const buildLeaderboardDeltasFromMatch = (match) => {
    if (!match) return [];

    const aParticipants = resolveParticipants(match.tA);
    const bParticipants = resolveParticipants(match.tB);
    const scoreA = toNumber(match.sA);
    const scoreB = toNumber(match.sB);

    const aWon = scoreA > scoreB;
    const pdA = scoreA - scoreB;
    const pdB = scoreB - scoreA;

    const deltasByName = {};
    const pushDelta = (name, won, pd, pf, pa) => {
        const cleanName = sanitizeName(name);
        if (!cleanName) return;

        if (!deltasByName[cleanName]) {
            deltasByName[cleanName] = emptyStats(cleanName);
        }

        deltasByName[cleanName].p += 1;
        if (won) deltasByName[cleanName].w += 1;
        else deltasByName[cleanName].l += 1;
        deltasByName[cleanName].pd += pd;
        deltasByName[cleanName].pf += pf;
        deltasByName[cleanName].pa += pa;
    };

    pushDelta(aParticipants.p1, aWon, pdA, scoreA, scoreB);
    pushDelta(aParticipants.p2, aWon, pdA, scoreA, scoreB);
    pushDelta(bParticipants.p1, !aWon, pdB, scoreB, scoreA);
    pushDelta(bParticipants.p2, !aWon, pdB, scoreB, scoreA);

    return Object.values(deltasByName);
};

export const computeTournamentPlayerStats = (tournamentData) => {
    const merged = applyEventSourcing(tournamentData) || tournamentData;
    const stats = {};

    if (merged?.matches) processMatches(merged.matches, stats);
    if (merged?.knockouts) processMatches(merged.knockouts, stats);

    const compact = {};
    Object.values(stats).forEach((record) => {
        const normalized = normalizeStatsRecord(record);
        if (!normalized) return;
        compact[normalized.name] = normalized;
    });

    return compact;
};

export const buildEncodedLeaderboardFromTournaments = (tournamentsById) => {
    const aggregateByName = {};

    Object.values(tournamentsById || {}).forEach((tournamentData) => {
        if (!tournamentData) return;

        const statsForTournament = computeTournamentPlayerStats(tournamentData);
        Object.values(statsForTournament).forEach((record) => {
            accumulateStats(aggregateByName, record, 1);
        });
    });

    const encoded = {};
    Object.values(aggregateByName).forEach((record) => {
        const key = playerKeyForName(record.name);
        if (!key) return;
        encoded[key] = record;
    });

    return encoded;
};

export const leaderboardRowsFromEncoded = (encodedMap) => {
    return Object.values(encodedMap || {})
        .map((raw) => normalizeStatsRecord(raw))
        .filter(Boolean)
        .map((s) => {
            const played = s.p;
            const winRate = played > 0 ? (s.w / played) : 0;
            const rating = 3.5 + (s.w * 0.1 + s.pd * 0.01);
            return {
                ...s,
                winRate,
                winRateStr: played > 0 ? Math.round(winRate * 100) : 0,
                rating: rating.toFixed(2),
            };
        })
        .sort((a, b) => Number(b.rating) - Number(a.rating))
        .slice(0, 50);
};

export const derivePlayersFromTournamentData = (tournamentData) => {
    if (!tournamentData) return [];

    let players = [];

    if (Array.isArray(tournamentData.players) && tournamentData.players.length > 0) {
        players = tournamentData.players;
    } else if (Array.isArray(tournamentData.draftPlayers) && tournamentData.draftPlayers.length > 0) {
        players = tournamentData.draftPlayers;
    } else if (Array.isArray(tournamentData.teams)) {
        tournamentData.teams.forEach((team) => {
            if (team?.p1) players.push(team.p1);
            if (team?.p2) players.push(team.p2);
        });
    }

    const unique = [];
    const seen = new Set();

    players.forEach((name) => {
        const cleanName = sanitizeName(name);
        if (!cleanName || seen.has(cleanName)) return;
        seen.add(cleanName);
        unique.push(cleanName);
    });

    return unique;
};

export const buildPlayersPreview = (players, max = 4) => {
    const unique = [];
    const seen = new Set();

    (players || []).forEach((name) => {
        const cleanName = sanitizeName(name);
        if (!cleanName || seen.has(cleanName)) return;
        seen.add(cleanName);
        unique.push(cleanName);
    });

    return {
        playersPreview: unique.slice(0, max),
        playerCount: unique.length,
    };
};

export const accumulateLeaderboardStats = (targetEncoded, deltas, multiplier = 1) => {
    const byName = {};

    Object.values(targetEncoded || {}).forEach((record) => {
        const normalized = normalizeStatsRecord(record);
        if (!normalized) return;
        byName[normalized.name] = normalized;
    });

    (deltas || []).forEach((delta) => {
        accumulateStats(byName, delta, multiplier);
    });

    const encoded = {};
    Object.values(byName).forEach((record) => {
        const key = playerKeyForName(record.name);
        if (!key) return;
        encoded[key] = record;
    });

    return encoded;
};
