/* -------------------------------------------------------------
   SHOOTING STARS - Main Game Engine
   Loop orchestration, input handling, collision resolution,
   responsive scaling, and state machine management.
   Integrates: energy system, shield protection, floating platforms,
   coin system with analytics, funny sounds.

   Firebase upgrade: accepts optional { onGameOver } option so the
   app orchestrator can save stats after each run.  Game mechanics
   are 100% unchanged.
   ------------------------------------------------------------- */

import { CONFIG } from './config.js';
import { sound } from './audio.js';
import { ParticleSystem } from './particles.js';
import { Player } from './player.js';
import { PlatformManager } from './platform.js';
import { FloatingPlatformManager } from './floatingPlatforms.js';
import { DifficultyManager } from './difficulty.js';
import { UIManager } from './ui.js';
import { CoinManager } from './coins.js';
import { EnergyManager } from './energy.js';
import { RageBaitCoinManager } from './rageBaitCoin.js';
import { SpaceBackground } from './spaceBackground.js';
import { saveGameRun } from './db.js';
import { getCurrentUser } from './auth.js';
import { toggleTheme } from './theme.js';
import { PowerUpManager } from './powerups.js';
import { GemManager } from './gems.js';
import { getWorldById, getSavedWorldId } from './worlds.js';
import { getSavedSkinId } from './skins.js';

export const GAME_STATE = {
    MENU: 0,
    INTRO: 1,
    PLAYING: 2,
    GAMEOVER: 3,
    REVIVE: 4
};

