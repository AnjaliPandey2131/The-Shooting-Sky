/* -------------------------------------------------------------
   SHOOTING STARS - Dual Theme System
   Supports "dark" (Midnight Space - default) and "light" (Solar Sky).
   Persists selection in localStorage.
   ------------------------------------------------------------- */

const THEME_KEY = 'shooting_stars_theme';

let _currentTheme = 'dark';
const _listeners = [];

/** Initialise theme from localStorage and apply to <html>. */
export function initTheme() {
    try {
        const saved = localStorage.getItem(THEME_KEY);
        if (saved === 'light' || saved === 'dark') {
            _currentTheme = saved;
        }
    } catch (e) {
        _currentTheme = 'dark';
    }
    _applyTheme();
    return _currentTheme;
}

/** Return active theme ('dark' | 'light'). */
export function getTheme() {
    return _currentTheme;
}

/** Toggle between 'dark' and 'light', persist, and notify listeners. */
export function toggleTheme() {
    _currentTheme = _currentTheme === 'dark' ? 'light' : 'dark';
    try {
        localStorage.setItem(THEME_KEY, _currentTheme);
    } catch (e) {}
    _applyTheme();
    _listeners.forEach(cb => cb(_currentTheme));
    return _currentTheme;
}

/** Register a callback fired whenever theme changes. */
export function onThemeChange(cb) {
    _listeners.push(cb);
}

const SUN_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41"/></svg>`;
const MOON_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;

/** Update DOM attribute and all theme toggle button labels/icons. */
function _applyTheme() {
    document.documentElement.setAttribute('data-theme', _currentTheme);
    const isLight = _currentTheme === 'light';
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
        const icon = btn.querySelector('.theme-icon');
        const label = btn.querySelector('.theme-label');
        if (icon) {
            if (icon.dataset.svgIcon === 'true') {
                icon.innerHTML = isLight ? SUN_SVG : MOON_SVG;
            } else {
                icon.textContent = isLight ? '☀️' : '🌙';
            }
        }
        if (label) label.textContent = isLight ? 'Solar Sky' : 'Midnight Space';
        btn.title = isLight ? 'Switch to Midnight Space (Dark)' : 'Switch to Solar Sky (Light)';
    });
}
