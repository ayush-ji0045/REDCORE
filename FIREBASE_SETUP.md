# Connect REDCORE to Firebase

REDCORE is a static GitHub Pages site. Firebase provides Google sign-in and a private Firestore space for each player's game activity. A Google sign-in creates the player's REDCORE ID the first time they use it.

## 1. Create a Firebase project

1. Create a project in the [Firebase console](https://console.firebase.google.com/).
2. Add a Web app in Project settings.
3. Copy its web app config into `firebase-config.js`, replacing each `YOUR_...` value. The web config is intended for browser apps; do not put service account keys or private credentials in this file.

## 2. Enable Google sign-in

In Firebase Console, open **Authentication → Sign-in method**, enable **Google**, and save.

Under **Authentication → Settings → Authorized domains**, add the hostname serving the site: `ayush-ji0045.github.io`. Add `redcore99.netlify.app` too only if you want Google sign-in to work on that Netlify copy.

## 3. Create and secure the progress database

1. Create a **Cloud Firestore Standard edition** database.
2. Open **Firestore Database → Rules**.
3. Paste the current contents of `firestore.rules` and publish them. Republish the rules whenever this file changes.

The rules restrict player activity records to the signed-in owner of each account. REDCORE saves game title, play count, active playtime, last-played time, and best score where a game exposes one. The dashboard uses saved active playtime to calculate player levels. The Flappy Yadav game runs on a third-party site inside an iframe; REDCORE can record its visits but cannot inspect activity within that iframe, so its playtime is counted while the page remains visible.

## Saved data

REDCORE stores game title, play count, total active play seconds, and score progress when available at `users/{your Firebase user ID}/games/{game ID}`. The dashboard only reads the signed-in player's records.

## Notes

- Firebase's browser config is public by design. Firestore Security Rules protect saved player data.
- This setup does not deploy REDCORE or publish the GitHub Pages site.
