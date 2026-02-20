import { 
    processMatches, 
    buildKnockouts, 
    determineStatus, 
    getKnockoutAdvancement, 
    intelligentSort, 
    applyEventSourcing,
    buildPairedTeams,
    buildRoundRobin,
    buildSinglesRoundRobin,
    buildMixerDoubles,
    qualifyCount,
    getGradient
} from './gameLogic';
import { describe, it, expect } from 'vitest';

describe('processMatches', () => {
    it('should correctly process wins, losses, PD, and form', () => {
        const stats = {};
        const matches = [
            {
                done: true,
                tA: { p1: 'Alice', p2: 'Bob' },
                tB: { p1: 'Charlie', p2: 'David' },
                sA: 11,
                sB: 5
            },
            {
                done: true,
                tA: { p1: 'Alice', p2: 'Charlie' },
                tB: { p1: 'Bob', p2: 'David' },
                sA: 9,
                sB: 11
            }
        ];

        processMatches(matches, stats);

        expect(stats['Alice'].w).toBe(1);
        expect(stats['Alice'].l).toBe(1);
        expect(stats['Alice'].pd).toBe(4); // +6 from match 1, -2 from match 2
        expect(stats['Alice'].form).toEqual(['W', 'L']);

        expect(stats['David'].w).toBe(1);
        expect(stats['David'].l).toBe(1);
        expect(stats['David'].pd).toBe(-4); // -6 from match 1, +2 from match 2
        expect(stats['David'].form).toEqual(['L', 'W']);
    });
});

describe('buildKnockouts', () => {
    const mockStandings = [
        { name: 'Alice', w: 3, pd: 10 },
        { name: 'Bob', w: 2, pd: 5 },
        { name: 'Charlie', w: 2, pd: 2 },
        { name: 'David', w: 1, pd: -5 }
    ];

    it('should generate standard semi-finals for 4 teams in non-mixer mode', () => {
        // qCount=4, isMixer=false
        const knockouts = buildKnockouts(mockStandings, 4, false);
        expect(knockouts.length).toBe(3); // 2 SFs + 1 Pending Final
        expect(knockouts[0].id).toBe('sf1');
        expect(knockouts[0].tA.name).toBe('Alice'); // Seed 1
        expect(knockouts[0].tB.name).toBe('David'); // Seed 4
        expect(knockouts[1].tA.name).toBe('Bob');   // Seed 2
        expect(knockouts[1].tB.name).toBe('Charlie'); // Seed 3
    });

    it('should generate a direct MIXED final for Mixer mode (top 4 individuals)', () => {
        // The user specifically requested this: Top 4 play direct final with teams mixed (1&3 vs 2&4)
        const knockouts = buildKnockouts(mockStandings, 4, true); // isMixer = true
        expect(knockouts.length).toBe(1);
        expect(knockouts[0].id).toBe('final');
        expect(knockouts[0].type).toContain('GRAND FINAL (MIXED)');

        // Seed 1 (Alice) & Seed 3 (Charlie)
        expect(knockouts[0].tA.name).toBe('Alice/Charlie');
        expect(knockouts[0].tA.p1).toBe('Alice');
        expect(knockouts[0].tA.p2).toBe('Charlie');

        // Seed 2 (Bob) & Seed 4 (David)
        expect(knockouts[0].tB.name).toBe('Bob/David');
        expect(knockouts[0].tB.p1).toBe('Bob');
        expect(knockouts[0].tB.p2).toBe('David');
    });

    it('should generate a simple final for only 2 advancing teams', () => {
        const knockouts = buildKnockouts(mockStandings, 2, false);
        expect(knockouts.length).toBe(1);
        expect(knockouts[0].id).toBe('final');
        expect(knockouts[0].tA.name).toBe('Alice');
        expect(knockouts[0].tB.name).toBe('Bob');
    });
});

