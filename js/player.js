/* -------------------------------------------------------------
   SHOOTING STARS - Player Character (Procedural Stickman)
   Smooth limb physics, animation states, crouch/jump, and collision.
   Integrates: energy-based posture / speed / jump, platform carry,
   coin collection, cartoon sounds.
   ------------------------------------------------------------- */

import { CONFIG } from './config.js';
import { TILE_STATE } from './floatingPlatforms.js';

export class Player {
    constructor() {
        this.reset();
    }

    reset() {
        this.width = CONFIG.PLAYER.WIDTH;
        this.height = CONFIG.PLAYER.HEIGHT_STANDING;
        this.x = CONFIG.CANVAS_WIDTH / 2 - this.width / 2;
        this.y = CONFIG.GROUND_Y - this.height;

        this.vx = 0;
        this.vy = 0;

        this.facingRight = true;
        this.isGrounded = true;
        this.isCrouching = false;
        this.isDead = false;

        // Which platform tile the player is currently standing on (or null)
        this.standingOnTile = null;

        // Procedural Animation Variables
        this.animTimer = 0;
        this.landingSquish = 0; // Brief recoil compression on impact
        this.crouchProgress = 0; // Smooth 0 to 1 crouch transition

        // Sound cooldown tracking
        this.wasMoving = false;
        this.jumpSoundPlayed = false;

        // Near-miss tracking
        this.nearMissCooldown = 0;
    }

