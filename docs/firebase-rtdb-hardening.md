# Firebase RTDB Hardening

This project now includes a deployable RTDB ruleset in `firebase/database.rules.json` plus `firebase.json`.

## What this ruleset enforces

- Root deny-by-default.
- Public read for app-facing data:
  - `tournaments_meta`
  - `tournament_data`
  - `leaderboard_global`
  - `leaderboard_meta`
  - `roster`
- Authenticated writes only (`auth != null`) for all write paths.
- Event payload validation for `tournament_data/{id}/events/{eventId}`.
- Leaderboard shape validation for `leaderboard_global/{playerKey}`.
- Idempotency marker validation for `leaderboard_applied/{id}/{scope}/{idx}`.
- Indexes for hot query/sort fields:
  - `tournaments_meta`: `createdAt`, `status`, `format`, `winner`, `playerCount`
  - `tournament_data/{id}/events`: `ts`, `clientEventId`
  - `leaderboard_global`: `name`, `w`, `p`, `pd`

## Runtime requirement

Enable **Anonymous Authentication** in Firebase Console:

- Firebase Console -> Authentication -> Sign-in method -> Anonymous -> Enable

The app now bootstraps anonymous auth at startup and before write operations.

## Deploy rules

```bash
firebase login
firebase use <your-project-id>
firebase deploy --only database
```

## Notes

- This secures writes against unauthenticated traffic, but it is not role-based admin security.
- For stricter admin-only writes, add custom claims (e.g. `auth.token.tournament_admin === true`) or move sensitive writes to Cloud Functions.
