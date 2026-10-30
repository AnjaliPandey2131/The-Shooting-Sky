/* -------------------------------------------------------------
   SHOOTING STARS - Floating Platform Manager
   Moving platform tiles with multiple states, smooth movement,
   player carrying, and stacked level progression.
   ------------------------------------------------------------- */

import { CONFIG } from './config.js';

export const TILE_STATE = {
    INTACT: 0,
    UNSTABLE: 1,
    CRACKED: 2,
    COLLAPSING: 3,
    GONE: 4
};

export class FloatingPlatformTile {
    constructor(id, x, y, width, height, movementType, range, speed) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.baseX = x;
        this.baseY = y;
        this.width = width;
        this.height = height;

        // Movement
        this.movementType = movementType; // 'horizontal', 'vertical', 'static'
        this.range = range;   // max offset from base in pixels
        this.speed = speed;   // units per second
        this.phase = Math.random() * Math.PI * 2; // randomize start phase

        // State
        this.state = TILE_STATE.INTACT;
        this.standTimer = 0;   // how long player has stood on this
        this.collapseTimer = 0;
        this.collapseDuration = 2.5;
        this.shakeOffset = { x: 0, y: 0 };

        // Visual
        this.crackLines = this._generateCrackLines();
        this.glowPhase = Math.random() * Math.PI * 2;

        // For player-carry
        this.prevX = x;
        this.prevY = y;
        this.dx = 0;
        this.dy = 0;

        // Coin spawning
        this.coinSpawned = false;