    /**
     * Main update — handles input, physics, platform collisions.
     * @param {Object}   input           - key state { left, right, jump, down }
     * @param {PlatformManager}         platformManager
     * @param {FloatingPlatformManager} floatingPlatforms
     * @param {SoundManager}            sound
     * @param {EnergyManager}           energyManager - may be null for menu preview
     */
    update(input, platformManager, floatingPlatforms, sound, energyManager = null) {
        if (this.isDead) return;

        const now = performance.now() / 1000;

        // ── Gather energy-based physics multipliers (safe defaults if no manager) ──
        const speedMult = energyManager ? energyManager.speedMultiplier : 1.0;
        const jumpMult  = energyManager ? energyManager.jumpMultiplier  : 1.0;
        const cadence   = energyManager ? energyManager.cadence         : 1.0;

        // 1. Crouch State Logic
        const wantCrouch = input.down && this.isGrounded;
        if (wantCrouch) {
            this.isCrouching = true;
            this.height = CONFIG.PLAYER.HEIGHT_CROUCHING;
        } else {
            this.isCrouching = false;
            this.height = CONFIG.PLAYER.HEIGHT_STANDING;
        }

        // Smooth crouch lerp for limb rendering
        const targetCrouch = this.isCrouching ? 1 : 0;
        this.crouchProgress += (targetCrouch - this.crouchProgress) * 0.3;

        // 2. Horizontal Movement Logic (speed scaled by energy)
        const baseSpeed = this.isCrouching ? CONFIG.PLAYER.CROUCH_SPEED : CONFIG.PLAYER.WALK_SPEED;
        const moveSpeed = baseSpeed * speedMult;
        const isMovingHorizontal = input.left || input.right;

        if (input.left) {
            this.vx -= CONFIG.PLAYER.ACCELERATION;
            this.facingRight = false;
        } else if (input.right) {
            this.vx += CONFIG.PLAYER.ACCELERATION;
            this.facingRight = true;
        } else {
            this.vx *= CONFIG.PLAYER.FRICTION;
        }

        // Clamp horizontal velocity to energy-adjusted max
        this.vx = Math.max(-moveSpeed, Math.min(moveSpeed, this.vx));

        // Platform carry: if standing on a floating tile, add its delta
        if (this.standingOnTile && this.standingOnTile.state !== TILE_STATE.GONE) {
            this.x += this.standingOnTile.dx;
        }

        this.x += this.vx;

        // Keep inside screen bounds
        if (this.x < 10) {
            this.x = 10;
            this.vx = 0;
        } else if (this.x + this.width > CONFIG.CANVAS_WIDTH - 10) {
            this.x = CONFIG.CANVAS_WIDTH - 10 - this.width;
            this.vx = 0;
        }

        // 3. Funny Movement Sounds — interval adjusted by energy cadence
        if (this.isGrounded && isMovingHorizontal && Math.abs(this.vx) > 2) {
            // Pass a compressed 'now' so cadence changes the effective interval
            // Lower cadence → slower → lower effective playback rate
            sound.playMoveSound(now, cadence);
        }

        // 4. Vertical Physics & Jump Logic (jump force scaled by energy)
        if (input.jump && this.isGrounded && !this.isCrouching) {
            this.vy = CONFIG.PLAYER.JUMP_FORCE * jumpMult;
            this.isGrounded = false;
            this.standingOnTile = null;
            sound.playJump();
            this.jumpSoundPlayed = true;
        } else {
            this.jumpSoundPlayed = false;
        }

        // Apply Gravity
        this.vy += CONFIG.PLAYER.GRAVITY;

        // Platform carry: add vertical delta if standing on moving tile
        if (this.standingOnTile && this.standingOnTile.state !== TILE_STATE.GONE) {
            this.y += this.standingOnTile.dy;
        }

        this.y += this.vy;

        // 5. Reset grounded state before collision checks
        const wasGrounded = this.isGrounded;
        this.isGrounded = false;
        this.standingOnTile = null;

        const feetX = this.x + this.width / 2;
        const currentFeetY = this.y + this.height;

        // 6a. Check main ground platform segments
        const groundSurfaceY = platformManager.getGroundYAt(feetX);
        if (groundSurfaceY !== null) {
            if (this.vy >= 0 && currentFeetY >= groundSurfaceY && currentFeetY <= groundSurfaceY + 25) {
                if (!wasGrounded) {
                    this.landingSquish = 0.8;
                }
                this.y = groundSurfaceY - this.height;
                this.vy = 0;
                this.isGrounded = true;
            }
        }

        // 6b. Check floating platform tiles (only if not already grounded below main platform)
        if (!this.isGrounded && floatingPlatforms) {
            const tile = floatingPlatforms.getTileAt(feetX, currentFeetY, this.vy);
            if (tile) {
                if (!wasGrounded) {
                    this.landingSquish = 0.8;
                }
                const surf = tile.y + tile.shakeOffset.y;
                this.y = surf - this.height;
                this.vy = 0;
                this.isGrounded = true;
                this.standingOnTile = tile;
                // Notify tile that player is standing on it
                tile.onPlayerStand(1 / 60, sound); // approximate dt
            }
        }

        // If standing on tile, also carry vertical position next frame
        if (this.isGrounded && this.standingOnTile === null && floatingPlatforms) {
            // Check if we're resting on a floating tile even without landing this frame
            const standTile = floatingPlatforms.getStandingTile(this.x, this.y, this.width, this.height);
            if (standTile && standTile.state !== TILE_STATE.GONE) {
                this.standingOnTile = standTile;
            }
        }

        // Decay landing recoil
        this.landingSquish *= 0.75;

        // Update animation stride counter — speed scaled by energy cadence
        if (this.isGrounded && Math.abs(this.vx) > 0.5) {
            this.animTimer += Math.abs(this.vx) * 0.15 * cadence;
        } else if (!this.isGrounded) {
            this.animTimer += 0.1;
        }

        // Near-miss cooldown decay
        if (this.nearMissCooldown > 0) {
            this.nearMissCooldown -= 1 / 60;
        }
    }

    /**
     * Check if a hazard is very close (near miss). Plays whoa/yikes sound.
     */
    checkNearMiss(hazardHitbox, sound) {
        if (this.nearMissCooldown > 0) return;
        const playerHB = this.getHitbox();

        // Expand player hitbox by 20px for near-miss zone
        const expanded = {
            x: playerHB.x - 20,
            y: playerHB.y - 20,
            width: playerHB.width + 40,
            height: playerHB.height + 40
        };

        if (
            expanded.x < hazardHitbox.x + hazardHitbox.width &&
            expanded.x + expanded.width > hazardHitbox.x &&
            expanded.y < hazardHitbox.y + hazardHitbox.height &&
            expanded.y + expanded.height > hazardHitbox.y
        ) {
            sound.playNearMiss();
            this.nearMissCooldown = 3;
        }
    }