export class GameEngine {
    /**
     * @param {{ onGameOver?: function }} [options]
     */
    constructor(options = {}) {
        this._onGameOverCb = options.onGameOver || null;
        this._onReturnToDashboardCb = options.onReturnToDashboard || null;

        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.container = document.getElementById('game-container');

        this.state = GAME_STATE.MENU;

        // Subsystem instances
        this.particles = new ParticleSystem();
        this.player = new Player();
        this.platform = new PlatformManager();
        this.floatingPlatforms = new FloatingPlatformManager();
        this.difficulty = new DifficultyManager();
        this.ui = new UIManager(sound);
        this.coins = new CoinManager();
        this.energy = new EnergyManager();
        this.rageBait = new RageBaitCoinManager();
        this.powerUps = new PowerUpManager();
        this.gems = new GemManager();
        this.spaceBackground = new SpaceBackground(CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        this.activeWorld = getWorldById(getSavedWorldId());
        this.activeSkinId = getSavedSkinId();
        this.streakBonusMult = 1.0;
        this.windTimer = 0;
        this._lastRunOptions = {};
        this.availableGems = 0;
        this.gemsSpentThisRun = 0;
        this.revivesUsed = 0;
        this.reviveTimer = 0;
        this.pendingDeathReason = '';
        this.reviveOverlay = document.getElementById('revive-overlay');

        this.cameraOffset = 0;
        this.introTimer = 0;
        this.introDuration = 4;
        this.rocketY = CONFIG.CANVAS_HEIGHT;
        this.rocketSpeed = 250;

        // Input State
        this.keys = {
            left: false,
            right: false,
            jump: false,
            down: false
        };

        // Score tracking
        this.score = 0;
        this.lastFrameTime = 0;
        this.deathCause = "";

        // Pause state
        this.isPaused = false;
        this.pauseOverlay = document.getElementById('pause-overlay');
        this.touchControls = document.getElementById('touch-controls');
        this._touchReleaseHandlers = [];
        this._historyGuardActive = false;

        // Screen shake (visual juice)
        this.shakeTimer = 0;
        this.shakeIntensity = 0;

        // Prevent duplicate game-run saves
        this._runSaved = false;

        this.initCanvasScale();
        this.bindEvents();
        this._bindTouchControls();
        this._bindBackGuard();
        this._bindRotateHint();
        sound.syncMuteUI();
        this.ui.hideAllOverlays();
    }

    initCanvasScale() {
        const resize = () => {
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const scale = Math.min(1, vw / CONFIG.CANVAS_WIDTH, vh / CONFIG.CANVAS_HEIGHT);
            const dpr = window.devicePixelRatio || 1;

            this.container.style.width = `${CONFIG.CANVAS_WIDTH * scale}px`;
            this.container.style.height = `${CONFIG.CANVAS_HEIGHT * scale}px`;
            this.canvas.style.width = `${CONFIG.CANVAS_WIDTH * scale}px`;
            this.canvas.style.height = `${CONFIG.CANVAS_HEIGHT * scale}px`;
            this.canvas.width = CONFIG.CANVAS_WIDTH * dpr;
            this.canvas.height = CONFIG.CANVAS_HEIGHT * dpr;
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        window.addEventListener('resize', resize);
        window.addEventListener('orientationchange', () => setTimeout(resize, 120));
        document.addEventListener('fullscreenchange', resize);
        document.addEventListener('webkitfullscreenchange', resize);
        resize();
    }

    bindEvents() {
        window.addEventListener('keydown', (e) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
                e.preventDefault();
            }

            if (e.code === 'KeyM') {
                sound.toggleMute();
            }

            if ((e.code === 'Escape' || e.code === 'KeyP' || e.code === 'Space') && this.state === GAME_STATE.PLAYING) {
                this._togglePause();
                return;
            }

            if (this.state === GAME_STATE.PLAYING && !this.isPaused) {
                if (e.code === 'ArrowLeft')  this.keys.left  = true;
                if (e.code === 'ArrowRight') this.keys.right = true;
                if (e.code === 'ArrowUp')    this.keys.jump  = true;
                if (e.code === 'ArrowDown')  this.keys.down  = true;
            }
        });

        window.addEventListener('keyup', (e) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
                e.preventDefault();
            }
            if (e.code === 'ArrowLeft')  this.keys.left  = false;
            if (e.code === 'ArrowRight') this.keys.right = false;
            if (e.code === 'ArrowUp')    this.keys.jump  = false;
            if (e.code === 'ArrowDown')  this.keys.down  = false;
        });

        document.getElementById('start-btn')?.addEventListener('click', () => {
            sound.ensureAudioContext();
            this.startGame();
        });

        document.getElementById('restart-btn')?.addEventListener('click', () => {
            sound.ensureAudioContext();
            this.startGame();
        });

        document.getElementById('main-menu-btn')?.addEventListener('click', () => {
            if (this._onReturnToDashboardCb) this._onReturnToDashboardCb();
        });

        document.getElementById('hud-theme-btn')?.addEventListener('click', () => {
            toggleTheme();
        });

        document.getElementById('hud-fullscreen-btn')?.addEventListener('click', () => {
            this._toggleFullscreen();
        });

        document.getElementById('hud-pause-btn')?.addEventListener('click', () => {
            if (this.state === GAME_STATE.PLAYING) this._togglePause();
        });

        document.getElementById('pause-resume-btn')?.addEventListener('click', () => {
            if (this.isPaused) this._resumeFromPause();
        });

        document.getElementById('pause-restart-btn')?.addEventListener('click', () => {
            sound.ensureAudioContext();
            this.startGame();
        });

        document.getElementById('pause-dashboard-btn')?.addEventListener('click', () => {
            this._resumeFromPause(true);
            this.state = GAME_STATE.MENU;
            this._setTouchControlsVisible(false);
            if (this._onReturnToDashboardCb) this._onReturnToDashboardCb();
        });

        document.getElementById('revive-accept-btn')?.addEventListener('click', () => {
            if (this.state === GAME_STATE.REVIVE) this._acceptRevive();
        });

        document.getElementById('revive-skip-btn')?.addEventListener('click', () => {
            if (this.state === GAME_STATE.REVIVE) this._skipRevive();
        });
    }

    _bindTouchControls() {
        const map = [
            { id: 'touch-left',   key: 'left',  haptic: false },
            { id: 'touch-right',  key: 'right', haptic: false },
            { id: 'touch-jump',   key: 'jump',  haptic: true  },
            { id: 'touch-crouch', key: 'down',  haptic: true  }
        ];

        this._touchReleaseHandlers = [];

        map.forEach(({ id, key, haptic }) => {
            const btn = document.getElementById(id);
            if (!btn) return;

            const activePointers = new Set();

            const releasePointer = (pointerId) => {
                if (pointerId !== undefined) {
                    activePointers.delete(pointerId);
                } else {
                    activePointers.clear();
                }
                if (activePointers.size === 0) {
                    this.keys[key] = false;
                    btn.classList.remove('active');
                }
            };

            const onPointerDown = (e) => {
                e.preventDefault();
                sound.ensureAudioContext();
                if (this.state !== GAME_STATE.PLAYING || this.isPaused) return;

                activePointers.add(e.pointerId);
                this.keys[key] = true;
                btn.classList.add('active');

                if (haptic && navigator.vibrate) {
                    try { navigator.vibrate(12); } catch (err) {}
                }

                try {
                    btn.setPointerCapture?.(e.pointerId);
                } catch (err) {}
            };

            const onPointerUp = (e) => {
                e.preventDefault();
                releasePointer(e.pointerId);
            };

            btn.addEventListener('pointerdown', onPointerDown, { passive: false });
            btn.addEventListener('pointerup', onPointerUp, { passive: false });
            btn.addEventListener('pointercancel', onPointerUp, { passive: false });
            btn.addEventListener('lostpointercapture', onPointerUp, { passive: false });
            btn.addEventListener('contextmenu', (e) => e.preventDefault());

            this._touchReleaseHandlers.push(() => releasePointer());
        });
    }

    _clearTouchInputs() {
        this.keys = { left: false, right: false, jump: false, down: false };
        this._touchReleaseHandlers.forEach(fn => fn());
    }

    _bindBackGuard() {
        window.addEventListener('popstate', () => {
            if (this.state === GAME_STATE.PLAYING && !this.isPaused) {
                this._togglePause();
                try {
                    window.history.pushState({ shootingStarsPlaying: true }, '');
                } catch (e) {}
            }
        });

        window.addEventListener('beforeunload', (e) => {
            if (this.state === GAME_STATE.PLAYING && !this.isPaused) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }

    _armHistoryGuard() {
        if (this._historyGuardActive) return;
        try {
            window.history.pushState({ shootingStarsPlaying: true }, '');
            this._historyGuardActive = true;
        } catch (e) {}
    }

    _bindRotateHint() {
        const hint = document.getElementById('rotate-hint');
        const closeBtn = document.getElementById('rotate-hint-close');
        if (!hint || !closeBtn) return;

        try {
            if (sessionStorage.getItem('rotate_hint_dismissed') === '1') {
                hint.classList.add('dismissed');
            }
        } catch (e) {}

        closeBtn.addEventListener('click', () => {
            hint.classList.add('dismissed');
            try { sessionStorage.setItem('rotate_hint_dismissed', '1'); } catch (e) {}
        });
    }

    _setTouchControlsVisible(visible) {
        if (!this.touchControls) return;
        this.touchControls.classList.toggle('hidden', !visible);
    }

    _isTouchDevice() {
        return (
            document.body.classList.contains('has-touch') ||
            'ontouchstart' in window ||
            navigator.maxTouchPoints > 0
        );
    }

    _requestFullscreen() {
        try {
            const el = document.documentElement;
            if (document.fullscreenElement || document.webkitFullscreenElement) return;
            const fn = el.requestFullscreen || el.webkitRequestFullscreen;
            if (typeof fn === 'function') {
                const res = fn.call(el);
                if (res && typeof res.catch === 'function') res.catch(() => {});
            }
        } catch (e) {}
    }

    _toggleFullscreen() {
        try {
            const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
            if (fsEl) {
                const exitFn = document.exitFullscreen || document.webkitExitFullscreen;
                if (typeof exitFn === 'function') {
                    const res = exitFn.call(document);
                    if (res && typeof res.catch === 'function') res.catch(() => {});
                }
            } else {
                this._requestFullscreen();
            }
        } catch (e) {}
    }

    showMenu() {
        this.state = GAME_STATE.MENU;
        this._resumeFromPause(true);
        this._setTouchControlsVisible(false);
        this.rageBait.reset(sound);
        this.ui.showStartScreen();
    }

    _togglePause() {
        if (!this.isPaused) {
            this.isPaused = true;
            this._clearTouchInputs();
            this._setTouchControlsVisible(false);
            this._showPauseMessage();
        } else {
            this._resumeFromPause();
        }
    }

    _showPauseMessage() {
        if (!this.pauseOverlay) return;
        this.pauseOverlay.classList.remove('hidden');
    }

    _resumeFromPause(silent = false) {
        this.isPaused = false;
        if (this.pauseOverlay) this.pauseOverlay.classList.add('hidden');
        if (!silent && this.state === GAME_STATE.PLAYING) {
            this._setTouchControlsVisible(true);
        }
    }

    startGame(runOptions = null) {
        if (runOptions) {
            this._lastRunOptions = runOptions;
        }
        const opts = this._lastRunOptions || {};
        this.activeWorld = getWorldById(opts.worldId || getSavedWorldId());
        this.activeSkinId = opts.skinId || getSavedSkinId();
        this.streakBonusMult = (opts.currentStreak || 0) >= 3 ? 1.10 : 1.0;
        this.windTimer = 0;

        if (this._isTouchDevice()) {
            this._requestFullscreen();
        }
        this._armHistoryGuard();
        this.score = 0;
        this._runSaved = false; // reset save guard for new run
        this._resumeFromPause(true);
        this._setTouchControlsVisible(false);
        this.shakeTimer = 0;
        this.shakeIntensity = 0;
        this.particles.reset();
        this.player.reset();
        this.platform.reset();
        this.floatingPlatforms.reset();
        this.difficulty.reset();
        this.coins.reset();
        this.rageBait.reset(sound);
        this.powerUps.reset();
        this.gems.reset();
        this.availableGems = Math.max(0, Math.floor(opts.totalGems || 0));
        this.gemsSpentThisRun = 0;
        this.revivesUsed = 0;
        this.reviveTimer = 0;
        this.pendingDeathReason = '';
        if (this.reviveOverlay) this.reviveOverlay.classList.add('hidden');
        this.ui.updateGemHUD(this.availableGems);
        this.spaceBackground.setWorld(this.activeWorld.id);
        this.spaceBackground.setWindForce(0);
        this.energy.reset();
        this._clearTouchInputs();

        this.state = GAME_STATE.INTRO;
        this.introTimer = 0;
        this.rocketY = CONFIG.CANVAS_HEIGHT;
        this.cameraOffset = 0;
        this.ui.hideAllOverlays();
    }

    gameOver(reason) {
        if (this.state === GAME_STATE.GAMEOVER || this.state === GAME_STATE.REVIVE) return;

        // Check if player has enough Gems for "Save Me / Revive" (2, 4, 6...)
        const reviveCost = (this.revivesUsed + 1) * 2;
        if (this.state === GAME_STATE.PLAYING && this.availableGems >= reviveCost) {
            this._triggerReviveOffer(reason, reviveCost);
            return;
        }

        this._finalizeGameOver(reason);
    }

    _triggerReviveOffer(reason, cost) {
        this.state = GAME_STATE.REVIVE;
        this.pendingDeathReason = reason;
        this.reviveTimer = 5.0;
        this._clearTouchInputs();
        this._setTouchControlsVisible(false);
        this.rageBait.reset(sound);
        sound.playImpact();
        this._triggerShake(8, 0.25);

        const reasonEl = document.getElementById('revive-reason');
        const btnEl = document.getElementById('revive-accept-btn');
        if (reasonEl) reasonEl.textContent = reason || 'Continue your cosmic run!';
        if (btnEl) btnEl.textContent = `💎 REVIVE (${cost} 💎)`;
        this._updateReviveUI();

        if (this.reviveOverlay) this.reviveOverlay.classList.remove('hidden');
    }

    _updateReviveUI() {
        const textEl = document.getElementById('revive-timer-text');
        const barEl = document.getElementById('revive-bar-fill');
        const secs = Math.max(0, Math.ceil(this.reviveTimer));
        const pct = Math.max(0, Math.min(100, (this.reviveTimer / 5.0) * 100));
        if (textEl) textEl.textContent = `${secs}s`;
        if (barEl) barEl.style.width = `${pct}%`;
    }

    _acceptRevive() {
        const cost = (this.revivesUsed + 1) * 2;
        if (this.availableGems < cost) {
            this._skipRevive();
            return;
        }

        this.revivesUsed++;
        this.gemsSpentThisRun += cost;
        this.availableGems -= cost;
        this.ui.updateGemHUD(this.availableGems);

        // Clear all active hazards & warnings
        this.difficulty.hazards = [];
        this.difficulty.warnings = [];

        // Restore 100% Energy + grant 2.5s blinking invincibility shield
        this.energy.energy = CONFIG.ENERGY.MAX;
        this.energy._displayEnergy = CONFIG.ENERGY.MAX;
        this.energy.shieldActive = true;
        this.energy.shieldTimer = 2.5;

        // Place player safely above an intact ground segment if they fell
        const intact = this.platform.segments.filter(s => s.state < 4);
        if (this.player.y > CONFIG.GROUND_Y - this.player.height || intact.length > 0) {
            if (this.player.y > CONFIG.GROUND_Y - 10 && intact.length > 0) {
                const seg = intact[Math.floor(intact.length / 2)];
                this.player.x = seg.x + seg.width / 2 - this.player.width / 2;
            }
            this.player.y = Math.min(this.player.y, CONFIG.GROUND_Y - this.player.height);
            this.player.vy = 0;
            this.player.vx = 0;
        }

        if (this.reviveOverlay) this.reviveOverlay.classList.add('hidden');
        this.state = GAME_STATE.PLAYING;
        this._setTouchControlsVisible(true);
        sound.ensureAudioContext();
        sound.playRevive();
    }

    _skipRevive() {
        if (this.reviveOverlay) this.reviveOverlay.classList.add('hidden');
        this._finalizeGameOver(this.pendingDeathReason || 'Crushed by a falling hazard!');
    }

    _finalizeGameOver(reason) {
        if (this.state === GAME_STATE.GAMEOVER) return;
        this.state = GAME_STATE.GAMEOVER;
        this._clearTouchInputs();
        this._setTouchControlsVisible(false);
        this.rageBait.reset(sound);
        this.deathCause = reason;
        this._triggerShake(10, 0.35);

        sound.playWomp();
        sound.playImpact();

        this.particles.createExplosion(
            this.player.x + this.player.width / 2,
            this.player.y + this.player.height / 2,
            '#00f0ff',
            35,
            1.5
        );

        // Capture stats before the async save so they're consistent
        const finalScore       = Math.floor(this.score);
        const survivalTime     = this.difficulty.survivalTime;
        const stageLevel       = this.difficulty.currentStage.LEVEL;
        const stageName        = this.difficulty.currentStage.NAME;
        const totalCoins       = this.coins.totalCollected;
        const gemsCollected    = this.gems.totalCollected;
        const netGemsDelta     = gemsCollected - this.gemsSpentThisRun;
        const intervalCoins    = [...this.energy.intervalCoins];
        const shieldCharges    = this.energy.shieldCharges;
        const shieldsGranted   = this.energy.milestonesGranted.size;

        setTimeout(() => {
            this.ui.showGameOver(
                finalScore,
                survivalTime,
                stageName,
                stageLevel,
                this.deathCause,
                totalCoins,
                intervalCoins,
                shieldCharges,
                shieldsGranted
            );
        }, 400);

        // ── Firebase: save run once ───────────────────────────────────────────
        if (!this._runSaved) {
            this._runSaved = true;
            this._persistRun({
                score:               finalScore,
                coinsCollected:      totalCoins,
                gemsCollected,
                netGemsDelta,
                highestStageReached: stageLevel,
                highestStageName:    stageName,
                survivalTime:        Math.round(survivalTime),
                stageWiseCoinAnalytics: intervalCoins,
                gameStatus:          'completed'
            });
        }
    }

    /** Saves run to Firestore. Silently ignores failures (non-game-breaking). */
    async _persistRun(runData) {
        try {
            const user = getCurrentUser();
            if (!user) return; // No authenticated user; skip silently

            const { isNewBest } = await saveGameRun(user.uid, runData);

            // Update the HUD "BEST" value if we set a new record
            if (isNewBest) {
                this.ui.highScore = runData.score;
                this.ui.updateBestScoreDisplays();
            }

            // Notify the app orchestrator so it can refresh the dashboard
            if (this._onGameOverCb) {
                this._onGameOverCb(runData);
            }
        } catch (err) {
            console.error('[GameEngine] Failed to save run to Firestore:', err.message);
            // Show a non-intrusive toast so the player knows
            this._showSaveError();
        }
    }

    _showSaveError() {
        const toast = document.createElement('div');
        toast.className = 'save-error-toast';
        toast.textContent = '⚠ Could not save game result. Check your connection.';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
    }

    startLoop() {
        const loop = (timestamp) => {
            if (!this.lastFrameTime) this.lastFrameTime = timestamp;
            const dt = Math.min((timestamp - this.lastFrameTime) / 1000, 0.1);
            this.lastFrameTime = timestamp;

            this.update(dt);
            this.draw();

            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    _triggerShake(intensity, duration) {
        this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
        this.shakeTimer = Math.max(this.shakeTimer, duration);
    }

    update(dt) {
        if (this.shakeTimer > 0) {
            this.shakeTimer = Math.max(0, this.shakeTimer - dt);
            if (this.shakeTimer === 0) this.shakeIntensity = 0;
        }

        if (this.isPaused) {
            this.spaceBackground.update(dt);
            return;
        }

        if (this.state === GAME_STATE.REVIVE) {
            this.spaceBackground.update(dt);
            this.reviveTimer -= dt;
            this._updateReviveUI();
            if (this.reviveTimer <= 0) {
                this._skipRevive();
            }
            return;
        }

        this.spaceBackground.update(dt);

        if (this.state === GAME_STATE.INTRO) {
            this.introTimer += dt;
            this.rocketY -= this.rocketSpeed * dt;
            this.cameraOffset = Math.max(0, this.rocketY - CONFIG.CANVAS_HEIGHT / 2);
            if (this.introTimer >= this.introDuration) {
                this.state = GAME_STATE.PLAYING;
                this.ui.showHUD();
                this._setTouchControlsVisible(true);
                this.cameraOffset = 0;
                const regionMap = ['earth','mars','jupiter','nebula','blackhole'];
                this.spaceBackground.setRegion(regionMap[this.difficulty.currentStageIndex] || 'earth');
            }
            return;
        }

        if (this.state === GAME_STATE.PLAYING) {
            // Mars Storm periodic wind gusts (cycles every 10s, active for 4s)
            let windForce = 0;
            if (this.activeWorld.hasWind) {
                this.windTimer += dt;
                const cycle = this.windTimer % 10;
                if (cycle < 4) {
                    const dir = Math.floor(this.windTimer / 10) % 2 === 0 ? 1 : -1;
                    windForce = dir * 0.55 * Math.sin((cycle / 4) * Math.PI);
                }
            }
            this.spaceBackground.setWindForce(windForce);

            this.energy.update(dt);
            this.player.update(
                this.keys,
                this.platform,
                this.floatingPlatforms,
                sound,
                this.energy,
                { gravityMult: this.activeWorld.gravityMult, windForce }
            );

            if (this.player.y > CONFIG.GROUND_Y + 100) {
                this.gameOver("Fell into the broken abyss!");
                return;
            }

            this.floatingPlatforms.update(
                dt,
                this.difficulty.survivalTime,
                this.particles,
                sound,
                this.coins
            );

            const hazardSpeedMult = this.activeWorld.hazardSpeedMult * this.powerUps.hazardSpeedMultiplier;
            this.difficulty.update(dt, this.particles, this.platform, sound, hazardSpeedMult);

            if (this.difficulty.levelJustChanged) {
                this.ui.triggerLevelBanner(this.difficulty.currentStage);
                const regionMap = ['earth','mars','jupiter','nebula','blackhole'];
                this.spaceBackground.setRegion(regionMap[this.difficulty.currentStageIndex] || 'earth');
            }

            const scoreMultiplier = (1 + (this.difficulty.currentStageIndex * 0.5))
                * this.powerUps.scoreMultiplier
                * this.streakBonusMult;
            this.score += dt * 100 * scoreMultiplier;

            const intervalIndex = Math.min(4, Math.floor(this.difficulty.survivalTime / 30));
            this.coins.update(dt, this.difficulty.survivalTime, this.platform, this.floatingPlatforms);

            // Power-Ups & Gems update + collection + Coin Magnet pull
            this.powerUps.update(dt, this.platform);
            this.gems.update(dt);
            const playerHitbox = this.player.getHitbox();
            this.powerUps.checkPlayerCollection(playerHitbox, sound, this.particles);
            this.gems.checkPlayerCollection(playerHitbox, sound, this.particles, () => {
                this.availableGems++;
                this.ui.updateGemHUD(this.availableGems);
            });
            this.powerUps.applyMagnetToCoins(
                this.coins.coins,
                this.player.x + this.player.width / 2,
                this.player.y + this.player.height / 2,
                dt
            );

            const coinResult = this.coins.checkPlayerCollection(
                playerHitbox,
                sound,
                this.energy,
                intervalIndex,
                this.particles
            );
            if (coinResult.score > 0) {
                this.score += coinResult.score * this.activeWorld.coinMult * this.powerUps.scoreMultiplier;
            }

            this.rageBait.update(
                dt,
                this.difficulty.survivalTime,
                this.difficulty.currentStageIndex,
                this.player,
                this.platform,
                this.floatingPlatforms,
                this.energy,
                sound,
                this.particles
            );
            const rageBaitResult = this.rageBait.checkPlayerCollection(
                playerHitbox,
                this.coins,
                sound,
                this.energy,
                intervalIndex,
                this.particles
            );
            this.score += rageBaitResult.score * this.activeWorld.coinMult * this.powerUps.scoreMultiplier;

            for (let hazard of this.difficulty.hazards) {
                const hazardHitbox = hazard.getHitbox();

                if (this.checkCollision(playerHitbox, hazardHitbox)) {
                    if (this.energy.shieldActive) {
                        continue;
                    }

                    const closeness = this._hazardProximity(playerHitbox, hazardHitbox);
                    if (closeness <= CONFIG.SHIELD.TRIGGER_MARGIN && !this.energy.shieldActive) {
                        this.energy.tryActivateShield();
                    }

                    if (this.energy.shieldActive) {
                        continue;
                    }

                    let name = "a falling hazard";
                    if (hazard.constructor.name === 'ShootingStar') name = "a Shooting Star";
                    if (hazard.constructor.name === 'Hailstone')    name = "a Hailstone";
                    if (hazard.constructor.name === 'Asteroid')     name = "a heavy Asteroid";
                    if (hazard.constructor.name === 'Fireball')     name = "a burning Fireball";

                    this.gameOver(`Crushed by ${name}!`);
                    return;
                } else {
                    const closeness = this._hazardProximity(playerHitbox, hazardHitbox);
                    if (closeness <= CONFIG.SHIELD.TRIGGER_MARGIN && !this.energy.shieldActive && this.energy.shieldCharges > 0) {
                        this.energy.tryActivateShield();
                    }

                    if (this.player.checkNearMiss(hazardHitbox, sound)) {
                        this._triggerShake(4, 0.16);
                    }
                }
            }

            this.ui.updateHUD(
                this.score,
                this.difficulty.survivalTime,
                this.difficulty.currentStage,
                this.coins.totalCollected,
                this.energy,
                this.energy.shieldCharges,
                this.energy.shieldActive,
                this.energy.shieldTimer
            );
            this.ui.updatePowerUpHUD(this.powerUps.active, this.activeWorld, windForce);

        } else if (this.state === GAME_STATE.MENU) {
            this.difficulty.update(dt * 0.5, this.particles, this.platform, sound);
        }
    }

    _hazardProximity(playerHB, hazardHB) {
        const px = playerHB.x + playerHB.width  / 2;
        const py = playerHB.y + playerHB.height / 2;
        const hx = hazardHB.x + hazardHB.width  / 2;
        const hy = hazardHB.y + hazardHB.height / 2;
        return Math.hypot(px - hx, py - hy);
    }

    checkCollision(rect1, rect2) {
        return (
            rect1.x < rect2.x + rect2.width  &&
            rect1.x + rect1.width  > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y
        );
    }

    draw() {
        this.ctx.save();
        if (this.shakeTimer > 0 && this.shakeIntensity > 0) {
            const dx = (Math.random() - 0.5) * 2 * this.shakeIntensity;
            const dy = (Math.random() - 0.5) * 2 * this.shakeIntensity;
            this.ctx.translate(dx, dy);
        }
        this.spaceBackground.draw(this.ctx, this.cameraOffset);

        if (this.state === GAME_STATE.INTRO) {
            const ctx = this.ctx;
            ctx.save();
            const rocketX = CONFIG.CANVAS_WIDTH / 2;
            const rocketY = this.rocketY;
            ctx.fillStyle = '#ffdd33';
            ctx.beginPath();
            ctx.moveTo(rocketX - 12, rocketY);
            ctx.lineTo(rocketX + 12, rocketY);
            ctx.lineTo(rocketX, rocketY - 30);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 0.6;
            const plumeHeight = 20 + Math.random() * 8;
            const plumeGrad = ctx.createLinearGradient(rocketX, rocketY, rocketX, rocketY + plumeHeight);
            plumeGrad.addColorStop(0, 'rgba(255,140,0,0.8)');
            plumeGrad.addColorStop(1, 'rgba(255,0,0,0)');
            ctx.fillStyle = plumeGrad;
            ctx.fillRect(rocketX - 8, rocketY, 16, plumeHeight);
            ctx.restore();
        }

        this.particles.updateAndDraw(this.ctx, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
        this.platform.draw(this.ctx);
        this.floatingPlatforms.draw(this.ctx);

        if (this.state === GAME_STATE.PLAYING) {
            this.coins.draw(this.ctx);
            this.gems.draw(this.ctx);
            this.powerUps.draw(this.ctx);
            this.rageBait.draw(this.ctx, this.player);
        }

        this.difficulty.draw(this.ctx);

        if (this.state === GAME_STATE.PLAYING || this.state === GAME_STATE.MENU) {
            const shieldActive = (this.state === GAME_STATE.PLAYING) && this.energy.shieldActive;
            this.player.draw(this.ctx, this.energy, shieldActive, this.activeSkinId);
        }

        this.ctx.restore();
    }
}