        // Particle trail for moving platforms
        this.trailTimer = 0;
    }

    _generateCrackLines() {
        const lines = [];
        for (let i = 0; i < 5; i++) {
            const sx = Math.random() * this.width;
            const sy = Math.random() * (this.height * 0.5);
            lines.push({
                x1: sx, y1: sy,
                x2: sx + (Math.random() - 0.5) * 24,
                y2: sy + 8 + Math.random() * 10,
                x3: sx + (Math.random() - 0.5) * 36,
                y3: sy + 18 + Math.random() * 10
            });
        }
        return lines;
    }

    get surfaceY() {
        return this.y; // top surface
    }

    update(dt, particleSystem, sound) {
        this.prevX = this.x;
        this.prevY = this.y;
        this.glowPhase += dt * 2.5;

        if (this.state === TILE_STATE.GONE) return;

        // Movement
        const t = performance.now() / 1000 + this.phase;
        if (this.movementType === 'horizontal') {
            this.x = this.baseX + Math.sin(t * this.speed) * this.range;
        } else if (this.movementType === 'vertical') {
            this.y = this.baseY + Math.sin(t * this.speed) * this.range;
        }

        this.dx = this.x - this.prevX;
        this.dy = this.y - this.prevY;

        // Particle trail for moving platforms
        if (this.movementType !== 'static') {
            this.trailTimer += dt;
            if (this.trailTimer > 0.08 && particleSystem && Math.abs(this.dx) + Math.abs(this.dy) > 0.3) {
                this.trailTimer = 0;
                particleSystem.createTrail(
                    this.x + this.width / 2,
                    this.y + this.height,
                    'rgba(0, 200, 255, 0.4)',
                    2
                );
            }
        }

        // State machine
        if (this.state === TILE_STATE.COLLAPSING) {
            this.collapseTimer += dt;
            this.shakeOffset.x = (Math.random() - 0.5) * 6 * (this.collapseTimer / this.collapseDuration);
            this.shakeOffset.y = (Math.random() - 0.5) * 3 * (this.collapseTimer / this.collapseDuration);

            // Emit warning particles
            if (particleSystem && Math.random() < 0.4) {
                particleSystem.createTrail(
                    this.x + Math.random() * this.width,
                    this.y + 4,
                    '#ff2a5f',
                    2.5
                );
            }

            if (this.collapseTimer >= this.collapseDuration) {
                // Collapse!
                this.state = TILE_STATE.GONE;
                if (particleSystem) {
                    for (let i = 0; i < 8; i++) {
                        particleSystem.createDebris(this.x, this.y, this.width, 12);
                    }
                }
                if (sound) sound.playCrack();
            }
        }
    }

    /**
     * Called when player stands on this tile.
     * Returns true if tile should collapse soon.
     */
    onPlayerStand(dt, sound) {
        if (this.state >= TILE_STATE.COLLAPSING) return;

        if (this.state === TILE_STATE.UNSTABLE || this.state === TILE_STATE.CRACKED) {
            this.standTimer += dt;
            if (this.state === TILE_STATE.CRACKED && this.standTimer > 0.8) {
                this.state = TILE_STATE.COLLAPSING;
                this.collapseTimer = 0;
                if (sound) sound.playWarning();
            } else if (this.state === TILE_STATE.UNSTABLE && this.standTimer > 1.2) {
                this.state = TILE_STATE.CRACKED;
                this.standTimer = 0;
                if (sound) sound.playCrack();
            }
        }
    }

    /** Check if a point (feetX, feetY) is landing on this tile from above */
    checkPlayerLand(feetX, feetY, vy) {
        if (this.state === TILE_STATE.GONE) return false;
        if (feetX < this.x - 2 || feetX > this.x + this.width + 2) return false;

        const surf = this.y + this.shakeOffset.y;
        // Only land if falling down and was above surface
        if (vy >= 0 && feetY >= surf && feetY <= surf + 22) return true;
        return false;
    }

    startCollapse(sound) {
        if (this.state < TILE_STATE.COLLAPSING) {
            this.state = TILE_STATE.COLLAPSING;
            this.collapseTimer = 0;
            if (sound) sound.playWarning();
        }
    }

    draw(ctx) {
        if (this.state === TILE_STATE.GONE) return;

        ctx.save();
        const drawX = this.x + this.shakeOffset.x;
        const drawY = this.y + this.shakeOffset.y;

        const glow = 0.5 + 0.5 * Math.sin(this.glowPhase);

        // Colors per state
        let fillColor, strokeColor, glowColor, topLineColor;
        switch (this.state) {
            case TILE_STATE.UNSTABLE:
                fillColor = '#1e2a3a';
                strokeColor = '#facc15';
                glowColor = '#facc15';
                topLineColor = '#facc15';
                break;
            case TILE_STATE.CRACKED:
                fillColor = '#2a1a1a';
                strokeColor = '#f97316';
                glowColor = '#f97316';
                topLineColor = '#f97316';
                break;
            case TILE_STATE.COLLAPSING: {
                const p = this.collapseTimer / this.collapseDuration;
                fillColor = `rgba(80, 10, 10, ${0.8 + p * 0.2})`;
                strokeColor = '#ff2a5f';
                glowColor = '#ff2a5f';
                topLineColor = '#ff2a5f';
                break;
            }
            default: // INTACT
                fillColor = '#172033';
                strokeColor = '#38bdf8';
                glowColor = '#00f0ff';
                topLineColor = '#00f0ff';
                break;
        }

        // Body
        ctx.fillStyle = fillColor;
        ctx.fillRect(drawX, drawY, this.width, this.height);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(drawX, drawY, this.width, this.height);

        // Glowing top rail
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 8 + glow * 6;
        ctx.strokeStyle = topLineColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(drawX + 6, drawY);
        ctx.lineTo(drawX + this.width - 6, drawY);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Crack lines for damaged states
        if (this.state >= TILE_STATE.CRACKED) {
            ctx.strokeStyle = this.state === TILE_STATE.COLLAPSING ? '#ff2a5f' : '#f97316';
            ctx.lineWidth = 1.5;
            const numCracks = this.state === TILE_STATE.CRACKED ? 3 : this.crackLines.length;
            for (let i = 0; i < numCracks; i++) {
                const c = this.crackLines[i];
                ctx.beginPath();
                ctx.moveTo(drawX + c.x1, drawY + c.y1);
                ctx.lineTo(drawX + c.x2, drawY + c.y2);
                ctx.lineTo(drawX + c.x3, drawY + c.y3);
                ctx.stroke();
            }
        } else if (this.state === TILE_STATE.UNSTABLE) {
            // Just show first crack as hairline
            ctx.strokeStyle = 'rgba(250, 204, 21, 0.5)';
            ctx.lineWidth = 1;
            const c = this.crackLines[0];
            ctx.beginPath();
            ctx.moveTo(drawX + c.x1, drawY + c.y1);
            ctx.lineTo(drawX + c.x2, drawY + c.y2);
            ctx.stroke();
        }

        // Movement direction indicator arrows for horizontal tiles
        if (this.movementType === 'horizontal') {
            ctx.fillStyle = `rgba(0, 240, 255, ${0.15 + glow * 0.1})`;
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('◄ ►', drawX + this.width / 2, drawY + this.height / 2 + 2);
        } else if (this.movementType === 'vertical') {
            ctx.fillStyle = `rgba(0, 240, 255, ${0.15 + glow * 0.1})`;
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('▲▼', drawX + this.width / 2, drawY + this.height / 2 + 2);
        }

        // Collapsing warning flash
        if (this.state === TILE_STATE.COLLAPSING) {
            const flashAlpha = Math.abs(Math.sin(this.collapseTimer * 10)) * 0.35;
            ctx.fillStyle = `rgba(255, 42, 95, ${flashAlpha})`;
            ctx.fillRect(drawX, drawY, this.width, this.height);
        }

        ctx.restore();
    }
}

