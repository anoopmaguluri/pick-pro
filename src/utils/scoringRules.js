/**
 * Pickleball match state calculator.
 *
 * Rules:
 *  - First to target points wins, must win by 2
 *  - Deuce at (target-1)-(target-1), then Advantage, then winner on next point
 *  - Game Point shown when one team is at (target-1), other is below (target-1)
 */

export const WIN_TARGET_OPTIONS = [11, 15, 21];
export const DEFAULT_WIN_TARGET = 11;

export function normalizeWinTarget(winTarget) {
    const parsed = parseInt(winTarget, 10);
    return WIN_TARGET_OPTIONS.includes(parsed) ? parsed : DEFAULT_WIN_TARGET;
}

export function getMatchState(sA, sB, winTarget = DEFAULT_WIN_TARGET) {
    const WIN_TARGET = normalizeWinTarget(winTarget);
    // Coerce to integers — guard against undefined/null from Firebase on fresh matches
    const a = parseInt(sA, 10) || 0;
    const b = parseInt(sB, 10) || 0;

    const isDeuceZone = a >= WIN_TARGET - 1 && b >= WIN_TARGET - 1;

    if (!isDeuceZone) {
        if (a >= WIN_TARGET) return { phase: "finished", winner: "A", advantageTeam: null, gamePointTeam: null, isDeuceZone: false };
        if (b >= WIN_TARGET) return { phase: "finished", winner: "B", advantageTeam: null, gamePointTeam: null, isDeuceZone: false };

        // Game point: one team is exactly at 10, opponent is below 10
        const gamePointTeam =
            a === WIN_TARGET - 1 && b < WIN_TARGET - 1 ? "A" :
                b === WIN_TARGET - 1 && a < WIN_TARGET - 1 ? "B" : null;

        return { phase: "playing", winner: null, advantageTeam: null, gamePointTeam, isDeuceZone: false };
    }

    // Deuce zone (both >= 10)
    const diff = a - b;

    if (diff === 0) return { phase: "deuce", winner: null, advantageTeam: null, gamePointTeam: null, isDeuceZone: true };
    if (Math.abs(diff) === 1) return { phase: "advantage", winner: null, advantageTeam: diff > 0 ? "A" : "B", gamePointTeam: null, isDeuceZone: true };

    // 2+ ahead → finished
    return { phase: "finished", winner: diff > 0 ? "A" : "B", advantageTeam: null, gamePointTeam: null, isDeuceZone: true };
}

/**
 * Human-readable banner label for the current phase.
 * Returns null when no banner should be shown.
 */
export function getPhaseLabel(phase, advantageTeam, gamePointTeam, teamAName, teamBName) {
    const nA = teamAName ?? "";
    const nB = teamBName ?? "";
    if (phase === "deuce") return "DEUCE";
    if (phase === "advantage" && (nA || nB))
        return `ADV \u00b7 ${advantageTeam === "A" ? nA : nB}`;
    if (phase === "finished") return "GAME";
    if (phase === "playing" && gamePointTeam && (nA || nB))
        return `GAME PT \u00b7 ${gamePointTeam === "A" ? nA : nB}`;
    return null;
}
