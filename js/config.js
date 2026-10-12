/* -------------------------------------------------------------
   SHOOTING STARS - Configuration & Tuning
   Centralized parameters for physics, player, hazards, and levels
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
