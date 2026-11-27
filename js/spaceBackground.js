/* -------------------------------------------------------------
   SHOOTING STARS - Animated space background
   Procedural parallax scenery kept separate from gameplay effects.
   ------------------------------------------------------------- */

import { createBackgroundLayers } from './backgroundLayers.js';
export class SpaceBackground {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.time = 0;
        // Initialize modular background layers
        this.layers = createBackgroundLayers(width, height);
        this.currentRegion = 'earth'; // default region
        this.currentWorld = 'earth';  // active unlockable world
        this.windForce = 0;
        this._worldMotes = Array.from({ length: 24 }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            size: 1.5 + Math.random() * 2.5,
            speed: 18 + Math.random() * 26,
            alpha: 0.25 + Math.random() * 0.4
        }));
    }

    setWorld(worldId) {
        const known = ['earth', 'moon', 'mars', 'cyber'];
        this.currentWorld = known.includes(worldId) ? worldId : 'earth';
    }

    setWindForce(windForce = 0) {
        this.windForce = windForce;
    }

    /**
     * Update the active region for ambient lighting.
     * @param {string} name - one of 'earth','mars','jupiter','nebula','blackhole'
     */
    setRegion(name) {
        const known = ['earth', 'mars', 'jupiter', 'nebula', 'blackhole'];
        this.currentRegion = known.includes(name) ? name : 'earth';
    }

    _createStars(count, minRadius, maxRadius, minSpeed, maxSpeed) {
        return Array.from({ length: count }, () => ({
            x: Math.random() * this.width,
            y: Math.random() * this.height,
            radius: minRadius + Math.random() * (maxRadius - minRadius),
            speed: minSpeed + Math.random() * (maxSpeed - minSpeed),
            alpha: 0.16 + Math.random() * 0.48,
            twinkle: Math.random() * Math.PI * 2
        }));
    }

    _createPlanet(size, baseColor, lightColor) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not create a canvas for the space background.');

        const radius = size * 0.39;
        const center = size / 2;
        const glow = ctx.createRadialGradient(center, center, radius * 0.65, center, center, size * 0.49);
        glow.addColorStop(0, `${lightColor}00`);
        glow.addColorStop(0.78, `${lightColor}18`);
        glow.addColorStop(1, `${lightColor}00`);
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, size, size);

        const atmosphere = ctx.createRadialGradient(
            center - radius * 0.2, center - radius * 0.25, radius * 0.1,
            center, center, radius * 1.12
        );
        atmosphere.addColorStop(0, `${lightColor}72`);
        atmosphere.addColorStop(0.82, `${lightColor}38`);
        atmosphere.addColorStop(1, `${lightColor}00`);
        ctx.fillStyle = atmosphere;
        ctx.beginPath();
        ctx.arc(center, center, radius * 1.12, 0, Math.PI * 2);
        ctx.fill();

        const surface = ctx.createRadialGradient(
            center - radius * 0.38, center - radius * 0.42, radius * 0.04,
            center + radius * 0.12, center + radius * 0.18, radius * 1.2
        );
        surface.addColorStop(0, lightColor);
        surface.addColorStop(0.5, baseColor);
        surface.addColorStop(1, '#080b19');
        ctx.fillStyle = surface;
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.beginPath();
        ctx.arc(center, center, radius - 1, 0, Math.PI * 2);
        ctx.clip();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = lightColor;
        for (let i = 0; i < 5; i++) {
            const bandY = center - radius + i * radius * 0.43;
            ctx.fillRect(center - radius, bandY, radius * 2, radius * 0.12);
        }
        ctx.restore();

        return canvas;
    }

    update(dt) {
        this.time += dt;
        if (this.layers && Array.isArray(this.layers)) {
            for (const layer of this.layers) {
                if (typeof layer.update === 'function') {
                    layer.update(dt);
                }
            }
        }
        for (const m of this._worldMotes) {
            if (this.currentWorld === 'mars') {
                const gustBoost = Math.abs(this.windForce) > 0.05 ? this.windForce * 220 : 28;
                m.x += gustBoost * dt;
                m.y += Math.sin(this.time + m.x * 0.01) * 8 * dt;
            } else {
                m.y -= m.speed * 0.4 * dt;
            }
            if (m.x > this.width + 10) m.x = -10;
            if (m.x < -10) m.x = this.width + 10;
            if (m.y < -10) m.y = this.height + 10;
        }
    }

    draw(ctx, cameraOffset = 0) {
        const effectiveRegion = this.currentWorld === 'mars'
            ? 'mars'
            : (this.currentWorld === 'cyber' ? 'nebula' : this.currentRegion);
        for (let i = 0; i < this.layers.length; i++) {
            const layer = this.layers[i];
            layer.draw(ctx, cameraOffset, effectiveRegion);
        }
        this._drawWorldOverlay(ctx);
    }

    _drawWorldOverlay(ctx) {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        ctx.save();

        if (this.currentWorld === 'earth') {
            // Curved glowing blue Earth horizon rim at the bottom
            const cx = this.width * 0.5;
            const cy = this.height * 2.05;
            const r = this.height * 1.48;
            const rim = ctx.createRadialGradient(cx, cy, r * 0.94, cx, cy, r * 1.03);
            rim.addColorStop(0, isLight ? 'rgba(14, 165, 233, 0.25)' : 'rgba(56, 189, 248, 0.30)');
            rim.addColorStop(0.6, isLight ? 'rgba(56, 189, 248, 0.12)' : 'rgba(0, 240, 255, 0.14)');
            rim.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = rim;
            ctx.beginPath();
            ctx.arc(cx, cy, r * 1.03, Math.PI * 1.1, Math.PI * 1.9);
            ctx.fill();
        } else if (this.currentWorld === 'moon') {
            // Distant glowing blue Earth rising in upper-left sky
            const ex = this.width * 0.16;
            const ey = this.height * 0.22;
            const earthGrad = ctx.createRadialGradient(ex - 8, ey - 8, 4, ex, ey, 34);
            earthGrad.addColorStop(0, '#93c5fd');
            earthGrad.addColorStop(0.6, '#2563eb');
            earthGrad.addColorStop(1, 'rgba(30, 58, 138, 0)');
            ctx.fillStyle = earthGrad;
            ctx.beginPath();
            ctx.arc(ex, ey, 34, 0, Math.PI * 2);
            ctx.fill();

            // Silver-slate lunar crater ridge horizon
            ctx.fillStyle = isLight ? 'rgba(100, 116, 139, 0.26)' : 'rgba(148, 163, 184, 0.20)';
            ctx.beginPath();
            ctx.moveTo(0, this.height);
            ctx.lineTo(0, this.height - 95);
            ctx.quadraticCurveTo(this.width * 0.22, this.height - 135, this.width * 0.45, this.height - 90);
            ctx.quadraticCurveTo(this.width * 0.72, this.height - 55, this.width, this.height - 110);
            ctx.lineTo(this.width, this.height);
            ctx.closePath();
            ctx.fill();

            // Floating lunar dust motes
            ctx.fillStyle = isLight ? '#475569' : '#e2e8f0';
            for (const m of this._worldMotes) {
                ctx.globalAlpha = m.alpha * 0.6;
                ctx.beginPath();
                ctx.arc(m.x, m.y, m.size * 0.8, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (this.currentWorld === 'mars') {
            // Burnt-orange Martian canyon silhouettes
            ctx.fillStyle = isLight ? 'rgba(154, 52, 18, 0.28)' : 'rgba(124, 45, 18, 0.36)';
            ctx.beginPath();
            ctx.moveTo(0, this.height);
            ctx.lineTo(0, this.height - 105);
            ctx.lineTo(this.width * 0.18, this.height - 140);
            ctx.lineTo(this.width * 0.34, this.height - 95);
            ctx.lineTo(this.width * 0.56, this.height - 130);
            ctx.lineTo(this.width * 0.78, this.height - 85);
            ctx.lineTo(this.width, this.height - 125);
            ctx.lineTo(this.width, this.height);
            ctx.closePath();
            ctx.fill();

            // Drifting red sand / wind streaks (intensify during Wind Gusts)
            const gustActive = Math.abs(this.windForce) > 0.05;
            ctx.strokeStyle = isLight ? 'rgba(194, 65, 12, 0.45)' : 'rgba(251, 146, 60, 0.45)';
            ctx.lineWidth = gustActive ? 1.8 : 1;
            for (const m of this._worldMotes) {
                ctx.globalAlpha = gustActive ? m.alpha * 1.3 : m.alpha * 0.55;
                const len = gustActive ? 28 : 10;
                ctx.beginPath();
                ctx.moveTo(m.x, m.y);
                ctx.lineTo(m.x + len, m.y);
                ctx.stroke();
            }
        } else if (this.currentWorld === 'cyber') {
            // Retro synthwave horizon glow + perspective grid
            const horizonY = this.height * 0.68;
            const sunGrad = ctx.createRadialGradient(this.width * 0.5, horizonY, 10, this.width * 0.5, horizonY, 150);
            sunGrad.addColorStop(0, 'rgba(232, 121, 249, 0.35)');
            sunGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = sunGrad;
            ctx.fillRect(0, horizonY - 150, this.width, 150);

            ctx.strokeStyle = isLight ? 'rgba(147, 51, 234, 0.28)' : 'rgba(217, 70, 239, 0.28)';
            ctx.lineWidth = 1;
            for (let i = 0; i <= 12; i++) {
                const xTop = this.width * 0.5 + (i - 6) * 65;
                const xBot = this.width * 0.5 + (i - 6) * 190;
                ctx.beginPath();
                ctx.moveTo(xTop, horizonY);
                ctx.lineTo(xBot, this.height);
                ctx.stroke();
            }
            for (let r = 0; r < 6; r++) {
                const y = horizonY + Math.pow(r / 5, 1.5) * (this.height - horizonY);
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(this.width, y);
                ctx.stroke();
            }

            // Floating cyan/magenta geometric particles
            for (let i = 0; i < this._worldMotes.length; i++) {
                const m = this._worldMotes[i];
                ctx.globalAlpha = m.alpha * 0.7;
                ctx.strokeStyle = i % 2 === 0 ? '#22d3ee' : '#e879f9';
                ctx.strokeRect(m.x, m.y, m.size * 2.2, m.size * 2.2);
            }
        }

        ctx.restore();
    }

    _drawNebula(ctx) {
        const driftX = Math.sin(this.time * 0.035 + this.cloudPhase) * 35;
        const driftY = Math.cos(this.time * 0.028 + this.cloudPhase) * 18;
        for (const cloud of this.clouds) {
            const x = cloud.x + driftX * cloud.driftX;
            const y = cloud.y + driftY * cloud.driftY;
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, cloud.radius);
            gradient.addColorStop(0, `rgba(${cloud.color}, ${cloud.alpha})`);
            gradient.addColorStop(1, `rgba(${cloud.color}, 0)`);
            ctx.fillStyle = gradient;
            ctx.fillRect(x - cloud.radius, y - cloud.radius, cloud.radius * 2, cloud.radius * 2);
        }
    }

    _drawPlanets(ctx) {
        const drift = Math.sin(this.time * 0.012 + this.planetPhase) * 11;
        ctx.globalAlpha = 0.56;
        ctx.drawImage(this.planet, this.planetX + drift - 75, this.planetY - 75);
        ctx.globalAlpha = 0.22;
        ctx.drawImage(this.moon, this.width * 0.13 - 37, this.height * 0.49 + drift * 0.35 - 37);
        ctx.globalAlpha = 1;
    }

    _drawStarfield(ctx) {
        ctx.fillStyle = '#d9e8ff';
        for (const star of this.stars) {
            const twinkle = 0.82 + Math.sin(this.time * 0.55 + star.twinkle) * 0.18;
            ctx.globalAlpha = star.alpha * twinkle;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    _drawDrifters(ctx) {
        ctx.fillStyle = '#a8dfff';
        for (const particle of this.drifters) {
            ctx.globalAlpha = particle.alpha * (0.72 + Math.sin(this.time * 0.3 + particle.twinkle) * 0.16);
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    _drawStreaks(ctx) {
        for (const streak of this.streaks) {
            const gradient = ctx.createLinearGradient(streak.x - streak.length, streak.y, streak.x, streak.y);
            gradient.addColorStop(0, 'rgba(144, 207, 255, 0)');
            gradient.addColorStop(1, `rgba(190, 226, 255, ${streak.alpha})`);
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(streak.x - streak.length, streak.y);
            ctx.lineTo(streak.x, streak.y);
            ctx.stroke();
        }
    }
}
