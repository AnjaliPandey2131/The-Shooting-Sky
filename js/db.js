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
import { computeUnlockedWorlds } from './worlds.js';
import { createFreshDailyMissions, evaluateDailyMissions } from './missions.js';

// ── Date helpers (local YYYY-MM-DD) ───────────────────────────────────────────
function _formatLocalDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function _getTodayAndYesterday() {
    const now = new Date();
    const today = _formatLocalDate(now);
    const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const yesterday = _formatLocalDate(yest);
    return { today, yesterday };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const userRef        = uid => doc(db, 'users', uid);
const runsRef        = uid => collection(db, 'users', uid, 'gameRuns');
const leaderboardRef = uid => doc(db, 'leaderboard', uid);
const leaderboardCol = ()  => collection(db, 'leaderboard');

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
            totalGems:         0,
            highestStage:      0,
            totalSurvivalTime: 0,
            lastPlayedAt:      null,
            localScoreMigrated: false,
            currentStreak:     0,
            bestStreak:        0,
            lastPlayedDate:    '',
            selectedWorld:     'earth',
            unlockedWorlds:    ['earth'],
            selectedSkin:      'cyan',
            unlockedSkins:     ['cyan'],
            dailyMissions:     createFreshDailyMissions(_formatLocalDate(new Date()))
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
        const updatedSnap = await getDoc(userRef(uid));
        if (updatedSnap.exists()) {
            const p = updatedSnap.data();
            if ((p.bestScore || 0) > 0) {
                await syncLeaderboardEntry(uid, p.displayName, p.bestScore, p.highestStage || 1);
            }
        }
    } catch (err) {
        console.warn('[DB] Local score migration failed (non-fatal):', err.message);
    }
}

// ── Sync public leaderboard entry ─────────────────────────────────────────────
/**
 * Writes/updates leaderboard/{uid} with non-sensitive public fields only
 * (never email). Keeps users/{uid} private.
 */
export async function syncLeaderboardEntry(uid, displayName, bestScore, highestStage) {
    try {
        await setDoc(leaderboardRef(uid), {
            uid,
            displayName:  displayName || 'Space Traveller',
            bestScore:    Math.floor(bestScore || 0),
            highestStage: Math.max(1, Math.floor(highestStage || 1)),
            updatedAt:    serverTimestamp()
        }, { merge: true });
    } catch (err) {
        console.warn('[DB] Leaderboard sync failed (non-fatal):', err.message);
    }
}

// ── Fetch Top 10 Global Leaderboard ───────────────────────────────────────────
/**
 * Fetches Top 20 players ordered by bestScore descending.
 */
