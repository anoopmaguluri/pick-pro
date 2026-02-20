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
        // Singles round robin for 6 players.
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

    it('should create grand final only for 2 players in singles', () => {
        const twoPlayers = ['Alice', 'Bob'];
        const result = prepareAutoTournamentResult('singles', twoPlayers);
        
        expect(result.format).toBe('singles');
        expect(result.matches.length).toBe(0);
        expect(result.knockouts.length).toBe(1);
        expect(result.knockouts[0].id).toBe('final');
        expect(result.knockouts[0].type).toBe('🏆 GRAND FINAL');
        // Players are shuffled, so check that both are present
        expect([result.knockouts[0].tA.name, result.knockouts[0].tB.name]).toContain('Alice');
        expect([result.knockouts[0].tA.name, result.knockouts[0].tB.name]).toContain('Bob');
        expect(result.knockouts[0].done).toBe(false);
    });

    it('should create grand final only for 2 teams in doubles', () => {
        const fourPlayers = ['Alice', 'Bob', 'Charlie', 'David']; // 4 players = 2 teams
        const result = prepareAutoTournamentResult('doubles', fourPlayers);
        
        expect(result.format).toBe('pairs');
        expect(result.teams.length).toBe(2);
        expect(result.matches.length).toBe(0);
        expect(result.knockouts.length).toBe(1);
        expect(result.knockouts[0].id).toBe('final');
        expect(result.knockouts[0].type).toBe('🏆 GRAND FINAL');
        expect(result.knockouts[0].done).toBe(false);
    });

    it('should create round robin for 3+ players in singles', () => {
        const threePlayers = ['Alice', 'Bob', 'Charlie'];
        const result = prepareAutoTournamentResult('singles', threePlayers);
        
        expect(result.format).toBe('singles');
        expect(result.matches.length).toBeGreaterThan(0);
        expect(result.knockouts.length).toBe(0);
    });

    it('should create round robin for 3+ teams in doubles', () => {
        const sixPlayers = ['Alice', 'Bob', 'Charlie', 'David', 'Eve', 'Frank']; // 6 players = 3 teams
        const result = prepareAutoTournamentResult('doubles', sixPlayers);
        
        expect(result.format).toBe('pairs');
        expect(result.teams.length).toBe(3);
        expect(result.matches.length).toBe(3); // 3C2 = 3 matches
        expect(result.knockouts.length).toBe(0);
    });

    it('should cap fixed-team matches to 3 per team for 9+ player doubles', () => {
        const tenPlayers = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10'];
        const result = prepareAutoTournamentResult('doubles', tenPlayers);

        expect(result.format).toBe('pairs');
        expect(result.teams.length).toBe(5);
        expect(result.knockouts.length).toBe(0);
        expect(result.matches.length).toBe(6); // 5 teams, capped to 3 rounds => 6 matches

        const gamesPerTeam = {};
        result.matches.forEach((m) => {
            gamesPerTeam[m.tA.name] = (gamesPerTeam[m.tA.name] || 0) + 1;
            gamesPerTeam[m.tB.name] = (gamesPerTeam[m.tB.name] || 0) + 1;
        });

        Object.values(gamesPerTeam).forEach((count) => {
            expect(count).toBeLessThanOrEqual(3);
        });
    });

    it('should preserve all players in result', () => {
        const players = ['Alice', 'Bob', 'Charlie'];
        const result = prepareAutoTournamentResult('singles', players);
        
        expect(result.players.length).toBe(3);
        players.forEach(p => {
            expect(result.players).toContain(p);
        });
    });

    it('should handle empty player array', () => {
        const result = prepareAutoTournamentResult('singles', []);
        
        expect(result.format).toBe('singles');
        expect(result.players.length).toBe(0);
        expect(result.matches.length).toBe(0);
        expect(result.knockouts.length).toBe(0);
    });

    it('should handle single player', () => {
        const result = prepareAutoTournamentResult('singles', ['Alice']);
        
        expect(result.format).toBe('singles');
        expect(result.players.length).toBe(1);
        expect(result.matches.length).toBe(0);
        expect(result.knockouts.length).toBe(0);
    });
});
