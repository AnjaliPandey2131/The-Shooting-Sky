/* -------------------------------------------------------------
   SHOOTING STARS - In-Game Power-Up System
   Spawns 3 random collectible power-ups:
     - Coin Magnet (6s): pulls nearby coins toward player
     - Slow-Mo (5s): slows falling hazards by ~45%
     - 2x Score (8s): doubles all score gained
   ------------------------------------------------------------- */

import { CONFIG } from './config.js';
import { FloatingText } from './coins.js';

export const POWERUP_TYPES = {
    MAGNET: {
        id: 'magnet',
        icon: '🧲',
        label: 'MAGNET',
        color: '#38bdf8',
        glow: 'rgba(56, 189, 248, 0.7)',
        duration: 6
    },
    SLOWMO: {
        id: 'slowmo',
        icon: '⏳',
        label: 'SLOW-MO',
        color: '#c084fc',
        glow: 'rgba(192, 132, 252, 0.7)',
        duration: 5
    },
    DOUBLE_SCORE: {
        id: 'doubleScore',
        icon: '⚡',
        label: '2X SCORE',
        color: '#facc15',
        glow: 'rgba(250, 204, 21, 0.7)',
        duration: 8
    }
};

const TYPE_LIST = [POWERUP_TYPES.MAGNET, POWERUP_TYPES.SLOWMO, POWERUP_TYPES.DOUBLE_SCORE];

class PowerUpItem {
    constructor(x, y, def) {
        this.x = x;
        this.y = y;
        this.def = def;
        this.radius = 16;
        this.alive = true;
        this.age = 0;
        this.maxAge = 11; // despawn if uncollected after 11s
    }

    update(dt) {
        this.age += dt;
        if (this.age >= this.maxAge) {
            this.alive = false;
        }
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
        const bobY = this.y + Math.sin(this.age * 3.5) * 5;
        const pulse = 1 + Math.sin(this.age * 5) * 0.08;
        const fade = this.age > this.maxAge - 2 ? (this.maxAge - this.age) / 2 : 1;

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, fade));
        ctx.translate(this.x, bobY);
        ctx.scale(pulse, pulse);

        // Outer aura
        ctx.shadowColor = this.def.color;
        ctx.shadowBlur = 18;
        ctx.fillStyle = 'rgba(10, 14, 32, 0.78)';
        ctx.strokeStyle = this.def.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Icon
        ctx.shadowBlur = 0;
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.def.icon, 0, 1);

        // Compact label underneath
        ctx.font = 'bold 9px Orbitron, sans-serif';
        ctx.fillStyle = this.def.color;
        ctx.fillText(this.def.label, 0, this.radius + 11);

        ctx.restore();
    }
}

export class PowerUpManager {
    constructor() {
        this.reset();
    }

    reset() {
        this.items = [];
        this.floatingTexts = [];
        this.spawnTimer = 10; // first power-up arrives ~10-14s in
        this.active = {
            magnet: 0,
            slowmo: 0,
            doubleScore: 0
        };
    }

    update(dt, platformManager) {
        // Count down active timers
        if (this.active.magnet > 0) this.active.magnet = Math.max(0, this.active.magnet - dt);
        if (this.active.slowmo > 0) this.active.slowmo = Math.max(0, this.active.slowmo - dt);
        if (this.active.doubleScore > 0) this.active.doubleScore = Math.max(0, this.active.doubleScore - dt);

        // Spawn logic (at most 1 power-up on screen)
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnTimer = 14 + Math.random() * 6;
            if (this.items.length === 0) {
                this._spawnRandom(platformManager);
            }
        }

        for (let i = this.items.length - 1; i >= 0; i--) {
            this.items[i].update(dt);
            if (!this.items[i].alive) {
                this.items.splice(i, 1);
            }
        }

        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            this.floatingTexts[i].update(dt);
            if (!this.floatingTexts[i].alive) {
                this.floatingTexts.splice(i, 1);
            }
        }
    }

    _spawnRandom(platformManager) {
        const intact = platformManager?.segments?.filter(s => s.state < 4) || [];
        let x = 120 + Math.random() * (CONFIG.CANVAS_WIDTH - 240);
        if (intact.length > 0) {
            const seg = intact[Math.floor(Math.random() * intact.length)];
            x = seg.x + 24 + Math.random() * Math.max(10, seg.width - 48);
        }
        const y = CONFIG.GROUND_Y - (48 + Math.random() * 95);
        const def = TYPE_LIST[Math.floor(Math.random() * TYPE_LIST.length)];
        this.items.push(new PowerUpItem(x, y, def));
    }

    checkPlayerCollection(playerHitbox, sound, particles) {
        for (let i = this.items.length - 1; i >= 0; i--) {
            const item = this.items[i];
            const hb = item.getHitbox();
            const hit =
                playerHitbox.x < hb.x + hb.width &&
                playerHitbox.x + playerHitbox.width > hb.x &&
                playerHitbox.y < hb.y + hb.height &&
                playerHitbox.y + playerHitbox.height > hb.y;

            if (hit) {
                this.active[item.def.id] = item.def.duration;
                if (typeof sound.playPowerUp === 'function') sound.playPowerUp();
                if (particles) {
                    particles.createExplosion(item.x, item.y, item.def.color, 16, 0.8);
                }
                this.floatingTexts.push(
                    new FloatingText(item.x, item.y - 24, `${item.def.icon} ${item.def.label}!`, item.def.color)
                );
                this.items.splice(i, 1);
            }
        }
    }

    /** Pull nearby coins toward the player when Coin Magnet is active. */
    applyMagnetToCoins(coinsArray, playerX, playerY, dt) {
        if (this.active.magnet <= 0 || !Array.isArray(coinsArray)) return;
        const magnetRange = 250;
        const pullSpeed = 420 * dt;
        for (const coin of coinsArray) {
            if (coin.collected || !coin.alive) continue;
            const dx = playerX - coin.x;
            const dy = playerY - coin.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 1 && dist <= magnetRange) {
                coin.x += (dx / dist) * pullSpeed;
                coin.y += (dy / dist) * pullSpeed;
            }
        }
    }

    get hazardSpeedMultiplier() {
        return this.active.slowmo > 0 ? 0.55 : 1.0;
    }

    get scoreMultiplier() {
        return this.active.doubleScore > 0 ? 2 : 1;
    }

    draw(ctx) {
        for (const item of this.items) {
            item.draw(ctx);
        }
        for (const ft of this.floatingTexts) {
            ft.draw(ctx);
        }
    }
}
