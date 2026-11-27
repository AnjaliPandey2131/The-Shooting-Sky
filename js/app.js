/* -------------------------------------------------------------
   SHOOTING STARS - App Orchestrator
   Top-level controller that manages authentication state and
   wires together: Login Screen → Dashboard → Game → Dashboard.
   The game engine is not instantiated until the user authenticates.
   ------------------------------------------------------------- */

import { initAuth, onAuthChange, getCurrentUser } from './auth.js';
import { migrateLocalScore }                       from './db.js';
import { showLoginScreen, hideLoginScreen }        from './login.js';
import { showDashboard, hideDashboard,
         setStartGameCallback, refreshDashboardAfterGame,
         getActiveWorldId, getActiveStreak, getActiveGems, getActiveSkinId } from './dashboard.js';
import { GameEngine }                              from './game.js';
import { CONFIG }                                  from './config.js';
import { initTheme }                               from './theme.js';
import { sound }                                   from './audio.js';

let _gameEngine = null;
let _gameVisible = false;

// ── Boot ──────────────────────────────────────────────────────────────────────
export async function bootApp() {
    initTheme();
    sound.syncMuteUI();

    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        document.body.classList.add('has-touch');
    }

    // Show the login screen immediately while Firebase resolves auth state
    showLoginScreen();

    // Set callback so dashboard Start button knows what to do
    setStartGameCallback(_startGame);

    // Wire the "Dashboard" button on the game-over overlay
    _bindDashboardBtn();

    // Register auth-state handler before initAuth fires
    onAuthChange(_handleAuthChange);

    // Kick off auth listener + redirect-result handling
    await initAuth();
}

// ── Auth state handler ────────────────────────────────────────────────────────
async function _handleAuthChange(user) {
    if (user) {
        // ── Authenticated ────────────────────────────────────────────────────
        hideLoginScreen();
        _hideGame();

        // One-time migration of localStorage high score (safe; won't repeat)
        await migrateLocalScore(user.uid, CONFIG.STORAGE_KEY);

        // If game is active (player returned from game), refresh dashboard
        if (_gameEngine) {
            await refreshDashboardAfterGame();
        }

        await showDashboard(user);
    } else {
        // ── Not authenticated ────────────────────────────────────────────────
        hideDashboard();
        _hideGame();
        showLoginScreen();
    }
}

// ── Start Game ────────────────────────────────────────────────────────────────
function _startGame() {
    const user = getCurrentUser();
    if (!user) {
        // Should never happen (button is only shown when authenticated)
        console.error('[App] startGame called without an authenticated user');
        return;
    }

    hideDashboard();
    _showGame();

    if (!_gameEngine) {
        // First run: create the engine once and start its loop
        _gameEngine = new GameEngine({
            onGameOver: _onGameOver,
            onReturnToDashboard: returnToDashboard
        });
        _gameEngine.startLoop();
    }
    // Launch directly into gameplay for a streamlined flow
    _gameEngine.startGame({
        worldId:       getActiveWorldId(),
        currentStreak: getActiveStreak(),
        totalGems:     getActiveGems(),
        skinId:        getActiveSkinId()
    });
}

// ── Game-over hook ────────────────────────────────────────────────────────────
/**
 * Called by the GameEngine after the game-over screen has been shown.
 * Saves the result to Firestore and refreshes dashboard in the background.
 */
async function _onGameOver(result) {
    const user = getCurrentUser();
    if (!user) return; // paranoia guard

    // Save is handled inside game.js — we just trigger a dashboard refresh
    // after the stats are written so the user sees up-to-date numbers
    // when they navigate back to the dashboard.
    // (game.js calls saveGameRun; we call refresh here after a short delay)
    setTimeout(async () => {
        try {
            await refreshDashboardAfterGame();
        } catch (e) {
            console.warn('[App] Dashboard refresh after game failed:', e.message);
        }
    }, 1500);
}

// ── Game container visibility ─────────────────────────────────────────────────
function _showGame() {
    const gc = document.getElementById('game-container');
    if (gc) {
        gc.style.display = '';
        gc.classList.remove('hidden');
    }
    _gameVisible = true;
}

function _hideGame() {
    const gc = document.getElementById('game-container');
    if (gc) {
        gc.style.display = 'none';
    }
    _gameVisible = false;
}

// ── Wire the "📊 DASHBOARD" button on the game-over screen ───────────────────
function _bindDashboardBtn() {
    const btn = document.getElementById('dashboard-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
        _hideGame();
        const user = getCurrentUser();
        if (user) showDashboard(user);
    });
}

// ── Expose global hook for the game's "Back to Dashboard" button ──────────────
export function returnToDashboard() {
    _hideGame();
    const user = getCurrentUser();
    if (user) showDashboard(user);
}
