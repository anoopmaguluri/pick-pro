# Pick-Pro

Pick-Pro is a React + Vite tournament app for live scoring, standings, and global rankings.

## Requirements

- Node.js `20.19+` or `22.12+`
- npm (or Yarn 4, since `packageManager` is configured for Yarn)

## Environment Setup

The app needs Firebase env vars (used in `src/services/firebase.js`):

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_DB_URL`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

Migration/runtime flags (used in `src/services/db.js`):

- `VITE_READ_SOURCE` = `rtdb` | `firestore` (default: `rtdb`)
- `VITE_WRITE_MODE` = `rtdb_only` | `dual_write` | `firestore_only` (default: `dual_write`)
- `VITE_PREFETCH_ENABLED` = `true` | `false` (default: `true`)
- `VITE_PREFETCH_TOURNAMENT_LIMIT` = integer (default: `8`)

When `VITE_READ_SOURCE=firestore`, the app can prefetch recent tournaments (`state/current`, `matches`, `knockouts`) in the background so they are available after offline reload.

Create a local env file (example):

```bash
cp .env.development .env.local
```

Then edit `.env.local` as needed for your Firebase project.

## Install

```bash
npm install
```

## Run in Development

```bash
npm run dev
```

The app starts with Vite on host mode (`vite --host`).

## Build and Preview

Production mode:

```bash
npm run build
npm run preview
```

Development-mode build (recommended for offline testing against dev Firebase config):

```bash
npm run build -- --mode development
npm run preview
```

Build output is generated in:

```bash
dist/
```

## Offline Testing Notes

- `npm run dev` is not a reliable offline hard-refresh test because Vite HMR endpoints require network.
- Use `build + preview` for realistic PWA/offline behavior.
- Test flow:
1. Open app online once (so service worker + data cache can warm).
2. Switch DevTools network to offline.
3. Refresh and verify hub/tournament state.

## Tests and Lint

```bash
npm run test:ci
npm run lint
```

## Firebase Notes

- Realtime Database rules: `firebase/database.rules.json`
- Firestore rules: `firestore.rules`
- Firestore indexes: `firestore.indexes.json`

Deploy Firebase rules/indexes:

```bash
firebase deploy --only database,firestore:rules,firestore:indexes
```

Deploy Cloud Functions:

```bash
firebase deploy --only functions
```

- Anonymous auth must be enabled in Firebase Auth for write operations.
- Cloud Functions (v2 / Node 22) require Blaze plan enabled on the Firebase project.

## Optional Backfill Script

If migrating historical data from RTDB to Firestore:

```bash
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/backfillFirestore.js
```
