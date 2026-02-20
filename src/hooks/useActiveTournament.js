import { useState, useEffect, useMemo } from "react";
import { ref, onValue, get } from "firebase/database";
import { db } from "../services/firebase";
import { applyEventSourcing } from "../utils/gameLogic";

export const useActiveTournament = (activeTournamentId, isTournamentActive) => {
    const [rawTournamentData, setRawTournamentData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!activeTournamentId || !isTournamentActive) {
            setRawTournamentData(null);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);

        const basePath = `tournament_data/${activeTournamentId}`;
        const pathListeners = [
            "events",
            "scoreSnapshot",
            "matches",
            "knockouts",
            "draftPlayers",
            "players",
            "teams",
            "format",
            "status",
            "winner",
            "name",
            "createdAt",
            "id",
        ];

        const primeInitialData = async () => {
            try {
                const snapshot = await get(ref(db, basePath));
                if (cancelled) return;
                setRawTournamentData(snapshot.val() || null);
            } catch (error) {
                if (!cancelled) {
                    console.error("Failed to prime tournament data", error);
                    setRawTournamentData(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void primeInitialData();

        const unsubs = pathListeners.map((path) => {
            const pathRef = ref(db, `${basePath}/${path}`);
            return onValue(pathRef, (snapshot) => {
                if (cancelled) return;
                setRawTournamentData((prev) => ({
                    ...(prev || {}),
                    [path]: snapshot.val(),
                }));
            });
        });

        return () => {
            cancelled = true;
            unsubs.forEach((unsub) => unsub());
        };
    }, [activeTournamentId, isTournamentActive]);

    const computedTournamentData = useMemo(() => {
        return applyEventSourcing(rawTournamentData);
    }, [rawTournamentData]);

    return { tournamentData: computedTournamentData, loadingTournamentData: loading };
};
