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

/** Update DOM attribute and all theme toggle button labels/icons. */
function _applyTheme() {
    document.documentElement.setAttribute('data-theme', _currentTheme);
    const isLight = _currentTheme === 'light';
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
        const icon = btn.querySelector('.theme-icon');
        const label = btn.querySelector('.theme-label');
        if (icon) icon.textContent = isLight ? '☀️' : '🌙';
        if (label) label.textContent = isLight ? 'Solar Sky' : 'Midnight Space';
        btn.title = isLight ? 'Switch to Midnight Space (Dark)' : 'Switch to Solar Sky (Light)';
    });
}
