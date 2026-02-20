import { useState, useEffect } from "react";
import { ref, onValue, get, update } from "firebase/database";
import { db, ensureFirebaseSession } from "../services/firebase";
import {
    LEADERBOARD_SCHEMA_VERSION,
    buildEncodedLeaderboardFromTournaments,
    derivePlayersFromTournamentData,
    buildPlayersPreview,
} from "../utils/leaderboard";

export const useTournaments = () => {
    const [tournaments, setTournaments] = useState({});
    const [leaderboardData, setLeaderboardData] = useState({});
    const [roster, setRoster] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        let backfillInFlight = false;

        const metaRef = ref(db, "tournaments_meta");
        const leaderboardRef = ref(db, "leaderboard_global");
        const rosterRef = ref(db, "roster");

        const backfillMetaSummaries = async (metaById) => {
            if (backfillInFlight) return;
            backfillInFlight = true;

            try {
                const updates = {};
                const entries = Object.entries(metaById || {});

                for (const [id, meta] of entries) {
                    const hasPreview = Array.isArray(meta?.playersPreview);
                    const hasCount = Number.isFinite(meta?.playerCount);
                    if (hasPreview && hasCount) continue;

                    const snapshot = await get(ref(db, `tournament_data/${id}`));
                    if (!snapshot.exists()) continue;

                    const players = derivePlayersFromTournamentData(snapshot.val());
                    const summary = buildPlayersPreview(players);

                    updates[`tournaments_meta/${id}/playersPreview`] = summary.playersPreview;
                    updates[`tournaments_meta/${id}/playerCount`] = summary.playerCount;
                }

                if (!cancelled && Object.keys(updates).length > 0) {
                    await ensureFirebaseSession();
                    await update(ref(db), updates);
                }
            } catch (error) {
                console.error("Meta summary backfill failed", error);
            } finally {
                backfillInFlight = false;
            }
        };

        const bootstrapLeaderboardIfNeeded = async () => {
            try {
                const versionRef = ref(db, "leaderboard_meta/schemaVersion");
                const versionSnap = await get(versionRef);
                const currentVersion = Number(versionSnap.val() || 0);
                const leaderboardSnap = await get(leaderboardRef);
                const leaderboardVal = leaderboardSnap.val();
                const hasExistingLeaderboard = Boolean(
                    leaderboardVal &&
                    typeof leaderboardVal === "object" &&
                    Object.keys(leaderboardVal).length > 0
                );

                if (currentVersion === LEADERBOARD_SCHEMA_VERSION && hasExistingLeaderboard) return;

                // Rules deny root reads on `tournament_data`, so rebuild from known IDs.
                const metaSnap = await get(metaRef);
                const metaById = metaSnap.val() || {};
                const tournamentIds = Object.keys(metaById);
                const tournamentsById = {};

                for (const id of tournamentIds) {
                    const tSnap = await get(ref(db, `tournament_data/${id}`));
                    if (!tSnap.exists()) continue;
                    tournamentsById[id] = tSnap.val();
                }

                const encoded = buildEncodedLeaderboardFromTournaments(tournamentsById);

                await ensureFirebaseSession();
                await update(ref(db), {
                    leaderboard_global: encoded,
                    "leaderboard_meta/schemaVersion": LEADERBOARD_SCHEMA_VERSION,
                    "leaderboard_meta/rebuiltAt": Date.now(),
                });
            } catch (error) {
                console.error("Leaderboard bootstrap failed", error);
            }
        };

        const unsubMeta = onValue(metaRef, (snapshot) => {
            const meta = snapshot.val() || {};
            if (cancelled) return;

            setTournaments(meta);
            setLoading(false);
            void backfillMetaSummaries(meta);
        });

        const unsubLeaderboard = onValue(leaderboardRef, (snapshot) => {
            if (cancelled) return;
            setLeaderboardData(snapshot.val() || {});
        });

        const unsubRoster = onValue(rosterRef, (snapshot) => {
            if (cancelled) return;
            setRoster(snapshot.val() || []);
        });

        ensureFirebaseSession().catch((error) => {
            console.error("Anonymous auth bootstrap failed", error);
        });

        void bootstrapLeaderboardIfNeeded();

        return () => {
            cancelled = true;
            unsubMeta();
            unsubLeaderboard();
            unsubRoster();
        };
    }, []);

    return { tournaments, leaderboardData, roster, loading };
};
