import {
    buildSinglesRoundRobin,
    buildPairedTeams,
    buildRoundRobin,
    buildMixerDoubles
} from "../utils/gameLogic";

self.onmessage = function (e) {
    const { action, fmt, draftPlayers } = e.data;

    if (action === "PREPARE_TOURNAMENT") {
        try {
            const result = prepareAutoTournamentResultWorker(fmt, draftPlayers);
            self.postMessage({ status: 'success', data: result });
        } catch (error) {
            self.postMessage({ status: 'error', error: error.message });
        }
    }
};

const prepareAutoTournamentResultWorker = (fmt, draftPlayers) => {
    const players = [...draftPlayers];

    // Fisher-Yates shuffle
    for (let i = players.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [players[i], players[j]] = [players[j], players[i]];
    }

    const isEven = players.length % 2 === 0;
    const isDouble = fmt === "doubles";

    let format, teams, matches, knockouts = [];

    if (!isDouble) {
        format = "singles";
        teams = null;
        if (players.length === 2) {
            matches = [];
            knockouts = [{
                id: "final",
                type: "🏆 GRAND FINAL",
                tA: { name: players[0], p1: players[0], p2: null },
                tB: { name: players[1], p1: players[1], p2: null },
                sA: 0, sB: 0, done: false
            }];
        } else {
            matches = buildSinglesRoundRobin(players);
        }
    } else if (isEven) {
        format = "pairs";
        teams = buildPairedTeams(players);
        if (teams.length === 2) {
            matches = [];
            knockouts = [{
                id: "final",
                type: "🏆 GRAND FINAL",
                tA: teams[0],
                tB: teams[1],
                sA: 0, sB: 0, done: false
            }];
        } else {
            const maxGamesPerTeam = players.length >= 9 ? 3 : null;
            matches = buildRoundRobin(teams, maxGamesPerTeam);
        }
    } else {
        format = "mixer";
        teams = null;
        matches = buildMixerDoubles(players);
    }

    return { format, teams, matches, knockouts, players };
};