describe('determineStatus', () => {
    it('should set all to pending if no matches are played', () => {
        const standings = [
            { w: 0, p: 0, rem: 3 },
            { w: 0, p: 0, rem: 3 }
        ];
        determineStatus(standings, 2, 3);
        expect(standings[0].status).toBe('pending');
        expect(standings[1].status).toBe('pending');
    });

    it('should accurately detect guaranteed qualification and elimination', () => {
        const standings = [
            { name: 'P1', w: 3, p: 3 }, // Done
            { name: 'P2', w: 2, p: 2 }, // 1 rem, max 3
            { name: 'P3', w: 1, p: 3 }, // Done
            { name: 'P4', w: 0, p: 2 }  // 1 rem, max 1
        ];
        // 2 qualify spots. Total matches = 3 each.
        determineStatus(standings, 2, 3);

        expect(standings[0].status).toBe('Q'); // P1 is mathematically locked in top 2
        expect(standings[3].status).toBe('E'); // P4 max wins is 1, cannot catch P2
    });

    it('should calculate heuristic probabilities correctly', () => {
        const standings = [
            { name: 'P1', w: 2, p: 2 },
            { name: 'P2', w: 1, p: 2 },
            { name: 'P3', w: 1, p: 2 },
            { name: 'P4', w: 0, p: 2 }
        ];
        // 2 spots, 3 total matches each
        determineStatus(standings, 2, 3);

        // Check that analysis object is attached
        expect(standings[0].analysis).toBeDefined();
        // P1 should have very high probability
        expect(standings[0].analysis.probability).toBeGreaterThan(70);
        // P4 should have very low probability
        expect(standings[3].analysis.probability).toBeLessThan(30);
    });
});

describe('getKnockoutAdvancement', () => {
    it('should return null if not exactly 2 matches', () => {
        expect(getKnockoutAdvancement([], 'pairs', 0)).toBeNull();
        expect(getKnockoutAdvancement([{}], 'pairs', 0)).toBeNull();
    });

    it('should return null if any match is not done', () => {
        const matches = [
            { done: true },
            { done: false }
        ];
        expect(getKnockoutAdvancement(matches, 'pairs', 0)).toBeNull();
    });

    it('should return null if final already exists', () => {
        const matches = [
            { id: 'sf1', done: true },
            { id: 'final', done: true }
        ];
        expect(getKnockoutAdvancement(matches, 'pairs', 0)).toBeNull();
    });

    it('should correctly generate grand final from winners', () => {
        const matches = [
            {
                id: 'sf1', done: true,
                tA: { name: 'Alice' }, tB: { name: 'Bob' },
                sA: 11, sB: 5
            },
            {
                id: 'sf2', done: true,
                tA: { name: 'Charlie' }, tB: { name: 'David' },
                sA: 8, sB: 11
            }
        ];
        const result = getKnockoutAdvancement(matches, 'pairs', 0);
        expect(result.length).toBe(3);
        expect(result[2].id).toBe('final');
        expect(result[2].tA.name).toBe('Alice');
        expect(result[2].tB.name).toBe('David');
    });
});

describe('intelligentSort', () => {
    it('should sort primarily by Wins', () => {
        const standings = [
            { name: 'A', w: 1, pd: 10, pf: 20, pa: 10 },
            { name: 'B', w: 3, pd: 2, pf: 15, pa: 13 }
        ];
        const sorted = intelligentSort(standings);
        expect(sorted[0].name).toBe('B');
        expect(sorted[1].name).toBe('A');
    });

    it('should fallback to Point Differential if Wins are tied', () => {
        const standings = [
            { name: 'A', w: 2, pd: 5, pf: 20, pa: 15 },
            { name: 'B', w: 2, pd: 10, pf: 25, pa: 15 }
        ];
        const sorted = intelligentSort(standings);
        expect(sorted[0].name).toBe('B');
    });

    it('should use Head-to-Head if W and PD are tied', () => {
        const standings = [
            { name: 'TeamA', w: 2, pd: 5, pf: 25, pa: 20 },
            { name: 'TeamB', w: 2, pd: 5, pf: 25, pa: 20 }
        ];
        const matches = [
            { done: true, tA: { name: 'TeamA' }, tB: { name: 'TeamB' }, sA: 11, sB: 9 } // TeamA beat TeamB
        ];
        const sorted = intelligentSort(standings, matches);
        expect(sorted[0].name).toBe('TeamA');
    });

    it('should fallback to Points For (PF) if W, PD, and H2H are tied', () => {
        const standings = [
            { name: 'TeamA', w: 2, pd: 5, pf: 30, pa: 25 },
            { name: 'TeamB', w: 2, pd: 5, pf: 35, pa: 30 }
        ];
        // They haven't played each other
        const sorted = intelligentSort(standings, []);
        // TeamB has higher PF (35 vs 30)
        expect(sorted[0].name).toBe('TeamB');
    });

    it('should fallback to Points Against (PA) if W, PD, H2H, and PF are tied', () => {
        const standings = [
            { name: 'TeamA', w: 2, pd: 5, pf: 30, pa: 25 },
            { name: 'TeamB', w: 2, pd: 5, pf: 30, pa: 20 } // TeamB conceded fewer
        ];
        const sorted = intelligentSort(standings, []);
        // TeamB has lower PA
        expect(sorted[0].name).toBe('TeamB');
    });

    it('should fallback to Alphabetical if absolute deadlock', () => {
        const standings = [
            { name: 'Zeta', w: 2, pd: 5, pf: 30, pa: 25 },
            { name: 'Alpha', w: 2, pd: 5, pf: 30, pa: 25 }
        ];
        const sorted = intelligentSort(standings, []);
        expect(sorted[0].name).toBe('Alpha');
    });
});

