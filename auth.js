import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { auth, firebaseReady } from "./firebase.js";

export { auth, firebaseReady, onAuthStateChanged, signOut };

export async function signInWithGoogle() {
  if (!firebaseReady) throw new Error("Firebase is not configured yet. Follow FIREBASE_SETUP.md first.");
  const provider = new GoogleAuthProvider();
  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    if (["auth/popup-blocked", "auth/popup-closed-by-user", "auth/operation-not-supported-in-this-environment"].includes(error.code)) {
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw error;
  }
}

export async function finishGoogleRedirect() {
  if (!firebaseReady) return null;
  return getRedirectResult(auth);
}

export function friendlyAuthError(error) {
  const messages = {
    "auth/unauthorized-domain": "Add this website's domain to Firebase's Authorized domains.",
    "auth/popup-closed-by-user": "The Google sign-in window was closed before finishing.",
    "auth/network-request-failed": "Check your internet connection and try again."
  };
  return messages[error?.code] || error?.message || "Sign-in could not be completed. Please try again.";
}
