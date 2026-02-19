import {
    buildSinglesRoundRobin,
    buildPairedTeams,
    buildRoundRobin,
    buildMixerDoubles
} from "./gameLogic";

/**
 * Prepares the tournament data as a pure function.
 * 
 * @param {string} fmt - The tournament format ("singles" or "doubles")
 * @param {string[]} draftPlayers - List of players currently in the draft
 * @returns {Object} { format, teams, matches, players }
 */
export const prepareAutoTournamentResult = (fmt, draftPlayers) => {
    const players = [...draftPlayers];

    // Fisher-Yates shuffle
    for (let i = players.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [players[i], players[j]] = [players[j], players[i]];
    }

    const isEven = players.length % 2 === 0;
    const isDouble = fmt === "doubles";

    let format, teams, matches;

    if (!isDouble) {
        // SINGLES — individual 1v1 round-robin
        format = "singles";
        teams = null;
        matches = buildSinglesRoundRobin(players);
    } else if (isEven) {
        // EVEN + DOUBLES — fixed teams, team round-robin, team standings
        format = "pairs";
        teams = buildPairedTeams(players);
        matches = buildRoundRobin(teams);
    } else {
        // ODD + DOUBLES — mixer: unique teams, individual standings
        format = "mixer";
        teams = null;
        matches = buildMixerDoubles(players);
    }

    return { format, teams, matches, players };
};