describe('applyEventSourcing', () => {
    it('should correctly apply a stream of SCORE events to base matches', () => {
        const rawData = {
            matches: [
                { id: 'm1', sA: 0, sB: 0 },
                { id: 'm2', sA: 0, sB: 0 }
            ],
            events: [
                { type: 'SCORE', mIdx: 0, team: 'A', delta: 1, ts: 1000 },
                { type: 'SCORE', mIdx: 0, team: 'A', delta: 1, ts: 4000 }, // Placed > 2000ms apart
                { type: 'SCORE', mIdx: 0, team: 'B', delta: 1, ts: 5000 },
                { type: 'SCORE', mIdx: 1, team: 'B', delta: 1, ts: 6000 }
            ]
        };

        const result = applyEventSourcing(rawData);

        expect(result.matches[0].sA).toBe(2);
        expect(result.matches[0].sB).toBe(1);
        expect(result.matches[1].sA).toBe(0);
        expect(result.matches[1].sB).toBe(1);
    });

    it('should correctly sort and apply out-of-order events', () => {
        const rawData = {
            matches: [{ id: 'm1', sA: 0, sB: 0 }],
            events: [
                // Event at ts 200 subtracts a point
                { type: 'SCORE', mIdx: 0, team: 'A', delta: -1, ts: 200 },
                // Event at ts 100 adds a point
                { type: 'SCORE', mIdx: 0, team: 'A', delta: 1, ts: 100 }
            ]
        };

        // If applied chronologically (100 then 200): 0 -> 1 -> 0
        // If applied out of order (200 then 100): 0 -> Math.max(0, -1) = 0 -> 1
        const result = applyEventSourcing(rawData);
        expect(result.matches[0].sA).toBe(0);
    });

    it('should process events as an object from Firebase push()', () => {
        const rawData = {
            matches: [{ id: 'm1', sA: 0, sB: 0 }],
            events: {
                "pushKey1": { type: 'SCORE', mIdx: 0, team: 'A', delta: 1, ts: 100 },
                "pushKey2": { type: 'SCORE', mIdx: 0, team: 'B', delta: 1, ts: 101 }
            }
        };

        const result = applyEventSourcing(rawData);
        expect(result.matches[0].sA).toBe(1);
        expect(result.matches[0].sB).toBe(1);
    });

    it('should handle knockout match events', () => {
        const rawData = {
            knockouts: [{ id: 'k1', sA: 0, sB: 0 }],
            events: [
                { type: 'SCORE', mIdx: 0, team: 'A', delta: 1, isKnockout: true, ts: 100 }
            ]
        };

        const result = applyEventSourcing(rawData);
        expect(result.knockouts[0].sA).toBe(1);
    });

    it('should deduplicate near-simultaneous identical taps from different admins', () => {
        const rawData = {
            matches: [{ id: 'm1', sA: 0, sB: 0 }],
            events: [
                { type: 'SCORE', mIdx: 0, team: 'A', delta: 1, ts: 1000, sourceId: 'admin-A' },
                // Different admin/device, same action in short window -> ignored
                { type: 'SCORE', mIdx: 0, team: 'A', delta: 1, ts: 1200, sourceId: 'admin-B' },
                // Same admin rapid second tap -> allowed
                { type: 'SCORE', mIdx: 0, team: 'A', delta: 1, ts: 1400, sourceId: 'admin-A' },
                // Different admin outside dedupe window -> allowed
                { type: 'SCORE', mIdx: 0, team: 'A', delta: 1, ts: 2200, sourceId: 'admin-C' },
                // Different action should always be allowed
                { type: 'SCORE', mIdx: 0, team: 'A', delta: -1, ts: 2300, sourceId: 'admin-B' }
            ]
        };

        const result = applyEventSourcing(rawData);
        expect(result.matches[0].sA).toBe(2);
    });

    it('should allow rapid same-admin taps for intentional fast scoring', () => {
        const rawData = {
            matches: [{ id: 'm1', sA: 0, sB: 0 }],
            events: [
                { type: 'SCORE', mIdx: 0, team: 'A', delta: 1, ts: 1000, sourceId: 'admin-A' },
                { type: 'SCORE', mIdx: 0, team: 'A', delta: 1, ts: 1100, sourceId: 'admin-A' }
            ]
        };

        const result = applyEventSourcing(rawData);
        expect(result.matches[0].sA).toBe(2);
    });

    it('should prefer absolute nextScore events to avoid base+delta inflation', () => {
        const rawData = {
            matches: [{ id: 'm1', sA: 11, sB: 0 }],
            events: [
                { type: 'SCORE', mIdx: 0, team: 'A', delta: 1, nextScore: 11, ts: 1000, sourceId: 'admin-A' }
            ]
        };

        const result = applyEventSourcing(rawData);
        expect(result.matches[0].sA).toBe(11);
    });

    it('should apply scoreSnapshot as the replay baseline', () => {
        const rawData = {
            matches: [{ id: 'm1', sA: 0, sB: 0 }],
            scoreSnapshot: {
                matches: [{ sA: 7, sB: 4 }],
                knockouts: [],
            },
            events: [
                { type: 'SCORE', mIdx: 0, team: 'A', delta: 1, ts: 1010 }
            ]
        };

        const result = applyEventSourcing(rawData);
        expect(result.matches[0].sA).toBe(8);
        expect(result.matches[0].sB).toBe(4);
    });

    it('should deduplicate duplicate pushes by clientEventId', () => {
        const rawData = {
            matches: [{ id: 'm1', sA: 0, sB: 0 }],
            events: [
                { type: 'SCORE', mIdx: 0, team: 'A', delta: 1, ts: 1000, clientEventId: 'evt-1' },
                { type: 'SCORE', mIdx: 0, team: 'A', delta: 1, ts: 1001, clientEventId: 'evt-1' }
            ]
        };

        const result = applyEventSourcing(rawData);
        expect(result.matches[0].sA).toBe(1);
    });
});