export async function fetchLeaderboard(topN = 20) {
    const q = query(
        leaderboardCol(),
        orderBy('bestScore', 'desc'),
        limit(topN)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
        gemsCollected     = 0,
        netGemsDelta      = 0,
        highestStageReached = 1,
        highestStageName  = 'CALM SKY',
        survivalTime      = 0,
        stageWiseCoinAnalytics = [],
        gameStatus        = 'completed'
    } = runData;

    const roundedScore   = Math.floor(score);
    const roundedTime    = Math.round(survivalTime);
    const roundedCoins   = Math.floor(coinsCollected);
    const roundedGems    = Math.floor(gemsCollected);
    const roundedGemDelta = Math.trunc(netGemsDelta);

    let runId   = null;
    let isNewBest = false;

    // 1. Write game run document first (outside the transaction for atomicity)
    const runDoc = await addDoc(runsRef(uid), {
        score:               roundedScore,
        coinsCollected:      roundedCoins,
        gemsCollected:       roundedGems,
        highestStageReached,
        highestStageName,
        survivalTime:        roundedTime,
        stageWiseCoinAnalytics,
        gameStatus,
        playedAt:            serverTimestamp()
    });
    runId = runDoc.id;

    // 2. Atomically update summary statistics
    let leaderProfile = null;
    await runTransaction(db, async tx => {
        const txSnap = await tx.get(userRef(uid));
        if (!txSnap.exists()) return;

        const data = txSnap.data();
        const newBest = roundedScore > (data.bestScore || 0);
        isNewBest     = newBest;

        const { today, yesterday } = _getTodayAndYesterday();
        const { nextMissionsState, bonusCoinsEarned } = evaluateDailyMissions(
            data.dailyMissions,
            today,
            { coinsCollected: roundedCoins, survivalTime: roundedTime }
        );

        const nextBestScore    = newBest ? roundedScore : (data.bestScore || 0);
        const nextTotalCoins   = (data.totalCoins || 0) + roundedCoins + bonusCoinsEarned;
        const nextTotalGems    = Math.max(0, (data.totalGems || 0) + roundedGemDelta);
        const nextHighestStage = highestStageReached > (data.highestStage || 0)
            ? highestStageReached
            : (data.highestStage || 1);

        // ── Daily Streak calculation ──
        let nextStreak = data.currentStreak || 0;
        if (data.lastPlayedDate === today) {
            nextStreak = Math.max(1, nextStreak);
        } else if (data.lastPlayedDate === yesterday) {
            nextStreak = nextStreak + 1;
        } else {
            nextStreak = 1;
        }
        const nextBestStreak = Math.max(data.bestStreak || 0, nextStreak);
        const nextUnlockedWorlds = computeUnlockedWorlds(nextBestScore, nextTotalCoins, data.unlockedWorlds);

        const updates = {
            previousScore:     roundedScore,
            totalGames:        (data.totalGames     || 0) + 1,
            totalCoins:        nextTotalCoins,
            totalGems:         nextTotalGems,
            totalSurvivalTime: (data.totalSurvivalTime || 0) + roundedTime,
            lastPlayedAt:      serverTimestamp(),
            currentStreak:     nextStreak,
            bestStreak:        nextBestStreak,
            lastPlayedDate:    today,
            unlockedWorlds:    nextUnlockedWorlds,
            dailyMissions:     nextMissionsState
        };

        if (newBest) {
            updates.bestScore = roundedScore;
        }
        if (highestStageReached > (data.highestStage || 0)) {
            updates.highestStage = highestStageReached;
        }

        tx.update(userRef(uid), updates);
        leaderProfile = {
            displayName:  data.displayName || 'Space Traveller',
            bestScore:    nextBestScore,
            highestStage: nextHighestStage
        };
    });

    // 3. Sync public leaderboard entry (non-sensitive fields only)
    if (leaderProfile) {
        await syncLeaderboardEntry(
            uid,
            leaderProfile.displayName,
            leaderProfile.bestScore,
            leaderProfile.highestStage
        );
    }

    return { runId, isNewBest };
}

// ── Save selected world ───────────────────────────────────────────────────────
export async function saveSelectedWorld(uid, worldId) {
    try {
        await updateDoc(userRef(uid), { selectedWorld: worldId });
    } catch (err) {
        console.warn('[DB] Failed to save selectedWorld (non-fatal):', err.message);
    }
}

// ── Unlock & equip Stickman skin (Armory) ─────────────────────────────────────
export async function unlockAndEquipSkin(uid, skinId, cost) {
    return runTransaction(db, async tx => {
        const snap = await tx.get(userRef(uid));
        if (!snap.exists()) throw new Error('Profile not found');

        const data = snap.data();
        const unlocked = new Set(Array.isArray(data.unlockedSkins) ? data.unlockedSkins : ['cyan']);
        let totalCoins = data.totalCoins || 0;

        if (!unlocked.has(skinId)) {
            if (totalCoins < cost) {
                throw new Error('Not enough coins');
            }
            totalCoins -= cost;
            unlocked.add(skinId);
        }

        const nextUnlocked = Array.from(unlocked);
        tx.update(userRef(uid), {
            totalCoins,
            unlockedSkins: nextUnlocked,
            selectedSkin: skinId
        });

        return { totalCoins, unlockedSkins: nextUnlocked, selectedSkin: skinId };
    });
}

export async function equipSkin(uid, skinId) {
    await updateDoc(userRef(uid), { selectedSkin: skinId });
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
