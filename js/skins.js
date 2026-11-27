/* -------------------------------------------------------------
   SHOOTING STARS - Stickman Skins & Trails Shop (Armory)
   Defines the 5 unlockable stickman colors + glowing motion trails.
   ------------------------------------------------------------- */

export const SKIN_STORAGE_KEY = 'shooting_stars_skin';

export const SKINS = [
    {
        id: 'cyan',
        name: 'Cosmic Cyan',
        cost: 0,
        bodyDark: '#ffffff',
        bodyLight: '#0f172a',
        glow: '#00f0ff',
        trail: '#00f0ff',
        desc: 'Classic starlight runner'
    },
    {
        id: 'gold',
        name: 'Solar Gold',
        cost: 50,
        bodyDark: '#fef08a',
        bodyLight: '#92400e',
        glow: '#ffd166',
        trail: '#fbbf24',
        desc: 'Golden spark trail'
    },
    {
        id: 'crimson',
        name: 'Crimson Blaze',
        cost: 120,
        bodyDark: '#fecaca',
        bodyLight: '#991b1b',
        glow: '#fb7185',
        trail: '#f97316',
        desc: 'Fiery meteor trail'
    },
    {
        id: 'emerald',
        name: 'Matrix Emerald',
        cost: 200,
        bodyDark: '#bbf7d0',
        bodyLight: '#065f46',
        glow: '#34d399',
        trail: '#10b981',
        desc: 'Digital neon glow trail'
    },
    {
        id: 'violet',
        name: 'Phantom Violet',
        cost: 350,
        bodyDark: '#e9d5ff',
        bodyLight: '#5b21b6',
        glow: '#c084fc',
        trail: '#a855f7',
        desc: 'Cosmic plasma trail'
    }
];

export function getSkinById(id) {
    return SKINS.find(s => s.id === id) || SKINS[0];
}

export function getSavedSkinId() {
    try {
        const id = localStorage.getItem(SKIN_STORAGE_KEY);
        return SKINS.some(s => s.id === id) ? id : 'cyan';
    } catch (e) {
        return 'cyan';
    }
}

export function saveLocalSkinId(id) {
    try {
        if (SKINS.some(s => s.id === id)) {
            localStorage.setItem(SKIN_STORAGE_KEY, id);
        }
    } catch (e) {}
}
