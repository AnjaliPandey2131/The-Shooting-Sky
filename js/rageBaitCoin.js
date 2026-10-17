/* -------------------------------------------------------------
   SHOOTING STARS - Rage Bait Coin
   A rare, timed character encounter drawn with the game canvas.
   ------------------------------------------------------------- */

import { CONFIG } from './config.js';
import { TILE_STATE } from './floatingPlatforms.js';

const TAUNT_LINES = [
    'Catch me if you can!',
    'Oiii! Over here!',
    "Bet you can't catch me!",
    'Come on, slowpoke!',
    'Too slow already?',
    'You want me? Come GET me!',
    'Hehehe! Try harder!',
    "I'm right here, genius!",
    'Ready, steady... TOO SLOW!',
    "You can't catch what you can't handle!"
];

const ESCAPE_LINES = [
    'OIIII, LOSER!',
    'Missed me again! HAHAHA!',
    'No guts, no coins!',
    'Skill issue, bestie!',
    'I WAS RIGHT THERE!',
    'Too slow! Too slow!',
    'Awww, you almost had me!',
    "You don't have the guts!",
    'Better luck next lifetime!',
    'Hehehe! I escaped!',
    'Catch me in your dreams!',
    'BYEEEE, SLOWPOKE!',
    'That was embarrassing!',
    'You blinked. I won.',
    'Your reflexes need a vacation!',
    'Hehehehe!',
    'MUAHAHA!',
    'Hahahaha!',
    'Nyehehehe!',
    'Heh. HEH. HAHAHA!'
];

const COLLECTION_LINES = [
    'WAIT—YOU GOT ME?!',
    "Okayyy, I'm impressed!",
    'Well played, speedster!',
    'Fine. You earned that one.',
    'Lucky catch! ...Probably.',
    'UGH! NICE ONE!',
    'Okay, show-off!',
    'I underestimated you!',
    'Not bad, human!',
    'You actually did it!',
    'Respect. Just this once.',
    "I'm telling my lawyer!",
    'WHAT?! MY PLAN FAILED!',
    'Okay, that was FAST!',
    'You win this round!'
];

const TAUNT_FACES = ['smug', 'wink', 'laugh', 'tongue', 'fakeCrying', 'angry'];
const ENTRANCE_LINES = ['PSST! CATCH ME!', 'OI! OVER HERE!', 'YOU WANT THIS?', 'TRY AND CATCH ME!'];
const MID_ENCOUNTER_LINES = ['Hehehe!', 'Nyehehe!', 'Too slow!'];
const CLOSE_LINES = ['Whoa, close one!', 'Easy there, speedster!'];
const TIMER_EPSILON = 1e-8;

function pickDifferent(items, previous) {
    if (items.length < 2) return items[0];
    let choice = items[Math.floor(Math.random() * items.length)];
    while (choice === previous) {
        choice = items[Math.floor(Math.random() * items.length)];
    }
    return choice;
}

function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}

function overlaps(a, b) {
    return a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y;
}

export class RageBaitCoin {
    constructor(tile, anchorOffsetX, dialogue, entranceDialogue, lastEscape) {
        this.tile = tile;
        this.anchorOffsetX = anchorOffsetX;
        this.dodgeOffset = 0;
        this.x = tile.x + anchorOffsetX;
        this.y = tile.y - 18;
        this.state = 'entrance';
        this.face = 'wink';
        this.teaseFace = TAUNT_FACES[Math.floor(Math.random() * TAUNT_FACES.length)];
        this.dialogue = entranceDialogue;
        this.teaseDialogue = dialogue;
        this.lastEscape = lastEscape;
        this.timeRemaining = CONFIG.RAGE_BAIT_COIN.LIFETIME;
        this.entranceRemaining = CONFIG.RAGE_BAIT_COIN.ENTRANCE_DURATION;
        this.reactionTimer = 0;
        this.animationTime = 0;
        this.proximity = 'far';
        this.midEncounterSoundPlayed = false;
        this.closeSoundPlayed = false;
        this.alive = true;
    }

