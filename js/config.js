/* -------------------------------------------------------------
   SHOOTING STARS - Configuration & Tuning
   Centralized parameters for physics, player, hazards, levels,
   energy system, shield, and level-based coin spawning.
   ------------------------------------------------------------- */

export const CONFIG = {
    // Virtual resolution constants (canvas renders at crisp 16:9 ratio internal resolution)
    CANVAS_WIDTH: 1280,
    CANVAS_HEIGHT: 720,

    // Platform ground baseline
    GROUND_Y: 620,
    PLATFORM_HEIGHT: 40,
    PLATFORM_SEGMENTS: 10,

    // Player physics & dimensions
    PLAYER: {
        WIDTH: 30,
        HEIGHT_STANDING: 76,
        HEIGHT_CROUCHING: 42,
        HEAD_RADIUS: 11,
        WALK_SPEED: 7.5,
        CROUCH_SPEED: 4.8,
        JUMP_FORCE: -17.5,
        GRAVITY: 0.75,
        FRICTION: 0.82,
        ACCELERATION: 1.2
    },

    // ─── ENERGY SYSTEM ───────────────────────────────────────────
    ENERGY: {
        START: 100,           // Initial energy %
        MIN: 0,
        MAX: 100,
        DRAIN_PER_SECOND: 2,  // % drained per active second
        COIN_RESTORE: 5,      // % restored per coin collected

        // Tier thresholds (inclusive lower bound)
        TIER_HIGH: 60,        // 60–100% = HIGH
        TIER_MED: 30,         // 30–59% = MEDIUM
        TIER_LOW: 1,          // 1–29%  = LOW
        // 0% = ZERO tier

        // Speed multipliers per tier (applied to WALK_SPEED)
        SPEED_HIGH: 1.0,
        SPEED_MED: 0.87,
        SPEED_LOW: 0.70,
        SPEED_ZERO: 0.55,

        // Jump force multipliers per tier (applied to JUMP_FORCE)
        JUMP_HIGH: 1.0,
        JUMP_MED: 0.92,
        JUMP_LOW: 0.78,
        JUMP_ZERO: 0.67,

        // Forward-lean body-bend (radians). 0 = upright, positive = forward lean
        LEAN_HIGH: 0.0,
        LEAN_MED: 0.18,
        LEAN_LOW: 0.38,
        LEAN_ZERO: 0.58,

        // Run animation cadence multiplier (1 = normal speed legs)
        CADENCE_HIGH: 1.0,
        CADENCE_MED: 0.88,
        CADENCE_LOW: 0.72,
        CADENCE_ZERO: 0.55,
    },

    // ─── SHIELD SYSTEM ───────────────────────────────────────────
    SHIELD: {
        COINS_PER_CHARGE: 10,   // earn 1 shield per N coins THIS run
        INVULNERABLE_DURATION: 5,  // seconds of protection per activation
        TRIGGER_MARGIN: 40,     // px distance at which auto-activation fires
    },

    // ─── COIN SPAWNING (per 30-second stage) ─────────────────────
    COIN_SPAWNING: {
        // Target coin counts for each level's 30-second window
        // These are spawn targets, not guarantees of collection.
        LEVEL_TARGETS: [
            { level: 1, min: 5,  max: 6  },  // 0-30s
            { level: 2, min: 9,  max: 10 },  // 30-60s
            { level: 3, min: 12, max: 14 },  // 60-90s
            { level: 4, min: 15, max: 17 },  // 90-120s
            { level: 5, min: 18, max: 20 },  // 120s+
        ],
        MAX_ACTIVE_COINS: 16,   // clamp total alive coins
        GROUND_COIN_HEIGHT: 30, // px above ground surface for ground-level coins
        // Floating platform coin heights
        ABOVE_PLATFORM: 24,     // px above tile surface
        HIGH_COIN_EXTRA: 40,    // additional px for "high" coins (must still be reachable)
        NEAR_DUPLICATE_DIST: 28 // px radius to avoid duplicate coin placement
    },

    // ─── RAGE BAIT COIN ──────────────────────────────────────────
    RAGE_BAIT_COIN: {
        ENABLED: true,
        LIFETIME: 8,              // collectible seconds after the entrance
        ENTRANCE_DURATION: 0.55,   // pop-in time before the collection window
        REACTION_DURATION: 2.1,   // seconds for spoken escape/collection reactions
        MIN_PER_STAGE: 1,
        MAX_PER_STAGE: 2,
        FIRST_SPAWN_MIN: 4,       // seconds after a stage begins
        FIRST_SPAWN_MAX: 8,
        SECOND_SPAWN_MIN: 18,     // stage-relative; leaves time for both encounters
        SECOND_SPAWN_MAX: 22,
        FINAL_STAGE_SECOND_MIN: 24,
        FINAL_STAGE_SECOND_MAX: 32,
        HITBOX_RADIUS: 12,
        PLATFORM_EDGE_MARGIN: 24,
        MIN_SPAWN_DISTANCE: 42,
        MIN_PLATFORM_HEIGHT: 12,
        JUMP_HEIGHT_MARGIN: 8,
        HORIZONTAL_REACH_MARGIN: 12,
        MAX_DODGE: 4,
        PROXIMITY_NEAR: 180,
        PROXIMITY_CLOSE: 70,
        RETRY_DELAY: 1,
        BONUS_SCORE: 0             // normal coin score is always awarded on collection
    },

    // ─── FLOATING PLATFORMS ──────────────────────────────────────
    FLOATING_PLATFORMS: {
        // Min Y for floating tiles (pixels from top). Level 1 uses LOW_MIN so player can reach.
        MIN_Y_LEVEL1: 480,   // ~140px above ground for early easy platforms
        MIN_Y_LATE: 200,     // higher tiles in later levels
        MAX_Y_ABOVE_GROUND: 120, // tiles must be at least this far above GROUND_Y
    },

    // Hazard Base Settings
    HAZARDS: {
        SHOOTING_STAR: {
            RADIUS: 10,
            SPEED_MIN: 7,
            SPEED_MAX: 12,
            COLOR: '#00f0ff',
            SCORE_VALUE: 50
        },
        HAILSTONE: {
            RADIUS: 7,
            SPEED_MIN: 11,
            SPEED_MAX: 16,
            COLOR: '#a5f3fc',
            SCORE_VALUE: 30
        },
        ASTEROID: {
            RADIUS: 24,
            SPEED_MIN: 4,
            SPEED_MAX: 7,
            COLOR: '#94a3b8',
            SCORE_VALUE: 100
        },
        FIREBALL: {
            RADIUS: 16,
            SPEED_MIN: 8,
            SPEED_MAX: 13,
            COLOR: '#ff4500',
            SCORE_VALUE: 80
        },
        METEOR_WAVE: {
            WARNING_TIME: 1.2, // seconds
            METEOR_COUNT: 5,
            RADIUS: 14,
            SPEED: 14,
            COLOR: '#ff0055'
        }
    },

    // Stages / Difficulty Progression
    STAGES: [
        {
            LEVEL: 1,
            NAME: "CALM SKY",
            DURATION: 30, // 0 - 30 seconds
            SPAWN_INTERVAL: 1.4, // seconds between spawns
            TYPES: ['SHOOTING_STAR'],
            PLATFORM_CRACKING: false,
            MAX_CRUMBLED: 0
        },
        {
            LEVEL: 2,
            NAME: "METEOR SHOWER",
            DURATION: 60, // 30 - 60 seconds
            SPAWN_INTERVAL: 0.95,
            TYPES: ['SHOOTING_STAR', 'HAILSTONE'],
            PLATFORM_CRACKING: false,
            MAX_CRUMBLED: 0
        },
        {
            LEVEL: 3,
            NAME: "ASTEROID STORM",
            DURATION: 90, // 60 - 90 seconds
            SPAWN_INTERVAL: 0.72,
            TYPES: ['SHOOTING_STAR', 'HAILSTONE', 'ASTEROID'],
            PLATFORM_CRACKING: true,
            CRACK_STAGE_MAX: 1, // Only cracks show
            MAX_CRUMBLED: 0
        },
        {
            LEVEL: 4,
            NAME: "BREAKING WORLD",
            DURATION: 120, // 90 - 120 seconds
            SPAWN_INTERVAL: 0.55,
            TYPES: ['SHOOTING_STAR', 'HAILSTONE', 'ASTEROID', 'FIREBALL', 'METEOR_WAVE'],
            PLATFORM_CRACKING: true,
            CRACK_STAGE_MAX: 3, // Sections collapse!
            MAX_CRUMBLED: 2
        },
        {
            LEVEL: 5,
            NAME: "ULTIMATE SURVIVAL",
            DURATION: Infinity, // 120s+
            SPAWN_INTERVAL: 0.38,
            TYPES: ['SHOOTING_STAR', 'HAILSTONE', 'ASTEROID', 'FIREBALL', 'METEOR_WAVE'],
            PLATFORM_CRACKING: true,
            CRACK_STAGE_MAX: 3,
            MAX_CRUMBLED: 3
        }
    ],

    STORAGE_KEY: "shooting_stars_highscore"
};
