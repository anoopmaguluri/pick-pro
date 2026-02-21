import { db as rtdb, firestore, checkAndRefreshAuth } from './firebase';
import {
    ref,
    onValue,
    update as updateRtdb,
    push as pushRtdb,
    runTransaction as runRtdbTransaction
} from 'firebase/database';
import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    onSnapshot,
    updateDoc,
    writeBatch,
    query,
    orderBy
} from 'firebase/firestore';

/**
 * FEATURE FLAGS
 * Control rollouts exclusively against Dev Environment before Prod.
 */
export const FLAGS = {
    // "rtdb" | "firestore"
    READ_SOURCE: (import.meta.env.VITE_READ_SOURCE || "rtdb").toLowerCase(),
    // "rtdb_only" | "dual_write" | "firestore_only"
    WRITE_MODE: (import.meta.env.VITE_WRITE_MODE || "dual_write").toLowerCase(),
    // Enable background Firestore warm cache prefetch for offline reload
    PREFETCH_ENABLED: (import.meta.env.VITE_PREFETCH_ENABLED || "true").toLowerCase() !== "false",
    // Number of recent tournaments to prefetch (state/matches/knockouts)
    PREFETCH_TOURNAMENT_LIMIT: Math.max(0, Number.parseInt(import.meta.env.VITE_PREFETCH_TOURNAMENT_LIMIT || "8", 10) || 0),
};

/**
 * UTILITIES
 */
export const requireAuth = async () => {
    await checkAndRefreshAuth();
};

const safeWrite = async (rtdbFn, firestoreFn) => {
    await requireAuth();
    const promises = [];

    if (FLAGS.WRITE_MODE === "rtdb_only" || FLAGS.WRITE_MODE === "dual_write") {
        promises.push(rtdbFn());
    }
    if (FLAGS.WRITE_MODE === "firestore_only" || FLAGS.WRITE_MODE === "dual_write") {
        promises.push(firestoreFn());
    }

    // In dual write, we wait for both to complete before confirming to UI
    await Promise.all(promises);
};

const setDefinedPathUpdates = (target, basePath, patch = {}) => {
    Object.entries(patch).forEach(([key, value]) => {
        if (value === undefined) return;
        target[`${basePath}/${key}`] = value;
    });
};

const buildStatePatch = (dataPatch = {}) => {
    const statePatch = {};
    ["draftPlayers", "players", "teams", "pools", "scoreSnapshot", "pointsToWin"].forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(dataPatch, field)) {
            statePatch[field] = dataPatch[field];
        }
    });
    return statePatch;
};

const buildRootPatchFromData = (dataPatch = {}) => {
    const rootPatch = {};
    ["name", "status", "format", "createdAt", "winner", "pointsToWin"].forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(dataPatch, field)) {
            rootPatch[field] = dataPatch[field];
        }
    });
    return rootPatch;
};

const replaceIndexedSubcollection = async (tournamentId, scope, entries = []) => {
    const scopeRef = collection(firestore, `tournaments/${tournamentId}/${scope}`);
    const currentSnap = await getDocs(query(scopeRef));

    const nextById = new Map();
    (entries || []).forEach((entry, idx) => {
        if (!entry) return;
        nextById.set(String(idx), entry);
    });

    const batch = writeBatch(firestore);
    let hasWrites = false;

    currentSnap.forEach((snap) => {
        if (!nextById.has(snap.id)) {
            batch.delete(snap.ref);
            hasWrites = true;
        }
    });

    nextById.forEach((entry, idx) => {
        batch.set(doc(firestore, `tournaments/${tournamentId}/${scope}/${idx}`), entry);
        hasWrites = true;
    });

    if (hasWrites) {
        await batch.commit();
    }
};

const canPrefetchFirestore = () => {
    if (FLAGS.READ_SOURCE !== "firestore") return false;
    if (!FLAGS.PREFETCH_ENABLED) return false;
    if (FLAGS.PREFETCH_TOURNAMENT_LIMIT <= 0) return false;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
    return true;
};

