/* -------------------------------------------------------------
   SHOOTING STARS - Firestore Database Module
   User profile management and game-run persistence.
   All reads/writes are scoped to request.auth.uid — matches
   the security rules in firestore.rules.
   ------------------------------------------------------------- */

import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    addDoc,
    collection,
    serverTimestamp,
    runTransaction,
    query,
    orderBy,
    limit,
    getDocs,
    startAfter,
    increment
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

import { db } from './firebase.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
const userRef  = uid => doc(db, 'users', uid);
const runsRef  = uid => collection(db, 'users', uid, 'gameRuns');

// ── Create / update user profile on login ────────────────────────────────────
/**
 * Creates the user document if it doesn't exist, or updates login timestamp.
 * Safe to call repeatedly — will not overwrite statistics.
 */
export async function createOrUpdateUser(firebaseUser) {
    const ref  = userRef(firebaseUser.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
        // First time — seed empty profile
        await setDoc(ref, {
            uid:               firebaseUser.uid,
            displayName:       firebaseUser.displayName || 'Space Traveller',
            email:             firebaseUser.email || '',
            photoURL:          firebaseUser.photoURL || '',
            createdAt:         serverTimestamp(),
            lastLoginAt:       serverTimestamp(),
            bestScore:         0,
            previousScore:     0,
            totalGames:        0,
            totalCoins:        0,
            highestStage:      0,
            totalSurvivalTime: 0,
            lastPlayedAt:      null,
            localScoreMigrated: false
        });
    } else {
        // Subsequent logins — only update mutable profile fields
        await updateDoc(ref, {
            displayName: firebaseUser.displayName || snap.data().displayName,
            email:       firebaseUser.email       || snap.data().email,
            photoURL:    firebaseUser.photoURL    || snap.data().photoURL,
            lastLoginAt: serverTimestamp()
        });
    }
}

// ── Load user profile ─────────────────────────────────────────────────────────
export async function loadUserProfile(uid) {
    const snap = await getDoc(userRef(uid));
    return snap.exists() ? snap.data() : null;
}

// ── Migrate local high score (runs once per account) ─────────────────────────
/**
 * Reads the local high score from localStorage (if any) and writes it to
 * Firestore only if it beats the existing cloud bestScore.
 * Sets localScoreMigrated = true afterwards to prevent double-import.
 */
export async function migrateLocalScore(uid, storageKey) {
    try {
        const snap = await getDoc(userRef(uid));
        if (!snap.exists()) return;

        const profile = snap.data();
        if (profile.localScoreMigrated) return; // already done

        const localScore = parseInt(localStorage.getItem(storageKey) || '0', 10) || 0;
        if (localScore <= 0) {
            await updateDoc(userRef(uid), { localScoreMigrated: true });
            return;
        }

        // Only import if the local score beats the cloud record
        await runTransaction(db, async tx => {
            const txSnap = await tx.get(userRef(uid));
            const data   = txSnap.data();
            const updates = { localScoreMigrated: true };
            if (localScore > (data.bestScore || 0)) {
                updates.bestScore = localScore;
            }
            tx.update(userRef(uid), updates);
        });

        console.log(`[DB] Local score ${localScore} migration complete.`);
    } catch (err) {
        console.warn('[DB] Local score migration failed (non-fatal):', err.message);
    }
}

// ── Save a completed game run ─────────────────────────────────────────────────
/**
 * Saves the game result atomically.
 * - Writes one document to users/{uid}/gameRuns/{runId}
 * - Atomically updates the summary statistics on the user document
 * Returns { runId, isNewBest } or throws on error.
 *
 * @param {string} uid
 * @param {{ score, coinsCollected, highestStageReached, highestStageName,
 *           survivalTime, stageWiseCoinAnalytics, gameStatus }} runData
 */
export async function saveGameRun(uid, runData) {
    const {
        score             = 0,
        coinsCollected    = 0,
        highestStageReached = 1,
        highestStageName  = 'CALM SKY',
        survivalTime      = 0,
        stageWiseCoinAnalytics = [],
        gameStatus        = 'completed'
    } = runData;

    const roundedScore   = Math.floor(score);
    const roundedTime    = Math.round(survivalTime);
    const roundedCoins   = Math.floor(coinsCollected);

    let runId   = null;
    let isNewBest = false;

    // 1. Write game run document first (outside the transaction for atomicity)
    const runDoc = await addDoc(runsRef(uid), {
        score:               roundedScore,
        coinsCollected:      roundedCoins,
        highestStageReached,
        highestStageName,
        survivalTime:        roundedTime,
        stageWiseCoinAnalytics,
        gameStatus,
        playedAt:            serverTimestamp()
    });
    runId = runDoc.id;

    // 2. Atomically update summary statistics
    await runTransaction(db, async tx => {
        const txSnap = await tx.get(userRef(uid));
        if (!txSnap.exists()) return;

        const data = txSnap.data();
        const newBest = roundedScore > (data.bestScore || 0);
        isNewBest     = newBest;

        const updates = {
            previousScore:     roundedScore,
            totalGames:        (data.totalGames     || 0) + 1,
            totalCoins:        (data.totalCoins      || 0) + roundedCoins,
            totalSurvivalTime: (data.totalSurvivalTime || 0) + roundedTime,
            lastPlayedAt:      serverTimestamp()
        };

        if (newBest) {
            updates.bestScore = roundedScore;
        }
        if (highestStageReached > (data.highestStage || 0)) {
            updates.highestStage = highestStageReached;
        }

        tx.update(userRef(uid), updates);
    });

    return { runId, isNewBest };
}

// ── Fetch recent game runs ────────────────────────────────────────────────────
/**
 * Returns the most recent `pageSize` game runs for `uid`, sorted newest first.
 * Pass `afterDoc` to paginate (get the next page).
 */
export async function fetchRecentRuns(uid, pageSize = 10, afterDoc = null) {
    let q = query(
        runsRef(uid),
        orderBy('playedAt', 'desc'),
        limit(pageSize)
    );

    if (afterDoc) {
        q = query(
            runsRef(uid),
            orderBy('playedAt', 'desc'),
            startAfter(afterDoc),
            limit(pageSize)
        );
    }

    const snap  = await getDocs(q);
    const runs  = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const last  = snap.docs[snap.docs.length - 1] || null;
    const hasMore = snap.docs.length === pageSize;

    return { runs, lastDoc: last, hasMore };
}
