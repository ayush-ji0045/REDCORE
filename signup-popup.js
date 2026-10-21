import { auth, firebaseReady, onAuthStateChanged, signInWithGoogle, friendlyAuthError } from "./auth.js";

const dialog = document.querySelector("#signup-dialog");
if (dialog) {
  const button = dialog.querySelector("#signup-google");
  const status = dialog.querySelector("#signup-status");
  const dismiss = dialog.querySelectorAll("[data-dismiss-signup]");
  const dismissedKey = "redcore-signup-dismissed";

  function hide(remember = true) {
    if (dialog.open) dialog.close();
    if (remember) {
      try { sessionStorage.setItem(dismissedKey, "yes"); } catch {}
    }
  }

  function show() {
    let dismissed = false;
    try { dismissed = sessionStorage.getItem(dismissedKey) === "yes"; } catch {}
    if (!dismissed && !dialog.open) dialog.showModal();
  }

  dismiss.forEach(control => control.addEventListener("click", () => hide()));
  dialog.addEventListener("click", event => {
    if (event.target === dialog) hide();
  });
  dialog.addEventListener("cancel", () => {
    try { sessionStorage.setItem(dismissedKey, "yes"); } catch {}
  });

  if (!firebaseReady) {
    button.disabled = true;
    status.textContent = "Google sign-up will be available after Firebase is connected.";
    show();
  } else {
    onAuthStateChanged(auth, user => {
      if (user) {
        hide(false);
      } else {
        window.setTimeout(show, 650);
      }
    });
    button.addEventListener("click", async () => {
      button.disabled = true;
      status.textContent = "Opening Google sign-in…";
      try {
        await signInWithGoogle();
        status.textContent = "";
      } catch (error) {
        status.textContent = friendlyAuthError(error);
      } finally {
        button.disabled = false;
      }
    });
  }
}
