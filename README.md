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

## Build for Production

```bash
npm run build
```

Build output is generated in:

```bash
dist/
```

## Preview Production Build

```bash
npm run preview
```

## Tests and Lint

```bash
npm run test:ci
npm run lint
```

## Firebase Notes

- Realtime Database rules are in `firebase/database.rules.json`.
- Deploy rules with:

```bash
firebase deploy --only database
```

- Anonymous auth must be enabled in Firebase Auth for write operations.
