import { auth, firebaseReady, onAuthStateChanged } from "./auth.js";
import { db } from "./firebase.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const nameEl = document.querySelector("#player-name");
const emailEl = document.querySelector("#player-email");
const photoEl = document.querySelector("#player-photo");
const listEl = document.querySelector("#game-list");
const countEl = document.querySelector("#game-count");

if (!firebaseReady) {
  nameEl.textContent = "Firebase setup needed";
  listEl.innerHTML = '<p class="status-message">Finish the steps in <a href="FIREBASE_SETUP.md">FIREBASE_SETUP.md</a> to connect your player account.</p>';
} else {
  onAuthStateChanged(auth, async user => {
    if (!user) {
      location.replace("login.html");
      return;
    }
    nameEl.textContent = user.displayName || "REDCORE player";
    emailEl.textContent = user.email || "";
    if (user.photoURL) { photoEl.src = user.photoURL; photoEl.hidden = false; }

    try {
      const snapshot = await getDocs(collection(db, "users", user.uid, "games"));
      const games = snapshot.docs.map(item => item.data()).sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
      countEl.textContent = `${games.length} game${games.length === 1 ? "" : "s"}`;
      if (!games.length) {
        listEl.innerHTML = '<p class="empty-state">Your play history will appear here after you sign in and play a REDCORE game.</p>';
        return;
      }
      listEl.replaceChildren(...games.map(game => {
        const card = document.createElement("article");
        card.className = "game-progress-card";
        const title = document.createElement("h3");
        title.textContent = game.title || game.gameId || "REDCORE game";
        const stats = document.createElement("div");
        stats.className = "progress-stats";
        const plays = document.createElement("span");
        plays.innerHTML = `PLAYS<b>${Number(game.playCount) || 0}</b>`;
        stats.append(plays);
        if (Number(game.bestScore) > 0) {
          const score = document.createElement("span");
          score.innerHTML = `BEST SCORE<b>${Number(game.bestScore).toLocaleString()}</b>`;
          stats.append(score);
        }
        const link = document.createElement("a");
        link.href = `${game.gameId}.html`;
        link.textContent = "Play again →";
        card.append(title, stats, link);
        return card;
      }));
    } catch (error) {
      listEl.innerHTML = '<p class="status-message">Could not load saved activity. Check your Firestore setup and security rules.</p>';
      console.error(error);
    }
  });
}
