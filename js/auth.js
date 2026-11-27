/* -------------------------------------------------------------
   SHOOTING STARS - Authentication Module
   Handles Google Sign-In, sign-out, and auth state monitoring.
   Uses Firebase Authentication with onAuthStateChanged persistence.
   ------------------------------------------------------------- */

import {
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    signOut,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

import { auth }              from './firebase.js';
import { createOrUpdateUser } from './db.js';

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

// ── State ────────────────────────────────────────────────────────────────────
let _currentUser = null;
let _authListeners = [];

/** Returns the currently authenticated Firebase user (or null). */
export function getCurrentUser() {
    return _currentUser;
}

/** Register a callback that fires whenever auth state changes. */
export function onAuthChange(cb) {
    _authListeners.push(cb);
}

function _notifyListeners(user) {
    _currentUser = user;
    _authListeners.forEach(cb => cb(user));
}

// ── Initialise: listen for auth state & handle redirect result ────────────────
export async function initAuth() {
    // Handle the redirect result first (for browsers that blocked the popup)
    try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
            await createOrUpdateUser(result.user);
        }
    } catch (err) {
        console.warn('[Auth] getRedirectResult error:', err.message);
    }

    // Set up the persistent auth-state observer
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await createOrUpdateUser(user);
        }
        _notifyListeners(user);
    });
}

// ── Sign in ───────────────────────────────────────────────────────────────────
/**
 * Attempts signInWithPopup; falls back to signInWithRedirect on failure.
 * Returns { user } on success or throws with a human-readable message.
 */
export async function signInWithGoogle() {
    try {
        const result = await signInWithPopup(auth, provider);
        await createOrUpdateUser(result.user);
        return result.user;
    } catch (err) {
        // Popup was blocked or unavailable → fall back to redirect
        if (
            err.code === 'auth/popup-blocked' ||
            err.code === 'auth/popup-closed-by-user' ||
            err.code === 'auth/cancelled-popup-request'
        ) {
            await signInWithRedirect(auth, provider);
            return null; // page will reload; result handled in initAuth
        }
        throw _friendlyError(err);
    }
}

// ── Sign out ──────────────────────────────────────────────────────────────────
export async function signOutUser() {
    await signOut(auth);
}

// ── Error helper ──────────────────────────────────────────────────────────────
function _friendlyError(err) {
    const map = {
        'auth/network-request-failed': 'Network error. Check your internet connection and try again.',
        'auth/user-disabled':           'This account has been disabled. Contact support.',
        'auth/account-exists-with-different-credential': 'An account already exists with that email address.',
        'auth/internal-error':          'An internal error occurred. Please try again.',
    };
    const msg = map[err.code] || err.message || 'Sign-in failed. Please try again.';
    const friendly = new Error(msg);
    friendly.code = err.code;
    return friendly;
}
