/* -------------------------------------------------------------
   SHOOTING STARS - UI & HUD Overlay Manager
   Manages start menu, HUD updates, firecracker energy bar,
   shield counter, game-over screen, analytics chart, and high scores.
   ------------------------------------------------------------- */

import { CONFIG } from './config.js';

export class UIManager {
    constructor(soundManager) {
        this.sound = soundManager;
        this.highScore = this.loadHighScore();
        this.bestCoins = this.loadBestCoins();

        // Element References
        this.hudLayer        = document.getElementById('hud-layer');
        this.startScreen     = document.getElementById('start-screen');
        this.gameoverScreen  = document.getElementById('gameover-screen');
        this.levelUpBanner   = document.getElementById('level-up-banner');
        this.aboutScreen = document.getElementById('about-screen');
        // HUD Text Elements
        this.hudLevelVal  = document.getElementById('hud-level-val');
        this.hudLevelName = document.getElementById('hud-level-name');
        this.hudTimeVal   = document.getElementById('hud-time-val');
        this.hudScoreVal  = document.getElementById('hud-score-val');
        this.hudBestVal   = document.getElementById('hud-best-val');
        this.hudCoinVal   = document.getElementById('hud-coin-num');

        // Energy HUD
        this.energyFill    = document.getElementById('energy-fill');
        this.energyTip     = document.getElementById('energy-tip');
        this.energyPct     = document.getElementById('energy-pct');

        // Shield HUD
        this.shieldCount   = document.getElementById('shield-count');
        this.shieldActive  = document.getElementById('shield-active');

        // Menu Score Elements
        this.menuBestScore   = document.getElementById('menu-best-score');
        this.audioToggleBtn  = document.getElementById('audio-toggle-btn');
        this.audioIcon       = document.getElementById('audio-icon');

        // Game Over Elements
        this.deathReason     = document.getElementById('death-reason');
        this.goScore         = document.getElementById('go-score');
        this.goTime          = document.getElementById('go-time');
        this.goLevel         = document.getElementById('go-level');
        this.goBest          = document.getElementById('go-best');
        this.goCoins         = document.getElementById('go-coins');
        this.goShields       = document.getElementById('go-shields');
        this.newRecordBadge  = document.getElementById('new-record-badge');

        // Analytics chart canvas (game-over)
        this.chartCanvas     = document.getElementById('analytics-chart');

        this.initEventListeners();
        this.updateBestScoreDisplays();
    }

    loadHighScore() {
        try {
            const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
            return saved ? parseInt(saved, 10) || 0 : 0;
        } catch (e) { return 0; }
    }

    loadBestCoins() {
        try {
            const saved = localStorage.getItem(CONFIG.STORAGE_KEY + '_coins');
            return saved ? parseInt(saved, 10) || 0 : 0;
        } catch (e) { return 0; }
    }

    saveHighScore(score) {
        if (score > this.highScore) {
            this.highScore = score;
            try { localStorage.setItem(CONFIG.STORAGE_KEY, score.toString()); } catch (e) {}
            this.updateBestScoreDisplays();
            return true;
        }
        return false;
    }

    saveBestCoins(coins) {
        if (coins > this.bestCoins) {
            this.bestCoins = coins;
            try { localStorage.setItem(CONFIG.STORAGE_KEY + '_coins', coins.toString()); } catch (e) {}
        }
    }

    updateBestScoreDisplays() {
        if (this.hudBestVal)  this.hudBestVal.textContent  = this.highScore.toLocaleString();
        if (this.menuBestScore) this.menuBestScore.textContent = this.highScore.toLocaleString();
    }

    initEventListeners() {
        // Existing listeners
        if (this.audioToggleBtn) {
            this.audioToggleBtn.addEventListener('click', () => {
                const isMuted = this.sound.toggleMute();
                this.audioIcon.textContent = isMuted ? '🔇' : '🔊';
            });
        }
        // Start button handled elsewhere in game.js
        // About button
        const aboutBtn = document.getElementById('about-btn');
        if (aboutBtn) {
            aboutBtn.addEventListener('click', () => this.showAboutScreen());
        }
        // About close button
        const aboutCloseBtn = document.getElementById('about-close-btn');
        if (aboutCloseBtn) {
            aboutCloseBtn.addEventListener('click', () => this.hideAboutScreen());
        }

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
        if (this.aboutScreen) this.aboutScreen.classList.add('hidden');
        this.updateBestScoreDisplays();
    }

