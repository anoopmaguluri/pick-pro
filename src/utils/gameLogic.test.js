import { processMatches, buildKnockouts, determineStatus } from './gameLogic';
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
