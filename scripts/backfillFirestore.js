import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";
import { readFileSync } from "node:fs";

dotenv.config({ path: ".env.production" });

// Initialize Admin SDK.
// If GOOGLE_APPLICATION_CREDENTIALS points to a JSON file, load it.
// Otherwise fall back to Application Default Credentials.
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const credential = credentialsPath
    ? cert(JSON.parse(readFileSync(credentialsPath, "utf8")))
    : applicationDefault();

const app = initializeApp({
    credential,
    databaseURL: process.env.VITE_FIREBASE_DB_URL,
});

const rtdb = getDatabase(app);
const firestore = getFirestore(app);

const buildMetaPlayerSummary = (players) => {
    // Simplified version of utils/leaderboard.js buildPlayersPreview
    const pCount = Array.isArray(players) ? players.length : 0;
    const preview = pCount > 0 ? players.slice(0, 3) : [];
    return {
        playersPreview: preview,
        playerCount: pCount
    };
};

async function backfill() {
    console.log("Starting Firebase RTDB -> Firestore Backfill...");

    // 1. Snapshot global trees
    const tournamentsSnapshot = await rtdb.ref("tournament_data").once("value");
    const metaSnapshot = await rtdb.ref("tournaments_meta").once("value");
    const rosterSnapshot = await rtdb.ref("roster").once("value");

    // The leaderboard relies on a separate collection schema in Firestore
    const leaderboardSnapshot = await rtdb.ref("leaderboard_global").once("value");

    const tournaments = tournamentsSnapshot.val() || {};
    const meta = metaSnapshot.val() || {};
    const roster = rosterSnapshot.val() || [];
    const leaderboard = leaderboardSnapshot.val() || {};

    const batchArgs = [];
    let currentBatch = firestore.batch();
    let batchCount = 0;

    const commitBatchProgressively = async () => {
        if (batchCount > 0) {
            batchArgs.push(currentBatch);
            currentBatch = firestore.batch();
            batchCount = 0;
        }

        if (batchArgs.length >= 10) {
            for (const b of batchArgs) await b.commit();
            batchArgs.length = 0;
            console.log("Committed batch chunks...");
        }
    };

    const addToBatch = async (ref, data) => {
        currentBatch.set(ref, data);
        batchCount++;
        if (batchCount >= 400) {
            await commitBatchProgressively();
        }
    };

    // 2. Migrate Roster
    console.log(`Migrating Roster (${roster.length} players)`);
    await addToBatch(firestore.doc("settings/roster"), { players: roster });

    // 3. Migrate Leaderboard
    console.log(`Migrating Leaderboard (${Object.keys(leaderboard).length} entries)`);
    for (const [key, stats] of Object.entries(leaderboard)) {
        await addToBatch(firestore.doc(`leaderboard/${key}`), stats);
    }

    // 4. Migrate Tournaments
    const tournamentIds = Object.keys(tournaments);
    console.log(`Migrating ${tournamentIds.length} Tournaments`);

    for (const tid of tournamentIds) {
        const fullData = tournaments[tid];
        const metaData = meta[tid] || {};

        // Root Meta Document
        const draftPlayers = fullData.draftPlayers || [];
        const summary = buildMetaPlayerSummary(draftPlayers);

        await addToBatch(firestore.doc(`tournaments/${tid}`), {
            id: tid,
            name: fullData.name || metaData.name || "Untitled",
            createdAt: fullData.createdAt || metaData.createdAt || Date.now(),
            status: fullData.status || metaData.status || "draft",
            format: fullData.format || metaData.format || "doubles",
            winner: fullData.winner || metaData.winner || null,
            ...summary
        });

        // State Sub-Document
        await addToBatch(firestore.doc(`tournaments/${tid}/state/current`), {
            draftPlayers: draftPlayers,
            players: fullData.players || [],
            teams: fullData.teams || [],
            pools: fullData.pools || [],
            scoreSnapshot: fullData.scoreSnapshot || null
        });

        // Matches Sub-Collection
        const matches = Array.isArray(fullData.matches) ? fullData.matches : Object.values(fullData.matches || {});
        for (let i = 0; i < matches.length; i++) {
            if (!matches[i]) continue;
            await addToBatch(firestore.doc(`tournaments/${tid}/matches/${i}`), matches[i]);
        }

        // Knockouts Sub-Collection
        const knockouts = Array.isArray(fullData.knockouts) ? fullData.knockouts : Object.values(fullData.knockouts || {});
        for (let i = 0; i < knockouts.length; i++) {
            if (!knockouts[i]) continue;
            await addToBatch(firestore.doc(`tournaments/${tid}/knockouts/${i}`), knockouts[i]);
        }

        // Note: Events are dropped during migration since historical score snapshots replace them.
        // We only care about active/future events.
    }

    // Flush any remaining
    await commitBatchProgressively();
    if (batchCount > 0) {
        await currentBatch.commit();
    }
    for (const b of batchArgs) {
        await b.commit();
    }

    console.log("Migration Complete!");
    process.exit(0);
}

backfill().catch(console.error);