export class FloatingPlatformManager {
    constructor() {
        this.tiles = [];
        this.nextId = 0;
        this.spawnTimer = 0;
        this.maxTiles = 6;
    }

    reset() {
        this.tiles = [];
        this.nextId = 0;
        this.spawnTimer = 0;
    }

    /**
     * Called each frame from game update.
     * @param {number} dt - delta time
     * @param {number} survivalTime - for difficulty scaling
     * @param {ParticleSystem} particleSystem
     * @param {SoundManager} sound
     * @param {CoinManager} coinManager
     */
    update(dt, survivalTime, particleSystem, sound, coinManager) {
        // Determine platform config based on time
        const cfg = this._getPlatformConfig(survivalTime);

        // Spawn new tiles periodically
        this.spawnTimer += dt;
        if (this.spawnTimer >= cfg.spawnInterval) {
            this.spawnTimer = 0;
            const activeTiles = this.tiles.filter(t => t.state !== TILE_STATE.GONE);
            if (activeTiles.length < cfg.maxTiles) {
                this._spawnTile(survivalTime, cfg, particleSystem, coinManager);
            }
        }

        // Update tiles
        for (let i = this.tiles.length - 1; i >= 0; i--) {
            const tile = this.tiles[i];
            tile.update(dt, particleSystem, sound);

            // Remove gone tiles after a short delay
            if (tile.state === TILE_STATE.GONE) {
                this.tiles.splice(i, 1);
            }
        }
    }

    _getPlatformConfig(survivalTime) {
        if (survivalTime < 30) {
            return { spawnInterval: 5, maxTiles: 2, fragile: false, verticalAllowed: false, collapsingAllowed: false };
        } else if (survivalTime < 60) {
            return { spawnInterval: 4, maxTiles: 3, fragile: false, verticalAllowed: true, collapsingAllowed: false };
        } else if (survivalTime < 90) {
            return { spawnInterval: 3.5, maxTiles: 4, fragile: true, verticalAllowed: true, collapsingAllowed: false };
        } else if (survivalTime < 120) {
            return { spawnInterval: 3, maxTiles: 5, fragile: true, verticalAllowed: true, collapsingAllowed: true };
        } else {
            return { spawnInterval: 2.5, maxTiles: 6, fragile: true, verticalAllowed: true, collapsingAllowed: true };
        }
    }

