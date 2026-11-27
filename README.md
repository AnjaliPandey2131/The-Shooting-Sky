# Shooting Stars — Online Gaming Platform

**Shooting Stars** is a browser-based arcade survival game upgraded into a **Google-authenticated online gaming platform** with cloud-based player statistics, a personal dashboard, and persistent game history powered by Firebase.

---

## Overview

Guide a stickman across a fragile platform, dodge falling celestial hazards, collect coins to restore energy, and survive as the cosmos intensifies through five stages.

After this upgrade, the game requires **Google Sign-In** to play. Each player gets a personal dashboard with their cloud statistics and game history.

---

## New Features (Firebase Upgrade)

| Feature | Details |
|---|---|
| **Google Authentication** | Sign in with your Google account; session persists across refreshes |
| **Personal Dashboard** | Best score, last score, games played, coins, highest stage, total playtime |
| **Cloud Game History** | Every completed run is stored in Firestore, sorted newest first |
| **Firestore Security** | Per-user read/write isolation enforced server-side |
| **Local Score Migration** | Existing localStorage high score imported once to the cloud |
| **Back to Dashboard** | "📊 DASHBOARD" button on game-over screen |

---

## Project Structure

```text
.
├── index.html              # App shell (game container hidden until auth)
├── style.css               # All styles incl. login & dashboard
├── firestore.rules         # Firestore security rules (deploy to Firebase)
├── vercel.json             # Vercel SPA routing config
├── .env.example            # Firebase config template
├── README.md
└── js/
    ├── main.js             # Entry point → bootApp()
    ├── app.js              # App orchestrator (auth → dashboard → game)
    ├── firebase.js         # Firebase initialisation (fill in your config)
    ├── auth.js             # Google Sign-In / Sign-Out / onAuthStateChanged
    ├── db.js               # Firestore helpers (profile, runs, migration)
    ├── login.js            # Login screen UI module
    ├── dashboard.js        # Dashboard UI module
    ├── game.js             # Game engine (original + Firebase save hook)
    ├── config.js           # Physics, stages, hazards, feature tuning
    ├── player.js           # Player movement, physics, drawing
    ├── platform.js         # Ground segments and deterioration
    ├── floatingPlatforms.js# Moving platforms
    ├── hazards.js          # Falling hazards and meteor warnings
    ├── coins.js            # Coin scheduling, collection, and rewards
    ├── energy.js           # Energy, shield milestones, and analytics
    ├── rageBaitCoin.js     # Timed special-coin encounter
    ├── difficulty.js       # Stage progression and hazard scheduling
    ├── spaceBackground.js  # Procedural animated parallax scenery
    ├── particles.js        # Particle and visual effects
    ├── audio.js            # Procedural sound and optional speech
    └── ui.js               # HUD, menus, scores, and analytics chart
```

---

## Firestore Data Model

```
users/{uid}
  ├── uid, displayName, email, photoURL
  ├── createdAt, lastLoginAt, lastPlayedAt
  ├── bestScore, previousScore
  ├── totalGames, totalCoins, highestStage, totalSurvivalTime
  └── localScoreMigrated

users/{uid}/gameRuns/{runId}
  ├── score, coinsCollected, highestStageReached, highestStageName
  ├── survivalTime, stageWiseCoinAnalytics
  ├── gameStatus, playedAt
```

---

## Setup — Step by Step

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** and follow the wizard (Analytics is optional).
3. Click **Add app → Web (</>)** and register the app.
4. Copy the `firebaseConfig` object shown.

### 2. Configure js/firebase.js

Open [`js/firebase.js`](js/firebase.js) and replace every `REPLACE_WITH_…` placeholder with the values from the Firebase Console:

```js
const firebaseConfig = {
    apiKey:            "YOUR_API_KEY",
    authDomain:        "YOUR_PROJECT.firebaseapp.com",
    projectId:         "YOUR_PROJECT_ID",
    storageBucket:     "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId:             "YOUR_APP_ID"
};
```

> **Note:** These are **public** web config values. They are intentionally safe to include in browser code. Never add Admin SDK or service-account private keys to this file.

### 3. Enable Google Authentication

1. Firebase Console → **Authentication → Sign-in method**.
2. Enable **Google**.
3. Add your Vercel domain (e.g. `shooting-stars.vercel.app`) to **Authorised domains**.
4. `localhost` is authorised by default for local development.

### 4. Create Firestore Database

