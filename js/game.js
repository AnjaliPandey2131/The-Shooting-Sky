/* -------------------------------------------------------------
   SHOOTING STARS - Main Game Engine
   Loop orchestration, input handling, collision resolution,
   responsive scaling, and state machine management.
   Integrates: energy system, shield protection, floating platforms,
   coin system with analytics, funny sounds.
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

export const GAME_STATE = {
    MENU: 0,
    INTRO: 1,
    PLAYING: 2,
    GAMEOVER: 3
};

export class GameEngine {
    constructor() {
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

        this.cameraOffset = 0; // used for background parallax
        this.introTimer = 0;
        this.introDuration = 4; // seconds
        this.rocketY = CONFIG.CANVAS_HEIGHT; // start off-screen
        this.rocketSpeed = 250; // pixels per second
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

        this.initCanvasScale();
        this.bindEvents();
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
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
            }

            if (e.code === 'KeyM') {
                const isMuted = sound.toggleMute();
                document.getElementById('audio-icon').textContent = isMuted ? '🔇' : '🔊';
            }

            if (this.state === GAME_STATE.PLAYING) {
                if (e.code === 'ArrowLeft')  this.keys.left  = true;
                if (e.code === 'ArrowRight') this.keys.right = true;
                if (e.code === 'ArrowUp')    this.keys.jump  = true;
                if (e.code === 'ArrowDown')  this.keys.down  = true;
            }
        });

        window.addEventListener('keyup', (e) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
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
    }

    showMenu() {
        this.state = GAME_STATE.MENU;
        this.rageBait.reset(sound);
        this.ui.showStartScreen();
    }

    startGame() {
        this.score = 0;
        this.particles.reset();
        this.player.reset();
        this.platform.reset();
        this.floatingPlatforms.reset();
        this.difficulty.reset();
        this.coins.reset();
        this.rageBait.reset(sound);
        this.energy.reset();
        this.keys = { left: false, right: false, jump: false, down: false };

        // Begin cinematic intro before gameplay
        this.state = GAME_STATE.INTRO;
        this.introTimer = 0;
        this.rocketY = CONFIG.CANVAS_HEIGHT; // start below canvas
        this.cameraOffset = 0;
        this.ui.showStartScreen(); // keep menu visible until intro ends
    }

    gameOver(reason) {
        if (this.state === GAME_STATE.GAMEOVER) return;
        this.state = GAME_STATE.GAMEOVER;
        this.rageBait.reset(sound);
        this.deathCause = reason;

        sound.playWomp();
        sound.playImpact();

        this.particles.createExplosion(
            this.player.x + this.player.width / 2,
            this.player.y + this.player.height / 2,
            '#00f0ff',
            35,
            1.5
        );

        setTimeout(() => {
            this.ui.showGameOver(
                Math.floor(this.score),
                this.difficulty.survivalTime,
                this.difficulty.currentStage.NAME,
                this.difficulty.currentStage.LEVEL,
                this.deathCause,
                this.coins.totalCollected,
                this.energy.intervalCoins,
                this.energy.shieldCharges,
                this.energy.milestonesGranted.size  // shields used = milestones granted
            );
        }, 400);
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

    update(dt) {
        this.spaceBackground.update(dt);

        // Intro cinematic sequence
        if (this.state === GAME_STATE.INTRO) {
            this.introTimer += dt;
            this.rocketY -= this.rocketSpeed * dt;
            // Simple camera follow the rocket while it ascends
            this.cameraOffset = Math.max(0, this.rocketY - CONFIG.CANVAS_HEIGHT / 2);
            if (this.introTimer >= this.introDuration) {
                // Transition to PLAYING state
                this.state = GAME_STATE.PLAYING;
                this.ui.showHUD();
                this.cameraOffset = 0;
                // Ensure background region matches the first stage
                const regionMap = ['earth','mars','jupiter','nebula','blackhole'];
                this.spaceBackground.setRegion(regionMap[this.difficulty.currentStageIndex] || 'earth');
            }
            return; // Skip gameplay updates during intro
        }

        if (this.state === GAME_STATE.PLAYING) {
            // 1. Update Energy (drain + smooth physics multipliers)
            this.energy.update(dt);

            // 2. Update Player (now receives energy manager for speed/jump scaling)
            this.player.update(this.keys, this.platform, this.floatingPlatforms, sound, this.energy);

            // Check if player fell into a gap past the ground
            if (this.player.y > CONFIG.GROUND_Y + 100) {
                this.gameOver("Fell into the broken abyss!");
                return;
            }

            // 3. Update Floating Platforms
            this.floatingPlatforms.update(
                dt,
                this.difficulty.survivalTime,
                this.particles,
                sound,
                this.coins
            );

            // 4. Update Difficulty & Hazards
            this.difficulty.update(dt, this.particles, this.platform, sound);

            if (this.difficulty.levelJustChanged) {
                this.ui.triggerLevelBanner(this.difficulty.currentStage);
                // Update background region to match new stage
                const regionMap = ['earth','mars','jupiter','nebula','blackhole'];
                this.spaceBackground.setRegion(regionMap[this.difficulty.currentStageIndex] || 'earth');
            }

            // 5. Update Score
            const scoreMultiplier = 1 + (this.difficulty.currentStageIndex * 0.5);
            this.score += dt * 100 * scoreMultiplier;

            // 6. Update Coins (level-based scheduling + animation)
            const intervalIndex = Math.min(4, Math.floor(this.difficulty.survivalTime / 30));
            this.coins.update(dt, this.difficulty.survivalTime, this.platform, this.floatingPlatforms);

            // 7. Coin Collection Detection
            const playerHitbox = this.player.getHitbox();
            const coinResult = this.coins.checkPlayerCollection(
                playerHitbox,
                sound,
                this.energy,
                intervalIndex
            );
            if (coinResult.score > 0) {
                this.score += coinResult.score;
            }

            // 8. Update and collect the special coin through normal coin rewards.
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

            // 9. Hazard Collision Detection (with shield protection)
            for (let hazard of this.difficulty.hazards) {
                const hazardHitbox = hazard.getHitbox();

                if (this.checkCollision(playerHitbox, hazardHitbox)) {
                    // Check if shield can block this hit
                    if (this.energy.shieldActive) {
                        // Shield absorbs the hit — do nothing (still invulnerable)
                        continue;
                    }

                    // Check proximity for auto-activation
                    const closeness = this._hazardProximity(playerHitbox, hazardHitbox);
                    if (closeness <= CONFIG.SHIELD.TRIGGER_MARGIN && !this.energy.shieldActive) {
                        this.energy.tryActivateShield();
                    }

                    // If shield just activated, this hit is blocked
                    if (this.energy.shieldActive) {
                        continue;
                    }

                    // No shield — die
                    let name = "a falling hazard";
                    if (hazard.constructor.name === 'ShootingStar') name = "a Shooting Star";
                    if (hazard.constructor.name === 'Hailstone')    name = "a Hailstone";
                    if (hazard.constructor.name === 'Asteroid')     name = "a heavy Asteroid";
                    if (hazard.constructor.name === 'Fireball')     name = "a burning Fireball";

                    this.gameOver(`Crushed by ${name}!`);
                    return;
                } else {
                    // Pre-emptive shield trigger: if hazard is very close, activate before collision
                    const closeness = this._hazardProximity(playerHitbox, hazardHitbox);
                    if (closeness <= CONFIG.SHIELD.TRIGGER_MARGIN && !this.energy.shieldActive && this.energy.shieldCharges > 0) {
                        this.energy.tryActivateShield();
                    }

                    this.player.checkNearMiss(hazardHitbox, sound);
                }
            }

            // 9. Update HUD
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

    /** Returns shortest distance from hazard centre to player hitbox edge */
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
        // Draw background with camera offset for parallax effect
        this.spaceBackground.draw(this.ctx, this.cameraOffset);

        // Render intro rocket if in INTRO state
        if (this.state === GAME_STATE.INTRO) {
            const ctx = this.ctx;
            ctx.save();
            const rocketX = CONFIG.CANVAS_WIDTH / 2;
            const rocketY = this.rocketY;
            // Rocket body
            ctx.fillStyle = '#ffdd33';
            ctx.beginPath();
            ctx.moveTo(rocketX - 12, rocketY);
            ctx.lineTo(rocketX + 12, rocketY);
            ctx.lineTo(rocketX, rocketY - 30);
            ctx.closePath();
            ctx.fill();
            // Exhaust plume
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
    }
}
