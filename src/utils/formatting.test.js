import { describe, it, expect } from 'vitest';
import { getGradient, avatarGradients } from './formatting';

describe('getGradient', () => {
    it('should return a default gradient if no name is provided', () => {
        expect(getGradient(null)).toBe(avatarGradients[0]);
        expect(getGradient('')).toBe(avatarGradients[0]);
    });

    it('should return deterministic gradients for the same name', () => {
        const name = "Alice";
        const g1 = getGradient(name);
        const g2 = getGradient(name);
        expect(g1).toBe(g2);

        // Ensure different names get potentially different gradients
        const g3 = getGradient("Bob");
        // Statistically they could be the same, but for these two they are likely different
        // We just want to check g1 is consistent.
        expect(getGradient("Alice")).toBe(g1);
    });

    it('should rotate through gradients', () => {
        const results = new Set();
        // Check 50 random strings to see if we use multiple gradients
        for (let i = 0; i < 50; i++) {
            results.add(getGradient("Player" + i));
        }
        expect(results.size).toBeGreaterThan(1);
    });
});
