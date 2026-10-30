/* -------------------------------------------------------------
   SHOOTING STARS - Dynamic Particle System
   Handles starry background, hazard trails, impacts & explosions
   ------------------------------------------------------------- */

export class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    reset() {
        this.particles = [];
    }

    // Spawn burst of explosion particles (meteors hitting ground/player)
    createExplosion(x, y, color, count = 25, speedScale = 1) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = (Math.random() * 6 + 2) * speedScale;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1, // Slight upward boost
                radius: Math.random() * 4 + 2,
                color: color,
                alpha: 1,
                decay: Math.random() * 0.03 + 0.015,
                gravity: 0.2,
                shape: 'circle'
            });
        }
    }

    // Spawn rock debris when platform crumbles
    createDebris(x, y, width, count = 15) {
        for (let i = 0; i < count; i++) {
            const px = x + Math.random() * width;
            const speedX = (Math.random() - 0.5) * 4;
            const speedY = Math.random() * -4 - 1;
            this.particles.push({
                x: px,
                y: y,
                vx: speedX,
                vy: speedY,
                radius: Math.random() * 5 + 3,
                color: '#64748b',
                alpha: 1,
                decay: 0.01,
                gravity: 0.35,
                rotation: Math.random() * Math.PI,
                vRot: (Math.random() - 0.5) * 0.2,
                shape: 'rock'
            });
        }
    }

    // Spawn subtle trailing particles for hazards
    createTrail(x, y, color, radius = 3) {
        this.particles.push({
            x: x + (Math.random() - 0.5) * 4,
            y: y + (Math.random() - 0.5) * 4,
            vx: (Math.random() - 0.5) * 1,
            vy: (Math.random() - 0.5) * 1,
            radius: radius,
            color: color,
            alpha: 0.8,
            decay: 0.05,
            gravity: 0,
            shape: 'circle'
        });
    }

    updateAndDraw(ctx, canvasWidth, canvasHeight) {
        // Update and draw active gameplay particles.
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.alpha -= p.decay;

            if (p.vRot) {
                p.rotation += p.vRot;
            }

            if (p.alpha <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            ctx.save();
            ctx.globalAlpha = Math.max(0, p.alpha);
            ctx.fillStyle = p.color;

            if (p.shape === 'rock') {
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation);
                ctx.fillRect(-p.radius / 2, -p.radius / 2, p.radius, p.radius);
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, Math.max(0.5, p.radius), 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }
}