1. Firebase Console → **Firestore Database → Create database**.
2. Choose **Production mode** (we publish strict security rules).
3. Select your preferred region (e.g. `asia-south1` for India).

### 5. Publish Firestore Security Rules

Paste the contents of [`firestore.rules`](firestore.rules) into:  
Firebase Console → **Firestore Database → Rules → Edit rules → Publish**

Or deploy via CLI:
```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # select your project; use firestore.rules
firebase deploy --only firestore:rules
```

### 6. Add Authorised Domain for Production

After deploying to Vercel:  
Firebase Console → **Authentication → Settings → Authorised domains → Add domain**  
Add your Vercel URL, e.g. `shooting-stars.vercel.app`.

---

## Run Locally

No package manager required. Use any static HTTP server:

```powershell
# Python
python -m http.server 8000

# Node (npx)
npx serve .
```

Then open `http://localhost:8000`. Do **not** open `index.html` as a `file:` URL — ES modules require an HTTP server.

---

## Deploy on Vercel

### Option A — Vercel Dashboard

1. Push the project to GitHub.
2. Go to [vercel.com](https://vercel.com) → **New Project → Import from GitHub**.
3. Select the repository.
4. Framework preset: **Other** (static site).
5. No build command needed; output directory: `.` (or leave empty).
6. Click **Deploy**.

### Option B — Vercel CLI

```bash
npm install -g vercel
vercel login
vercel --prod
```

`vercel.json` already includes a rewrite rule so all routes resolve to `index.html`.

### After Deployment

1. Copy the Vercel production URL (e.g. `https://shooting-stars.vercel.app`).
2. Add it to Firebase → **Authentication → Authorised domains**.
3. Test Google Sign-In on the live HTTPS URL.

---

## Controls

| Action | Key |
|---|---|
| Move left | ← Left Arrow |
| Move right | → Right Arrow |
| Jump | ↑ Up Arrow |
| Crouch | ↓ Down Arrow |
| Pause / Resume | Space |
| Mute / Unmute | M or 🔊 button |

---

## Stages

| Stage | Time | Hazards |
|---|---|---|
| 1 — Calm Sky | 0–30 s | Shooting stars |
| 2 — Meteor Shower | 30–60 s | Stars, hailstones |
| 3 — Asteroid Storm | 60–90 s | Stars, hailstones, asteroids; ground cracks |
| 4 — Breaking World | 90–120 s | Adds fireballs, meteor waves; ground collapses |
| 5 — Ultimate Survival | 120 s+ | All hazards at maximum intensity |

---

## Security Notes

- Firestore rules enforce per-user isolation using `request.auth.uid`.
- No server secrets or Admin SDK credentials are present in browser code.
- The `localScoreMigrated` flag ensures the localStorage score is imported exactly once per account.
- Client-side validation alone is not a security mechanism; all critical rules are enforced server-side by Firestore.
- For anti-cheat protection of score submissions in the future, a Cloud Function (trusted backend) would be needed.

---

## Technologies

- HTML5, CSS3, Canvas 2D API
- Vanilla JavaScript with native ES modules (no build system required)
- Firebase Authentication (Google Sign-In)
- Cloud Firestore
- Firebase JavaScript Modular SDK v10 (loaded from CDN)
- Web Audio API, optional Web Speech API
- Google Fonts (Orbitron, Press Start 2P, Outfit)
- Vercel (static hosting)

---

## Changelog

**v2.0.0 — Firebase Upgrade**
- Added Google Authentication (signInWithPopup + redirect fallback).
- Added personal player dashboard with Firestore statistics.
- Added game run persistence: score, coins, stage, survival time saved per run.
- Added game history panel (10 runs per page, paginated).
- Added localStorage high-score migration (runs once per account).
- Added "📊 DASHBOARD" button on game-over screen.
- Added Firestore security rules (per-user isolation).
- Added vercel.json for SPA deployment.
- Added `.env.example` for Firebase config documentation.
- Updated `main.js`, `game.js`, `index.html`, `style.css`.
- **All original game mechanics, physics, hazards, coins, energy, shield, and Rage Bait Coin are fully preserved.**

**v1.x — Original Game**
- Canvas-rendered stickman survival arcade.
- Energy system, shield milestones, moving platforms.
- Five stages, all hazard types, Rage Bait Coin encounter.
- Procedural sound and particle effects.
- LocalStorage high score.

---

## License

No explicit license is currently assigned. No reuse permissions are granted by this README.

---

*Developed by Anjali Pandey*