    update(dt, player, sound, particles) {
        this.animationTime += dt;
        const platformValid = this._syncPosition();

        if (!platformValid && (this.state === 'entrance' || this.state === 'teasing')) {
            this._beginEscape(sound, particles);
        }

        if (this.state === 'entrance') {
            const entranceTimeRemaining = this.entranceRemaining;
            this.entranceRemaining = Math.max(0, this.entranceRemaining - dt);
            if (this.entranceRemaining <= TIMER_EPSILON) {
                this.entranceRemaining = 0;
                const activeTime = Math.max(0, dt - entranceTimeRemaining);
                this.state = 'teasing';
                this.face = this.teaseFace;
                this.dialogue = this.teaseDialogue;
                this.timeRemaining = Math.max(0, CONFIG.RAGE_BAIT_COIN.LIFETIME - activeTime);
            }
        } else if (this.state === 'teasing') {
            this.timeRemaining = Math.max(0, this.timeRemaining - dt);
            if (this.timeRemaining <= TIMER_EPSILON) this.timeRemaining = 0;
            const playerX = player.x + player.width / 2;
            const playerY = player.y + player.height / 2;
            const distance = Math.hypot(playerX - this.x, playerY - this.y);
            const settings = CONFIG.RAGE_BAIT_COIN;

            if (distance <= settings.PROXIMITY_CLOSE) {
                this.proximity = 'close';
            } else if (distance <= settings.PROXIMITY_NEAR) {
                this.proximity = 'near';
            } else {
                this.proximity = 'far';
            }
            this.face = this.proximity === 'close' ? 'shocked' : this.teaseFace;

            if (this.proximity === 'close' && !this.closeSoundPlayed) {
                this.closeSoundPlayed = true;
                sound.playRageBaitReaction('close', pickDifferent(CLOSE_LINES, null));
            }
            if (!this.midEncounterSoundPlayed &&
                this.timeRemaining <= CONFIG.RAGE_BAIT_COIN.LIFETIME / 2) {
                this.midEncounterSoundPlayed = true;
                sound.playRageBaitReaction(
                    'laugh',
                    MID_ENCOUNTER_LINES[Math.floor(Math.random() * MID_ENCOUNTER_LINES.length)]
                );
            }

            if (this.timeRemaining <= TIMER_EPSILON) {
                this._beginEscape(sound, particles);
            }
        } else {
            this.reactionTimer = Math.max(0, this.reactionTimer - dt);
            if (this.state === 'collected') {
                this.face = this.reactionTimer > CONFIG.RAGE_BAIT_COIN.REACTION_DURATION * 0.65
                    ? 'shocked'
                    : 'impressed';
            }
            if (this.reactionTimer === 0) this.alive = false;
        }

    }

    _syncPosition() {
        if (!this.tile || this.tile.state >= TILE_STATE.COLLAPSING) return false;
        this.dodgeOffset = this.proximity === 'close'
            ? Math.sin(this.animationTime * 7) * CONFIG.RAGE_BAIT_COIN.MAX_DODGE
            : 0;
        this.x = this.tile.x + this.anchorOffsetX + this.dodgeOffset;
        this.y = this.tile.y - 18;
        return true;
    }

    _beginEscape(sound, particles) {
        if (this.state === 'escaping' || this.state === 'collected') return;
        this.state = 'escaping';
        this.face = 'victory';
        this.dialogue = pickDifferent(ESCAPE_LINES, this.lastEscape);
        this.lastEscape = this.dialogue;
        this.reactionTimer = CONFIG.RAGE_BAIT_COIN.REACTION_DURATION;
        sound.playRageBaitReaction('escaped', this.dialogue);
        particles.createExplosion(this.x, this.y, '#FFD700', 14, 0.65);
    }

