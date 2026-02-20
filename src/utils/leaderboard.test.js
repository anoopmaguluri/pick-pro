import { describe, it, expect } from 'vitest';
import {
    buildPlayersPreview,
    buildLeaderboardDeltasFromMatch,
    buildEncodedLeaderboardFromTournaments,
    leaderboardRowsFromEncoded,
} from './leaderboard';

describe('leaderboard utils', () => {
    it('buildPlayersPreview should dedupe and cap preview', () => {
        const result = buildPlayersPreview(['A', 'B', 'A', 'C', 'D', 'E']);
        expect(result.playersPreview).toEqual(['A', 'B', 'C', 'D']);
        expect(result.playerCount).toBe(5);
    });

    it('buildLeaderboardDeltasFromMatch should emit per-player deltas', () => {
        const deltas = buildLeaderboardDeltasFromMatch({
            tA: { p1: 'Alice', p2: 'Bob' },
            tB: { p1: 'Cara', p2: 'Dan' },
            sA: 11,
            sB: 7,
        });

        expect(deltas).toHaveLength(4);
        const alice = deltas.find((d) => d.name === 'Alice');
        const cara = deltas.find((d) => d.name === 'Cara');

        expect(alice).toMatchObject({ p: 1, w: 1, l: 0, pd: 4, pf: 11, pa: 7 });
        expect(cara).toMatchObject({ p: 1, w: 0, l: 1, pd: -4, pf: 7, pa: 11 });
    });

    it('buildEncodedLeaderboardFromTournaments should aggregate finished matches', () => {
        const tournaments = {
            t1: {
                matches: [
                    {
                        done: true,
                        tA: { p1: 'Alice', p2: null, name: 'Alice' },
                        tB: { p1: 'Bob', p2: null, name: 'Bob' },
                        sA: 11,
                        sB: 9,
                    },
                ],
                knockouts: [],
            },
            t2: {
                matches: [],
                knockouts: [
                    {
                        done: true,
                        tA: { p1: 'Alice', p2: null, name: 'Alice' },
                        tB: { p1: 'Cara', p2: null, name: 'Cara' },
                        sA: 8,
                        sB: 11,
                    },
                ],
            },
        };

        const encoded = buildEncodedLeaderboardFromTournaments(tournaments);
        const rows = leaderboardRowsFromEncoded(encoded);

        const alice = rows.find((r) => r.name === 'Alice');
        const bob = rows.find((r) => r.name === 'Bob');
        const cara = rows.find((r) => r.name === 'Cara');

        expect(alice).toMatchObject({ p: 2, w: 1, l: 1, pd: -1 });
        expect(bob).toMatchObject({ p: 1, w: 0, l: 1, pd: -2 });
        expect(cara).toMatchObject({ p: 1, w: 1, l: 0, pd: 3 });
    });
});