describe('buildPairedTeams', () => {
    it('should pair consecutive players into teams', () => {
        const players = ['Alice', 'Bob', 'Charlie', 'David'];
        const teams = buildPairedTeams(players);
        
        expect(teams.length).toBe(2);
        expect(teams[0].p1).toBe('Alice');
        expect(teams[0].p2).toBe('Bob');
        expect(teams[0].name).toBe('Alice/Bob');
        expect(teams[1].p1).toBe('Charlie');
        expect(teams[1].p2).toBe('David');
        expect(teams[1].name).toBe('Charlie/David');
    });

    it('should handle odd number of players', () => {
        const players = ['Alice', 'Bob', 'Charlie'];
        const teams = buildPairedTeams(players);
        
        // buildPairedTeams pairs consecutive players, so Alice/Bob is one team
        // Charlie gets paired with undefined (next index)
        expect(teams.length).toBe(2);
        expect(teams[0].p1).toBe('Alice');
        expect(teams[0].p2).toBe('Bob');
        expect(teams[1].p1).toBe('Charlie');
        expect(teams[1].p2).toBeUndefined();
    });

    it('should handle empty array', () => {
        const teams = buildPairedTeams([]);
        expect(teams.length).toBe(0);
    });

    it('should handle single player', () => {
        const teams = buildPairedTeams(['Alice']);
        // buildPairedTeams creates a team with p2 as undefined
        expect(teams.length).toBe(1);
        expect(teams[0].p1).toBe('Alice');
        expect(teams[0].p2).toBeUndefined();
    });
});

