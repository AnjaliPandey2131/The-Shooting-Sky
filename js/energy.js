/* -------------------------------------------------------------
   SHOOTING STARS - Energy Manager
   Manages the firecracker energy bar, drain, coin restoration,
   shield milestone tracking, analytics, and energy-tier physics.
   ------------------------------------------------------------- */

import { CONFIG } from './config.js';

export class EnergyManager {
    constructor() {
        this.reset();
    }

    reset() {
        this.energy = CONFIG.ENERGY.START;       // current energy %
        this._displayEnergy = CONFIG.ENERGY.START; // smoothly animated display value

        // Shield tracking — per run
        this.runCoinsCollected = 0;         // coins collected this run (for shield milestones)
        this.shieldCharges = 0;             // available shield charges
        this.milestonesGranted = new Set(); // which multiples of COINS_PER_CHARGE we've already granted
        this.shieldActive = false;
        this.shieldTimer = 0;

        // Analytics: coin count per 30s interval (indices 0-4 map to levels 1-5)
        this.intervalCoins = [0, 0, 0, 0, 0];
        this.currentIntervalIndex = 0;

        // Internal smooth-lerp target for physics multipliers
        this._smoothSpeedMult = 1.0;
        this._smoothJumpMult  = 1.0;
        this._smoothLeanRad   = 0.0;
        this._smoothCadence   = 1.0;
    }

    // ─── Called every frame (only during active play) ──────────────────────
    update(dt) {
        // Drain energy over time
        const drain = CONFIG.ENERGY.DRAIN_PER_SECOND * dt;
        this.energy = Math.max(CONFIG.ENERGY.MIN, this.energy - drain);

        // Smooth display value (for bar animation)
        this._displayEnergy += (this.energy - this._displayEnergy) * Math.min(1, dt * 8);

        // Shield timer countdown
        if (this.shieldActive) {
            this.shieldTimer -= dt;
            if (this.shieldTimer <= 0) {
                this.shieldActive = false;
                this.shieldTimer = 0;
            }
        }

        // Smoothly interpolate physics multipliers toward target values
        const targetSpeed   = this._getSpeedMult();
        const targetJump    = this._getJumpMult();
        const targetLean    = this._getLean();
        const targetCadence = this._getCadence();

        const lerpRate = Math.min(1, dt * 4); // smooth 4Hz approach
        this._smoothSpeedMult += (targetSpeed   - this._smoothSpeedMult) * lerpRate;
        this._smoothJumpMult  += (targetJump    - this._smoothJumpMult)  * lerpRate;
        this._smoothLeanRad   += (targetLean    - this._smoothLeanRad)   * lerpRate;
        this._smoothCadence   += (targetCadence - this._smoothCadence)   * lerpRate;
    }

    // ─── Called when a coin is collected ───────────────────────────────────
    /**
     * @param {number} intervalIndex  0-based index of the 30s interval
     * @returns {boolean} true if a new shield milestone was earned
     */
    onCoinCollected(intervalIndex) {
        this.energy = Math.min(CONFIG.ENERGY.MAX, this.energy + CONFIG.ENERGY.COIN_RESTORE);
        this.runCoinsCollected++;

        // Track analytics for this interval
        const idx = Math.min(intervalIndex, 4);
        this.intervalCoins[idx]++;

        // Shield milestone check
        const milestone = Math.floor(this.runCoinsCollected / CONFIG.SHIELD.COINS_PER_CHARGE);
        if (milestone > 0 && !this.milestonesGranted.has(milestone)) {
            this.milestonesGranted.add(milestone);
            this.shieldCharges++;
            return true; // new shield earned
        }
        return false;
    }

    // ─── Shield activation (called by game engine before collision resolves) ──
    /**
     * Attempt to activate the shield. Returns true if activated.
     */
    tryActivateShield() {
        if (!this.shieldActive && this.shieldCharges > 0) {
            this.shieldCharges--;
            this.shieldActive = true;
            this.shieldTimer = CONFIG.SHIELD.INVULNERABLE_DURATION;
            return true;
        }
        return false;
    }

    // ─── Smooth physics accessors used by Player ───────────────────────────
    get speedMultiplier() { return this._smoothSpeedMult; }
    get jumpMultiplier()  { return this._smoothJumpMult;  }
    get lean()            { return this._smoothLeanRad;   }
    get cadence()         { return this._smoothCadence;   }

    // Raw (instant) multipliers — for math/reference
    _getSpeedMult() {
        const e = this.energy;
        const E = CONFIG.ENERGY;
        if (e >= E.TIER_HIGH) return E.SPEED_HIGH;
        if (e >= E.TIER_MED)  return this._lerp(E.SPEED_MED,  E.SPEED_HIGH, (e - E.TIER_MED)  / (E.TIER_HIGH - E.TIER_MED));
        if (e >= E.TIER_LOW)  return this._lerp(E.SPEED_ZERO, E.SPEED_MED,  (e - E.TIER_LOW)  / (E.TIER_MED  - E.TIER_LOW));
        return E.SPEED_ZERO;
    }

    _getJumpMult() {
        const e = this.energy;
        const E = CONFIG.ENERGY;
        if (e >= E.TIER_HIGH) return E.JUMP_HIGH;
        if (e >= E.TIER_MED)  return this._lerp(E.JUMP_MED,  E.JUMP_HIGH, (e - E.TIER_MED)  / (E.TIER_HIGH - E.TIER_MED));
        if (e >= E.TIER_LOW)  return this._lerp(E.JUMP_ZERO, E.JUMP_MED,  (e - E.TIER_LOW)  / (E.TIER_MED  - E.TIER_LOW));
        return E.JUMP_ZERO;
    }

    _getLean() {
        const e = this.energy;
        const E = CONFIG.ENERGY;
        if (e >= E.TIER_HIGH) return E.LEAN_HIGH;
        if (e >= E.TIER_MED)  return this._lerp(E.LEAN_HIGH, E.LEAN_MED,  (E.TIER_HIGH - e) / (E.TIER_HIGH - E.TIER_MED));
        if (e >= E.TIER_LOW)  return this._lerp(E.LEAN_MED,  E.LEAN_LOW,  (E.TIER_MED  - e) / (E.TIER_MED  - E.TIER_LOW));
        return E.LEAN_ZERO;
    }

    _getCadence() {
        const e = this.energy;
        const E = CONFIG.ENERGY;
        if (e >= E.TIER_HIGH) return E.CADENCE_HIGH;
        if (e >= E.TIER_MED)  return this._lerp(E.CADENCE_MED,  E.CADENCE_HIGH, (e - E.TIER_MED)  / (E.TIER_HIGH - E.TIER_MED));
        if (e >= E.TIER_LOW)  return this._lerp(E.CADENCE_ZERO, E.CADENCE_MED,  (e - E.TIER_LOW)  / (E.TIER_MED  - E.TIER_LOW));
        return E.CADENCE_ZERO;
    }

    _lerp(a, b, t) {
        return a + (b - a) * Math.max(0, Math.min(1, t));
    }

    // ─── Display helpers ───────────────────────────────────────────────────
    /** Energy percentage for the visual bar (0–100, smoothed). */
    get displayEnergy() {
        return Math.max(0, Math.min(100, this._displayEnergy));
    }

    /** Current energy tier name for colour decisions. */
    get tier() {
        const e = this.energy;
        if (e >= CONFIG.ENERGY.TIER_HIGH) return 'HIGH';
        if (e >= CONFIG.ENERGY.TIER_MED)  return 'MED';
        if (e >= CONFIG.ENERGY.TIER_LOW)  return 'LOW';
        return 'ZERO';
    }
}
