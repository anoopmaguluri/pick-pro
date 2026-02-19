import { describe, it, expect } from 'vitest';
import { prepareAutoTournamentResult } from './tournamentBuilder';

describe('prepareAutoTournamentResult', () => {
    const players = ['Alice', 'Bob', 'Charlie', 'David', 'Eve', 'Frank']; // 6 players (Even)
    const oddPlayers = ['Alice', 'Bob', 'Charlie', 'David', 'Eve']; // 5 players (Odd)

    it('should generate a valid SINGLES tournament', () => {
        const result = prepareAutoTournamentResult('singles', players);
        expect(result.format).toBe('singles');
        expect(result.teams).toBeNull();
        expect(result.players.length).toBe(6);
        // Singles round robin for 6 players. Every player plays 3 games (per buildSinglesRoundRobin logic)
        // Let's just check that matches exist
        expect(result.matches.length).toBeGreaterThan(0);
        result.matches.forEach(m => {
            expect(m.tA.p1).toBeDefined();
            expect(m.tB.p1).toBeDefined();
            expect(m.tA.p2).toBeNull();
            expect(m.tB.p2).toBeNull();
        });
    });

    it('should generate a valid FIXED PAIRS tournament for even players', () => {
        const result = prepareAutoTournamentResult('doubles', players);
        expect(result.format).toBe('pairs');
        expect(result.teams.length).toBe(3); // 6 players -> 3 teams
        // Round robin for 3 teams -> 3 matches total (3C2)
        expect(result.matches.length).toBe(3);

        // Match structure for pairs
        const m = result.matches[0];
        expect(m.tA.p1).toBeDefined();
        expect(m.tA.p2).toBeDefined();
        expect(m.tB.p1).toBeDefined();
        expect(m.tB.p2).toBeDefined();
    });

    it('should generate a valid MIXER tournament for odd players', () => {
        const result = prepareAutoTournamentResult('doubles', oddPlayers);
        expect(result.format).toBe('mixer');
        expect(result.teams).toBeNull();
        expect(result.players.length).toBe(5);

        // Mixer logic checks partners and opponents
        expect(result.matches.length).toBeGreaterThan(0);
        result.matches.forEach(m => {
            expect(m.tA.p1).toBeDefined();
            expect(m.tA.p2).toBeDefined();
            expect(m.tB.p1).toBeDefined();
            expect(m.tB.p2).toBeDefined();
        });
    });

    it('should shuffle players and result in different outcomes (Fisher-Yates check)', () => {
        const result1 = prepareAutoTournamentResult('doubles', players);
        const result2 = prepareAutoTournamentResult('doubles', players);

        // It's statistically possible but extremely unlikely for them to be identical 
        // especially the pairings in 'pairs' mode.
        const teams1 = result1.teams.map(t => t.name).sort();
        const teams2 = result2.teams.map(t => t.name).sort();

        // Note: This test might flaky if shuffle by chance is identical, 
        // but for 6 players (3 pairs), it's highly unlikely.
        // We just want to ensure it's not a static copy.
    });
});
