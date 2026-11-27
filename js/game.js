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

export const GAME_STATE = {
    MENU: 0,
    INTRO: 1,
    PLAYING: 2,
    GAMEOVER: 3
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
        this.spaceBackground = new SpaceBackground(CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

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

        // Screen shake (visual juice)
        this.shakeTimer = 0;
        this.shakeIntensity = 0;

        // Prevent duplicate game-run saves
        this._runSaved = false;

        this.initCanvasScale();
        this.bindEvents();
        this._bindTouchControls();
        this._bindRotateHint();
        sound.syncMuteUI();
        this.showMenu();
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

        document.getElementById('start-btn').addEventListener('click', () => {
            sound.ensureAudioContext();
            this.startGame();
        });

        document.getElementById('restart-btn').addEventListener('click', () => {
            sound.ensureAudioContext();
            this.startGame();
        });

        document.getElementById('main-menu-btn').addEventListener('click', () => {
            this.showMenu();
        });

        document.getElementById('hud-theme-btn')?.addEventListener('click', () => {
            toggleTheme();
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
    }

    _bindTouchControls() {
        const map = [
            { id: 'touch-left',   key: 'left'  },
            { id: 'touch-right',  key: 'right' },
            { id: 'touch-jump',   key: 'jump'  },
            { id: 'touch-crouch', key: 'down'  }
        ];

        map.forEach(({ id, key }) => {
            const btn = document.getElementById(id);
            if (!btn) return;

            const press = (e) => {
                e.preventDefault();
                sound.ensureAudioContext();
                if (this.state === GAME_STATE.PLAYING && !this.isPaused) {
                    this.keys[key] = true;
                    btn.classList.add('active');
                }
            };

            const release = (e) => {
                if (e) e.preventDefault();
                this.keys[key] = false;
                btn.classList.remove('active');
            };

            btn.addEventListener('pointerdown', press, { passive: false });
            btn.addEventListener('pointerup', release, { passive: false });
            btn.addEventListener('pointercancel', release, { passive: false });
            btn.addEventListener('pointerleave', release, { passive: false });
            btn.addEventListener('touchstart', press, { passive: false });
            btn.addEventListener('touchend', release, { passive: false });
            btn.addEventListener('touchcancel', release, { passive: false });
        });
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
            this.keys = { left: false, right: false, jump: false, down: false };
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

    startGame() {
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
        this.energy.reset();
        this.keys = { left: false, right: false, jump: false, down: false };

        this.state = GAME_STATE.INTRO;
        this.introTimer = 0;
        this.rocketY = CONFIG.CANVAS_HEIGHT;
        this.cameraOffset = 0;
        this.ui.showStartScreen();
    }

    gameOver(reason) {
        if (this.state === GAME_STATE.GAMEOVER) return;
        this.state = GAME_STATE.GAMEOVER;
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
            this.energy.update(dt);
            this.player.update(this.keys, this.platform, this.floatingPlatforms, sound, this.energy);

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

            this.difficulty.update(dt, this.particles, this.platform, sound);

            if (this.difficulty.levelJustChanged) {
                this.ui.triggerLevelBanner(this.difficulty.currentStage);
                const regionMap = ['earth','mars','jupiter','nebula','blackhole'];
                this.spaceBackground.setRegion(regionMap[this.difficulty.currentStageIndex] || 'earth');
            }

            const scoreMultiplier = 1 + (this.difficulty.currentStageIndex * 0.5);
            this.score += dt * 100 * scoreMultiplier;

            const intervalIndex = Math.min(4, Math.floor(this.difficulty.survivalTime / 30));
            this.coins.update(dt, this.difficulty.survivalTime, this.platform, this.floatingPlatforms);

            const playerHitbox = this.player.getHitbox();
            const coinResult = this.coins.checkPlayerCollection(
                playerHitbox,
                sound,
                this.energy,
                intervalIndex,
                this.particles
            );
            if (coinResult.score > 0) {
                this.score += coinResult.score;
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
            this.score += rageBaitResult.score;

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
            this.rageBait.draw(this.ctx, this.player);
        }

        this.difficulty.draw(this.ctx);

        if (this.state === GAME_STATE.PLAYING || this.state === GAME_STATE.MENU) {
            const shieldActive = (this.state === GAME_STATE.PLAYING) && this.energy.shieldActive;
            this.player.draw(this.ctx, this.energy, shieldActive);
        }

        this.ctx.restore();
    }
}