const prefetchTournamentBundle = async (tournamentId) => {
    const stateRef = doc(firestore, `tournaments/${tournamentId}/state/current`);
    const matchesRef = collection(firestore, `tournaments/${tournamentId}/matches`);
    const knockoutsRef = collection(firestore, `tournaments/${tournamentId}/knockouts`);

    // Reading documents through Firestore SDK hydrates local IndexedDB cache.
    await Promise.all([
        getDoc(stateRef),
        getDocs(query(matchesRef)),
        getDocs(query(knockoutsRef)),
    ]);
};

// Prefetch recent tournament subtrees so offline reload can open them without prior manual navigation.
export const prefetchTournamentCaches = async (tournamentIds = []) => {
    if (!canPrefetchFirestore()) {
        return { attempted: 0, failedIds: [] };
    }

    const uniqueIds = [...new Set((tournamentIds || []).filter(Boolean))];
    const targetIds = uniqueIds.slice(0, FLAGS.PREFETCH_TOURNAMENT_LIMIT);
    const failedIds = [];

    for (const tournamentId of targetIds) {
        try {
            await prefetchTournamentBundle(tournamentId);
        } catch (error) {
            failedIds.push(tournamentId);
            console.warn(`Tournament prefetch failed for ${tournamentId}`, error);
        }
    }

    return {
        attempted: targetIds.length,
        failedIds,
    };
};

/**
 * TOURNAMENTS
 */

// Subscribe to hub list (tournaments_meta / lightweight tournaments)
export const subscribeToTournaments = (onUpdate, onError) => {
    if (FLAGS.READ_SOURCE === "rtdb") {
        const metaRef = ref(rtdb, "tournaments_meta");
        return onValue(metaRef, (snapshot) => {
            onUpdate(snapshot.val() || {});
        }, onError);
    } else {
        const q = query(
            collection(firestore, "tournaments"),
            orderBy("createdAt", "desc")
        );
        return onSnapshot(q, (snapshot) => {
            const data = {};
            snapshot.forEach(d => { data[d.id] = d.data(); });
            onUpdate(data);
        }, onError);
    }
};

// Subscribe to a specific active tournament's state
export const subscribeToActiveTournament = (tournamentId, onUpdate, onError) => {
    if (FLAGS.READ_SOURCE === "rtdb") {
        const tRef = ref(rtdb, `tournament_data/${tournamentId}`);
        return onValue(tRef, (snapshot) => {
            onUpdate(snapshot.val());
        }, onError);
    } else {
        // Firestore Implementation
        let currentMerge = {};

        const unsubRoot = onSnapshot(doc(firestore, `tournaments/${tournamentId}`), (snap) => {
            currentMerge = { ...currentMerge, ...snap.data(), id: tournamentId };
            onUpdate({ ...currentMerge });
        }, onError);

        const unsubState = onSnapshot(doc(firestore, `tournaments/${tournamentId}/state/current`), (snap) => {
            currentMerge = { ...currentMerge, ...snap.data() };
            onUpdate({ ...currentMerge });
        }, onError);

        const qMatches = query(collection(firestore, `tournaments/${tournamentId}/matches`));
        const unsubMatches = onSnapshot(qMatches, (snap) => {
            const matchesArr = [];
            snap.forEach(d => {
                const data = d.data();
                matchesArr[Number(d.id)] = data;
            });
            currentMerge.matches = matchesArr;
            onUpdate({ ...currentMerge });
        }, onError);

        const qKnockouts = query(collection(firestore, `tournaments/${tournamentId}/knockouts`));
        const unsubKnockouts = onSnapshot(qKnockouts, (snap) => {
            const koArr = [];
            snap.forEach(d => {
                const data = d.data();
                koArr[Number(d.id)] = data;
            });
            currentMerge.knockouts = koArr;
            onUpdate({ ...currentMerge });
        }, onError);

        return () => {
            unsubRoot();
            unsubState();
            unsubMatches();
            unsubKnockouts();
        };
    }
};