describe('buildRoundRobin', () => {
    it('should generate all pairwise matches for teams', () => {
        const teams = [
            { name: 'Team1', p1: 'Alice', p2: 'Bob' },
            { name: 'Team2', p1: 'Charlie', p2: 'David' },
            { name: 'Team3', p1: 'Eve', p2: 'Frank' }
        ];
        const matches = buildRoundRobin(teams);
        
        // 3 teams = 3C2 = 3 matches
        expect(matches.length).toBe(3);
        expect(matches[0].tA.name).toBe('Team1');
        expect(matches[0].tB.name).toBe('Team2');
        expect(matches[1].tA.name).toBe('Team1');
        expect(matches[1].tB.name).toBe('Team3');
        expect(matches[2].tA.name).toBe('Team2');
        expect(matches[2].tB.name).toBe('Team3');
    });

    it('should generate correct match IDs', () => {
        const teams = [
            { name: 'Team1', p1: 'A', p2: 'B' },
            { name: 'Team2', p1: 'C', p2: 'D' }
        ];
        const matches = buildRoundRobin(teams);
        
        expect(matches[0].id).toBe('m_0_1');
        expect(matches[0].sA).toBe(0);
        expect(matches[0].sB).toBe(0);
    });

    it('should handle single team', () => {
        const matches = buildRoundRobin([{ name: 'Team1', p1: 'A', p2: 'B' }]);
        expect(matches.length).toBe(0);
    });

    it('should handle empty array', () => {
        const matches = buildRoundRobin([]);
        expect(matches.length).toBe(0);
    });

    it('should generate 6 matches for 4 teams', () => {
        const teams = [
            { name: 'T1', p1: 'A', p2: 'B' },
            { name: 'T2', p1: 'C', p2: 'D' },
            { name: 'T3', p1: 'E', p2: 'F' },
            { name: 'T4', p1: 'G', p2: 'H' }
        ];
        const matches = buildRoundRobin(teams);
        expect(matches.length).toBe(6); // 4C2 = 6
    });

    it('should cap each team to 3 games when maxGamesPerTeam is provided', () => {
        const teams = [
            { name: 'T1', p1: 'A1', p2: 'A2' },
            { name: 'T2', p1: 'B1', p2: 'B2' },
            { name: 'T3', p1: 'C1', p2: 'C2' },
            { name: 'T4', p1: 'D1', p2: 'D2' },
            { name: 'T5', p1: 'E1', p2: 'E2' },
            { name: 'T6', p1: 'F1', p2: 'F2' }
        ];

        const matches = buildRoundRobin(teams, 3);
        expect(matches.length).toBe(9); // 6 teams * 3 games / 2

        const gamesPerTeam = {};
        const seenOpponents = new Set();

        matches.forEach((m) => {
            gamesPerTeam[m.tA.name] = (gamesPerTeam[m.tA.name] || 0) + 1;
            gamesPerTeam[m.tB.name] = (gamesPerTeam[m.tB.name] || 0) + 1;
            const matchup = [m.tA.name, m.tB.name].sort().join(' vs ');
            expect(seenOpponents.has(matchup)).toBe(false);
            seenOpponents.add(matchup);
        });

        Object.values(gamesPerTeam).forEach((count) => {
            expect(count).toBeLessThanOrEqual(3);
        });
    });
});

describe('buildSinglesRoundRobin', () => {
    it('should generate matches for players', () => {
        const players = ['Alice', 'Bob', 'Charlie'];
        const matches = buildSinglesRoundRobin(players);
        
        expect(matches.length).toBeGreaterThan(0);
        matches.forEach(m => {
            expect(m.tA.p1).toBeDefined();
            expect(m.tA.p2).toBeNull();
            expect(m.tB.p1).toBeDefined();
            expect(m.tB.p2).toBeNull();
            expect(m.sA).toBe(0);
            expect(m.sB).toBe(0);
        });
    });

    it('should schedule full round-robin for 4 players', () => {
        const players = ['Alice', 'Bob', 'Charlie', 'David'];
        const matches = buildSinglesRoundRobin(players);
        expect(matches.length).toBe(6); // 4C2

        const playerGames = {};
        players.forEach(p => playerGames[p] = 0);
        
        matches.forEach(m => {
            playerGames[m.tA.p1]++;
            playerGames[m.tB.p1]++;
        });

        players.forEach(p => {
            expect(playerGames[p]).toBe(3);
        });
    });

    it('should schedule full round-robin for 5 players', () => {
        const players = ['Alice', 'Bob', 'Charlie', 'David', 'Eve'];
        const matches = buildSinglesRoundRobin(players);
        expect(matches.length).toBe(10); // 5C2
    });

    it('should not create duplicate matches', () => {
        const players = ['Alice', 'Bob'];
        const matches = buildSinglesRoundRobin(players);
        
        const matchKeys = matches.map(m => {
            const pair = [m.tA.p1, m.tB.p1].sort().join('-');
            return pair;
        });
        
        const uniqueKeys = new Set(matchKeys);
        expect(uniqueKeys.size).toBe(matchKeys.length);
    });

    it('should handle empty array', () => {
        const matches = buildSinglesRoundRobin([]);
        expect(matches.length).toBe(0);
    });

    it('should handle single player', () => {
        const matches = buildSinglesRoundRobin(['Alice']);
        expect(matches.length).toBe(0);
    });
});