    showHUD() {
        this.startScreen.classList.add('hidden');
        this.gameoverScreen.classList.add('hidden');
        this.hudLayer.classList.remove('hidden');
    }

    showAboutScreen() {
        if (this.aboutScreen) {
            this.aboutScreen.classList.remove('hidden');
            this.startScreen.classList.add('hidden');
            this.hudLayer.classList.add('hidden');
            this.gameoverScreen.classList.add('hidden');
        }
    }

    hideAboutScreen() {
        if (this.aboutScreen) {
            this.aboutScreen.classList.add('hidden');
            this.startScreen.classList.remove('hidden');
        }
    }

    /**
     * Show game-over screen with analytics.
     * @param {number[]} intervalCoins - coins per 30s interval (array of 5)
     * @param {number}   shieldsUsed   - how many shield milestones were earned
     */
    showGameOver(finalScore, survivalTime, stageName, stageLevel, deathCause, totalCoins = 0, intervalCoins = [], shieldsRemaining = 0, shieldsUsed = 0) {
        const isNewRecord = this.saveHighScore(finalScore);
        this.saveBestCoins(totalCoins);

        this.deathReason.textContent = deathCause || "Smashed by a falling obstacle!";
        this.goScore.textContent     = finalScore.toLocaleString();
        this.goTime.textContent      = this.formatTime(survivalTime);
        this.goLevel.textContent     = `LVL ${stageLevel} - ${stageName}`;
        this.goBest.textContent      = this.highScore.toLocaleString();
        if (this.goCoins)   this.goCoins.textContent   = `${totalCoins} 🪙`;
        if (this.goShields) this.goShields.textContent = `${shieldsUsed} 🛡`;

        if (isNewRecord) {
            this.newRecordBadge.classList.remove('hidden');
        } else {
            this.newRecordBadge.classList.add('hidden');
        }

        this.gameoverScreen.classList.remove('hidden');

        // Draw analytics chart after a brief delay (DOM must be visible)
        setTimeout(() => this._drawAnalyticsChart(intervalCoins, survivalTime), 100);
    }

