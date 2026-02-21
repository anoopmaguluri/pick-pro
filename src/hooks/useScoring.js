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
    clearLeaderboardMarker,
    applyRtdbLeaderboardUpdates
} from "../services/db";
import { useHaptic } from "./useHaptic";
import { getKnockoutAdvancement } from "../utils/gameLogic";
import { buildLeaderboardDeltasFromMatch, playerKeyForName } from "../utils/leaderboard";
import { getMatchState } from "../utils/scoringRules";

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
const scoreKeyForEvent = (isKnockout, mIdx, team) => `${isKnockout ? "k" : "m"}-${mIdx}-${team}`;
const parseScoreKey = (key) => {
    const match = /^([mk])-(\d+)-([AB])$/.exec(String(key || ""));
    if (!match) return null;
    return {
        isKnockout: match[1] === "k",
        mIdx: Number(match[2]),
        team: match[3],
    };
};

const normalizeScoreValue = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.trunc(numeric));
};

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
    const confirmInFlightRef = useRef(new Set());

    useEffect(() => {
        localScores.current = {};
        setOptimisticScores({});
    }, [activeTournamentId]);

    const getServerScoreForKey = useCallback((key) => {
        const parsed = parseScoreKey(key);
        if (!parsed) return null;

        const source = parsed.isKnockout ? data?.knockouts : data?.matches;
        const match = Array.isArray(source) ? source[parsed.mIdx] : null;
        if (!match) return null;

        const scoreField = parsed.team === "A" ? "sA" : "sB";
        const value = Number(match[scoreField]);
        return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : null;
    }, [data?.knockouts, data?.matches]);

    // Reconcile each optimistic key only when server score actually catches up.
    // This avoids score snap-back during fast taps under network latency.
    useEffect(() => {
        setOptimisticScores((prev) => {
            const keys = Object.keys(prev || {});
            if (!keys.length) return prev;

            let changed = false;
            const next = { ...prev };

            keys.forEach((key) => {
                const optimisticScore = Number(prev[key]);
                const serverScore = getServerScoreForKey(key);

                if (!Number.isFinite(optimisticScore)) {
                    delete next[key];
                    delete localScores.current[key];
                    changed = true;
                    return;
                }

                if (serverScore === optimisticScore) {
                    delete next[key];
                    delete localScores.current[key];
                    changed = true;
                }
            });

            return changed ? next : prev;
        });
    }, [getServerScoreForKey, data?.matches, data?.knockouts]);

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

    const getResolvedMatchAt = useCallback((idx, isKnockout) => {
        const source = isKnockout ? data?.knockouts : data?.matches;
        if (!Array.isArray(source) || idx < 0 || idx >= source.length) return null;

        const baseMatch = source[idx];
        if (!baseMatch) return null;

        const keyA = scoreKeyForEvent(!!isKnockout, idx, "A");
        const keyB = scoreKeyForEvent(!!isKnockout, idx, "B");

        const resolvedSA = localScores.current[keyA] !== undefined
            ? normalizeScoreValue(localScores.current[keyA])
            : normalizeScoreValue(baseMatch.sA);
        const resolvedSB = localScores.current[keyB] !== undefined
            ? normalizeScoreValue(localScores.current[keyB])
            : normalizeScoreValue(baseMatch.sB);

        return {
            ...baseMatch,
            sA: resolvedSA,
            sB: resolvedSB,
        };
    }, [data?.knockouts, data?.matches]);

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
        if (!deltas.length) {
            await clearLeaderboardMarker(activeTournamentId, scope, idx);
            return;
        }

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

        if (Object.keys(updates).length === 0) {
            await clearLeaderboardMarker(activeTournamentId, scope, idx);
            return;
        }

        try {
            await applyRtdbLeaderboardUpdates(updates);
        } catch (error) {
            console.error("Leaderboard update failed", error);
            const rollbackOk = await clearLeaderboardMarker(activeTournamentId, scope, idx);
            if (!rollbackOk) {
                console.error("Leaderboard marker rollback failed", { activeTournamentId, scope, idx });
            }
        }
    }, [activeTournamentId]);

    const adjustScore = (mIdx, team, delta, isKnockout) => {
        if (!isAdmin || !activeTournamentId) return;

        const key = scoreKeyForEvent(isKnockout, mIdx, team);

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

    const confirmMatch = useCallback(async (mIdx) => {
        if (!isAdmin || !activeTournamentId) return;
        const inFlightKey = `m-${mIdx}`;
        if (confirmInFlightRef.current.has(inFlightKey)) return;
        confirmInFlightRef.current.add(inFlightKey);

        try {
            await ensureFirebaseSession();

            if (!data.matches || !Array.isArray(data.matches) || mIdx < 0 || mIdx >= data.matches.length) {
                console.error("Invalid match index or missing matches array");
                return;
            }

            const match = getResolvedMatchAt(mIdx, false);
            if (!match || match.done) return;
            const matchState = getMatchState(match.sA, match.sB, data?.pointsToWin);
            if (matchState.phase !== "finished") return;

            triggerHaptic([100, 50, 100]);

            await confirmMatchCompleted(activeTournamentId, mIdx, false);
            void applyMatchResultToGlobalLeaderboard({ ...match, done: true }, "matches", mIdx);
            void maybeCompactScoreEvents();
        } finally {
            confirmInFlightRef.current.delete(inFlightKey);
        }
    }, [isAdmin, activeTournamentId, data?.matches, data?.pointsToWin, getResolvedMatchAt, triggerHaptic, applyMatchResultToGlobalLeaderboard, maybeCompactScoreEvents]);

    const confirmKnockout = useCallback(async (idx) => {
        if (!isAdmin || !activeTournamentId) return;
        const inFlightKey = `k-${idx}`;
        if (confirmInFlightRef.current.has(inFlightKey)) return;
        confirmInFlightRef.current.add(inFlightKey);

        try {
            await ensureFirebaseSession();

            if (!data.knockouts || !Array.isArray(data.knockouts) || idx < 0 || idx >= data.knockouts.length) {
                console.error("Invalid knockout index or missing knockouts array");
                return;
            }

            const selected = getResolvedMatchAt(idx, true);
            if (!selected || selected.done) return;
            const selectedState = getMatchState(selected.sA, selected.sB, data?.pointsToWin);
            if (selectedState.phase !== "finished") return;

            if (selected.id === "final") triggerHaptic([200, 100, 200, 100, 500, 100, 800]);
            else triggerHaptic([100, 50, 100]);

            const resolvedKnockouts = data.knockouts.map((_, i) => {
                const resolved = getResolvedMatchAt(i, true);
                return resolved || data.knockouts[i];
            });
            const newKnockouts = resolvedKnockouts.map((k, i) => (i === idx ? { ...k, done: true } : k));
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
        } finally {
            confirmInFlightRef.current.delete(inFlightKey);
        }
    }, [isAdmin, activeTournamentId, data?.knockouts, data?.pointsToWin, data?.format, data?.pools, getResolvedMatchAt, triggerHaptic, applyMatchResultToGlobalLeaderboard, maybeCompactScoreEvents]);

    return { adjustScore, confirmMatch, confirmKnockout, optimisticScores };
};
