const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { initializeApp } = require("firebase-admin/app");

initializeApp();
const db = getFirestore();

const sanitizeName = (value) => (typeof value === "string" ? value.trim() : "");
const playerKeyForName = (name) => encodeURIComponent(sanitizeName(name));

const resolveParticipants = (team) => {
    if (!team) return { p1: null, p2: null };
    if (team.p1 || team.p2) {
        return {
            p1: sanitizeName(team.p1) || null,
            p2: sanitizeName(team.p2) || null,
        };
    }

    const raw = sanitizeName(team.name);
    if (!raw) return { p1: null, p2: null };
    const parts = raw.split("/").map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
        return { p1: parts[0], p2: parts[1] };
    }

    return { p1: raw, p2: null };
};

/**
 * 1. processScoreEvent
 * Trigger: onCreate for events
 * Logic: 
 *  - Checks idempotency marker
 *  - Cross-admin debounce
 *  - Safety check underflow / unexpected version for negative deltas
 *  - Updates score in matches / knockouts
 */
exports.processScoreEvent = onDocumentCreated("tournaments/{tournamentId}/events/{eventId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const data = snapshot.data();
    const tournamentId = event.params.tournamentId;
    const eventId = event.params.eventId;

    // We can't use transactions spanning > 500 documents naturally, 
    // but we can transactionalize reading the marker and writing the match score here.
    return db.runTransaction(async (transaction) => {
        const markerRef = db.doc(`tournaments/${tournamentId}/applied_events/${eventId}`);
        const markerDoc = await transaction.get(markerRef);

        // Idempotency: skip if already applied
        if (markerDoc.exists) return;

        // Deduplication (prevents multiple admins tapping at once)
        // actionKey = match/knockoutIdx : team : delta
        const scope = data.isKnockout ? "knockouts" : "matches";
        const actionKey = `${scope}_${data.mIdx}_${data.team}_${data.delta}`;
        const dedupeRef = db.doc(`tournaments/${tournamentId}/dedupe_recent/${actionKey}`);
        const dedupeDoc = await transaction.get(dedupeRef);

        // Firestore Event creation time as basis for anti-riddle
        const triggerTime = Date.parse(event.time); // event.time from CloudEvent

        if (dedupeDoc.exists) {
            const prev = dedupeDoc.data();
            // Same admin allowed to rapidly tap (+1), but DIFFERENT admins are throttled
            if (prev.sourceId !== data.sourceId && (triggerTime - prev.triggerTime < 650)) {
                // Ignore duplicate
                transaction.set(markerRef, { processedAt: FieldValue.serverTimestamp(), status: 'suppressed_duplicate' });
                transaction.update(event.data.ref, { processingStatus: 'suppressed_duplicate', processedAt: FieldValue.serverTimestamp() });
                return;
            }
        }

        // Get match state
        const matchRef = db.doc(`tournaments/${tournamentId}/${scope}/${data.mIdx}`);
        const matchDoc = await transaction.get(matchRef);

        if (!matchDoc.exists) {
            transaction.set(markerRef, { processedAt: FieldValue.serverTimestamp(), status: 'error_match_not_found' });
            return;
        }

        const matchState = matchDoc.data();
        let targetScoreField = (data.team === "A") ? "sA" : "sB";
        let currentScore = matchState[targetScoreField] || 0;
        let currentVersion = matchState.version || 0;

        let newScore = currentScore;
        let finalStatus = 'applied';

        if (data.delta > 0) {
            newScore = currentScore + 1;
            currentVersion++;
        } else if (data.delta < 0) {
            // Negative drift check: Absolute set semantics
            if (data.expectedVersion !== currentVersion) {
                // Stale conflict!
                finalStatus = 'stale_conflict';
            } else {
                newScore = data.nextScore; // strictly apply what they expect
                currentVersion++;
            }
        }

        if (finalStatus === 'applied') {
            transaction.update(matchRef, {
                [targetScoreField]: newScore,
                version: currentVersion
            });

            // Mark dedupe success
            transaction.set(dedupeRef, { sourceId: data.sourceId, triggerTime });
        }

        // Apply idempotency marker
        transaction.set(markerRef, { processedAt: FieldValue.serverTimestamp(), status: finalStatus });
        transaction.update(event.data.ref, { processingStatus: finalStatus, processedAt: FieldValue.serverTimestamp() });
    });
});