export const patchTournament = async (tournamentId, dataPatch = {}, metaPatch = {}) => {
    return safeWrite(
        async () => {
            const updates = {};
            setDefinedPathUpdates(updates, `tournament_data/${tournamentId}`, dataPatch);
            setDefinedPathUpdates(updates, `tournaments_meta/${tournamentId}`, {
                ...buildRootPatchFromData(dataPatch),
                ...metaPatch
            });
            if (Object.keys(updates).length > 0) {
                await updateRtdb(ref(rtdb), updates);
            }
        },
        async () => {
            const rootPatch = {
                ...buildRootPatchFromData(dataPatch),
                ...metaPatch
            };

            if (Object.keys(rootPatch).length > 0) {
                await setDoc(doc(firestore, `tournaments/${tournamentId}`), rootPatch, { merge: true });
            }

            const statePatch = buildStatePatch(dataPatch);
            if (Object.keys(statePatch).length > 0) {
                await setDoc(doc(firestore, `tournaments/${tournamentId}/state/current`), statePatch, { merge: true });
            }

            if (Object.prototype.hasOwnProperty.call(dataPatch, "matches")) {
                await replaceIndexedSubcollection(tournamentId, "matches", dataPatch.matches || []);
            }
            if (Object.prototype.hasOwnProperty.call(dataPatch, "knockouts")) {
                await replaceIndexedSubcollection(tournamentId, "knockouts", dataPatch.knockouts || []);
            }
        }
    );
};

export const createTournament = async (newId, fullTournamentData, metaSummary) => {
    return patchTournament(
        newId,
        {
            id: newId,
            ...fullTournamentData
        },
        {
            id: newId,
            ...metaSummary
        }
    );
};

export const updateTournamentStatus = async (tournamentId, newStatus) => {
    return patchTournament(
        tournamentId,
        { status: newStatus },
        { status: newStatus }
    );
};

export const finalizeTournament = async (tournamentId, winner) => {
    return patchTournament(
        tournamentId,
        { status: "done", winner },
        { status: "done", winner }
    );
};

export const deleteTournament = async (tournamentId) => {
    return safeWrite(
        async () => {
            // RTDB uses null updates to delete safely
            await updateRtdb(ref(rtdb), {
                [`tournaments_meta/${tournamentId}`]: null,
                [`tournament_data/${tournamentId}`]: null,
                [`leaderboard_applied/${tournamentId}`]: null,
            });
        },
        async () => {
            // Firestore
            const batch = writeBatch(firestore);

            // Delete Meta
            batch.delete(doc(firestore, `tournaments/${tournamentId}`));

            // Note: In Firestore, deleting a document does NOT delete its subcollections 
            // (e.g., matches, knockouts, events, state). 
            // To properly delete them, a Cloud Function usually handles cascading deletes 
            // or the client iterates through subcollections.
            // For this phase, we delete the root and rely on either a triggered Cloud Function
            // or we handle subcollection deletion manually inside here if required.
            // For Dual-Write phase 1, deleting the root hides it, which is sufficient, but 
            // we will add state/current just to be safe.
            batch.delete(doc(firestore, `tournaments/${tournamentId}/state/current`));

            await batch.commit();
        }
    );
};

export const updateTournamentPlayers = async (tournamentId, newDraft, summary) => {
    return patchTournament(
        tournamentId,
        { draftPlayers: newDraft },
        {
            draftPlayers: newDraft,
            ...summary
        }
    );
};

/**
 * SCORING & EVENTS
 */

export const dispatchScoreEvent = async (tournamentId, eventPayload) => {
    return safeWrite(
        async () => {
            // RTDB
            const dRef = ref(rtdb, `tournament_data/${tournamentId}/events`);
            await pushRtdb(dRef, eventPayload);
        },
        async () => {
            // Firestore
            const dRef = doc(firestore, `tournaments/${tournamentId}/events/${eventPayload.clientEventId}`);
            await setDoc(dRef, eventPayload);
        }
    );
};

export const updateScoreSnapshot = async (tournamentId, snapshotData) => {
    return safeWrite(
        async () => {
            await updateRtdb(ref(rtdb, `tournament_data/${tournamentId}`), {
                scoreSnapshot: snapshotData,
                events: [] // classic RTDB clears local events log
            });
        },
        async () => {
            await updateDoc(doc(firestore, `tournaments/${tournamentId}/state/current`), {
                scoreSnapshot: snapshotData
            });
            // Firestore function purges events log automatically via TTL
        }
    );
};

