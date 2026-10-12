/* -------------------------------------------------------------
   SHOOTING STARS - UI & HUD Overlay Manager
   Manages start menu, HUD updates, game-over screen, and high scores
   ------------------------------------------------------------- */

import { CONFIG } from './config.js';

export class UIManager {
    constructor(soundManager) {
        this.sound = soundManager;
        this.highScore = this.loadHighScore();

        // Element References
        this.hudLayer = document.getElementById('hud-layer');
        this.startScreen = document.getElementById('start-screen');
        this.gameoverScreen = document.getElementById('gameover-screen');
        this.levelUpBanner = document.getElementById('level-up-banner');

        // HUD Text Elements
        this.hudLevelVal = document.getElementById('hud-level-val');
        this.hudLevelName = document.getElementById('hud-level-name');
        this.hudTimeVal = document.getElementById('hud-time-val');
        this.hudScoreVal = document.getElementById('hud-score-val');
        this.hudBestVal = document.getElementById('hud-best-val');

        // Menu Score Elements
        this.menuBestScore = document.getElementById('menu-best-score');
        this.audioToggleBtn = document.getElementById('audio-toggle-btn');
        this.audioIcon = document.getElementById('audio-icon');

        // Game Over Elements
        this.deathReason = document.getElementById('death-reason');
        this.goScore = document.getElementById('go-score');
        this.goTime = document.getElementById('go-time');
        this.goLevel = document.getElementById('go-level');
        this.goBest = document.getElementById('go-best');
        this.newRecordBadge = document.getElementById('new-record-badge');

        this.initEventListeners();
        this.updateBestScoreDisplays();
    }

    loadHighScore() {
        try {
            const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
            return saved ? parseInt(saved, 10) || 0 : 0;
        } catch (e) {
            return 0;
        }
    }

    saveHighScore(score) {
        if (score > this.highScore) {
            this.highScore = score;
            try {
                localStorage.setItem(CONFIG.STORAGE_KEY, score.toString());
            } catch (e) {
                console.warn("Could not save high score to localStorage", e);
            }
            this.updateBestScoreDisplays();
            return true; // New record achieved!
        }
        return false;
    }

    updateBestScoreDisplays() {
        if (this.hudBestVal) this.hudBestVal.textContent = this.highScore.toLocaleString();
        if (this.menuBestScore) this.menuBestScore.textContent = this.highScore.toLocaleString();
    }

    initEventListeners() {
        if (this.audioToggleBtn) {
            this.audioToggleBtn.addEventListener('click', () => {
                const isMuted = this.sound.toggleMute();
                this.audioIcon.textContent = isMuted ? '🔇' : '🔊';
            });
        }
    }

    showStartScreen() {
        this.startScreen.classList.remove('hidden');
        this.gameoverScreen.classList.add('hidden');
        this.hudLayer.classList.add('hidden');
        this.updateBestScoreDisplays();
    }

    showHUD() {
        this.startScreen.classList.add('hidden');
        this.gameoverScreen.classList.add('hidden');
        this.hudLayer.classList.remove('hidden');
    }

    showGameOver(finalScore, survivalTime, stageName, stageLevel, deathCause) {
        const isNewRecord = this.saveHighScore(finalScore);

        this.deathReason.textContent = deathCause || "Smashed by a falling obstacle!";
        this.goScore.textContent = finalScore.toLocaleString();
        this.goTime.textContent = this.formatTime(survivalTime);
        this.goLevel.textContent = `LVL ${stageLevel} - ${stageName}`;
        this.goBest.textContent = this.highScore.toLocaleString();

        if (isNewRecord) {
            this.newRecordBadge.classList.remove('hidden');
        } else {
            this.newRecordBadge.classList.add('hidden');
        }

        this.gameoverScreen.classList.remove('hidden');
    }

    updateHUD(score, survivalTime, stageConfig) {
        this.hudLevelVal.textContent = `LVL ${stageConfig.LEVEL}`;
        this.hudLevelName.textContent = stageConfig.NAME;
        this.hudTimeVal.textContent = this.formatTime(survivalTime);
        this.hudScoreVal.textContent = Math.floor(score).toLocaleString();
    }

    triggerLevelBanner(stageConfig) {
        const titleEl = document.getElementById('banner-title-text');
        const subEl = document.getElementById('banner-sub-text');

        if (titleEl && subEl) {
            titleEl.textContent = `LEVEL ${stageConfig.LEVEL}!`;
            subEl.textContent = `${stageConfig.NAME} HAS BEGUN`;

            this.levelUpBanner.classList.remove('banner-hidden');
            this.levelUpBanner.classList.add('banner-visible');

            setTimeout(() => {
                this.levelUpBanner.classList.remove('banner-visible');
                this.levelUpBanner.classList.add('banner-hidden');
            }, 2200);
        }
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}