    collect(dialogue, sound, particles) {
        if (this.state !== 'teasing' || !this.alive) return false;
        this.state = 'collected';
        this.timeRemaining = 0;
        this.face = 'shocked';
        this.dialogue = dialogue;
        this.reactionTimer = CONFIG.RAGE_BAIT_COIN.REACTION_DURATION;
        sound.playRageBaitReaction('collected', this.dialogue);
        particles.createExplosion(this.x, this.y, '#FFD700', 18, 0.75);
        return true;
    }

    getVisualPosition() {
        const bob = Math.sin(this.animationTime * (this.proximity === 'close' ? 14 : 5)) *
            (this.proximity === 'close' ? 3 : 2.5);
        return { x: this.x, y: this.y + bob };
    }

    getHitbox() {
        const radius = CONFIG.RAGE_BAIT_COIN.HITBOX_RADIUS;
        const position = this.getVisualPosition();
        return {
            x: position.x - radius,
            y: position.y - radius,
            width: radius * 2,
            height: radius * 2
        };
    }

    draw(ctx, player) {
        if (!this.alive) return;

        const settings = CONFIG.RAGE_BAIT_COIN;
        const teasing = this.state === 'teasing';
        const entranceProgress = this.state === 'entrance'
            ? 1 - this.entranceRemaining / settings.ENTRANCE_DURATION
            : 1;
        const entranceEase = 1 + 2.70158 * Math.pow(entranceProgress - 1, 3) +
            1.70158 * Math.pow(entranceProgress - 1, 2);
        const reactionProgress = this.state === 'escaping' || this.state === 'collected'
            ? Math.max(0, this.reactionTimer / settings.REACTION_DURATION)
            : 1;
        const alpha = this.state === 'entrance'
            ? Math.min(1, entranceProgress * 2.5)
            : reactionProgress;
        const position = this.getVisualPosition();
        const centerX = position.x;
        const centerY = position.y +
            (this.state === 'entrance' ? 24 * (1 - entranceEase) : 0) -
            (this.state === 'escaping' ? (1 - alpha) * 18 : 0);
        const scale = this.state === 'entrance'
            ? Math.max(0.1, 0.72 + 0.28 * entranceEase)
            : 1;
        const lean = this.proximity === 'close'
            ? Math.sin(this.animationTime * 12) * 0.17
            : this.proximity === 'near' ? -0.08 : 0;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(centerX, centerY);
        ctx.scale(scale, scale);
        ctx.rotate(lean);
        if (this.state === 'entrance') drawEntranceFlash(ctx, this, entranceProgress);
        drawLimbs(ctx, this);
        drawCoinBody(ctx, this);
        drawFace(ctx, this.face, this.animationTime);
        ctx.restore();

        if (teasing) {
            drawCountdown(ctx, this, centerX, centerY);
        }
        drawDialogue(ctx, this, player, centerY);
    }
}

export class RageBaitCoinManager {
    constructor() {
        this.reset();
    }

    reset(sound = null) {
        if (sound) sound.stopRageBaitSpeech();
        this.activeCoin = null;
        this.stageIndex = -1;
        this.stageStartTime = 0;
        this.spawnedThisStage = 0;
        this.stageTarget = 0;
        this.nextSpawnAt = Infinity;
        this.lastTaunt = null;
        this.lastEscape = null;
        this.lastCollection = null;
        this.lastEntrance = null;
    }

