import { auth, firebaseReady, onAuthStateChanged } from "./auth.js";
import { db } from "./firebase.js";
import { doc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

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
  let lastProgress = null;
  let saveTimer = null;
  let lastActivityAt = Date.now();
  let lastClockAt = Date.now();
  let wasVisible = !document.hidden;
  let pendingPlaytimeMs = 0;
  let playtimeWrite = Promise.resolve();

  const idleLimitMs = gameId === "game" ? Number.POSITIVE_INFINITY : 60_000;

  function markActivity() {
    lastActivityAt = Date.now();
  }

  document.addEventListener("keydown", markActivity, { passive: true });
  document.addEventListener("pointerdown", markActivity, { passive: true });
  document.addEventListener("touchstart", markActivity, { passive: true });
  document.addEventListener("wheel", markActivity, { passive: true });
  window.addEventListener("pointermove", () => {
    if (Date.now() - lastActivityAt > 1500) markActivity();
  }, { passive: true });

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

  function savePlaytime(seconds) {
    if (!userId || seconds < 1) return;
    const uid = userId;
    const ref = doc(db, "users", uid, "games", gameId);
    playtimeWrite = playtimeWrite.then(() => runTransaction(db, async transaction => {
      const existing = await transaction.get(ref);
      const previous = existing.exists() ? existing.data() : {};
      transaction.set(ref, {
        gameId, title,
        playCount: Number(previous.playCount) || 0,
        bestScore: Number(previous.bestScore) || 0,
        totalPlaySeconds: (Number(previous.totalPlaySeconds) || 0) + seconds,
        lastPlayed: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    })).catch(error => {
      console.warn("REDCORE could not save playtime. Publish the latest firestore.rules to enable levels:", error);
    });
  }

  function flushPlaytime() {
    const now = Date.now();
    if (userId && wasVisible) {
      const activeUntil = Math.min(now, lastActivityAt + idleLimitMs);
      pendingPlaytimeMs += Math.max(0, activeUntil - lastClockAt);
    }
    lastClockAt = now;
    const visibleNow = !document.hidden;
    if (visibleNow && !wasVisible) lastActivityAt = now;
    wasVisible = visibleNow;

    const seconds = Math.floor(pendingPlaytimeMs / 1000);
    if (seconds > 0 && userId) {
      pendingPlaytimeMs -= seconds * 1000;
      savePlaytime(seconds);
    }
  }

  onAuthStateChanged(auth, user => {
    if (!user && userId) {
      flushPlaytime();
      clearInterval(saveTimer);
      userId = null;
      return;
    }
    userId = user?.uid || null;
    if (userId) {
      const now = Date.now();
      lastActivityAt = now;
      lastClockAt = now;
      wasVisible = !document.hidden;
      playRecorded = false;
      recordPlay();
      clearInterval(saveTimer);
      saveTimer = setInterval(() => {
        saveProgress();
        flushPlaytime();
      }, 12000);
    } else {
      clearInterval(saveTimer);
    }
  });

  window.addEventListener("pagehide", () => {
    saveProgress();
    flushPlaytime();
  });
  document.addEventListener("visibilitychange", () => {
    flushPlaytime();
    if (document.visibilityState === "hidden") saveProgress();
  });
}