export const confirmMatchCompleted = async (tournamentId, mIdx, isKnockout) => {
    return safeWrite(
        async () => {
            const scope = isKnockout ? 'knockouts' : 'matches';
            await updateRtdb(ref(rtdb), {
                [`tournament_data/${tournamentId}/${scope}/${mIdx}/done`]: true
            });
        },
        async () => {
            const scope = isKnockout ? 'knockouts' : 'matches';
            await updateDoc(doc(firestore, `tournaments/${tournamentId}/${scope}/${mIdx}`), {
                done: true
            });
        }
    );
};

export const setKnockoutMatch = async (tournamentId, kIdx, knockoutData) => {
    return safeWrite(
        async () => {
            await updateRtdb(ref(rtdb), {
                [`tournament_data/${tournamentId}/knockouts/${kIdx}`]: knockoutData
            });
        },
        async () => {
            await setDoc(doc(firestore, `tournaments/${tournamentId}/knockouts/${kIdx}`), knockoutData);
        }
    );
}

/**
 * LEADERBOARD & SYSTEM
 */

export const subscribeToLeaderboard = (onUpdate, onError) => {
    if (FLAGS.READ_SOURCE === "rtdb") {
        const lRef = ref(rtdb, "leaderboard_global");
        return onValue(lRef, (snapshot) => {
            onUpdate(snapshot.val() || {});
        }, onError);
    } else {
        const q = query(collection(firestore, "leaderboard"), orderBy("p", "desc"));
        return onSnapshot(q, (snapshot) => {
            const data = {};
            snapshot.forEach(d => { data[d.id] = d.data(); });
            onUpdate(data);
        }, onError);
    }
};

export const subscribeToRoster = (onUpdate, onError) => {
    if (FLAGS.READ_SOURCE === "rtdb") {
        const rRef = ref(rtdb, "roster");
        return onValue(rRef, (snapshot) => {
            onUpdate(snapshot.val() || []);
        }, onError);
    } else {
        const rRef = doc(firestore, "settings/roster");
        return onSnapshot(rRef, (snapshot) => {
            const data = snapshot.data();
            onUpdate(data?.players || []);
        }, onError);
    }
};

export const addPlayerToRoster = async (newRoster) => {
    return safeWrite(
        async () => {
            await updateRtdb(ref(rtdb), { roster: newRoster });
        },
        async () => {
            // Firestore
            await setDoc(doc(firestore, "settings/roster"), { players: newRoster }, { merge: true });
        }
    );
};

export const updateLeaderboardMarkerOnly = async (tournamentId, scope, idx) => {
    // Leftover from RTDB client-driven leaderboard.
    // In Firestore, functions do this. So this is strictly for RTDB write phase.
    if (FLAGS.WRITE_MODE === "rtdb_only" || FLAGS.WRITE_MODE === "dual_write") {
        await requireAuth();
        const markerPath = `leaderboard_applied/${tournamentId}/${scope}/${idx}`;
        const markerRef = ref(rtdb, markerPath);

        try {
            const tx = await runRtdbTransaction(markerRef, (current) => {
                if (current === true) return;
                return true;
            });
            return tx.committed;
        } catch (e) {
            console.error(e);
            return false;
        }
    }
    return true; // If Firestore only, function handles it implicitly
};

export const clearLeaderboardMarker = async (tournamentId, scope, idx) => {
    if (FLAGS.WRITE_MODE === "rtdb_only" || FLAGS.WRITE_MODE === "dual_write") {
        await requireAuth();
        const markerPath = `leaderboard_applied/${tournamentId}/${scope}/${idx}`;
        try {
            await updateRtdb(ref(rtdb), { [markerPath]: null });
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    }
    return true;
};

export const applyRtdbLeaderboardUpdates = async (updates) => {
    // Strict RTDB path only
    if (FLAGS.WRITE_MODE !== "firestore_only") {
        await updateRtdb(ref(rtdb), updates);
    }
};
