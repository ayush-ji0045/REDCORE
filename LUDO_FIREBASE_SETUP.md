# REDCORE LUDO — Firebase setup

REDCORE LUDO is Game 008. It uses the existing REDCORE Google Authentication setup and Firebase Realtime Database.

## Realtime Database rules

Merge the following `ludo` section into the existing root rules. Keep the existing `drawGuess` section; do not replace it.

```json
{
  "rules": {
    "drawGuess": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "ludo": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

These authenticated-user rules are a basic integration setting for initial testing, not an anti-cheat security model. They allow signed-in users to write game data. Before treating public matchmaking or rankings as production-trusted, move authoritative dice rolls, turn validation, captures, winner calculation, and power-up validation to trusted server-side logic and tighten the Realtime Database rules.

## Included gameplay

- Private room codes and invite links.
- Public quick-match queue for 2-player or 4-player rooms.
- Google-authenticated players.
- Traditional Ludo movement basics: four tokens, six to leave base, safe squares, captures, extra turn on six, and exact finish.
- A shield and boost charge earned by rolling a six.
- Responsive glass-style lobby and board.

## Important testing notes

- Use two separate Google accounts or browser profiles to test multiplayer.
- A room can start only when its selected player count is reached.
- The current browser implementation stores match state in Realtime Database. Verify the rules and test on the deployed HTTPS domain.
- This first implementation should be treated as a playable beta. Review edge cases and harden server-side validation before relying on competitive leaderboards.