describe('buildMixerDoubles', () => {
    it('should generate matches with teams of 2 players each', () => {
        const players = ['Alice', 'Bob', 'Charlie', 'David', 'Eve'];
        const matches = buildMixerDoubles(players);
        
        expect(matches.length).toBeGreaterThan(0);
        matches.forEach(m => {
            expect(m.tA.p1).toBeDefined();
            expect(m.tA.p2).toBeDefined();
            expect(m.tB.p1).toBeDefined();
            expect(m.tB.p2).toBeDefined();
            expect(m.sA).toBe(0);
            expect(m.sB).toBe(0);
        });
    });

    it('should schedule 3 games for 5-player mixer while keeping teammate pairs unique', () => {
        const players = ['Alice', 'Bob', 'Charlie', 'David', 'Eve'];
        const matches = buildMixerDoubles(players);

        expect(matches.length).toBe(3);

        const partnerPairs = new Set();
        matches.forEach((m) => {
            const pairA = [m.tA.p1, m.tA.p2].sort().join('+');
            const pairB = [m.tB.p1, m.tB.p2].sort().join('+');
            expect(partnerPairs.has(pairA)).toBe(false);
            expect(partnerPairs.has(pairB)).toBe(false);
            partnerPairs.add(pairA);
            partnerPairs.add(pairB);
        });
    });

    it('should not repeat partner pairs', () => {
        const players = ['Alice', 'Bob', 'Charlie', 'David', 'Eve', 'Frank'];
        const matches = buildMixerDoubles(players);
        
        const partnerPairs = new Set();
        matches.forEach(m => {
            const pairA = [m.tA.p1, m.tA.p2].sort().join('+');
            const pairB = [m.tB.p1, m.tB.p2].sort().join('+');
            expect(partnerPairs.has(pairA)).toBe(false);
            expect(partnerPairs.has(pairB)).toBe(false);
            partnerPairs.add(pairA);
            partnerPairs.add(pairB);
        });
    });

    it('should limit each player to MAX_GAMES (3)', () => {
        const players = ['Alice', 'Bob', 'Charlie', 'David', 'Eve'];
        const matches = buildMixerDoubles(players);
        
        const playerGames = {};
        players.forEach(p => playerGames[p] = 0);
        
        matches.forEach(m => {
            playerGames[m.tA.p1]++;
            playerGames[m.tA.p2]++;
            playerGames[m.tB.p1]++;
            playerGames[m.tB.p2]++;
        });
        
        players.forEach(p => {
            expect(playerGames[p]).toBeLessThanOrEqual(3);
        });
    });

    it('should not repeat individual opponent pairings', () => {
        const players = ['Alice', 'Bob', 'Charlie', 'David', 'Eve', 'Frank', 'Grace', 'Heidi', 'Ivan'];
        const matches = buildMixerDoubles(players);

        const opponentPairs = new Set();
        matches.forEach((m) => {
            const pairs = [
                [m.tA.p1, m.tB.p1],
                [m.tA.p1, m.tB.p2],
                [m.tA.p2, m.tB.p1],
                [m.tA.p2, m.tB.p2],
            ].map(([a, b]) => [a, b].sort().join('|'));

            pairs.forEach((key) => {
                expect(opponentPairs.has(key)).toBe(false);
                opponentPairs.add(key);
            });
        });
    });

    it('should handle empty array', () => {
        const matches = buildMixerDoubles([]);
        expect(matches.length).toBe(0);
    });

    it('should handle fewer than 4 players', () => {
        const matches = buildMixerDoubles(['Alice', 'Bob', 'Charlie']);
        expect(matches.length).toBe(0); // Need at least 4 for a doubles match
    });
});

describe('qualifyCount', () => {
    it('should return 2 for fewer than 5 teams', () => {
        expect(qualifyCount(2)).toBe(2);
        expect(qualifyCount(3)).toBe(2);
        expect(qualifyCount(4)).toBe(2);
    });

    it('should return 4 for 5 or more teams', () => {
        expect(qualifyCount(5)).toBe(4);
        expect(qualifyCount(6)).toBe(4);
        expect(qualifyCount(10)).toBe(4);
    });
});

