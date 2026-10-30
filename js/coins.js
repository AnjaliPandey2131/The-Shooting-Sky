/* -------------------------------------------------------------
   SHOOTING STARS - Coin Collection System
   Manages glowing gold coins: level-based spawning, animation,
   hitboxes, collection effects, energy restoration, and analytics.
   ------------------------------------------------------------- */

import { CONFIG } from './config.js';

export class Coin {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 10;
        this.collected = false;
        this.alive = true;

        // Animation state
        this.animTimer = 0;
        this.bobOffset = Math.random() * Math.PI * 2; // phase offset for bob
        this.glowPulse = Math.random() * Math.PI * 2;
        this.sparkleTimer = 0;
        this.sparkles = [];

        // Collection animation
        this.collectAnim = 0;
        this.collectScale = 1;
        this.collectAlpha = 1;
    }

    update(dt) {
        this.animTimer += dt;
        this.glowPulse += dt * 3.5;
        this.sparkleTimer += dt;

        // Generate ambient sparkles
        if (this.sparkleTimer > 0.3 && !this.collected) {
            this.sparkleTimer = 0;
            const angle = Math.random() * Math.PI * 2;
            const dist = this.radius * (0.8 + Math.random() * 0.5);
            this.sparkles.push({
                x: this.x + Math.cos(angle) * dist,
                y: this.y + Math.sin(angle) * dist,
                vx: Math.cos(angle) * 0.5,
                vy: -0.8 - Math.random() * 0.5,
                alpha: 1,
                radius: 1.5 + Math.random()
            });
        }

        for (let i = this.sparkles.length - 1; i >= 0; i--) {
            const s = this.sparkles[i];
            s.x += s.vx;
            s.y += s.vy;
            s.alpha -= 0.04;
            if (s.alpha <= 0) this.sparkles.splice(i, 1);
        }

        if (this.collected) {
            this.collectAnim += dt * 4;
            this.collectScale = 1 + this.collectAnim * 0.8;
            this.collectAlpha = Math.max(0, 1 - this.collectAnim);
            if (this.collectAlpha <= 0) {
                this.alive = false;
            }
        }
    }

    collect() {
        if (this.collected) return false;
        this.collected = true;
        return true;
    }

    getHitbox() {
        return {
            x: this.x - this.radius,
            y: this.y - this.radius,
            width: this.radius * 2,
            height: this.radius * 2
        };
    }

    draw(ctx) {
        if (!this.alive) return;

        const bobY = this.y + Math.sin(this.animTimer * 2 + this.bobOffset) * 4;
        const glow = 0.5 + 0.5 * Math.sin(this.glowPulse);

        ctx.save();

        for (const s of this.sparkles) {
            ctx.globalAlpha = s.alpha * (this.collected ? this.collectAlpha : 1);
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(s.x, bobY + (s.y - this.y), Math.max(0.3, s.radius), 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = this.collectAlpha;
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 12 + glow * 10;

        const scale = this.collected ? this.collectScale : 1;
        ctx.translate(this.x, bobY);
        ctx.scale(scale, scale);

        const grad = ctx.createRadialGradient(-3, -3, 1, 0, 0, this.radius);
        grad.addColorStop(0, '#FFFDE7');
        grad.addColorStop(0.4, '#FFD700');
        grad.addColorStop(0.8, '#FF9800');
        grad.addColorStop(1, '#E65100');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 220, 50, 0.9)';
        ctx.font = `bold ${this.radius * 1.2}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 0;
        ctx.fillText('★', 0, 1);

        ctx.globalAlpha = this.collectAlpha * 0.6;
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.ellipse(-this.radius * 0.3, -this.radius * 0.35, this.radius * 0.25, this.radius * 0.15, -0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

export class FloatingText {
    constructor(x, y, text, color = '#FFD700') {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.alpha = 1;
        this.vy = -1.5;
        this.alive = true;
    }

    update(dt) {
        this.y += this.vy;
        this.alpha -= dt * 1.5;
        this.vy *= 0.97;
        if (this.alpha <= 0) this.alive = false;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.alpha);
        ctx.fillStyle = this.color;
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 3;
        ctx.font = 'bold 16px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 8;
        ctx.strokeText(this.text, this.x, this.y);
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

/* ---------------------------------------------------------------
   Level-Based Coin Spawn Scheduler
   Distributes coins evenly across a 30-second stage window.
   --------------------------------------------------------------- */
export class CoinSpawnScheduler {
    constructor() {
        this.pendingSpawns = [];   // { time: number, spawnFn: Function }
        this.scheduledThisInterval = 0;
        this.lastIntervalIndex = -1;
    }

    reset() {
        this.pendingSpawns = [];
        this.scheduledThisInterval = 0;
        this.lastIntervalIndex = -1;
    }

    /**
     * Schedule coins for the next 30s interval if it's new.
     * @param {number} survivalTime
     * @param {Function} spawnFn - (x, y) => void
     * @param {PlatformManager} platformManager
     * @param {FloatingPlatformManager} floatingPlatforms
     */
    scheduleInterval(survivalTime, spawnFn, platformManager, floatingPlatforms) {
        const intervalIndex = Math.min(4, Math.floor(survivalTime / 30));
        if (intervalIndex === this.lastIntervalIndex) return; // already scheduled

        this.lastIntervalIndex = intervalIndex;
        const cfg = CONFIG.COIN_SPAWNING.LEVEL_TARGETS[intervalIndex];
        const target = cfg.min + Math.floor(Math.random() * (cfg.max - cfg.min + 1));

        const intervalStart = intervalIndex * 30;
        const intervalEnd   = intervalStart + 30;

        // Spread spawn times evenly with jitter
        const spacing = 30 / target;
        for (let i = 0; i < target; i++) {
            const t = intervalStart + i * spacing + (Math.random() - 0.5) * spacing * 0.6;
            this.pendingSpawns.push({
                time: Math.max(intervalStart, Math.min(intervalEnd - 0.5, t)),
                spawnFn,
                intervalIndex
            });
        }

        // Sort by time
        this.pendingSpawns.sort((a, b) => a.time - b.time);
    }

    update(survivalTime, coinManager, platformManager, floatingPlatforms) {
        for (let i = this.pendingSpawns.length - 1; i >= 0; i--) {
            const entry = this.pendingSpawns[i];
            if (survivalTime >= entry.time) {
                // Attempt to spawn a coin at a good location
                coinManager.spawnScheduledCoin(platformManager, floatingPlatforms, entry.intervalIndex);
                this.pendingSpawns.splice(i, 1);
            }
        }
    }
}

/* ---------------------------------------------------------------
   CoinManager
   --------------------------------------------------------------- */
export class CoinManager {
    constructor() {
        this.coins = [];
        this.floatingTexts = [];
        this.totalCollected = 0;   // all-time in this run
        this.coinScoreValue = 50;

        this.scheduler = new CoinSpawnScheduler();
    }

    reset() {
        this.coins = [];
        this.floatingTexts = [];
        this.totalCollected = 0;
        this.scheduler.reset();
    }

    // ── Called each frame ────────────────────────────────────────────────────
    update(dt, survivalTime, platformManager, floatingPlatforms) {
        // Check if we need to schedule the next 30s interval's coins
        this.scheduler.scheduleInterval(
            survivalTime,
            (x, y) => this.trySpawnCoin(x, y),
            platformManager,
            floatingPlatforms
        );

        // Flush pending spawns whose time has arrived
        this.scheduler.update(survivalTime, this, platformManager, floatingPlatforms);

        // Animate coins & floating texts
        for (let i = this.coins.length - 1; i >= 0; i--) {
            this.coins[i].update(dt);
            if (!this.coins[i].alive) {
                this.coins.splice(i, 1);
            }
        }

        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            this.floatingTexts[i].update(dt);
            if (!this.floatingTexts[i].alive) {
                this.floatingTexts.splice(i, 1);
            }
        }
    }

    /**
     * Spawn a coin at a sensible location for the current interval.
     * Prefers: ground level, then low platforms, then higher platforms.
     * Ensures coins are reachable even with low-energy jump heights.
     */
    spawnScheduledCoin(platformManager, floatingPlatforms, intervalIndex) {
        if (this.coins.filter(c => c.alive).length >= CONFIG.COIN_SPAWNING.MAX_ACTIVE_COINS) return;

        const rng = Math.random();

        // 40% chance: spawn on main ground (reachable always)
        if (rng < 0.40 || !floatingPlatforms || floatingPlatforms.tiles.length === 0) {
            this._spawnGroundCoin(platformManager);
            return;
        }

        // Try to place on a floating platform
        const activeTiles = floatingPlatforms.tiles.filter(t => t.state < 3); // not GONE/COLLAPSING
        if (activeTiles.length === 0) {
            this._spawnGroundCoin(platformManager);
            return;
        }

        // For early intervals, prefer tiles that are low (close to ground) — reachable even when tired
        const sortedTiles = [...activeTiles].sort((a, b) => b.y - a.y); // descending Y = lower on screen
        const pickPool = intervalIndex < 2
            ? sortedTiles.slice(0, Math.ceil(sortedTiles.length * 0.6))
            : sortedTiles;

        const tile = pickPool[Math.floor(Math.random() * pickPool.length)];
        const tileTopY = tile.y - CONFIG.COIN_SPAWNING.ABOVE_PLATFORM;

        // Pattern selection — avoid "high" coins on early levels
        const useHigh = intervalIndex >= 2 && Math.random() < 0.25;
        const finalY = useHigh ? tileTopY - CONFIG.COIN_SPAWNING.HIGH_COIN_EXTRA : tileTopY;

        // Place 1–3 coins on this tile
        const count = intervalIndex < 2 ? 1 : Math.random() < 0.4 ? 2 : 1;
        for (let i = 0; i < count; i++) {
            const cx = tile.x + 16 + Math.random() * (tile.width - 32);
            this.trySpawnCoin(cx, finalY - i * 22);
        }
    }

    _spawnGroundCoin(platformManager) {
        // Choose a random intact segment
        const intactSegs = platformManager.segments.filter(s => s.state < 4);
        if (intactSegs.length === 0) return;
        const seg = intactSegs[Math.floor(Math.random() * intactSegs.length)];
        const cx = seg.x + 20 + Math.random() * (seg.width - 40);
        const cy = CONFIG.GROUND_Y - CONFIG.COIN_SPAWNING.GROUND_COIN_HEIGHT;
        this.trySpawnCoin(cx, cy);
    }

    trySpawnCoin(x, y) {
        if (x < 20 || x > CONFIG.CANVAS_WIDTH - 20) return;
        if (y < 40 || y > CONFIG.GROUND_Y - 20) return;

        const dist = CONFIG.COIN_SPAWNING.NEAR_DUPLICATE_DIST;
        for (const coin of this.coins) {
            if (!coin.collected && Math.abs(coin.x - x) < dist && Math.abs(coin.y - y) < dist) return;
        }

        this.coins.push(new Coin(x, y));
    }

    // Legacy: called when a floating platform spawns (from floatingPlatforms.js)
    spawnCoinsForPlatform(tile, survivalTime) {
        if (this.coins.filter(c => c.alive).length >= CONFIG.COIN_SPAWNING.MAX_ACTIVE_COINS) return;

        const tileTopY = tile.y - CONFIG.COIN_SPAWNING.ABOVE_PLATFORM;
        const cx = tile.x + tile.width / 2;
        this.trySpawnCoin(cx, tileTopY);
    }

    /**
     * Check if player hitbox overlaps any uncollected coin.
     * Returns { score, energyRestored, newShield }.
     * @param {Object} playerHitbox
     * @param {SoundManager} sound
     * @param {EnergyManager} energyManager
     * @param {number} intervalIndex - current 30s interval (0-based)
     */
    checkPlayerCollection(playerHitbox, sound, energyManager = null, intervalIndex = 0) {
        let scoreGained = 0;
        let coinsThisCheck = 0;
        let newShieldEarned = false;

        for (const coin of this.coins) {
            if (coin.collected) continue;
            const h = coin.getHitbox();
            if (
                playerHitbox.x < h.x + h.width &&
                playerHitbox.x + playerHitbox.width > h.x &&
                playerHitbox.y < h.y + h.height &&
                playerHitbox.y + playerHitbox.height > h.y
            ) {
                if (coin.collect()) {
                    const reward = this.awardCollectedCoin(
                        coin.x,
                        coin.y,
                        sound,
                        energyManager,
                        intervalIndex
                    );
                    scoreGained += reward.score;
                    coinsThisCheck++;
                    if (reward.newShieldEarned) newShieldEarned = true;
                }
            }
        }

        return { score: scoreGained, coinsCollected: coinsThisCheck, newShieldEarned };
    }

    awardCollectedCoin(x, y, sound, energyManager = null, intervalIndex = 0) {
        this.totalCollected++;
        sound.playCoin();

        const newShieldEarned = energyManager
            ? energyManager.onCoinCollected(intervalIndex)
            : false;

        this.floatingTexts.push(new FloatingText(x, y - 22, `+1 🪙`, '#FFD700'));
        this.floatingTexts.push(
            new FloatingText(x, y - 42, `+${CONFIG.ENERGY.COIN_RESTORE}% ⚡`, '#a3e635')
        );
        if (newShieldEarned) {
            this.floatingTexts.push(new FloatingText(x, y - 64, `🛡 SHIELD!`, '#00f0ff'));
        }

        return { score: this.coinScoreValue, newShieldEarned };
    }

    draw(ctx) {
        for (const coin of this.coins) {
            coin.draw(ctx);
        }
        for (const ft of this.floatingTexts) {
            ft.draw(ctx);
        }
    }
}
