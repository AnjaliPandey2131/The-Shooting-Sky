/* -------------------------------------------------------------
   SHOOTING STARS - Main Game Engine
   Loop orchestration, input handling, collision resolution,
   responsive scaling, and state machine management.
   ------------------------------------------------------------- */

import { CONFIG } from './config.js';
import { sound } from './audio.js';
import { ParticleSystem } from './particles.js';
import { Player } from './player.js';
import { PlatformManager } from './platform.js';
import { DifficultyManager } from './difficulty.js';
import { UIManager } from './ui.js';

export const GAME_STATE = {
    MENU: 0,
    PLAYING: 1,
    GAMEOVER: 2
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
        this.difficulty = new DifficultyManager();
        this.ui = new UIManager(sound);

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
        // Internal fixed resolution for rendering crisp physics & graphics
        this.canvas.width = CONFIG.CANVAS_WIDTH;
        this.canvas.height = CONFIG.CANVAS_HEIGHT;

        const resize = () => {
            const containerWidth = this.container.clientWidth;
            const containerHeight = this.container.clientHeight;
            // Canvas styled to fill container via CSS width/height: 100%
        };
        window.addEventListener('resize', resize);
        resize();
    }

    bindEvents() {
        // Keyboard Controls (Arrow Keys strictly)
        window.addEventListener('keydown', (e) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault(); // Prevent browser scrolling
            }

            if (this.state === GAME_STATE.PLAYING) {
                if (e.code === 'ArrowLeft') this.keys.left = true;
                if (e.code === 'ArrowRight') this.keys.right = true;
                if (e.code === 'ArrowUp') this.keys.jump = true;
                if (e.code === 'ArrowDown') this.keys.down = true;
            }
        });

        window.addEventListener('keyup', (e) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
            }

            if (e.code === 'ArrowLeft') this.keys.left = false;
            if (e.code === 'ArrowRight') this.keys.right = false;
            if (e.code === 'ArrowUp') this.keys.jump = false;
            if (e.code === 'ArrowDown') this.keys.down = false;
        });

        // UI Buttons
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
        this.ui.showStartScreen();
    }

    startGame() {
        // Full State Reset
        this.score = 0;
        this.particles.reset();
        this.player.reset();
        this.platform.reset();
        this.difficulty.reset();
        this.keys = { left: false, right: false, jump: false, down: false };

        this.state = GAME_STATE.PLAYING;
        this.ui.showHUD();
        this.lastFrameTime = performance.now();
    }

    gameOver(reason) {
        if (this.state === GAME_STATE.GAMEOVER) return;
        this.state = GAME_STATE.GAMEOVER;
        this.deathCause = reason;

        sound.playImpact();

        // Create player hit explosion particles
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
                this.deathCause
            );
        }, 400);
    }

    startLoop() {
        const loop = (timestamp) => {
            if (!this.lastFrameTime) this.lastFrameTime = timestamp;
            const dt = Math.min((timestamp - this.lastFrameTime) / 1000, 0.1); // Cap delta time
            this.lastFrameTime = timestamp;

            this.update(dt);
            this.draw();

            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    update(dt) {
        if (this.state === GAME_STATE.PLAYING) {
            // 1. Update Player
            this.player.update(this.keys, this.platform, sound);

            // Check if player fell into a gap past the ground
            if (this.player.y > CONFIG.GROUND_Y + 100) {
                this.gameOver("Fell into the broken abyss!");
                return;
            }

            // 2. Update Difficulty & Hazards
            this.difficulty.update(dt, this.particles, this.platform, sound);

            if (this.difficulty.levelJustChanged) {
                this.ui.triggerLevelBanner(this.difficulty.currentStage);
            }

            // 3. Update Score based on survival time + level multiplier
            const scoreMultiplier = 1 + (this.difficulty.currentStageIndex * 0.5);
            this.score += dt * 100 * scoreMultiplier;

            // 4. Collision Detection (Player vs Hazards)
            const playerHitbox = this.player.getHitbox();

            for (let hazard of this.difficulty.hazards) {
                const hazardHitbox = hazard.getHitbox();

                if (this.checkCollision(playerHitbox, hazardHitbox)) {
                    let name = "a falling hazard";
                    if (hazard.constructor.name === 'ShootingStar') name = "a Shooting Star";
                    if (hazard.constructor.name === 'Hailstone') name = "a Hailstone";
                    if (hazard.constructor.name === 'Asteroid') name = "a heavy Asteroid";
                    if (hazard.constructor.name === 'Fireball') name = "a burning Fireball";

                    this.gameOver(`Crushed by ${name}!`);
                    return;
                }
            }

            // 5. Update HUD
            this.ui.updateHUD(this.score, this.difficulty.survivalTime, this.difficulty.currentStage);
        } else if (this.state === GAME_STATE.MENU) {
            // Menu State preview background updates
            this.difficulty.update(dt * 0.5, this.particles, this.platform, sound);
        }
    }

    checkCollision(rect1, rect2) {
        return (
            rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y
        );
    }

    draw() {
        // Clear screen with deep space background fill
        this.ctx.fillStyle = '#0a0c16';
        this.ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        // 1. Draw Starfield & Dynamic Particles
        this.particles.updateAndDraw(this.ctx, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        // 2. Draw Platform & Crumbling Gaps
        this.platform.draw(this.ctx);

        // 3. Draw Hazards & Warnings
        this.difficulty.draw(this.ctx);

        // 4. Draw Player (if playing or menu preview)
        if (this.state === GAME_STATE.PLAYING || this.state === GAME_STATE.MENU) {
            this.player.draw(this.ctx);
        }
    }
}
