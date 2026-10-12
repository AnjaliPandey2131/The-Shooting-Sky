/* -------------------------------------------------------------
   SHOOTING STARS - Hazard Classes & Spawner
   Shooting Stars, Hailstones, Asteroids, Fireballs & Meteor Waves
   ------------------------------------------------------------- */

import { CONFIG } from './config.js';

// Base Hazard Class
export class Hazard {
    constructor(x, y, radius, vx, vy, color, scoreValue) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.scoreValue = scoreValue;
        this.isOffscreen = false;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 0.08;
    }

    update(particleSystem) {
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.rotSpeed;

        if (this.y - this.radius > CONFIG.CANVAS_HEIGHT ||
            this.x + this.radius < -50 ||
            this.x - this.radius > CONFIG.CANVAS_WIDTH + 50) {
            this.isOffscreen = true;
        }
    }

    getHitbox() {
        return {
            x: this.x - this.radius * 0.85,
            y: this.y - this.radius * 0.85,
            width: this.radius * 1.7,
            height: this.radius * 1.7
        };
    }
}

// 1. Shooting Star: Fast glowing cyan star with trailing particles
export class ShootingStar extends Hazard {
    constructor(x, speed) {
        const vx = (Math.random() - 0.5) * 3;
        super(x, -20, CONFIG.HAZARDS.SHOOTING_STAR.RADIUS, vx, speed, CONFIG.HAZARDS.SHOOTING_STAR.COLOR, CONFIG.HAZARDS.SHOOTING_STAR.SCORE_VALUE);
    }

    update(particleSystem) {
        super.update(particleSystem);
        if (Math.random() < 0.6) {
            particleSystem.createTrail(this.x, this.y, '#00f0ff', 2.5);
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 15;

        // Draw tail
        const tailLength = 25;
        const grad = ctx.createLinearGradient(this.x, this.y, this.x - this.vx * 3, this.y - tailLength);
        grad.addColorStop(0, 'rgba(0, 240, 255, 0.9)');
        grad.addColorStop(1, 'rgba(0, 240, 255, 0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = this.radius * 1.5;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - this.vx * 3, this.y - tailLength);
        ctx.stroke();

        // Core star
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// 2. Hailstone: Ice blue sphere falling in fast bursts
export class Hailstone extends Hazard {
    constructor(x, speed) {
        super(x, -15, CONFIG.HAZARDS.HAILSTONE.RADIUS, (Math.random() - 0.5) * 1.5, speed, CONFIG.HAZARDS.HAILSTONE.COLOR, CONFIG.HAZARDS.HAILSTONE.SCORE_VALUE);
    }

    update(particleSystem) {
        super.update(particleSystem);
        if (Math.random() < 0.4) {
            particleSystem.createTrail(this.x, this.y, '#a5f3fc', 2);
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.shadowColor = '#a5f3fc';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#e0f2fe';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Inner ice glint
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.x - this.radius * 0.3, this.y - this.radius * 0.3, this.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// 3. Asteroid: Large irregular crater rock rotating while falling
export class Asteroid extends Hazard {
    constructor(x, speed) {
        super(x, -35, CONFIG.HAZARDS.ASTEROID.RADIUS, (Math.random() - 0.5) * 2, speed, CONFIG.HAZARDS.ASTEROID.COLOR, CONFIG.HAZARDS.ASTEROID.SCORE_VALUE);
        this.shapePoints = [];
        const numPoints = 8;
        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            const r = this.radius * (0.8 + Math.random() * 0.4);
            this.shapePoints.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        ctx.fillStyle = '#475569';
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2.5;

        ctx.beginPath();
        ctx.moveTo(this.shapePoints[0].x, this.shapePoints[0].y);
        for (let i = 1; i < this.shapePoints.length; i++) {
            ctx.lineTo(this.shapePoints[i].x, this.shapePoints[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Craters
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(-this.radius * 0.3, -this.radius * 0.2, this.radius * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.radius * 0.3, this.radius * 0.3, this.radius * 0.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// 4. Fireball: Fiery orange flame ball with smoke trail
export class Fireball extends Hazard {
    constructor(x, speed) {
        super(x, -25, CONFIG.HAZARDS.FIREBALL.RADIUS, (Math.random() - 0.5) * 2.5, speed, CONFIG.HAZARDS.FIREBALL.COLOR, CONFIG.HAZARDS.FIREBALL.SCORE_VALUE);
    }

    update(particleSystem) {
        super.update(particleSystem);
        particleSystem.createTrail(this.x, this.y, '#ff4500', 4);
        if (Math.random() < 0.5) {
            particleSystem.createTrail(this.x, this.y - 10, '#ffcc00', 2.5);
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.shadowColor = '#ff4500';
        ctx.shadowBlur = 20;

        const grad = ctx.createRadialGradient(this.x, this.y, 2, this.x, this.y, this.radius);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.4, '#ffcc00');
        grad.addColorStop(0.8, '#ff4500');
        grad.addColorStop(1, 'rgba(255, 0, 0, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// 5. Meteor Wave Warning & Shower
export class MeteorWaveWarning {
    constructor(targetX, width = 120, duration = 1.2) {
        this.targetX = targetX;
        this.width = width;
        this.duration = duration;
        this.timer = 0;
        this.isReadyToSpawn = false;
        this.isExpired = false;
    }

    update(dt) {
        this.timer += dt;
        if (this.timer >= this.duration && !this.isReadyToSpawn) {
            this.isReadyToSpawn = true;
        }
    }

    draw(ctx) {
        ctx.save();
        const pulse = Math.abs(Math.sin(this.timer * 8));

        // Red laser indicator lines at top
        ctx.fillStyle = `rgba(255, 42, 95, ${0.15 + pulse * 0.25})`;
        ctx.fillRect(this.targetX - this.width / 2, 0, this.width, CONFIG.GROUND_Y);

        ctx.strokeStyle = `rgba(255, 42, 95, ${0.4 + pulse * 0.5})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(this.targetX - this.width / 2, 0);
        ctx.lineTo(this.targetX - this.width / 2, CONFIG.GROUND_Y);
        ctx.moveTo(this.targetX + this.width / 2, 0);
        ctx.lineTo(this.targetX + this.width / 2, CONFIG.GROUND_Y);
        ctx.stroke();

        // Warning Icon at Top
        ctx.fillStyle = '#ff2a5f';
        ctx.font = '900 18px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("⚠ WARNING ⚠", this.targetX, 40);
        ctx.restore();
    }
}
