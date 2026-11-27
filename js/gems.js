/* -------------------------------------------------------------
   SHOOTING STARS - Rare Gem (💎) Spawner
   Periodically spawns glowing diamond-shaped Gems falling from
   the sky. Much rarer than coins; used for "Save Me / Revive".
   ------------------------------------------------------------- */

import { CONFIG } from './config.js';
import { FloatingText } from './coins.js';

class Gem {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vy = 1.85;
        this.vx = (Math.random() - 0.5) * 0.6;
        this.radius = 13;
        this.alive = true;
        this.age = 0;
    }

    update(dt) {
        this.age += dt;
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 30 || this.x > CONFIG.CANVAS_WIDTH - 30) {
            this.vx *= -1;
        }
        // Despawn if it falls past the ground
        if (this.y > CONFIG.GROUND_Y + 30) {
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
        const pulse = 1 + Math.sin(this.age * 5) * 0.09;
        const r = this.radius * pulse;

        ctx.save();
        ctx.translate(this.x, this.y);

        // Sparkling aura
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 18 + Math.sin(this.age * 6) * 5;

        // Diamond shape
        const grad = ctx.createLinearGradient(-r, -r, r, r);
        grad.addColorStop(0, '#e0f2fe');
        grad.addColorStop(0.45, '#38bdf8');
        grad.addColorStop(1, '#8b5cf6');

        ctx.fillStyle = grad;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(r * 0.85, 0);
        ctx.lineTo(0, r);
        ctx.lineTo(-r * 0.85, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Inner facet highlight
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.75);
        ctx.lineTo(r * 0.42, -r * 0.08);
        ctx.lineTo(0, r * 0.1);
        ctx.lineTo(-r * 0.42, -r * 0.08);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}

export class GemManager {
    constructor() {
        this.reset();
    }

    reset() {
        this.gems = [];
        this.floatingTexts = [];
        this.totalCollected = 0;
        this.spawnTimer = 18 + Math.random() * 10; // rare: every ~20-32s
    }

    update(dt) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnTimer = 22 + Math.random() * 12;
            if (this.gems.length === 0) {
                const x = 80 + Math.random() * (CONFIG.CANVAS_WIDTH - 160);
                this.gems.push(new Gem(x, -24));
            }
        }

        for (let i = this.gems.length - 1; i >= 0; i--) {
            this.gems[i].update(dt);
            if (!this.gems[i].alive) {
                this.gems.splice(i, 1);
            }
        }

        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            this.floatingTexts[i].update(dt);
            if (!this.floatingTexts[i].alive) {
                this.floatingTexts.splice(i, 1);
            }
        }
    }

    checkPlayerCollection(playerHitbox, sound, particles, onCollected = null) {
        for (let i = this.gems.length - 1; i >= 0; i--) {
            const gem = this.gems[i];
            const hb = gem.getHitbox();
            const hit =
                playerHitbox.x < hb.x + hb.width &&
                playerHitbox.x + playerHitbox.width > hb.x &&
                playerHitbox.y < hb.y + hb.height &&
                playerHitbox.y + playerHitbox.height > hb.y;

            if (hit) {
                this.totalCollected++;
                if (typeof sound.playGem === 'function') sound.playGem();
                if (particles) {
                    particles.createExplosion(gem.x, gem.y, '#38bdf8', 18, 0.85);
                }
                this.floatingTexts.push(new FloatingText(gem.x, gem.y - 22, '+1 💎', '#38bdf8'));
                this.gems.splice(i, 1);
                if (typeof onCollected === 'function') onCollected(this.totalCollected);
            }
        }
    }

    draw(ctx) {
        for (const gem of this.gems) {
            gem.draw(ctx);
        }
        for (const ft of this.floatingTexts) {
            ft.draw(ctx);
        }
    }
}
