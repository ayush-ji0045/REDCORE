import { auth, firebaseReady, onAuthStateChanged } from "./auth.js";
import { db } from "./firebase.js";
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const nameEl = document.querySelector("#player-name");
const emailEl = document.querySelector("#player-email");
const photoEl = document.querySelector("#player-photo");
const listEl = document.querySelector("#game-list");
const countEl = document.querySelector("#game-count");
const levelNumberEl = document.querySelector("#level-number");
const levelNameEl = document.querySelector("#level-heading");
const totalPlaytimeEl = document.querySelector("#total-playtime");
const levelProgressEl = document.querySelector("#level-progress");
const levelTrackEl = document.querySelector("#level-progress-track");
const levelProgressCopyEl = document.querySelector("#level-progress-copy");
const nextLevelNoteEl = document.querySelector("#next-level-note");
const reactorEl = document.querySelector("#core-reactor");
const reactorLevelEl = document.querySelector("#reactor-level");
const reactorTitleEl = document.querySelector("#reactor-title");
const levelupDialog = document.querySelector("#levelup-dialog");
const levelupRankEl = document.querySelector("#levelup-rank");
const levelupNumberEl = document.querySelector("#levelup-number");
const dismissLevelupButton = document.querySelector("#levelup-dismiss");
const levelCard = document.querySelector(".player-level-card");

const levels = [
  { name: "Rookie", atSeconds: 0 },
  { name: "Explorer", atSeconds: 60 * 60 },
  { name: "Challenger", atSeconds: 3 * 60 * 60 },
  { name: "Pro", atSeconds: 6 * 60 * 60 },
  { name: "Elite", atSeconds: 12 * 60 * 60 },
  { name: "Master", atSeconds: 25 * 60 * 60 },
  { name: "Legend", atSeconds: 50 * 60 * 60 }
];
const reactorColors = ["#3D5AFE", "#FF2FA3", "#FF8A1E", "#AEB6C2", "#F5F7FF", "#3D5AFE", "#FF2FA3"];
let displayedLevel = null;
let seenLevelStorageKey = null;

function formatPlaytime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (remainingMinutes === 0) return `${hours} hr`;
  return `${hours} hr ${remainingMinutes} min`;
}

function announceLevelUp(index) {
  const level = levels[index];
  if (!level || !levelupDialog || levelupDialog.open) return;
  levelupRankEl.textContent = level.name;
  levelupNumberEl.textContent = `LEVEL ${index + 1}`;
  reactorEl.classList.remove("is-leveling-up");
  void reactorEl.offsetWidth;
  reactorEl.classList.add("is-leveling-up");
  levelupDialog.showModal();
}

function updateLevel(rawSeconds) {
  const seconds = Math.max(0, Math.floor(Number(rawSeconds) || 0));
  let index = 0;
  for (let i = 1; i < levels.length; i += 1) {
    if (seconds >= levels[i].atSeconds) index = i;
    else break;
  }
  const current = levels[index];
  const next = levels[index + 1];
  const progress = next
    ? Math.min(100, ((seconds - current.atSeconds) / (next.atSeconds - current.atSeconds)) * 100)
    : 100;
  const color = reactorColors[index];

  levelNumberEl.textContent = `LEVEL ${index + 1}`;
  levelNameEl.textContent = current.name;
  totalPlaytimeEl.textContent = `${formatPlaytime(seconds)} active playtime`;
  levelProgressEl.style.width = `${progress}%`;
  levelTrackEl.setAttribute("aria-valuenow", String(Math.round(progress)));
  levelCard.style.setProperty("--core-color", color);
  levelCard.style.setProperty("--core-progress", `${progress}%`);
  reactorEl.style.setProperty("--core-color", color);
  reactorEl.setAttribute("aria-label", `Core Reactor, Level ${index + 1} ${current.name}, ${Math.floor(progress)} percent charged`);
  reactorLevelEl.textContent = String(index + 1).padStart(2, "0");
  reactorTitleEl.textContent = current.name.toUpperCase();

  if (next) {
    const remaining = next.atSeconds - seconds;
    levelProgressCopyEl.textContent = `${Math.floor(progress)}% to next level`;
    nextLevelNoteEl.textContent = `${formatPlaytime(remaining)} to ${next.name}`;
  } else {
    levelProgressCopyEl.textContent = "Maximum level reached";
    nextLevelNoteEl.textContent = "Legend status unlocked";
  }

  if (displayedLevel === null) {
    displayedLevel = index;
    try {
      const previous = Number(localStorage.getItem(seenLevelStorageKey));
      if (Number.isFinite(previous) && previous > 0 && previous < index) announceLevelUp(index);
      localStorage.setItem(seenLevelStorageKey, String(index));
    } catch { /* The dashboard still works when browser storage is unavailable. */ }
    return;
  }
  if (index > displayedLevel) announceLevelUp(index);
  displayedLevel = index;
  try { localStorage.setItem(seenLevelStorageKey, String(index)); } catch { /* Optional level-up memory. */ }
}

function renderGames(games) {
  games.sort((a, b) => (Number(b.playCount) || 0) - (Number(a.playCount) || 0));
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
    if (Number(game.totalPlaySeconds) > 0) {
      const playtime = document.createElement("span");
      playtime.innerHTML = `TIME<b>${formatPlaytime(Number(game.totalPlaySeconds))}</b>`;
      stats.append(playtime);
    }
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
}

dismissLevelupButton.addEventListener("click", () => levelupDialog.close());
levelupDialog.addEventListener("click", event => {
  if (event.target === levelupDialog) levelupDialog.close();
});
levelupDialog.addEventListener("close", () => reactorEl.classList.remove("is-leveling-up"));

updateLevel(0);

if (!firebaseReady) {
  nameEl.textContent = "Firebase setup needed";
  listEl.innerHTML = '<p class="status-message">Finish the steps in <a href="FIREBASE_SETUP.md">FIREBASE_SETUP.md</a> to connect your player account.</p>';
} else {
  onAuthStateChanged(auth, user => {
    if (!user) {
      location.replace("login.html");
      return;
    }
    nameEl.textContent = user.displayName || "REDCORE player";
    emailEl.textContent = user.email || "";
    if (user.photoURL) { photoEl.src = user.photoURL; photoEl.hidden = false; }
    seenLevelStorageKey = `redcore-seen-level-${user.uid}`;

    onSnapshot(collection(db, "users", user.uid, "games"), snapshot => {
      const games = snapshot.docs.map(item => item.data());
      const totalPlaySeconds = games.reduce((total, game) => total + (Number(game.totalPlaySeconds) || 0), 0);
      updateLevel(totalPlaySeconds);
      renderGames(games);
    }, error => {
      listEl.innerHTML = '<p class="status-message">Could not load saved activity. Check your Firestore setup and security rules.</p>';
      console.error(error);
    });
  });
}
