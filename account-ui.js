import { auth, firebaseReady, onAuthStateChanged, signOut } from "./auth.js";

const style = document.createElement("style");
style.textContent = `
.rc-account{position:fixed;z-index:1100;right:18px;top:18px;display:flex;align-items:center;gap:9px;padding:8px 10px;border:1px solid #39f5ff55;border-radius:999px;background:#09111ee8;color:#edf5ff;font:700 13px/1.2 Inter,"Segoe UI",sans-serif;box-shadow:0 8px 30px #0008;backdrop-filter:blur(12px)}
.rc-account a,.rc-account button{color:#edf5ff;text-decoration:none;border:0;background:transparent;font:inherit;cursor:pointer}
.rc-account .rc-account-link{padding:6px 9px;border-radius:999px;background:#17253a}
.rc-account img{width:26px;height:26px;border-radius:50%}
.rc-account-status{color:#a7b4ca;font-weight:500}
@media(max-width:600px){.rc-account{top:10px;right:10px;font-size:12px;padding:6px 8px}.rc-account .rc-account-status{display:none}}
`;
document.head.append(style);

const bar = document.createElement("nav");
bar.className = "rc-account";
bar.setAttribute("aria-label", "Account");
bar.innerHTML = '<span class="rc-account-status">Checking account…</span><a class="rc-account-link" href="login.html">Sign in</a>';
document.body.append(bar);

const status = bar.querySelector(".rc-account-status");
const link = bar.querySelector(".rc-account-link");

if (!firebaseReady) {
  status.textContent = "Firebase setup needed";
  link.textContent = "Setup";
  link.href = "FIREBASE_SETUP.md";
} else {
  onAuthStateChanged(auth, user => {
    if (!user) {
      status.textContent = "Guest";
      link.textContent = "Sign in";
      link.href = "login.html";
      return;
    }
    status.textContent = user.displayName || "Signed in";
    link.textContent = "Dashboard";
    link.href = "dashboard.html";
    const image = user.photoURL ? document.createElement("img") : null;
    if (image) {
      image.src = user.photoURL;
      image.alt = "";
      bar.prepend(image);
    }
    let logout = bar.querySelector(".rc-signout");
    if (!logout) {
      logout = document.createElement("button");
      logout.className = "rc-signout";
      logout.type = "button";
      logout.textContent = "Sign out";
      logout.addEventListener("click", () => signOut(auth));
      bar.append(logout);
    }
  });
}
