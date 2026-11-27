/* -------------------------------------------------------------
   SHOOTING STARS - Unlockable Worlds Configuration
   Defines the 4 cosmic worlds, unlock thresholds, visual themes,
   and gameplay twists.
   ------------------------------------------------------------- */

export const WORLD_STORAGE_KEY = 'shooting_stars_world';

export const WORLDS = [
    {
        id: 'earth',
        name: 'Earth Orbit',
        icon: '🌍',
        unlockScore: 0,
        unlockCoins: 0,
        twistLabel: 'Classic Survival',
        description: 'Balanced gravity & standard meteor showers.',
        gravityMult: 1.0,
        hazardSpeedMult: 1.0,
        coinMult: 1,
        hasWind: false,
        gradient: ['#0b2746', '#001d3d']
    },
    {
        id: 'moon',
        name: 'Moon Base',
        icon: '🌕',
        unlockScore: 5000,
        unlockCoins: 50,
        twistLabel: 'Low Gravity',
        description: 'Higher jumps and floatier lunar descent.',
        gravityMult: 0.72,
        hazardSpeedMult: 1.0,
        coinMult: 1,
        hasWind: false,
        gradient: ['#1e2436', '#0d111a']
    },
    {
        id: 'mars',
        name: 'Mars Storm',
        icon: '🔴',
        unlockScore: 15000,
        unlockCoins: 150,
        twistLabel: 'Wind Gusts',
        description: 'Periodic crimson gusts push you sideways.',
        gravityMult: 1.0,
        hazardSpeedMult: 1.05,
        coinMult: 1,
        hasWind: true,
        gradient: ['#4a1c18', '#220a09']
    },
    {
        id: 'cyber',
        name: 'Cyber Void',
        icon: '👾',
        unlockScore: 30000,
        unlockCoins: 300,
        twistLabel: 'Fast + 2x Coins',
        description: 'Faster hazards, neon synth grid, 2x coin value!',
        gravityMult: 1.0,
        hazardSpeedMult: 1.25,
        coinMult: 2,
        hasWind: false,
        gradient: ['#2b0b42', '#0e041a']
    }
];

export function getWorldById(id) {
    return WORLDS.find(w => w.id === id) || WORLDS[0];
}

export function isWorldUnlocked(world, bestScore = 0, totalCoins = 0, unlockedList = []) {
    if (world.unlockScore === 0 && world.unlockCoins === 0) return true;
    if (Array.isArray(unlockedList) && unlockedList.includes(world.id)) return true;
    return bestScore >= world.unlockScore || totalCoins >= world.unlockCoins;
}

export function computeUnlockedWorlds(bestScore = 0, totalCoins = 0, existing = []) {
    const set = new Set(Array.isArray(existing) ? existing : ['earth']);
    set.add('earth');
    for (const w of WORLDS) {
        if (bestScore >= w.unlockScore || totalCoins >= w.unlockCoins) {
            set.add(w.id);
        }
    }
    return Array.from(set);
}

export function getSavedWorldId() {
    try {
        const id = localStorage.getItem(WORLD_STORAGE_KEY);
        return WORLDS.some(w => w.id === id) ? id : 'earth';
    } catch (e) {
        return 'earth';
    }
}

export function saveLocalWorldId(id) {
    try {
        if (WORLDS.some(w => w.id === id)) {
            localStorage.setItem(WORLD_STORAGE_KEY, id);
        }
    } catch (e) {}
}
