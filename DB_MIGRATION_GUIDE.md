# Database Migration Guide: RTDB to Firestore

This document outlines the step-by-step process used to migrate the `pick-pro` application from Firebase Realtime Database (RTDB) to Cloud Firestore, implementing a "Dual-Write" architecture for offline resilience. 

Keep this as a reference if you ever need to set up a new environment (e.g., staging) or rerun the migration process.

## 1. Prerequisites (Firebase Console)
Before running any scripts, ensure the target Firebase Project is fully prepared:
1. **Billing:** The project MUST be on the **Blaze (pay-as-you-go)** plan to use Node.js 22 (2nd Gen) Cloud Functions.
2. **Firestore Database:** You must manually click **"Create Database"** in the Firestore section of the Firebase Console. The migration script will fail with a `5 NOT_FOUND` error if the database instance hasn't been provisioned yet.
3. **Service Account Key:** 
   - Go to Project Settings -> Service Accounts.
   - Click "Generate New Private Key" and download the `.json` file.
   - **Crucial:** Rename this file (e.g., `prod-service-account.json` or `dev-service-account.json`) and place it in the root directory. Ensure `*.json` remains in your `.gitignore` to prevent leaking credentials.

## 2. Environment Configuration
The application and scripts rely on specific environment variables to control the migration state and authenticate the Admin SDK.

In your target `.env` file (e.g., `.env.production` or `.env.development`), configure the following:

```env
# Controls where the React app reads data from ("rtdb" or "firestore")
VITE_READ_SOURCE="firestore"

# Controls where the React app writes data ("rtdb_only", "dual_write", or "firestore_only")
VITE_WRITE_MODE="dual_write"

# Absolute or relative path to the Service Account JSON downloaded in Step 1
GOOGLE_APPLICATION_CREDENTIALS="./prod-service-account.json"
```

## 3. The Backfill Script (`scripts/backfillFirestore.js`)
This one-time Node.js script uses the Firebase Admin SDK to snapshot the entire RTDB (Tournaments, Leaderboards, Roster) and write it into the new Firestore schema using batched transactions.

**To execute:**
1. Open `scripts/backfillFirestore.js`.
2. Ensure the `dotenv.config()` path points to your target environment (e.g., `dotenv.config({ path: ".env.production" });`).
3. Run the script:
   ```bash
   node scripts/backfillFirestore.js
   ```
4. *Troubleshooting:* If you see `app/invalid-credential`, ensure your terminal doesn't have an old `GOOGLE_APPLICATION_CREDENTIALS` export overriding your `.env` file. You can force it inline:
   `GOOGLE_APPLICATION_CREDENTIALS=./your-key.json node scripts/backfillFirestore.js`

## 4. Deploying Cloud Functions & Rules
Once the historical data is backfilled, you must deploy the Firestore Security Rules (`firestore.rules`), indexes (`firestore.indexes.json`), and Cloud Functions (`functions/index.js`).

```bash
firebase deploy --only functions,firestore --project your-project-id
```

### ⚠️ First-Time Deployment Gotcha (Eventarc Permissions)
Because `pick-pro` utilizes 2nd Gen Cloud Functions (which run on Cloud Run and trigger via Eventarc), a first-time deployment to a new project will often fail with an `Eventarc Service Agent` permission error.

To fix this, open the **Google Cloud Shell** for your project and run these three commands (replace `your-project-id` and `your-project-number`):

```bash
gcloud projects add-iam-policy-binding your-project-id \
    --member=serviceAccount:service-your-project-number@gcp-sa-pubsub.iam.gserviceaccount.com \
    --role=roles/iam.serviceAccountTokenCreator

gcloud projects add-iam-policy-binding your-project-id \
    --member=serviceAccount:your-project-number-compute@developer.gserviceaccount.com \
    --role=roles/run.invoker

gcloud projects add-iam-policy-binding your-project-id \
    --member=serviceAccount:your-project-number-compute@developer.gserviceaccount.com \
    --role=roles/eventarc.eventReceiver
```
*Wait 2-3 minutes for IAM to propagate, then rerun the `firebase deploy` command.*

## 5. Migration Completion
Once the functions are deployed and the script has run:
1. The app acts in `dual_write` mode, writing user actions to both RTDB and Firestore.
2. The Cloud Functions act as the ultimate source of truth, establishing idempotency and calculating leaderboards in the background.
3. The Vite PWA Service worker and Firestore `persistentLocalCache` will handle complete offline resilience for active tournaments.