    update(dt, survivalTime, stageIndex, player, platformManager, floatingPlatforms, energyManager, sound, particles) {
        const settings = CONFIG.RAGE_BAIT_COIN;
        if (!settings.ENABLED) return;

        if (stageIndex !== this.stageIndex) {
            if (this.activeCoin) sound.stopRageBaitSpeech();
            this.activeCoin = null;
            this.stageIndex = stageIndex;
            this.stageStartTime = survivalTime;
            this.spawnedThisStage = 0;
            this.stageTarget = Math.floor(randomBetween(
                settings.MIN_PER_STAGE,
                settings.MAX_PER_STAGE + 1
            ));
            this.nextSpawnAt = survivalTime + randomBetween(
                settings.FIRST_SPAWN_MIN,
                settings.FIRST_SPAWN_MAX
            );
        }

        if (this.activeCoin) {
            this.activeCoin.update(dt, player, sound, particles);
            if (this.activeCoin.state === 'escaping') {
                this.lastEscape = this.activeCoin.dialogue;
            }
            if (!this.activeCoin.alive) {
                sound.stopRageBaitSpeech();
                this.activeCoin = null;
            }
        }

        if (this.activeCoin ||
            this.spawnedThisStage >= this.stageTarget ||
            survivalTime < this.nextSpawnAt) {
            return;
        }

        const candidate = this.findReachablePosition(
            player,
            platformManager,
            floatingPlatforms,
            energyManager
        );
        if (!candidate) {
            this.nextSpawnAt = survivalTime + settings.RETRY_DELAY;
            return;
        }

        this.lastTaunt = pickDifferent(TAUNT_LINES, this.lastTaunt);
        this.lastEntrance = pickDifferent(ENTRANCE_LINES, this.lastEntrance);
        this.activeCoin = new RageBaitCoin(
            candidate.tile,
            candidate.offsetX,
            this.lastTaunt,
            this.lastEntrance,
            this.lastEscape
        );
        this.spawnedThisStage++;
        sound.playRageBaitReaction('appear', this.lastEntrance);
        particles.createExplosion(this.activeCoin.x, this.activeCoin.y, '#FFD700', 22, 0.8);

        if (this.spawnedThisStage < this.stageTarget) {
            const minDelay = stageIndex === 4
                ? settings.FINAL_STAGE_SECOND_MIN
                : settings.SECOND_SPAWN_MIN;
            const maxDelay = stageIndex === 4
                ? settings.FINAL_STAGE_SECOND_MAX
                : settings.SECOND_SPAWN_MAX;
            this.nextSpawnAt = this.stageStartTime + randomBetween(minDelay, maxDelay);
        }
    }

    findReachablePosition(player, platformManager, floatingPlatforms, energyManager) {
        const settings = CONFIG.RAGE_BAIT_COIN;
        if (!player.isGrounded || !floatingPlatforms) return null;

        const playerX = player.x + player.width / 2;
        const startSurfaceY = player.standingOnTile
            ? player.standingOnTile.y + player.standingOnTile.shakeOffset.y
            : platformManager.getGroundYAt(playerX);
        if (startSurfaceY === null) return null;

        const jumpMultiplier = energyManager ? energyManager.jumpMultiplier : 1;
        const speedMultiplier = energyManager ? energyManager.speedMultiplier : 1;
        const jump = this._jumpReach(jumpMultiplier);
        const walkSpeed = CONFIG.PLAYER.WALK_SPEED * speedMultiplier;
        const candidates = [];

        for (const tile of floatingPlatforms.tiles) {
            if (tile.state >= TILE_STATE.CRACKED ||
                tile.movementType !== 'horizontal' ||
                tile === player.standingOnTile ||
                tile.baseX - tile.range < settings.PLATFORM_EDGE_MARGIN ||
                tile.baseX + tile.width + tile.range >
                    CONFIG.CANVAS_WIDTH - settings.PLATFORM_EDGE_MARGIN) {
                continue;
            }

            const verticalGap = startSurfaceY - tile.y;
            if (verticalGap < settings.MIN_PLATFORM_HEIGHT ||
                verticalGap > jump.height - settings.JUMP_HEIGHT_MARGIN) {
                continue;
            }

            const flightFrames = jump.framesToHeight(verticalGap);
            if (flightFrames <= 0) continue;
            const horizontalReach = this._horizontalReach(player, walkSpeed, flightFrames) +
                settings.HORIZONTAL_REACH_MARGIN;
            const edge = settings.PLATFORM_EDGE_MARGIN + settings.MAX_DODGE;
            const left = Math.max(tile.x + edge, playerX + settings.MIN_SPAWN_DISTANCE);
            const right = Math.min(
                tile.x + tile.width - edge,
                playerX + horizontalReach
            );
            const otherSideLeft = Math.max(tile.x + edge, playerX - horizontalReach);
            const otherSideRight = Math.min(
                tile.x + tile.width - edge,
                playerX - settings.MIN_SPAWN_DISTANCE
            );

            if (left <= right) {
                candidates.push({ tile, minX: left, maxX: right });
            }
            if (otherSideLeft <= otherSideRight) {
                candidates.push({ tile, minX: otherSideLeft, maxX: otherSideRight });
            }
        }

        if (candidates.length === 0) return null;
        const selected = candidates[Math.floor(Math.random() * candidates.length)];
        const x = randomBetween(selected.minX, selected.maxX);
        return { tile: selected.tile, offsetX: x - selected.tile.x };
    }