    // Returns bounding box for collision detection
    getHitbox() {
        const headR = CONFIG.PLAYER.HEAD_RADIUS;
        const currentHeight = this.height;
        return {
            x: this.x + 4,
            y: this.y + headR * 0.5,
            width: this.width - 8,
            height: currentHeight - headR * 0.5
        };
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {EnergyManager} energyManager - may be null
     * @param {boolean} shieldActive
     */
    draw(ctx, energyManager = null, shieldActive = false) {
        ctx.save();

        const lean = energyManager ? energyManager.lean : 0;
        const tier = energyManager ? energyManager.tier : 'HIGH';

        const centerX = this.x + this.width / 2;
        const feetY = this.y + this.height + this.landingSquish * 6;
        const headR = CONFIG.PLAYER.HEAD_RADIUS;

        // Compute posture keypoints based on crouch progress & jump state
        const standingHeight = CONFIG.PLAYER.HEIGHT_STANDING;
        const crouchingHeight = CONFIG.PLAYER.HEIGHT_CROUCHING;
        const currentHeight = standingHeight - (standingHeight - crouchingHeight) * this.crouchProgress;

        const hipY  = feetY - currentHeight * 0.45;
        const neckY = feetY - currentHeight * 0.82;
        const headCenterY = neckY - headR;

        // ── Forward-lean offset (applied to torso + head when on ground or tired) ──
        // Lean shifts the head/neck forward relative to the hip
        const effectiveLean = this.isCrouching ? 0 : lean;
        const leanDir = this.facingRight ? 1 : -1;
        const leanOffsetX = Math.sin(effectiveLean) * (currentHeight * 0.4) * leanDir;
        const leanOffsetY = -(1 - Math.cos(effectiveLean)) * (currentHeight * 0.2); // slight dip when leaning

        const leanedNeckX  = centerX + leanOffsetX;
        const leanedNeckY  = neckY + leanOffsetY;
        const leanedHeadX  = leanedNeckX + Math.sin(effectiveLean) * headR * 1.5 * leanDir;
        const leanedHeadY  = leanedNeckY - headR;

        // 1. Draw Stickman Shadow on Ground (if near platform)
        if (this.isGrounded) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.ellipse(centerX, feetY + 2, 16 - this.crouchProgress * 4, 4, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // ── Shield bubble effect ──
        if (shieldActive) {
            const shieldPulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.006);
            ctx.save();
            ctx.globalAlpha = 0.25 + shieldPulse * 0.15;
            ctx.fillStyle = '#00f0ff';
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 30;
            ctx.beginPath();
            ctx.ellipse(centerX, this.y + currentHeight / 2, this.width * 1.8, currentHeight * 0.65, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Shield ring
            ctx.save();
            ctx.globalAlpha = 0.5 + shieldPulse * 0.3;
            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 2.5;
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.ellipse(centerX, this.y + currentHeight / 2, this.width * 1.8, currentHeight * 0.65, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // ── Stickman body colour changes with energy tier ──
        let glowColor, bodyColor;
        switch (tier) {
            case 'HIGH':
                glowColor = '#00f0ff'; bodyColor = '#ffffff'; break;
            case 'MED':
                glowColor = '#a3e635'; bodyColor = '#e8f5e8'; break;
            case 'LOW':
                glowColor = '#fb923c'; bodyColor = '#ffe8d6'; break;
            default: // ZERO
                glowColor = '#f43f5e'; bodyColor = '#fecaca'; break;
        }
        if (this.standingOnTile) glowColor = '#88eeff';

        ctx.strokeStyle = bodyColor;
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 8;

        const dir = this.facingRight ? 1 : -1;

        // 2. Draw Head & Face Detail
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.arc(leanedHeadX, leanedHeadY, headR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Eye (gives direction & expression)
        ctx.fillStyle = '#0a0c16';
        const eyeX = leanedHeadX + dir * (headR * 0.4);
        const eyeY = leanedHeadY - 1;
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, 2, 0, Math.PI * 2);
        ctx.fill();

        // Tired droopy expression for LOW/ZERO tiers
        if (tier === 'LOW' || tier === 'ZERO') {
            // Tired squint — small dark band
            ctx.strokeStyle = '#0a0c16';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(eyeX, eyeY + 0.5, 2, Math.PI, 0);
            ctx.stroke();
        }

        // 3. Draw Torso (leaned from hip to neck)
        ctx.strokeStyle = bodyColor;
        ctx.lineWidth = 3.5;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(centerX, hipY);
        ctx.lineTo(leanedNeckX, leanedNeckY);
        ctx.stroke();

        // 4. Draw Legs (Procedural Walking / Jumping / Crouching)
        const stride = Math.sin(this.animTimer);

        let leftFootX, leftFootY, rightFootX, rightFootY;
        let leftKneeX, leftKneeY, rightKneeX, rightKneeY;

        if (this.isCrouching) {
            leftKneeX  = centerX - 12;
            leftKneeY  = hipY + 10;
            leftFootX  = centerX - 14;
            leftFootY  = feetY;
            rightKneeX = centerX + 12;
            rightKneeY = hipY + 10;
            rightFootX = centerX + 14;
            rightFootY = feetY;
        } else if (!this.isGrounded) {
            leftKneeX  = centerX - 8 * dir;
            leftKneeY  = hipY + 12;
            leftFootX  = centerX - 12 * dir;
            leftFootY  = feetY - 8;
            rightKneeX = centerX + 10 * dir;
            rightKneeY = hipY + 8;
            rightFootX = centerX + 6 * dir;
            rightFootY = feetY - 4;
        } else {
            const legAngle1 = stride * 0.5;
            const legAngle2 = -stride * 0.5;
            leftKneeX  = centerX + Math.sin(legAngle1) * 14;
            leftKneeY  = hipY + Math.cos(legAngle1) * 14;
            leftFootX  = leftKneeX + Math.sin(legAngle1) * 16;
            leftFootY  = feetY;
            rightKneeX = centerX + Math.sin(legAngle2) * 14;
            rightKneeY = hipY + Math.cos(legAngle2) * 14;
            rightFootX = rightKneeX + Math.sin(legAngle2) * 16;
            rightFootY = feetY;
        }

        ctx.beginPath();
        ctx.moveTo(centerX, hipY);
        ctx.lineTo(leftKneeX, leftKneeY);
        ctx.lineTo(leftFootX, leftFootY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(centerX, hipY);
        ctx.lineTo(rightKneeX, rightKneeY);
        ctx.lineTo(rightFootX, rightFootY);
        ctx.stroke();

        // 5. Draw Arms (Procedural Arm Swing / Crouch / Jump)
        const shoulderY = leanedNeckY + 6;
        let leftHandX, leftHandY, rightHandX, rightHandY;

        if (this.isCrouching) {
            leftHandX  = leanedNeckX - 12 * dir;
            leftHandY  = shoulderY + 18;
            rightHandX = leanedNeckX + 8 * dir;
            rightHandY = shoulderY + 18;
        } else if (!this.isGrounded) {
            leftHandX  = leanedNeckX - 14 * dir;
            leftHandY  = shoulderY - 12;
            rightHandX = leanedNeckX + 16 * dir;
            rightHandY = shoulderY - 10;
        } else {
            const armAngle1 = -stride * 0.6 * dir;
            const armAngle2 =  stride * 0.6 * dir;
            leftHandX  = leanedNeckX + Math.sin(armAngle1) * 18;
            leftHandY  = shoulderY   + Math.cos(armAngle1) * 18;
            rightHandX = leanedNeckX + Math.sin(armAngle2) * 18;
            rightHandY = shoulderY   + Math.cos(armAngle2) * 18;
        }

        ctx.beginPath();
        ctx.moveTo(leanedNeckX, shoulderY);
        ctx.lineTo(leftHandX, leftHandY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(leanedNeckX, shoulderY);
        ctx.lineTo(rightHandX, rightHandY);
        ctx.stroke();

        ctx.restore();
    }
}