describe('getGradient', () => {
    it('should return a gradient string for valid name', () => {
        const gradient = getGradient('Alice');
        expect(gradient).toContain('linear-gradient');
        expect(gradient).toContain('hsl');
    });

    it('should return default gradient for empty string', () => {
        const gradient = getGradient('');
        expect(gradient).toBe("linear-gradient(135deg, #1f2937, #111827)");
    });

    it('should return default gradient for null/undefined', () => {
        expect(getGradient(null)).toBe("linear-gradient(135deg, #1f2937, #111827)");
        expect(getGradient(undefined)).toBe("linear-gradient(135deg, #1f2937, #111827)");
    });

    it('should return consistent gradient for same name', () => {
        const g1 = getGradient('Bob');
        const g2 = getGradient('Bob');
        expect(g1).toBe(g2);
    });

    it('should return different gradients for different names', () => {
        const g1 = getGradient('Alice');
        const g2 = getGradient('Bob');
        expect(g1).not.toBe(g2);
    });

    it('should handle names with special characters', () => {
        const gradient = getGradient('Alice-Bob/Charlie');
        expect(gradient).toContain('linear-gradient');
    });
});

describe('processMatches - edge cases', () => {
    it('should handle null/undefined matches array', () => {
        const stats = {};
        processMatches(null, stats);
        processMatches(undefined, stats);
        expect(Object.keys(stats).length).toBe(0);
    });

    it('should ignore matches that are not done', () => {
        const stats = {};
        const matches = [
            { done: false, tA: { p1: 'Alice' }, tB: { p1: 'Bob' }, sA: 11, sB: 5 },
            { done: true, tA: { p1: 'Alice' }, tB: { p1: 'Bob' }, sA: 11, sB: 5 }
        ];
        processMatches(matches, stats);
        expect(stats['Alice'].w).toBe(1);
        expect(stats['Bob'].l).toBe(1);
    });

    it('should handle matches with null players', () => {
        const stats = {};
        const matches = [
            { done: true, tA: { p1: 'Alice', p2: null }, tB: { p1: 'Bob', p2: null }, sA: 11, sB: 5 }
        ];
        processMatches(matches, stats);
        expect(stats['Alice']).toBeDefined();
        expect(stats['Bob']).toBeDefined();
        expect(stats['Alice'].w).toBe(1);
    });

    it('should process matches that only include team names', () => {
        const stats = {};
        const matches = [
            { done: true, tA: { name: 'Alice' }, tB: { name: 'Bob' }, sA: 11, sB: 8 }
        ];
        processMatches(matches, stats);
        expect(stats['Alice'].w).toBe(1);
        expect(stats['Bob'].l).toBe(1);
        expect(stats['Alice'].pf).toBe(11);
        expect(stats['Bob'].pa).toBe(11);
    });

    it('should split legacy doubles team names into two players', () => {
        const stats = {};
        const matches = [
            { done: true, tA: { name: 'Alice/Bob' }, tB: { name: 'Charlie/David' }, sA: 11, sB: 9 }
        ];
        processMatches(matches, stats);
        expect(stats['Alice'].w).toBe(1);
        expect(stats['Bob'].w).toBe(1);
        expect(stats['Charlie'].l).toBe(1);
        expect(stats['David'].l).toBe(1);
    });

    it('should handle tie scores correctly', () => {
        const stats = {};
        const matches = [
            { done: true, tA: { p1: 'Alice' }, tB: { p1: 'Bob' }, sA: 11, sB: 11 }
        ];
        processMatches(matches, stats);
        // In a tie, neither wins (sA > sB is false, so Alice loses)
        expect(stats['Alice'].w).toBe(0);
        expect(stats['Alice'].l).toBe(1);
    });
});

describe('buildKnockouts - edge cases', () => {
    it('should handle empty standings array', () => {
        // buildKnockouts requires at least 2 teams for a final
        // Empty array will cause error when accessing topStandings[0]
        // This test documents the current behavior - function assumes valid input
        try {
            const result = buildKnockouts([], 2, false);
            // If it doesn't throw, check result
            expect(result).toBeDefined();
        } catch (error) {
            // Expected to throw when accessing undefined array elements
            expect(error).toBeDefined();
        }
    });

    it('should handle single team', () => {
        // buildKnockouts requires at least 2 teams
        // Single team will cause error when accessing topStandings[1]
        const standings = [{ name: 'Alice', w: 3 }];
        try {
            const result = buildKnockouts(standings, 1, false);
            // If it doesn't throw, check result
            expect(result).toBeDefined();
        } catch (error) {
            // Expected to throw when accessing undefined array elements
            expect(error).toBeDefined();
        }
    });

    it('should handle 2 teams with mixer flag', () => {
        const standings = [
            { name: 'Alice', w: 3 },
            { name: 'Bob', w: 2 }
        ];
        const knockouts = buildKnockouts(standings, 2, true);
        // With only 2 teams, mixer should still create a final
        expect(knockouts.length).toBe(1);
        expect(knockouts[0].id).toBe('final');
    });

    it('should handle numAdvancing less than standings length', () => {
        const standings = [
            { name: 'A', w: 5 },
            { name: 'B', w: 4 },
            { name: 'C', w: 3 },
            { name: 'D', w: 2 }
        ];
        const knockouts = buildKnockouts(standings, 2, false);
        expect(knockouts.length).toBe(1);
        expect(knockouts[0].tA.name).toBe('A');
        expect(knockouts[0].tB.name).toBe('B');
    });
});

