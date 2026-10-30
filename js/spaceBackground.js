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
        // Forward the delta time to each background layer
        if (this.layers && Array.isArray(this.layers)) {
            for (const layer of this.layers) {
                if (typeof layer.update === 'function') {
                    layer.update(dt);
                }
            }
        }
    }

    draw(ctx, cameraOffset = 0) {
        // Render each layer, passing currentRegion to layers that accept it.
        for (let i = 0; i < this.layers.length; i++) {
            const layer = this.layers[i];
            layer.draw(ctx, cameraOffset, this.currentRegion);
        }
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
