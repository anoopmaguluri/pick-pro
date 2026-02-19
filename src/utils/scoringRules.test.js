import { describe, it, expect } from 'vitest';
import { getMatchState, getPhaseLabel } from './scoringRules';

describe('getMatchState', () => {
    it('should correctly identify a winner (not in deuce)', () => {
        expect(getMatchState(11, 5).winner).toBe('A');
        expect(getMatchState(11, 5).phase).toBe('finished');
        expect(getMatchState(8, 11).winner).toBe('B');
        expect(getMatchState(8, 11).phase).toBe('finished');
    });

    it('should detect deuce at 10-10', () => {
        const state = getMatchState(10, 10);
        expect(state.phase).toBe('deuce');
        expect(state.isDeuceZone).toBe(true);
    });

    it('should handle advantage in deuce zone', () => {
        const state = getMatchState(11, 10);
        expect(state.phase).toBe('advantage');
        expect(state.advantageTeam).toBe('A');

        const stateB = getMatchState(10, 11);
        expect(stateB.phase).toBe('advantage');
        expect(stateB.advantageTeam).toBe('B');
    });

    it('should require a 2-point lead in deuce zone', () => {
        // 12-10 is finished
        const state = getMatchState(12, 10);
        expect(state.phase).toBe('finished');
        expect(state.winner).toBe('A');

        // 11-12 is not finished
        const stateOngoing = getMatchState(11, 12);
        expect(stateOngoing.phase).toBe('advantage');
    });

    it('should correctly label game point', () => {
        const gpA = getMatchState(10, 8);
        expect(gpA.gamePointTeam).toBe('A');

        const gpB = getMatchState(5, 10);
        expect(gpB.gamePointTeam).toBe('B');
    });
});

describe('getPhaseLabel', () => {
    it('should return correct labels', () => {
        expect(getPhaseLabel('deuce')).toBe('DEUCE');
        expect(getPhaseLabel('finished')).toBe('GAME');
        expect(getPhaseLabel('advantage', 'A', null, 'Alice', 'Bob')).toBe('ADV \u00b7 Alice');
        expect(getPhaseLabel('playing', null, 'B', 'Alice', 'Bob')).toBe('GAME PT \u00b7 Bob');
    });
});