    _jumpReach(jumpMultiplier) {
        let velocity = CONFIG.PLAYER.JUMP_FORCE * jumpMultiplier;
        let displacement = 0;
        let height = 0;

        for (let frame = 1; frame <= 120; frame++) {
            velocity += CONFIG.PLAYER.GRAVITY;
            displacement += velocity;
            height = Math.max(height, -displacement);
            if (frame > 1 && displacement >= 0 && velocity > 0) break;
        }

        return {
            height,
            framesToHeight: targetHeight => {
                let vy = CONFIG.PLAYER.JUMP_FORCE * jumpMultiplier;
                let y = 0;
                let apexPassed = false;
                for (let frame = 1; frame <= 120; frame++) {
                    vy += CONFIG.PLAYER.GRAVITY;
                    y += vy;
                    if (vy >= 0) apexPassed = true;
                    if (apexPassed && y >= -targetHeight) return frame;
                }
                return 0;
            }
        };
    }

    _horizontalReach(player, maxSpeed, frames) {
        const distanceForDirection = direction => {
            let velocity = player.vx;
            let distance = 0;
            for (let frame = 0; frame < frames; frame++) {
                velocity += direction * CONFIG.PLAYER.ACCELERATION;
                velocity = Math.max(-maxSpeed, Math.min(maxSpeed, velocity));
                distance += velocity;
            }
            return Math.abs(distance);
        };
        return Math.max(
            distanceForDirection(-1),
            distanceForDirection(1)
        ) + player.width / 2;
    }

    checkPlayerCollection(playerHitbox, coinManager, sound, energyManager, intervalIndex, particles) {
        const coin = this.activeCoin;
        if (!coin || coin.state !== 'teasing' || !overlaps(playerHitbox, coin.getHitbox())) {
            return { score: 0 };
        }

        this.lastCollection = pickDifferent(COLLECTION_LINES, this.lastCollection);
        if (!coin.collect(this.lastCollection, sound, particles)) return { score: 0 };

        const reward = coinManager.awardCollectedCoin(
            coin.x,
            coin.y,
            sound,
            energyManager,
            intervalIndex
        );
        return { score: reward.score + CONFIG.RAGE_BAIT_COIN.BONUS_SCORE };
    }

    draw(ctx, player) {
        if (this.activeCoin) this.activeCoin.draw(ctx, player);
    }
}

