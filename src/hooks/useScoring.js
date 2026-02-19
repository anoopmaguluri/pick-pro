import { useRef, useEffect } from "react";
import { ref, set, update } from "firebase/database";
import { db } from "../services/firebase";
import { useHaptic } from "./useHaptic";

export const useScoring = (activeTournamentId, data, isAdmin) => {
    const { trigger: triggerHaptic } = useHaptic();
    const localScores = useRef({});

    // Reset local scores when tournament changes to prevent stale data
    useEffect(() => {
        localScores.current = {};
    }, [activeTournamentId]);

    const adjustScore = (mIdx, team, delta, isKnockout) => {
        if (!isAdmin) return;

        // Create unique key for this match/team
        const key = `${isKnockout ? "k" : "m"}-${mIdx}-${team}`;

        // Get current score from local tracking or Firebase data
        let currentScore;
        if (localScores.current[key] !== undefined) {
            currentScore = localScores.current[key];
        } else {
            currentScore = isKnockout
                ? data.knockouts[mIdx][team === "A" ? "sA" : "sB"]
                : data.matches[mIdx][team === "A" ? "sA" : "sB"];
            localScores.current[key] = currentScore;
        }

        // Calculate new score
        const newScore = Math.max(0, currentScore + delta);

        // Update local tracking immediately
        localScores.current[key] = newScore;

        // Haptic feedback
        triggerHaptic(delta > 0 ? 50 : [50, 50]);

        // Write ONLY the score to Firebase
        const scoreField = team === "A" ? "sA" : "sB";
        const scorePath = isKnockout
            ? `tournaments/${activeTournamentId}/knockouts/${mIdx}/${scoreField}`
            : `tournaments/${activeTournamentId}/matches/${mIdx}/${scoreField}`;

        set(ref(db, scorePath), newScore);
    };

    const confirmMatch = (mIdx) => {
        triggerHaptic([100, 50, 100]);
        update(ref(db), {
            [`tournaments/${activeTournamentId}/matches/${mIdx}/done`]: true,
        });
    };

    const confirmKnockout = (idx) => {
        const newKnockouts = [...data.knockouts];
        newKnockouts[idx].done = true;

        if (newKnockouts[idx].id === "final")
            triggerHaptic([200, 100, 200, 100, 500, 100, 800]);
        else triggerHaptic([100, 50, 100]);

        if (
            (data.format === "fixed" || data.pools === 2) &&
            newKnockouts.length === 2
        ) {
            if (newKnockouts[0].done && newKnockouts[1].done) {
                const winner1 =
                    newKnockouts[0].sA > newKnockouts[0].sB
                        ? newKnockouts[0].tA
                        : newKnockouts[0].tB;
                const winner2 =
                    newKnockouts[1].sA > newKnockouts[1].sB
                        ? newKnockouts[1].tA
                        : newKnockouts[1].tB;
                newKnockouts.push({
                    id: "final",
                    type: "🏆 GRAND FINAL",
                    tA: winner1,
                    tB: winner2,
                    sA: 0,
                    sB: 0,
                    done: false,
                });
                triggerHaptic([100, 100, 200, 200]);
            }
        }
        set(ref(db, `tournaments/${activeTournamentId}/knockouts`), newKnockouts);
    };

    return { adjustScore, confirmMatch, confirmKnockout };
};