    /**
     * Update HUD each frame.
     * @param {EnergyManager} energyManager
     */
    updateHUD(score, survivalTime, stageConfig, coinsCollected = 0, energyManager = null, shieldCharges = 0, shieldIsActive = false, shieldTimer = 0) {
        this.hudLevelVal.textContent  = `LVL ${stageConfig.LEVEL}`;
        this.hudLevelName.textContent = stageConfig.NAME;
        this.hudTimeVal.textContent   = this.formatTime(survivalTime);
        this.hudScoreVal.textContent  = Math.floor(score).toLocaleString();
        if (this.hudBestVal)  this.hudBestVal.textContent  = this.highScore.toLocaleString();
        if (this.hudCoinVal)  this.hudCoinVal.textContent  = coinsCollected;

        // ── Firecracker Energy Bar ─────────────────────────────────────────
        if (this.energyFill && energyManager) {
            const pct = energyManager.displayEnergy;
            const tier = energyManager.tier;

            // Bar fill width (%)
            this.energyFill.style.width = `${pct}%`;

            // Colour based on tier
            let barColor, tipColor, glowColor;
            switch (tier) {
                case 'HIGH':
                    barColor  = 'linear-gradient(90deg, #22d3ee, #00f0ff)';
                    tipColor  = '#00f0ff';
                    glowColor = 'rgba(0, 240, 255, 0.5)';
                    break;
                case 'MED':
                    barColor  = 'linear-gradient(90deg, #84cc16, #a3e635)';
                    tipColor  = '#a3e635';
                    glowColor = 'rgba(163, 230, 53, 0.5)';
                    break;
                case 'LOW':
                    barColor  = 'linear-gradient(90deg, #ea580c, #fb923c)';
                    tipColor  = '#fb923c';
                    glowColor = 'rgba(251, 146, 60, 0.5)';
                    break;
                default: // ZERO
                    barColor  = 'linear-gradient(90deg, #9f1239, #f43f5e)';
                    tipColor  = '#f43f5e';
                    glowColor = 'rgba(244, 63, 94, 0.5)';
                    break;
            }

            this.energyFill.style.background   = barColor;
            this.energyFill.style.boxShadow    = `0 0 10px ${glowColor}`;

            // Tip position
            if (this.energyTip) {
                this.energyTip.style.background = tipColor;
                this.energyTip.style.boxShadow  = `0 0 8px ${tipColor}`;
                this.energyTip.style.left       = `calc(${pct}% - 4px)`;
            }

            if (this.energyPct) {
                this.energyPct.textContent = `${Math.round(pct)}%`;
                this.energyPct.style.color = tipColor;
            }

            // Low-energy pulsing class
            const energyBar = document.getElementById('energy-bar-wrap');
            if (energyBar) {
                energyBar.classList.toggle('energy-pulse-low', tier === 'ZERO' || tier === 'LOW');
            }
        }

        // ── Shield HUD ──────────────────────────────────────────────────────
        if (this.shieldCount) {
            this.shieldCount.textContent = shieldCharges > 0 ? `🛡×${shieldCharges}` : '';
            this.shieldCount.style.opacity = shieldCharges > 0 ? '1' : '0.3';
        }
        if (this.shieldActive) {
            if (shieldIsActive) {
                const remaining = Math.ceil(shieldTimer);
                this.shieldActive.textContent = `🛡 ${remaining}s`;
                this.shieldActive.classList.add('shield-active-glow');
            } else {
                this.shieldActive.textContent = '';
                this.shieldActive.classList.remove('shield-active-glow');
            }
        }
    }

    triggerLevelBanner(stageConfig) {
        const titleEl = document.getElementById('banner-title-text');
        const subEl   = document.getElementById('banner-sub-text');

        if (titleEl && subEl) {
            titleEl.textContent = `LEVEL ${stageConfig.LEVEL}!`;
            subEl.textContent   = `${stageConfig.NAME} HAS BEGUN`;

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

    /* ── Analytics Bar Chart (game-over screen) ── */
    _drawAnalyticsChart(intervalCoins, survivalTime) {
        const canvas = this.chartCanvas;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const W = canvas.width  = canvas.offsetWidth  || 360;
        const H = canvas.height = canvas.offsetHeight || 100;

        ctx.clearRect(0, 0, W, H);

        const levels = ['LV1\n0-30s', 'LV2\n30-60s', 'LV3\n60-90s', 'LV4\n90-120s', 'LV5\n120s+'];
        const barCount = 5;
        const barW = (W - 60) / barCount;
        const maxVal = Math.max(1, ...intervalCoins);

        // Background
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(0, 0, W, H);

        for (let i = 0; i < barCount; i++) {
            const val  = intervalCoins[i] || 0;
            const bH   = ((val / maxVal) * (H - 40)) || 0;
            const bX   = 30 + i * barW + barW * 0.15;
            const bW   = barW * 0.7;
            const bY   = H - 24 - bH;

            // Colour per level
            const colors = ['#00f0ff', '#a3e635', '#fb923c', '#f43f5e', '#c084fc'];
            ctx.fillStyle = colors[i];
            ctx.shadowColor = colors[i];
            ctx.shadowBlur = 8;
            ctx.fillRect(bX, bY, bW, bH);
            ctx.shadowBlur = 0;

            // Coin count label
            if (val > 0) {
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 11px Orbitron, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(val, bX + bW / 2, bY - 4);
            }

            // Level label (two lines)
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '8px Outfit, sans-serif';
            ctx.textAlign = 'center';
            const lines = levels[i].split('\n');
            ctx.fillText(lines[0], bX + bW / 2, H - 12);
            ctx.fillText(lines[1] || '', bX + bW / 2, H - 2);
        }
    }
}
