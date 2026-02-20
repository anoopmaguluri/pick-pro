import { useState, useEffect, useRef } from "react";
import {
    subscribeToTournaments,
    subscribeToLeaderboard,
    subscribeToRoster,
    prefetchTournamentCaches,
    FLAGS,
} from "../services/db";
import { ensureFirebaseSession } from "../services/firebase";

export const useTournaments = () => {
    const [tournaments, setTournaments] = useState({});
    const [leaderboardData, setLeaderboardData] = useState({});
    const [roster, setRoster] = useState([]);
    const [loading, setLoading] = useState(true);
    const [prefetchTick, setPrefetchTick] = useState(0);
    const prefetchRequestedRef = useRef(new Set());

    useEffect(() => {
        let cancelled = false;

        const unsubMeta = subscribeToTournaments((meta) => {
            if (cancelled) return;
            setTournaments(meta || {});
            setLoading(false);
        }, (error) => {
            console.error("Tournaments subscribe failed", error);
            if (!cancelled) setLoading(false);
        });

        const unsubLeaderboard = subscribeToLeaderboard((leaderboard) => {
            if (cancelled) return;
            setLeaderboardData(leaderboard || {});
        }, (error) => {
            console.error("Leaderboard subscribe failed", error);
        });

        const unsubRoster = subscribeToRoster((nextRoster) => {
            if (cancelled) return;
            setRoster(nextRoster || []);
        }, (error) => {
            console.error("Roster subscribe failed", error);
        });

        ensureFirebaseSession().catch((error) => {
            console.error("Anonymous auth bootstrap failed", error);
        });

        return () => {
            cancelled = true;
            if (typeof unsubMeta === "function") unsubMeta();
            if (typeof unsubLeaderboard === "function") unsubLeaderboard();
            if (typeof unsubRoster === "function") unsubRoster();
        };
    }, []);

    useEffect(() => {
        if (FLAGS.READ_SOURCE !== "firestore") return;
        if (!FLAGS.PREFETCH_ENABLED || FLAGS.PREFETCH_TOURNAMENT_LIMIT <= 0) return;
        if (typeof navigator !== "undefined" && navigator.onLine === false) return;

        const sortedIds = Object.entries(tournaments || {})
            .sort(([, a], [, b]) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0))
            .map(([id]) => id);

        const candidates = sortedIds
            .slice(0, FLAGS.PREFETCH_TOURNAMENT_LIMIT)
            .filter((id) => !prefetchRequestedRef.current.has(id));

        if (!candidates.length) return;

        candidates.forEach((id) => prefetchRequestedRef.current.add(id));

        void prefetchTournamentCaches(candidates).then((result) => {
            (result?.failedIds || []).forEach((id) => prefetchRequestedRef.current.delete(id));
        });
    }, [tournaments, prefetchTick]);

    useEffect(() => {
        const handleOnline = () => setPrefetchTick((x) => x + 1);
        if (typeof window !== "undefined") {
            window.addEventListener("online", handleOnline);
            return () => window.removeEventListener("online", handleOnline);
        }
        return undefined;
    }, []);

    return { tournaments, leaderboardData, roster, loading };
};