/**
 * 2. updateLeaderboardTotals
 * Trigger: onUpdate for matches / knockouts
 * Logic:
 *  - Sync true->false or false->true match 'done' changes to leaderboard
 */
const handleMatchDoneChange = async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    // We only care about completion transition
    if (before.done === after.done) return;

    const tournamentId = event.params.tournamentId;
    const isKnockout = event.params.knockoutId != null;
    const mIdx = isKnockout ? event.params.knockoutId : event.params.matchId;
    const scope = isKnockout ? 'knockouts' : 'matches';

    // Use the snapshot that was actually "applied" to standings.
    // For done:false->true, use after. For done:true->false, use before.
    const scoredMatch = after.done ? after : before;
    const aParticipants = resolveParticipants(scoredMatch.tA);
    const bParticipants = resolveParticipants(scoredMatch.tB);

    const p1Name = aParticipants.p1;
    const p2Name = aParticipants.p2;
    const p3Name = bParticipants.p1;
    const p4Name = bParticipants.p2;

    const pK1 = p1Name ? playerKeyForName(p1Name) : null;
    const pK2 = p2Name ? playerKeyForName(p2Name) : null;
    const pK3 = p3Name ? playerKeyForName(p3Name) : null;
    const pK4 = p4Name ? playerKeyForName(p4Name) : null;

    // Identify winners/losers exactly from the snapshot
    const sA = Number(scoredMatch.sA || 0);
    const sB = Number(scoredMatch.sB || 0);

    // Determine deltas to apply
    let deltaW_A = sA > sB ? 1 : 0;
    let deltaL_A = sA < sB ? 1 : 0;
    let deltaW_B = sB > sA ? 1 : 0;
    let deltaL_B = sB < sA ? 1 : 0;

    let multiplier = (after.done === true && before.done === false) ? 1 : -1;

    // We want exact parity with RTDB increment math
    const applyToPlayer = (tx, playerKey, playerName, winDelta, lossDelta, pointsFor, pointsAgainst) => {
        if (!playerKey) return;
        const pRef = db.doc(`leaderboard/${playerKey}`);

        let pDelta = 0;
        if (winDelta > 0) pDelta = 3;
        else if (sA === sB) pDelta = 1; // tie

        tx.set(pRef, {
            name: playerName || "",
            p: FieldValue.increment(pDelta * multiplier),
            w: FieldValue.increment(winDelta * multiplier),
            l: FieldValue.increment(lossDelta * multiplier),
            pf: FieldValue.increment(pointsFor * multiplier),
            pa: FieldValue.increment(pointsAgainst * multiplier),
            pd: FieldValue.increment((pointsFor - pointsAgainst) * multiplier)
        }, { merge: true });
    };

    return db.runTransaction(async (transaction) => {
        const markerRef = db.doc(`tournaments/${tournamentId}/leaderboard_applied/${scope}_${mIdx}`);
        const markerDoc = await transaction.get(markerRef);

        if (multiplier === 1) {
            // applying
            if (markerDoc.exists) return; // already applied
            transaction.set(markerRef, { appliedAt: FieldValue.serverTimestamp() });
        } else {
            // reversing
            if (!markerDoc.exists) return; // not applied, can't reverse
            transaction.delete(markerRef); // allow re-applying later
        }

        applyToPlayer(transaction, pK1, p1Name, deltaW_A, deltaL_A, sA, sB);
        applyToPlayer(transaction, pK2, p2Name, deltaW_A, deltaL_A, sA, sB);
        applyToPlayer(transaction, pK3, p3Name, deltaW_B, deltaL_B, sB, sA);
        applyToPlayer(transaction, pK4, p4Name, deltaW_B, deltaL_B, sB, sA);
    });
};

exports.updateLeaderboardOnMatch = onDocumentUpdated("tournaments/{tournamentId}/matches/{matchId}", handleMatchDoneChange);
exports.updateLeaderboardOnKnockout = onDocumentUpdated("tournaments/{tournamentId}/knockouts/{knockoutId}", handleMatchDoneChange);
