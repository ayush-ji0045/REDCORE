# REDCORE Draw & Guess setup

This adds Draw & Guess as game 7 without replacing the first six cards or their routes. The page reuses the existing Firebase app and Google Authentication, and uses Firebase Realtime Database for room presence, drawing updates, chat, rounds, and scores. Existing Firestore dashboard records are not modified.

## Enable Realtime Database

1. Open the Firebase console for project `redcore-99`.
2. Go to **Build → Realtime Database** and create a database.
3. Open the **Rules** tab and review/publish the starter rules from `database.rules.json`. Rules in a JSON file are not automatically published by GitHub.
4. Ensure Google is enabled under **Authentication → Sign-in method** and your deployed hostname is listed under **Authorized domains**.
5. Serve the site over HTTPS or localhost. ES modules and Google sign-in will not work reliably when opening the HTML file directly with `file://`.

## Current implementation status and security note

The room/lobby, membership UI, live drawing stream, chat, timed rounds, and score display are wired to Realtime Database. The starter rules require authentication and restrict room reads to members, drawing writes to the current artist, and host controls to the host.

**Before a public launch, score validation and secret-word checking must be moved to a trusted server.** This browser prototype currently checks guesses in client code, which a modified client could exploit. Firebase Realtime Database rules alone cannot safely conceal a word from a player who is allowed to read the entire room record, and the current room shape needs to be split into public room state and artist-only secret state for that. Do not describe the game as cheat-proof or production-secure until that server-side validation and private word path are deployed. A trusted Cloud Functions implementation may require enabling the Firebase Blaze billing plan; check current Firebase pricing before enabling billing.

## Quick test

- Sign in using two separate Google accounts.
- Create a room on one device and join using the room code or invite link on the other.
- Verify that both players appear and the host can start the round.
- Test drawing on the artist's device and check that strokes appear on the other device, then try chat and reconnecting.
- Keep this feature branch separate until the test passes. The changes are not deployed automatically by this commit.