    _spawnTile(survivalTime, cfg, particleSystem, coinManager) {
        const width = 80 + Math.random() * 60;  // 80–140px
        const height = 18;

        // Tile Y range: early levels keep platforms LOW so tired players can reach them.
        // Level 1 (0-30s): tiles sit 40-140px above ground = Y 480-580
        // Later levels introduce higher tiles progressively.
        const FP = CONFIG.FLOATING_PLATFORMS;
        let minY, maxY;
        if (survivalTime < 30) {
            minY = FP.MIN_Y_LEVEL1;           // ~480 (easily reachable)
            maxY = CONFIG.GROUND_Y - 60;      // ~560
        } else if (survivalTime < 60) {
            minY = 380;
            maxY = CONFIG.GROUND_Y - 100;
        } else {
            minY = FP.MIN_Y_LATE;             // ~200 (higher challenge)
            maxY = CONFIG.GROUND_Y - FP.MAX_Y_ABOVE_GROUND;
        }
        const y = minY + Math.random() * Math.max(10, maxY - minY);

        // Pick X so tile is fully on screen
        const margin = 60;
        const x = margin + Math.random() * (CONFIG.CANVAS_WIDTH - width - margin * 2);

        // Check minimum distance from other tiles to avoid clustering
        for (const tile of this.tiles) {
            if (tile.state === TILE_STATE.GONE) continue;
            const dx = Math.abs((x + width / 2) - (tile.x + tile.width / 2));
            const dy = Math.abs(y - tile.y);
            if (dx < 120 && dy < 80) return; // Too close
        }

        // Movement type
        const movTypes = ['static', 'horizontal'];
        if (cfg.verticalAllowed) movTypes.push('vertical');
        const movType = movTypes[Math.floor(Math.random() * movTypes.length)];

        const range = movType === 'horizontal' ? 60 + Math.random() * 80 : 30 + Math.random() * 40;
        const speed = 0.4 + Math.random() * 0.6;

        // Initial state (fragile tiles after 60s)
        let initialState = TILE_STATE.INTACT;
        if (cfg.fragile && Math.random() < 0.3) {
            initialState = TILE_STATE.UNSTABLE;
        }

        const tile = new FloatingPlatformTile(this.nextId++, x, y, width, height, movType, range, speed);
        tile.state = initialState;

        // If collapsing allowed, some tiles auto-collapse after a while
        if (cfg.collapsingAllowed && Math.random() < 0.25) {
            const delay = 8 + Math.random() * 7;
            setTimeout(() => {
                if (tile.state !== TILE_STATE.GONE) {
                    tile.startCollapse(null);
                }
            }, delay * 1000);
        }

        this.tiles.push(tile);
        // Coin spawning is now handled by CoinManager's level-based scheduler.
        // A legacy fallback call is still supported for supplemental platform coins.
    }

    /**
     * Check if feet position (feetX, feetY) is over any tile.
     * Returns the tile if valid, or null.
     */
    getTileAt(feetX, feetY, vy) {
        for (const tile of this.tiles) {
            if (tile.state === TILE_STATE.GONE) continue;
            if (tile.checkPlayerLand(feetX, feetY, vy)) {
                return tile;
            }
        }
        return null;
    }

    /**
     * Given player's current position, find which tile (if any) player is standing on.
     * Used for platform-carry logic.
     */
    getStandingTile(playerX, playerY, playerWidth, playerHeight) {
        const feetY = playerY + playerHeight;
        const feetXLeft  = playerX + 4;
        const feetXRight = playerX + playerWidth - 4;
        const feetXMid   = playerX + playerWidth / 2;

        for (const tile of this.tiles) {
            if (tile.state === TILE_STATE.GONE) continue;
            const surf = tile.y + tile.shakeOffset.y;
            // Check if player feet are essentially resting on top of this tile
            if (Math.abs(feetY - surf) < 5) {
                // Any foot point over the tile?
                const inBounds = (fx) => fx >= tile.x - 2 && fx <= tile.x + tile.width + 2;
                if (inBounds(feetXLeft) || inBounds(feetXMid) || inBounds(feetXRight)) {
                    return tile;
                }
            }
        }
        return null;
    }

    draw(ctx) {
        for (const tile of this.tiles) {
            tile.draw(ctx);
        }
    }
}
