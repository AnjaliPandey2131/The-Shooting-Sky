/* -------------------------------------------------------------
   SHOOTING STARS - Login Screen Module
   Renders and manages the Google authentication screen.
   ------------------------------------------------------------- */

import { signInWithGoogle } from './auth.js';
import { toggleTheme, getTheme } from './theme.js';

// ── DOM references ────────────────────────────────────────────────────────────
let _loginScreen   = null;
let _signInBtn     = null;
let _errorEl       = null;
let _loadingEl     = null;

// ── Show / hide helpers ───────────────────────────────────────────────────────
export function showLoginScreen() {
    if (!_loginScreen) _build();
    _loginScreen.classList.remove('hidden');
    _resetUI();
}

export function hideLoginScreen() {
    if (_loginScreen) _loginScreen.classList.add('hidden');
}

// ── Build the DOM node once ───────────────────────────────────────────────────
function _build() {
    const isLight = getTheme() === 'light';
    _loginScreen = document.createElement('div');
    _loginScreen.id = 'login-screen';
    _loginScreen.innerHTML = `
        <div class="login-stars" id="login-stars-bg"></div>
        <button id="login-theme-btn" class="theme-toggle-btn floating-theme-btn" data-theme-toggle type="button" title="Toggle Theme">
            <span class="theme-icon" data-svg-icon="true"></span>
            <span class="theme-label">${isLight ? 'Solar Sky' : 'Midnight Space'}</span>
        </button>
        <div class="login-card glass-panel">
            <div class="login-logo-wrap">
                <div class="login-title-glow">SHOOTING</div>
                <div class="login-title-highlight">STARS</div>
                <div class="login-subtitle">Your cosmic survival journey begins here.</div>
            </div>

            <div class="login-features">
                <span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg> Global Top 10</span>
                <span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg> Cloud Stats</span>
                <span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> Daily Missions</span>
            </div>

            <button id="google-signin-btn" class="google-btn">
                <svg class="google-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span>Continue with Google</span>
            </button>

            <div id="login-loading" class="login-loading hidden">
                <div class="login-spinner"></div>
                <span>Authenticating…</span>
            </div>

            <div id="login-error" class="login-error hidden"></div>

            <p class="login-footer">
                By continuing you agree to play fair and reach for the stars 🌟
            </p>
        </div>
    `;

    document.body.appendChild(_loginScreen);
    _spawnStars();
    _signInBtn  = document.getElementById('google-signin-btn');
    _errorEl    = document.getElementById('login-error');
    _loadingEl  = document.getElementById('login-loading');

    _signInBtn.addEventListener('click', _handleSignIn);
    document.getElementById('login-theme-btn')?.addEventListener('click', () => toggleTheme());
    // Sync SVG icon immediately
    document.documentElement.setAttribute('data-theme', getTheme());
    const themeIconEl = document.querySelector('#login-theme-btn .theme-icon');
    if (themeIconEl) {
        themeIconEl.innerHTML = getTheme() === 'light'
            ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41"/></svg>`
            : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
    }
}

// ── Animated star background ──────────────────────────────────────────────────
function _spawnStars() {
    const bg = document.getElementById('login-stars-bg');
    if (!bg) return;
    for (let i = 0; i < 120; i++) {
        const star = document.createElement('div');
        star.className = 'login-star';
        star.style.cssText = `
            left:${Math.random() * 100}%;
            top:${Math.random() * 100}%;
            width:${Math.random() * 2.5 + 0.5}px;
            height:${Math.random() * 2.5 + 0.5}px;
            animation-delay:${(Math.random() * 4).toFixed(2)}s;
            animation-duration:${(Math.random() * 3 + 2).toFixed(2)}s;
        `;
        bg.appendChild(star);
    }
    // A handful of shooting-star streaks
    for (let j = 0; j < 6; j++) {
        const streak = document.createElement('div');
        streak.className = 'login-streak';
        streak.style.cssText = `
            left:${Math.random() * 80}%;
            top:${Math.random() * 60}%;
            animation-delay:${(Math.random() * 8).toFixed(2)}s;
            animation-duration:${(Math.random() * 2 + 3).toFixed(2)}s;
        `;
        bg.appendChild(streak);
    }
}

// ── Sign-in flow ──────────────────────────────────────────────────────────────
async function _handleSignIn() {
    _setLoading(true);
    _hideError();
    try {
        await signInWithGoogle();
        // onAuthStateChanged in auth.js will fire and trigger showDashboard
    } catch (err) {
        _setLoading(false);
        _showError(err.message || 'Sign-in failed. Please try again.');
    }
}

function _resetUI() {
    _setLoading(false);
    _hideError();
}

function _setLoading(on) {
    if (!_signInBtn || !_loadingEl) return;
    if (on) {
        _signInBtn.classList.add('hidden');
        _loadingEl.classList.remove('hidden');
    } else {
        _signInBtn.classList.remove('hidden');
        _loadingEl.classList.add('hidden');
    }
}

function _showError(msg) {
    if (!_errorEl) return;
    _errorEl.textContent = msg;
    _errorEl.classList.remove('hidden');
}

function _hideError() {
    if (_errorEl) _errorEl.classList.add('hidden');
}