function drawLimbs(ctx, coin) {
    const time = coin.animationTime;
    const escaping = coin.state === 'escaping';
    const collected = coin.state === 'collected';
    const waving = coin.proximity === 'near' || escaping;
    const armSwing = Math.sin(time * (coin.proximity === 'close' ? 16 : 7)) * 3;
    const legSwing = Math.sin(time * 12) * (coin.proximity === 'close' ? 5 : 3);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#9a4f08';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-10, 4);
    ctx.lineTo(-17, 8 + armSwing);
    ctx.lineTo(-21, waving ? -1 : 10 + armSwing);
    ctx.moveTo(10, 4);
    ctx.lineTo(17, collected ? -5 : 8 - armSwing);
    ctx.lineTo(21, collected ? -12 : waving ? 0 : 10 - armSwing);
    ctx.stroke();

    ctx.fillStyle = '#ffe08a';
    ctx.beginPath();
    ctx.arc(-21, waving ? -1 : 10 + armSwing, 2.5, 0, Math.PI * 2);
    ctx.arc(21, collected ? -12 : waving ? 0 : 10 - armSwing, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#9a4f08';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-6, 13);
    ctx.lineTo(-8 + legSwing, 21);
    ctx.moveTo(6, 13);
    ctx.lineTo(8 - legSwing, 21);
    ctx.stroke();

    ctx.fillStyle = '#6b3a12';
    ctx.beginPath();
    ctx.ellipse(-9 + legSwing, 22, 4, 2, -0.15, 0, Math.PI * 2);
    ctx.ellipse(9 - legSwing, 22, 4, 2, 0.15, 0, Math.PI * 2);
    ctx.fill();
}

function drawCoinBody(ctx, coin) {
    const glow = 0.55 + Math.sin(coin.animationTime * 5) * 0.15;
    ctx.shadowColor = '#ffb000';
    ctx.shadowBlur = 12 + glow * 7;

    const gold = ctx.createRadialGradient(-5, -7, 2, 0, 0, 17);
    gold.addColorStop(0, '#fff7b2');
    gold.addColorStop(0.38, '#ffd22f');
    gold.addColorStop(0.8, '#f59e0b');
    gold.addColorStop(1, '#a84c05');

    ctx.fillStyle = gold;
    ctx.strokeStyle = '#fff0a3';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 250, 205, 0.65)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, 12.5, 0, Math.PI * 2);
    ctx.stroke();
}