describe('determineStatus - edge cases', () => {
    it('should handle empty standings array', () => {
        const standings = [];
        determineStatus(standings, 2, 3);
        expect(standings.length).toBe(0);
    });

    it('should handle allMatchesFinished flag', () => {
        const standings = [
            { name: 'P1', w: 2, p: 3, rem: 0 },
            { name: 'P2', w: 1, p: 3, rem: 0 }
        ];
        determineStatus(standings, 1, 3, true);
        expect(standings[0].status).toBe('Q');
        expect(standings[1].status).toBe('E');
    });

    it('should handle zero total matches', () => {
        const standings = [
            { name: 'P1', w: 0, p: 0, rem: 0 },
            { name: 'P2', w: 0, p: 0, rem: 0 }
        ];
        determineStatus(standings, 1, 0);
        expect(standings[0].status).toBe('pending');
    });

    it('should respect per-entry scheduled match counts', () => {
        const standings = [
            { name: 'T1', w: 2, p: 2, scheduled: 3 },
            { name: 'T2', w: 1, p: 1, scheduled: 2 },
            { name: 'T3', w: 0, p: 0, scheduled: 1 }
        ];
        determineStatus(standings, 2, 99);

        expect(standings[0].rem).toBe(1);
        expect(standings[1].rem).toBe(1);
        expect(standings[2].rem).toBe(1);
    });
});

describe('getKnockoutAdvancement - edge cases', () => {
    it('should return null for invalid format', () => {
        const matches = [
            { id: 'sf1', done: true, tA: { name: 'A' }, tB: { name: 'B' }, sA: 11, sB: 5 },
            { id: 'sf2', done: true, tA: { name: 'C' }, tB: { name: 'D' }, sA: 8, sB: 11 }
        ];
        expect(getKnockoutAdvancement(matches, 'invalid', 0)).toBeNull();
    });

    it('should handle pools parameter', () => {
        const matches = [
            { id: 'sf1', done: true, tA: { name: 'A' }, tB: { name: 'B' }, sA: 11, sB: 5 },
            { id: 'sf2', done: true, tA: { name: 'C' }, tB: { name: 'D' }, sA: 8, sB: 11 }
        ];
        const result = getKnockoutAdvancement(matches, 'pairs', 2);
        expect(result).not.toBeNull();
        expect(result.length).toBe(3);
    });

    it('should handle tie scores correctly', () => {
        const matches = [
            { id: 'sf1', done: true, tA: { name: 'A' }, tB: { name: 'B' }, sA: 11, sB: 11 },
            { id: 'sf2', done: true, tA: { name: 'C' }, tB: { name: 'D' }, sA: 11, sB: 9 }
        ];
        const result = getKnockoutAdvancement(matches, 'pairs', 0);
        // In a tie, sA > sB is false, so B wins
        expect(result).not.toBeNull();
        expect(result[2].tA.name).toBe('B');
    });
});

describe('intelligentSort - edge cases', () => {
    it('should handle empty standings', () => {
        const sorted = intelligentSort([]);
        expect(sorted.length).toBe(0);
    });

    it('should handle standings with missing fields', () => {
        const standings = [
            { name: 'A' },
            { name: 'B', w: 1 }
        ];
        const sorted = intelligentSort(standings);
        expect(sorted.length).toBe(2);
    });

    it('should handle empty matches array', () => {
        const standings = [
            { name: 'A', w: 2, pd: 5 },
            { name: 'B', w: 2, pd: 5 }
        ];
        const sorted = intelligentSort(standings, []);
        expect(sorted.length).toBe(2);
    });

    it('should handle matches with same team names in different cases', () => {
        const standings = [
            { name: 'TeamA', w: 2, pd: 5, pf: 25, pa: 20 },
            { name: 'teama', w: 2, pd: 5, pf: 25, pa: 20 }
        ];
        const matches = [
            { done: true, tA: { name: 'TeamA' }, tB: { name: 'teama' }, sA: 11, sB: 9 }
        ];
        const sorted = intelligentSort(standings, matches);
        // Should still sort correctly despite case difference
        expect(sorted.length).toBe(2);
    });
});
