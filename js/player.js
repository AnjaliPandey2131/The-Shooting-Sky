/* -------------------------------------------------------------
   SHOOTING STARS - Player Character (Procedural Stickman)
   Smooth limb physics, animation states, crouch/jump, and collision
   ------------------------------------------------------------- */

import { CONFIG } from './config.js';

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

        // Procedural Animation Variables
        this.animTimer = 0;
        this.landingSquish = 0; // Brief recoil compression on impact
        this.crouchProgress = 0; // Smooth 0 to 1 crouch transition
    }

    update(input, platformManager, sound) {
        if (this.isDead) return;

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

        // 2. Horizontal Movement Logic
        const moveSpeed = this.isCrouching ? CONFIG.PLAYER.CROUCH_SPEED : CONFIG.PLAYER.WALK_SPEED;

        if (input.left) {
            this.vx -= CONFIG.PLAYER.ACCELERATION;
            this.facingRight = false;
        } else if (input.right) {
            this.vx += CONFIG.PLAYER.ACCELERATION;
            this.facingRight = true;
        } else {
            this.vx *= CONFIG.PLAYER.FRICTION;
        }

        // Clamp horizontal velocity
        this.vx = Math.max(-moveSpeed, Math.min(moveSpeed, this.vx));
        this.x += this.vx;

        // Keep inside screen bounds
        if (this.x < 10) {
            this.x = 10;
            this.vx = 0;
        } else if (this.x + this.width > CONFIG.CANVAS_WIDTH - 10) {
            this.x = CONFIG.CANVAS_WIDTH - 10 - this.width;
            this.vx = 0;
        }

        // 3. Vertical Physics & Jump Logic
        if (input.jump && this.isGrounded && !this.isCrouching) {
            this.vy = CONFIG.PLAYER.JUMP_FORCE;
            this.isGrounded = false;
            sound.playJump();
        }

        // Apply Gravity
        this.vy += CONFIG.PLAYER.GRAVITY;
        this.y += this.vy;

        // 4. Ground & Platform Collision Detection
        const feetX = this.x + this.width / 2;
        const currentFeetY = this.y + this.height;

        // Check platform height at player's feet
        const groundSurfaceY = platformManager.getGroundYAt(feetX);

        if (groundSurfaceY !== null) {
            // Player is over a valid platform section
            if (this.vy >= 0 && currentFeetY >= groundSurfaceY && currentFeetY <= groundSurfaceY + 25) {
                if (!this.isGrounded) {
                    // Just landed!
                    this.landingSquish = 0.8; // Trigger landing recoil
                }
                this.y = groundSurfaceY - this.height;
                this.vy = 0;
                this.isGrounded = true;
            } else if (currentFeetY < groundSurfaceY) {
                this.isGrounded = false;
            }
        } else {
            // Player is over a GAP in the platform!
            this.isGrounded = false;
        }

        // Decay landing recoil
        this.landingSquish *= 0.75;

        // Update animation stride counter
        if (this.isGrounded && Math.abs(this.vx) > 0.5) {
            this.animTimer += Math.abs(this.vx) * 0.15;
        } else if (!this.isGrounded) {
            this.animTimer += 0.1;
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

    draw(ctx) {
        ctx.save();

        const centerX = this.x + this.width / 2;
        const feetY = this.y + this.height + this.landingSquish * 6;
        const headR = CONFIG.PLAYER.HEAD_RADIUS;

        // Compute posture keypoints based on crouch progress & jump state
        const standingHeight = CONFIG.PLAYER.HEIGHT_STANDING;
        const crouchingHeight = CONFIG.PLAYER.HEIGHT_CROUCHING;
        const currentHeight = standingHeight - (standingHeight - crouchingHeight) * this.crouchProgress;

        const hipY = feetY - currentHeight * 0.45;
        const neckY = feetY - currentHeight * 0.82;
        const headCenterY = neckY - headR;

        // 1. Draw Stickman Shadow on Ground (if near platform)
        if (this.isGrounded) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.ellipse(centerX, feetY + 2, 16 - this.crouchProgress * 4, 4, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Glowing outline accent
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 8;

        // Direction facing multiplier
        const dir = this.facingRight ? 1 : -1;

        // 2. Draw Head & Face Detail
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(centerX, headCenterY, headR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Eye (gives direction & expression)
        ctx.fillStyle = '#0a0c16';
        const eyeX = centerX + dir * (headR * 0.4);
        const eyeY = headCenterY - 1;
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, 2, 0, Math.PI * 2);
        ctx.fill();

        // 3. Draw Torso
        ctx.beginPath();
        ctx.moveTo(centerX, neckY);
        ctx.lineTo(centerX, hipY);
        ctx.stroke();

        // 4. Draw Legs (Procedural Walking / Jumping / Crouching)
        const stride = Math.sin(this.animTimer);

        let leftFootX, leftFootY, rightFootX, rightFootY;
        let leftKneeX, leftKneeY, rightKneeX, rightKneeY;

        if (this.isCrouching) {
            // Crouched leg stance
            leftKneeX = centerX - 12;
            leftKneeY = hipY + 10;
            leftFootX = centerX - 14;
            leftFootY = feetY;

            rightKneeX = centerX + 12;
            rightKneeY = hipY + 10;
            rightFootX = centerX + 14;
            rightFootY = feetY;
        } else if (!this.isGrounded) {
            // Airborne / Jumping stance
            leftKneeX = centerX - 8 * dir;
            leftKneeY = hipY + 12;
            leftFootX = centerX - 12 * dir;
            leftFootY = feetY - 8;

            rightKneeX = centerX + 10 * dir;
            rightKneeY = hipY + 8;
            rightFootX = centerX + 6 * dir;
            rightFootY = feetY - 4;
        } else {
            // Walking / Running leg stride
            const legAngle1 = stride * 0.5;
            const legAngle2 = -stride * 0.5;

            leftKneeX = centerX + Math.sin(legAngle1) * 14;
            leftKneeY = hipY + Math.cos(legAngle1) * 14;
            leftFootX = leftKneeX + Math.sin(legAngle1) * 16;
            leftFootY = feetY;

            rightKneeX = centerX + Math.sin(legAngle2) * 14;
            rightKneeY = hipY + Math.cos(legAngle2) * 14;
            rightFootX = rightKneeX + Math.sin(legAngle2) * 16;
            rightFootY = feetY;
        }

        // Draw Left Leg
        ctx.beginPath();
        ctx.moveTo(centerX, hipY);
        ctx.lineTo(leftKneeX, leftKneeY);
        ctx.lineTo(leftFootX, leftFootY);
        ctx.stroke();

        // Draw Right Leg
        ctx.beginPath();
        ctx.moveTo(centerX, hipY);
        ctx.lineTo(rightKneeX, rightKneeY);
        ctx.lineTo(rightFootX, rightFootY);
        ctx.stroke();

        // 5. Draw Arms (Procedural Arm Swing / Crouch / Jump)
        const shoulderY = neckY + 6;
        let leftHandX, leftHandY, rightHandX, rightHandY;

        if (this.isCrouching) {
            leftHandX = centerX - 12 * dir;
            leftHandY = shoulderY + 18;
            rightHandX = centerX + 8 * dir;
            rightHandY = shoulderY + 18;
        } else if (!this.isGrounded) {
            // Arms raised for jump balance
            leftHandX = centerX - 14 * dir;
            leftHandY = shoulderY - 12;
            rightHandX = centerX + 16 * dir;
            rightHandY = shoulderY - 10;
        } else {
            // Arms swing opposite to legs
            const armAngle1 = -stride * 0.6 * dir;
            const armAngle2 = stride * 0.6 * dir;

            leftHandX = centerX + Math.sin(armAngle1) * 18;
            leftHandY = shoulderY + Math.cos(armAngle1) * 18;
            rightHandX = centerX + Math.sin(armAngle2) * 18;
            rightHandY = shoulderY + Math.cos(armAngle2) * 18;
        }

        ctx.beginPath();
        ctx.moveTo(centerX, shoulderY);
        ctx.lineTo(leftHandX, leftHandY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(centerX, shoulderY);
        ctx.lineTo(rightHandX, rightHandY);
        ctx.stroke();

        ctx.restore();
    }
}