function drawFace(ctx, face, time) {
    const eyeY = -4;
    const mouthY = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (face === 'wink') {
        drawOpenEye(ctx, -5, eyeY, 1);
        drawClosedEye(ctx, 5, eyeY);
        drawEyebrow(ctx, -6, -9, -2, -10);
        drawSmile(ctx, mouthY, false);
        return;
    }

    if (face === 'laugh') {
        drawClosedEye(ctx, -5, eyeY);
        drawClosedEye(ctx, 5, eyeY);
        drawOpenMouth(ctx, mouthY, 4, '#6b2106');
        return;
    }

    if (face === 'tongue') {
        drawOpenEye(ctx, -5, eyeY, 1);
        drawOpenEye(ctx, 5, eyeY, 1);
        drawEyebrow(ctx, -7, -9, -3, -8);
        drawEyebrow(ctx, 3, -8, 7, -9);
        drawOpenMouth(ctx, mouthY, 3.3, '#6b2106');
        ctx.fillStyle = '#ff6482';
        ctx.beginPath();
        ctx.ellipse(2, 9, 2.1, 3, 0.25, 0, Math.PI * 2);
        ctx.fill();
        return;
    }

    if (face === 'fakeCrying') {
        drawClosedEye(ctx, -5, eyeY);
        drawClosedEye(ctx, 5, eyeY);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-7, -1);
        ctx.quadraticCurveTo(-8, 2 + Math.sin(time * 8), -7, 4);
        ctx.moveTo(7, -1);
        ctx.quadraticCurveTo(8, 2 - Math.sin(time * 8), 7, 4);
        ctx.stroke();
        ctx.strokeStyle = '#6b2106';
        ctx.beginPath();
        ctx.arc(0, 9, 4, Math.PI + 0.25, -0.25);
        ctx.stroke();
        return;
    }

    if (face === 'shocked') {
        drawOpenEye(ctx, -5, eyeY, 1.2);
        drawOpenEye(ctx, 5, eyeY, 1.2);
        ctx.fillStyle = '#6b2106';
        ctx.beginPath();
        ctx.ellipse(0, mouthY, 2.5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        return;
    }

    if (face === 'impressed' || face === 'happy') {
        drawOpenEye(ctx, -5, eyeY, 1.15);
        drawOpenEye(ctx, 5, eyeY, 1.15);
        drawEyebrow(ctx, -7, -10, -3, -12);
        drawEyebrow(ctx, 3, -12, 7, -10);
        if (face === 'impressed') {
            drawStar(ctx, -5, eyeY, 2);
            drawStar(ctx, 5, eyeY, 2);
        }
        drawSmile(ctx, mouthY, false);
        return;
    }

    if (face === 'angry') {
        drawOpenEye(ctx, -5, eyeY, 0.8);
        drawOpenEye(ctx, 5, eyeY, 0.8);
        drawEyebrow(ctx, -8, -12, -3, -8);
        drawEyebrow(ctx, 3, -8, 8, -12);
        ctx.strokeStyle = '#6b2106';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-4, 8);
        ctx.lineTo(4, 8);
        ctx.stroke();
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(-10, 4, 2, 0, Math.PI * 2);
        ctx.arc(10, 4, 2, 0, Math.PI * 2);
        ctx.fill();
        return;
    }

    if (face === 'victory') {
        drawClosedEye(ctx, -5, eyeY);
        drawClosedEye(ctx, 5, eyeY);
        drawEyebrow(ctx, -7, -10, -3, -8);
        drawEyebrow(ctx, 3, -8, 8, -11);
        drawSmile(ctx, mouthY, true);
        return;
    }

    drawOpenEye(ctx, -5, eyeY, 0.9);
    drawOpenEye(ctx, 5, eyeY, 0.9);
    drawEyebrow(ctx, -7, -10, -3, -11);
    drawEyebrow(ctx, 3, -11, 7, -9);
    drawSmile(ctx, mouthY, true);
}

function drawOpenEye(ctx, x, y, scale) {
    ctx.fillStyle = '#fffdf3';
    ctx.beginPath();
    ctx.ellipse(x, y, 3 * scale, 3.8 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#41210d';
    ctx.beginPath();
    ctx.arc(x + 0.6, y + 0.4, 1.45 * scale, 0, Math.PI * 2);
    ctx.fill();
}

function drawClosedEye(ctx, x, y) {
    ctx.strokeStyle = '#51270b';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(x - 3, y);
    ctx.quadraticCurveTo(x, y + 2, x + 3, y);
    ctx.stroke();
}

function drawEyebrow(ctx, x1, y1, x2, y2) {
    ctx.strokeStyle = '#85420a';
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

function drawSmile(ctx, y, mischievous) {
    ctx.strokeStyle = '#632509';
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(-4, y);
    ctx.quadraticCurveTo(0, mischievous ? y + 5 : y + 4, 4, y - (mischievous ? 1 : 0));
    ctx.stroke();
}

function drawOpenMouth(ctx, y, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, y, radius, radius, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff8e9e';
    ctx.beginPath();
    ctx.arc(0, y + radius * 0.45, radius * 0.55, 0, Math.PI);
    ctx.fill();
}

function drawStar(ctx, x, y, radius) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4;
        const pointRadius = i % 2 === 0 ? radius : radius * 0.35;
        const px = x + Math.cos(angle) * pointRadius;
        const py = y + Math.sin(angle) * pointRadius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
}

function drawCountdown(ctx, coin) {
    const remaining = coin.timeRemaining / CONFIG.RAGE_BAIT_COIN.LIFETIME;
    const urgent = coin.timeRemaining <= 2;
    const blink = coin.timeRemaining <= 1 && Math.sin(coin.animationTime * 18) > 0;
    const position = coin.getVisualPosition();
    ctx.save();
    ctx.globalAlpha = blink ? 0.45 : 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.24)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(position.x, position.y, 23, -Math.PI / 2, Math.PI * 1.5);
    ctx.stroke();
    ctx.strokeStyle = urgent ? '#ff5577' : '#ffe082';
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = urgent ? 10 : 6;
    ctx.beginPath();
    ctx.arc(position.x, position.y, 23, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remaining);
    ctx.stroke();
    if (coin.timeRemaining <= 1) {
        ctx.shadowBlur = 0;
        for (let i = 0; i < 4; i++) {
            const angle = coin.animationTime * 2 + i * Math.PI / 2;
            drawStar(
                ctx,
                position.x + Math.cos(angle) * 28,
                position.y + Math.sin(angle) * 28,
                2
            );
        }
    }
    ctx.restore();
}

