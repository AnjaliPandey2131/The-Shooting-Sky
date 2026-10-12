/* -------------------------------------------------------------
   SHOOTING STARS - Breaking Platform Mechanic
   Manages individual platform segments, crack progression, collapse,
   rock debris particles, and gap bounds checking.
   ------------------------------------------------------------- */

import { CONFIG } from './config.js';

export const SEGMENT_STATE = {
    INTACT: 0,
    CRACKED_1: 1,
    CRACKED_2: 2,
    WARNING: 3,
    CRUMBLED: 4
};

export class PlatformSegment {
    constructor(id, x, width, y, height) {
        this.id = id;
        this.x = x;
        this.width = width;
        this.y = y;
        this.height = height;
        this.state = SEGMENT_STATE.INTACT;
        this.warningTimer = 0;
        this.shakeOffset = 0;
        this.crackLines = this.generateCrackLines();
    }

    generateCrackLines() {
        const lines = [];
        const numCracks = 4;
        for (let i = 0; i < numCracks; i++) {
            const startX = this.x + Math.random() * this.width;
            const startY = this.y + Math.random() * (this.height * 0.5);
            lines.push({
                x1: startX,
                y1: startY,
                x2: startX + (Math.random() - 0.5) * 30,
                y2: startY + 10 + Math.random() * 15,
                x3: startX + (Math.random() - 0.5) * 45,
                y3: startY + 20 + Math.random() * 15
            });
        }
        return lines;
    }

    reset() {
        this.state = SEGMENT_STATE.INTACT;
        this.warningTimer = 0;
        this.shakeOffset = 0;
    }

    triggerWarning(duration = 2.0) {
        if (this.state !== SEGMENT_STATE.CRUMBLED) {
            this.state = SEGMENT_STATE.WARNING;
            this.warningTimer = duration;
        }
    }

    update(dt, particleSystem, sound) {
        if (this.state === SEGMENT_STATE.WARNING) {
            this.warningTimer -= dt;
            this.shakeOffset = (Math.random() - 0.5) * 6;

            // Spawn warning dust
            if (Math.random() < 0.3) {
                particleSystem.createTrail(
                    this.x + Math.random() * this.width,
                    this.y + 5,
                    '#ff2a5f',
                    2
                );
            }

            if (this.warningTimer <= 0) {
                // Collapse into gap!
                this.state = SEGMENT_STATE.CRUMBLED;
                this.shakeOffset = 0;
                particleSystem.createDebris(this.x, this.y, this.width, 25);
                sound.playCrack();
            }
        }
    }

    draw(ctx) {
        if (this.state === SEGMENT_STATE.CRUMBLED) return; // Gap in ground!

        ctx.save();
        const drawX = this.x + this.shakeOffset;

        // Platform base styling
        if (this.state === SEGMENT_STATE.WARNING) {
            const pulse = Math.abs(Math.sin(this.warningTimer * 12));
            ctx.fillStyle = `rgba(255, 42, 95, ${0.4 + pulse * 0.4})`;
            ctx.strokeStyle = '#ff2a5f';
        } else {
            ctx.fillStyle = '#1e293b';
            ctx.strokeStyle = '#3b82f6';
        }

        ctx.lineWidth = 2;
        ctx.fillRect(drawX, this.y, this.width, this.height);
        ctx.strokeRect(drawX, this.y, this.width, this.height);

        // Glowing Top Surface Rail
        ctx.strokeStyle = this.state === SEGMENT_STATE.WARNING ? '#ff2a5f' : '#00f0ff';
        ctx.lineWidth = 3;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(drawX, this.y);
        ctx.lineTo(drawX + this.width, this.y);
        ctx.stroke();

        // Crack Visual Lines
        if (this.state >= SEGMENT_STATE.CRACKED_1) {
            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1.8;
            const cracksToDraw = this.state === SEGMENT_STATE.CRACKED_1 ? 2 : this.crackLines.length;

            for (let i = 0; i < cracksToDraw; i++) {
                const c = this.crackLines[i];
                ctx.beginPath();
                ctx.moveTo(c.x1 + this.shakeOffset, c.y1);
                ctx.lineTo(c.x2 + this.shakeOffset, c.y2);
                ctx.lineTo(c.x3 + this.shakeOffset, c.y3);
                ctx.stroke();
            }
        }

        ctx.restore();
    }
}

export class PlatformManager {
    constructor() {
        this.segments = [];
        this.initSegments();
    }

    initSegments() {
        this.segments = [];
        const segWidth = CONFIG.CANVAS_WIDTH / CONFIG.PLATFORM_SEGMENTS;
        for (let i = 0; i < CONFIG.PLATFORM_SEGMENTS; i++) {
            this.segments.push(
                new PlatformSegment(i, i * segWidth, segWidth, CONFIG.GROUND_Y, CONFIG.PLATFORM_HEIGHT)
            );
        }
    }

    reset() {
        this.segments.forEach(seg => seg.reset());
    }

    // Checks if feet position X is over an intact/cracked segment
    getGroundYAt(x) {
        for (let seg of this.segments) {
            if (seg.state !== SEGMENT_STATE.CRUMBLED) {
                if (x >= seg.x && x <= seg.x + seg.width) {
                    return seg.y;
                }
            }
        }
        return null; // Gap! No solid ground beneath foot!
    }

    // Trigger platform deterioration based on current stage config
    updateDeterioration(stageConfig, dt, particleSystem, sound) {
        if (!stageConfig.PLATFORM_CRACKING) return;

        // 1. Update crack visuals
        if (stageConfig.CRACK_STAGE_MAX >= 1) {
            this.segments.forEach(seg => {
                if (seg.state === SEGMENT_STATE.INTACT && Math.random() < 0.002) {
                    seg.state = SEGMENT_STATE.CRACKED_1;
                    sound.playCrack();
                } else if (seg.state === SEGMENT_STATE.CRACKED_1 && stageConfig.CRACK_STAGE_MAX >= 2 && Math.random() < 0.002) {
                    seg.state = SEGMENT_STATE.CRACKED_2;
                }
            });
        }

        // 2. Trigger crumbling gaps if stage allows collapses
        if (stageConfig.CRACK_STAGE_MAX >= 3) {
            const currentCrumbled = this.segments.filter(s => s.state === SEGMENT_STATE.CRUMBLED || s.state === SEGMENT_STATE.WARNING).length;
            if (currentCrumbled < stageConfig.MAX_CRUMBLED) {
                // Find candidates (must not crumble all adjacent segments to guarantee jumpable gaps)
                const candidates = this.segments.filter(s => s.state !== SEGMENT_STATE.CRUMBLED && s.state !== SEGMENT_STATE.WARNING);

                if (candidates.length > 3 && Math.random() < 0.003) {
                    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
                    chosen.triggerWarning(2.2);
                    sound.playWarning();
                }
            }
        }

        // 3. Update individual segment warning timers & debris
        this.segments.forEach(seg => seg.update(dt, particleSystem, sound));
    }

    draw(ctx) {
        this.segments.forEach(seg => seg.draw(ctx));
    }
}
