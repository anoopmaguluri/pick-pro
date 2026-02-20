import { useRef, useEffect, useCallback, useState } from "react";
import localforage from "localforage";
import { increment } from "firebase/database";
import { ensureFirebaseSession } from "../services/firebase";
import {
    dispatchScoreEvent,
    updateScoreSnapshot,
    confirmMatchCompleted,
    setKnockoutMatch,
    updateLeaderboardMarkerOnly,
    applyRtdbLeaderboardUpdates
} from "../services/db";
import { useHaptic } from "./useHaptic";
import { getKnockoutAdvancement } from "../utils/gameLogic";
import { buildLeaderboardDeltasFromMatch, playerKeyForName } from "../utils/leaderboard";

const SCORE_SOURCE_STORAGE_KEY = "pick-pro:score-source-id";
const PENDING_SCORE_EVENTS_KEY = "pending-score-events-v1";
const MAX_PENDING_SCORE_EVENTS = 3000;
const SCORE_EVENT_COMPACTION_THRESHOLD = 300;

const pendingEventsStore = localforage.createInstance({
    name: "pick-pro",
    storeName: "score-events",
});

const buildSourceId = () => `scorer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const buildClientEventId = (sourceId) => `${sourceId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const toArray = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(Boolean);
    if (typeof raw === "object") return Object.values(raw).filter(Boolean);
    return [];
};

const loadPendingEvents = async () => {
    try {
        const raw = await pendingEventsStore.getItem(PENDING_SCORE_EVENTS_KEY);
        return Array.isArray(raw) ? raw : [];
    } catch {
        return [];
    }
};

const savePendingEvents = async (events) => {
    try {
        await pendingEventsStore.setItem(PENDING_SCORE_EVENTS_KEY, events);
    } catch {
        // Ignore storage failures, Firebase offline queue still exists as fallback.
    }
};

const enqueuePendingEvent = async (entry) => {
    const current = await loadPendingEvents();
    if (current.some((item) => item?.clientEventId === entry.clientEventId)) return;

    const next = [...current, entry];
    const trimmed = next.length > MAX_PENDING_SCORE_EVENTS
        ? next.slice(next.length - MAX_PENDING_SCORE_EVENTS)
        : next;

    await savePendingEvents(trimmed);
};

const removePendingEvent = async (clientEventId) => {
    if (!clientEventId) return;

    const current = await loadPendingEvents();
    const next = current.filter((item) => item?.clientEventId !== clientEventId);

    if (next.length !== current.length) {
        await savePendingEvents(next);
    }
};

const getOrCreateScoreSourceId = () => {
    try {
        const storage = globalThis?.localStorage;
        if (!storage) return buildSourceId();

        const existing = storage.getItem(SCORE_SOURCE_STORAGE_KEY);
        if (existing && existing.trim()) return existing;

        const created = buildSourceId();
        storage.setItem(SCORE_SOURCE_STORAGE_KEY, created);
        return created;
    } catch {
        return buildSourceId();
    }
};