function drawEntranceFlash(ctx, coin, progress) {
    const radius = 20 + progress * 24;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 0.75 * (1 - progress));
    ctx.strokeStyle = '#fff0a3';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#ffd447';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3 + coin.animationTime * 2;
        drawStar(ctx, Math.cos(angle) * radius, Math.sin(angle) * radius, 2.5);
    }
    ctx.restore();
}

function drawDialogue(ctx, coin, player, centerY) {
    const maxTextWidth = 230;
    ctx.save();
    ctx.font = 'bold 12px Outfit, sans-serif';
    const words = coin.dialogue.split(' ');
    let lines = [];
    let line = '';
    for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(candidate).width > maxTextWidth) {
            lines.push(line);
            line = word;
        } else {
            line = candidate;
        }
    }
    if (line) lines.push(line);

    const textWidth = Math.min(maxTextWidth, Math.max(...lines.map(item => ctx.measureText(item).width)));
    const boxWidth = textWidth + 18;
    const boxHeight = lines.length * 15 + 12;
    const playerX = player.x + player.width / 2;
    const side = playerX < coin.x ? 1 : -1;
    const playerIsAbove = player.y + player.height / 2 < centerY - 30 &&
        Math.abs(playerX - coin.x) < 150;
    const horizontalOffsets = [side * 58, -side * 58];
    const verticalPositions = playerIsAbove
        ? [centerY + 32, centerY - 48 - boxHeight]
        : [centerY - 48 - boxHeight, centerY + 32];
    const playerBox = {
        x: player.x,
        y: player.y,
        width: player.width,
        height: player.height
    };
    let boxX = Math.max(8, Math.min(CONFIG.CANVAS_WIDTH - boxWidth - 8, coin.x + horizontalOffsets[0] - boxWidth / 2));
    let boxY = Math.max(112, Math.min(CONFIG.CANVAS_HEIGHT - boxHeight - 8, verticalPositions[0]));

    for (const y of verticalPositions) {
        const candidateY = Math.max(112, Math.min(CONFIG.CANVAS_HEIGHT - boxHeight - 8, y));
        for (const offset of horizontalOffsets) {
            const candidateX = Math.max(
                8,
                Math.min(CONFIG.CANVAS_WIDTH - boxWidth - 8, coin.x + offset - boxWidth / 2)
            );
            if (!overlaps(
                { x: candidateX, y: candidateY, width: boxWidth, height: boxHeight },
                playerBox
            )) {
                boxX = candidateX;
                boxY = candidateY;
                break;
            }
        }
        if (!overlaps(
            { x: boxX, y: candidateY, width: boxWidth, height: boxHeight },
            playerBox
        )) {
            boxY = candidateY;
            break;
        }
    }

    ctx.fillStyle = 'rgba(35, 20, 4, 0.88)';
    ctx.strokeStyle = '#ffd447';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff4c2';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((item, index) => {
        ctx.fillText(item, boxX + boxWidth / 2, boxY + 7 + index * 15 + 7);
    });
    ctx.restore();
}
