/* -------------------------------------------------------------
   SHOOTING STARS - Firebase Initialisation
   Single-instance Firebase setup. Exports auth and db.
   Fill in your own firebaseConfig values from Firebase Console
   → Project Settings → Your apps → Web app → SDK setup.
   ------------------------------------------------------------- */

import { initializeApp }        from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth }              from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore }         from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

// ── Firebase Web App configuration ──────────────────────────────────────────
// Replace every placeholder below with the values from your Firebase Console.
// NEVER put Admin SDK / service-account private keys here.
// This file is safe for the browser; it only uses the public web config.
const firebaseConfig = {
    apiKey:            "AIzaSyCHRKWSrbrByMBm731TRxPhLhp3VAK-vWM",
    authDomain:        "shooting-sky-11975.firebaseapp.com",
    projectId:         "shooting-sky-11975",
    storageBucket:     "shooting-sky-11975.firebasestorage.app",
    messagingSenderId: "460829110993",
    appId:             "1:460829110993:web:93c83b5632bde407650bf0"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);