export const useScoring = (activeTournamentId, data, isAdmin) => {
    const { trigger: triggerHaptic } = useHaptic();
    const localScores = useRef({});
    const [optimisticScores, setOptimisticScores] = useState({});
    const sourceIdRef = useRef(getOrCreateScoreSourceId());
    const lastCompactionAtRef = useRef(0);

    useEffect(() => {
        localScores.current = {};
        setOptimisticScores({});
    }, [activeTournamentId]);

    // Optimistic UI Reconciliation:
    // When the server sends new match data, if our local offline/pending queue is empty,
    // it means all our local optimistic taps have reached the server. We can safely
    // clear the local memory cache and snap precisely to the true server state.
    // This inherently resolves stale conflicts because the UI will visually "snap back"
    // to the true value if a tap was rejected by the server logic.
    useEffect(() => {
        let isCurrent = true;
        void loadPendingEvents().then((queued) => {
            if (!isCurrent) return;
            if (queued.length === 0) {
                localScores.current = {};
                setOptimisticScores({});
            }
        });

        return () => {
            isCurrent = false;
        };
    }, [data.matches, data.knockouts]);

    const flushPendingScoreEvents = useCallback(async () => {
        const queued = await loadPendingEvents();
        if (!queued.length) return;

        for (const entry of queued) {
            if (!entry?.payload || !entry?.tournamentId || !entry?.clientEventId) continue;

            try {
                // Route through abstraction layer instead of naked push
                await dispatchScoreEvent(entry.tournamentId, entry.payload);
                await removePendingEvent(entry.clientEventId);
            } catch {
                // Keep queued for the next online flush.
            }
        }
    }, []);

    useEffect(() => {
        void flushPendingScoreEvents();
    }, [activeTournamentId, flushPendingScoreEvents]);

    useEffect(() => {
        const handleOnline = () => {
            void flushPendingScoreEvents();
        };

        if (typeof window !== "undefined") {
            window.addEventListener("online", handleOnline);
            return () => window.removeEventListener("online", handleOnline);
        }

        return undefined;
    }, [flushPendingScoreEvents]);

    const dispatchEventToBackend = useCallback(async (eventPayload) => {
        if (!activeTournamentId) return;

        const queuedEntry = {
            clientEventId: eventPayload.clientEventId,
            tournamentId: activeTournamentId,
            payload: eventPayload,
        };

        await enqueuePendingEvent(queuedEntry);

        try {
            await dispatchScoreEvent(activeTournamentId, eventPayload);
            await removePendingEvent(eventPayload.clientEventId);
        } catch (err) {
            console.error("Database Push Error (queued for retry):", err);
        }
    }, [activeTournamentId]);

    const maybeCompactScoreEvents = useCallback(async () => {
        if (!activeTournamentId) return;
        await ensureFirebaseSession();

        const now = Date.now();
        if (now - lastCompactionAtRef.current < 15000) return;

        const events = toArray(data?.events);
        if (events.length < SCORE_EVENT_COMPACTION_THRESHOLD) return;

        const snapshot = {
            createdAt: now,
            matches: (data?.matches || []).map((m) => ({
                sA: Number.isFinite(m?.sA) ? Math.max(0, Math.trunc(m.sA)) : 0,
                sB: Number.isFinite(m?.sB) ? Math.max(0, Math.trunc(m.sB)) : 0,
            })),
            knockouts: (data?.knockouts || []).map((m) => ({
                sA: Number.isFinite(m?.sA) ? Math.max(0, Math.trunc(m.sA)) : 0,
                sB: Number.isFinite(m?.sB) ? Math.max(0, Math.trunc(m.sB)) : 0,
            })),
        };

        try {
            lastCompactionAtRef.current = now;
            await updateScoreSnapshot(activeTournamentId, snapshot);
        } catch (error) {
            console.error("Event compaction failed", error);
        }
    }, [activeTournamentId, data]);

    const applyMatchResultToGlobalLeaderboard = useCallback(async (match, scope, idx) => {
        if (!activeTournamentId || !match) return;
        await ensureFirebaseSession();

        // Let abstraction layer handle the marker logic (if applicable for RTDB dual-write phase)
        const markerOk = await updateLeaderboardMarkerOnly(activeTournamentId, scope, idx);
        if (!markerOk) return;

        const deltas = buildLeaderboardDeltasFromMatch(match);
        if (!deltas.length) return;

        // Abstract Leaderboard updates
        // To maintain dual-write parity while Cloud Functions are built, we will manually
        // submit the increment updates to the db layer, which will route them to RTDB only.
        const updates = {};
        deltas.forEach((delta) => {
            const key = playerKeyForName(delta.name);
            if (!key) return;

            const base = `leaderboard_global/${key}`;
            updates[`${base}/name`] = delta.name;
            updates[`${base}/p`] = increment(delta.p);
            updates[`${base}/w`] = increment(delta.w);
            updates[`${base}/l`] = increment(delta.l);
            updates[`${base}/pd`] = increment(delta.pd);
            updates[`${base}/pf`] = increment(delta.pf);
            updates[`${base}/pa`] = increment(delta.pa);
        });

        if (Object.keys(updates).length === 0) return;

        try {
            await applyRtdbLeaderboardUpdates(updates);
        } catch (error) {
            console.error("Leaderboard update failed", error);
        }
    }, [activeTournamentId]);

    const adjustScore = (mIdx, team, delta, isKnockout) => {
        if (!isAdmin || !activeTournamentId) return;

        const key = `${isKnockout ? "k" : "m"}-${mIdx}-${team}`;

        let currentScore;
        let expectedVersion = 0;

        if (localScores.current[key] !== undefined) {
            currentScore = localScores.current[key];
            // Infer version from data even if local score is used
            if (isKnockout && data.knockouts && data.knockouts[mIdx]) {
                expectedVersion = data.knockouts[mIdx].version || 0;
            } else if (!isKnockout && data.matches && data.matches[mIdx]) {
                expectedVersion = data.matches[mIdx].version || 0;
            }
        } else {
            if (isKnockout && data.knockouts && data.knockouts[mIdx]) {
                currentScore = data.knockouts[mIdx][team === "A" ? "sA" : "sB"] || 0;
                expectedVersion = data.knockouts[mIdx].version || 0;
            } else if (!isKnockout && data.matches && data.matches[mIdx]) {
                currentScore = data.matches[mIdx][team === "A" ? "sA" : "sB"] || 0;
                expectedVersion = data.matches[mIdx].version || 0;
            } else {
                currentScore = 0;
            }

            localScores.current[key] = currentScore;
        }

        if (currentScore === 0 && delta < 0) return;

        const newScore = Math.max(0, currentScore + delta);
        localScores.current[key] = newScore;
        setOptimisticScores((prev) => ({ ...prev, [key]: newScore }));

        triggerHaptic(delta > 0 ? 50 : [50, 50]);

        const eventPayload = {
            type: "SCORE",
            mIdx,
            team,
            delta,
            nextScore: newScore,
            expectedVersion,
            isKnockout: !!isKnockout,
            ts: Date.now(),
            sourceId: sourceIdRef.current,
            clientEventId: buildClientEventId(sourceIdRef.current),
        };

        void dispatchEventToBackend(eventPayload);
    };

    const confirmMatch = async (mIdx) => {
        if (!isAdmin || !activeTournamentId) return;
        await ensureFirebaseSession();

        if (!data.matches || !Array.isArray(data.matches) || mIdx < 0 || mIdx >= data.matches.length) {
            console.error("Invalid match index or missing matches array");
            return;
        }

        const match = data.matches[mIdx];
        if (!match || match.done) return;

        triggerHaptic([100, 50, 100]);

        await confirmMatchCompleted(activeTournamentId, mIdx, false);
        void applyMatchResultToGlobalLeaderboard({ ...match, done: true }, "matches", mIdx);
        void maybeCompactScoreEvents();
    };

    const confirmKnockout = async (idx) => {
        if (!isAdmin || !activeTournamentId) return;
        await ensureFirebaseSession();

        if (!data.knockouts || !Array.isArray(data.knockouts) || idx < 0 || idx >= data.knockouts.length) {
            console.error("Invalid knockout index or missing knockouts array");
            return;
        }

        const selected = data.knockouts[idx];
        if (!selected || selected.done) return;

        if (selected.id === "final") triggerHaptic([200, 100, 200, 100, 500, 100, 800]);
        else triggerHaptic([100, 50, 100]);

        const newKnockouts = data.knockouts.map((k, i) => (i === idx ? { ...k, done: true } : k));
        const advanced = getKnockoutAdvancement(newKnockouts, data.format, data.pools);

        await confirmMatchCompleted(activeTournamentId, idx, true);

        if (advanced) {
            const final = advanced.find((k) => k.id === "final");
            if (final) {
                await setKnockoutMatch(activeTournamentId, data.knockouts.length, final);
            }
            triggerHaptic([100, 100, 200, 200]);
        }

        void applyMatchResultToGlobalLeaderboard({ ...selected, done: true }, "knockouts", idx);
        void maybeCompactScoreEvents();
    };

    return { adjustScore, confirmMatch, confirmKnockout, optimisticScores };
};
