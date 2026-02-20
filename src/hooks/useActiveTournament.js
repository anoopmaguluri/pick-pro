import { useState, useEffect, useMemo } from "react";
import { applyEventSourcing } from "../utils/gameLogic";
import { subscribeToActiveTournament } from "../services/db";

export const useActiveTournament = (activeTournamentId, isTournamentActive) => {
    const [rawTournamentData, setRawTournamentData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!activeTournamentId || !isTournamentActive) {
            setRawTournamentData(null);
            setLoading(false);
            return;
        }

        let isMounted = true;
        setLoading(true);

        const unsubscribe = subscribeToActiveTournament(
            activeTournamentId,
            (data) => {
                if (isMounted) {
                    setRawTournamentData(data);
                    setLoading(false);
                }
            },
            (error) => {
                console.error("Tournament update error:", error);
                if (isMounted) {
                    setLoading(false);
                }
            }
        );

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, [activeTournamentId, isTournamentActive]);

    const computedTournamentData = useMemo(() => {
        return applyEventSourcing(rawTournamentData);
    }, [rawTournamentData]);

    return { tournamentData: computedTournamentData, loadingTournamentData: loading };
};
