/* -------------------------------------------------------------
   SHOOTING STARS - Difficulty & Level Manager
   Time-based progression system, hazard spawner, and stage transitions
   ------------------------------------------------------------- */

import { CONFIG } from './config.js';
import { ShootingStar, Hailstone, Asteroid, Fireball, MeteorWaveWarning } from './hazards.js';

export class DifficultyManager {
    constructor() {
        this.reset();
    }

    reset() {
        this.survivalTime = 0;
        this.currentStageIndex = 0;
        this.spawnTimer = 0;
        this.hazards = [];
        this.warnings = [];
        this.levelJustChanged = false;
    }

    get currentStage() {
        return CONFIG.STAGES[this.currentStageIndex];
    }

    update(dt, particleSystem, platformManager, sound) {
        this.survivalTime += dt;

        // 1. Check for Level Progression
        let targetIndex = 0;
        if (this.survivalTime >= 120) targetIndex = 4;
        else if (this.survivalTime >= 90) targetIndex = 3;
        else if (this.survivalTime >= 60) targetIndex = 2;
        else if (this.survivalTime >= 30) targetIndex = 1;

        if (targetIndex !== this.currentStageIndex) {
            this.currentStageIndex = targetIndex;
            this.levelJustChanged = true;
            sound.playLevelUp();
        } else {
            this.levelJustChanged = false;
        }

        // 2. Update Platform Deterioration
        platformManager.updateDeterioration(this.currentStage, dt, particleSystem, sound);

        // 3. Update Warnings & Meteor Waves
        for (let i = this.warnings.length - 1; i >= 0; i--) {
            const w = this.warnings[i];
            w.update(dt);
            if (w.isReadyToSpawn) {
                // Spawn wave of meteors in targeted lane!
                for (let k = 0; k < CONFIG.HAZARDS.METEOR_WAVE.METEOR_COUNT; k++) {
                    const spawnX = w.targetX + (Math.random() - 0.5) * (w.width * 0.8);
                    const speed = CONFIG.HAZARDS.METEOR_WAVE.SPEED + Math.random() * 3;
                    this.hazards.push(new Fireball(spawnX, speed));
                }
                this.warnings.splice(i, 1);
            }
        }

        // 4. Spawn Dynamic Hazards
        this.spawnTimer += dt;
        const currentInterval = this.currentStage.SPAWN_INTERVAL;

        if (this.spawnTimer >= currentInterval) {
            this.spawnTimer = 0;
            this.spawnRandomHazard();
        }

        // 5. Update Active Hazards
        for (let i = this.hazards.length - 1; i >= 0; i--) {
            const h = this.hazards[i];
            h.update(particleSystem);
            if (h.isOffscreen) {
                this.hazards.splice(i, 1);
            }
        }
    }

    spawnRandomHazard() {
        const allowedTypes = this.currentStage.TYPES;
        const chosenType = allowedTypes[Math.floor(Math.random() * allowedTypes.length)];
        const spawnX = Math.random() * (CONFIG.CANVAS_WIDTH - 60) + 30;

        // Base speed scales slightly with survival time
        const speedBoost = Math.min(6, this.survivalTime * 0.03);

        switch (chosenType) {
            case 'SHOOTING_STAR': {
                const speed = CONFIG.HAZARDS.SHOOTING_STAR.SPEED_MIN + Math.random() * 3 + speedBoost;
                this.hazards.push(new ShootingStar(spawnX, speed));
                break;
            }
            case 'HAILSTONE': {
                // Spawn hail in quick mini-burst of 2-3
                const count = Math.floor(Math.random() * 2) + 2;
                for (let b = 0; b < count; b++) {
                    const burstX = spawnX + (Math.random() - 0.5) * 60;
                    const speed = CONFIG.HAZARDS.HAILSTONE.SPEED_MIN + Math.random() * 4 + speedBoost;
                    this.hazards.push(new Hailstone(burstX, speed));
                }
                break;
            }
            case 'ASTEROID': {
                const speed = CONFIG.HAZARDS.ASTEROID.SPEED_MIN + Math.random() * 2 + speedBoost * 0.5;
                this.hazards.push(new Asteroid(spawnX, speed));
                break;
            }
            case 'FIREBALL': {
                const speed = CONFIG.HAZARDS.FIREBALL.SPEED_MIN + Math.random() * 4 + speedBoost;
                this.hazards.push(new Fireball(spawnX, speed));
                break;
            }
            case 'METEOR_WAVE': {
                if (this.warnings.length < 2) {
                    const warningX = Math.random() * (CONFIG.CANVAS_WIDTH - 200) + 100;
                    this.warnings.push(new MeteorWaveWarning(warningX));
                }
                break;
            }
        }
    }

    draw(ctx) {
        // Draw Warnings
        this.warnings.forEach(w => w.draw(ctx));
        // Draw Hazards
        this.hazards.forEach(h => h.draw(ctx));
    }
}
