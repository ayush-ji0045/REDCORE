import { auth, firebaseReady, onAuthStateChanged } from "./auth.js";
import { db } from "./firebase.js";
import { collection, doc, getDoc, increment, runTransaction, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const games = {
  "game": "Flappy Yadav",
  "game2": "Day Predictor",
  "iq_test": "IQ Test",
  "spend-ambani": "Spend Ambani Money",
  "runner": "REDCORE Runner",
  "rhythm": "Neon Rhythm 3D"
};
const gameId = location.pathname.split("/").pop().replace(/\.html?$/i, "");
const title = games[gameId];
if (firebaseReady && title && auth) {
  let userId = null;
  let playRecorded = false;
  let startedAt = Date.now();
  let lastProgress = null;
  let saveTimer = null;

  function progressValue() {
    const iq = document.querySelector("#scoreBox");
    if (iq?.textContent.trim()) {
      const match = iq.textContent.match(/IQ SCORE:\s*(\d+)/i);
      if (match) return Number(match[1]);
    }
    const score = document.querySelector("#score");
    const finalScore = document.querySelector("#finalScore");
    const text = (finalScore?.textContent || "").trim();
    const number = Number((text && text !== "0" ? text : score?.textContent || "").replace(/,/g, ""));
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  async function recordPlay() {
    if (!userId || playRecorded) return;
    playRecorded = true;
    const ref = doc(db, "users", userId, "games", gameId);
    try {
      await runTransaction(db, async transaction => {
        const existing = await transaction.get(ref);
        const previous = existing.exists() ? existing.data() : {};
        transaction.set(ref, {
          gameId, title,
          playCount: (Number(previous.playCount) || 0) + 1,
          bestScore: Number(previous.bestScore) || 0,
          lastPlayed: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      });
    } catch (error) { console.warn("REDCORE could not save this play:", error); }
  }

  async function saveProgress() {
    if (!userId) return;
    const value = progressValue();
    if (value === null || value === lastProgress) return;
    lastProgress = value;
    const ref = doc(db, "users", userId, "games", gameId);
    try {
      await runTransaction(db, async transaction => {
        const existing = await transaction.get(ref);
        const previous = existing.exists() ? existing.data() : {};
        transaction.set(ref, {
          gameId, title,
          playCount: Number(previous.playCount) || 0,
          bestScore: Math.max(Number(previous.bestScore) || 0, value),
          lastScore: value,
          lastPlayed: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      });
    } catch (error) { console.warn("REDCORE could not save game progress:", error); }
  }

  onAuthStateChanged(auth, user => {
    userId = user?.uid || null;
    if (userId) {
      startedAt = Date.now();
      playRecorded = false;
      recordPlay();
      clearInterval(saveTimer);
      saveTimer = setInterval(saveProgress, 12000);
    } else {
      clearInterval(saveTimer);
      userId = null;
    }
  });
  window.addEventListener("pagehide", saveProgress);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") saveProgress(); });
}
