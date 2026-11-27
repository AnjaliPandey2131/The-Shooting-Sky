/* -------------------------------------------------------------
   SHOOTING STARS - Player Dashboard Module
   Displays cloud statistics, game history, and links to the game.
   All data is sourced from the authenticated user's Firestore documents.
   ------------------------------------------------------------- */

import { signOutUser }                from './auth.js';
import { loadUserProfile, fetchRecentRuns, fetchLeaderboard, syncLeaderboardEntry } from './db.js';
import { toggleTheme, getTheme }      from './theme.js';
import { sound }                      from './audio.js';

// ── State ─────────────────────────────────────────────────────────────────────
let _dashScreen    = null;
let _user          = null;
let _lastRunDoc    = null;
let _hasMore       = false;
let _startGameCb   = null;

// ── Public API ────────────────────────────────────────────────────────────────
export function setStartGameCallback(cb) {
    _startGameCb = cb;
}

export async function showDashboard(firebaseUser) {
    _user = firebaseUser;
    if (!_dashScreen) _build();
    _dashScreen.classList.remove('hidden');

    _renderProfileSkeleton(firebaseUser);
    await _loadAndRender();
}

export function hideDashboard() {
    if (_dashScreen) _dashScreen.classList.add('hidden');
}

// Update stats card after a game finishes without full reload
export async function refreshDashboardAfterGame() {
    if (!_user) return;
    await _loadAndRender();
}

// ── Build DOM ─────────────────────────────────────────────────────────────────
function _build() {
    const isLight = getTheme() === 'light';
    _dashScreen = document.createElement('div');
    _dashScreen.id = 'dashboard-screen';
    _dashScreen.innerHTML = `
        <!-- Animated star background -->
        <div class="dash-stars" id="dash-stars-bg"></div>

        <div class="dash-layout">

            <!-- ── LEFT PANEL ── -->
            <aside class="dash-sidebar glass-panel">
                <div class="profile-section">
                    <img id="dash-avatar" class="profile-avatar" src="" alt="Profile" />
                    <div class="profile-info">
                        <div id="dash-name"  class="profile-name">Loading…</div>
                        <div id="dash-email" class="profile-email"></div>
                    </div>
                    <button id="dash-logout" class="logout-btn" title="Sign out">⏻ Logout</button>
                </div>

                <button id="dash-start-btn" class="primary-btn pulse-glow dash-start-btn">
                    <span class="btn-text">🚀 START GAME</span>
                    <span class="btn-shine"></span>
                </button>

                <div class="dash-nav">
                    <div class="nav-item active" data-panel="stats">📊 My Stats</div>
                    <div class="nav-item" data-panel="history">📋 Game History</div>
                    <div class="nav-item" data-panel="leaderboard">🏆 Leaderboard</div>
                </div>

                <div class="dash-controls-row">
                    <button id="dash-theme-btn" class="dash-util-btn" data-theme-toggle type="button" title="Toggle Theme">
                        <span class="theme-icon">${isLight ? '☀️' : '🌙'}</span>
                        <span class="theme-label">${isLight ? 'Solar Sky' : 'Midnight Space'}</span>
                    </button>
                    <button id="dash-mute-btn" class="dash-util-btn" type="button" title="Toggle Sound">
                        <span data-mute-icon>${sound.muted ? '🔇' : '🔊'}</span>
                        <span data-mute-label>${sound.muted ? 'Sound Off' : 'Sound On'}</span>
                    </button>
                </div>
            </aside>

            <!-- ── RIGHT PANEL ── -->
            <main class="dash-main">
                <!-- Stats panel -->
                <div id="dash-panel-stats" class="dash-panel active">
                    <h2 class="dash-heading">Your Cosmic Journey</h2>
                    <div class="stats-cards" id="dash-stats-cards">
                        ${_statCardHTML('🏆', 'Best Score',       'dash-best-score',  '—')}
                        ${_statCardHTML('🎯', 'Last Score',        'dash-prev-score',  '—')}
                        ${_statCardHTML('🎮', 'Games Played',      'dash-total-games', '—')}
                        ${_statCardHTML('🪙', 'Coins Collected',   'dash-total-coins', '—')}
                        ${_statCardHTML('🌌', 'Highest Stage',     'dash-high-stage',  '—')}
                        ${_statCardHTML('⏱', 'Total Playtime',    'dash-total-time',  '—')}
                    </div>
                    <div id="dash-empty-stats" class="dash-empty hidden">
                        <div class="empty-icon">🚀</div>
                        <p>Your stats will appear here after your first game!</p>
                        <p class="empty-sub">Hit "Start Game" to begin your cosmic journey.</p>
                    </div>
                </div>

                <!-- History panel -->
                <div id="dash-panel-history" class="dash-panel">
                    <h2 class="dash-heading">Recent Games</h2>
                    <div id="dash-history-list" class="history-list">
                        <div class="history-loading">Loading…</div>
                    </div>
                    <button id="dash-load-more" class="secondary-btn load-more-btn hidden">Load More</button>
                </div>

                <!-- Leaderboard panel -->
                <div id="dash-panel-leaderboard" class="dash-panel">
                    <div class="dash-heading-row">
                        <h2 class="dash-heading">Global Leaderboard (Top 10)</h2>
                        <button id="dash-lb-refresh" class="secondary-btn lb-refresh-btn" type="button">↻ Refresh</button>
                    </div>
                    <div id="dash-leaderboard-list" class="leaderboard-list">
                        <div class="history-loading">Loading…</div>
                    </div>
                </div>
            </main>
        </div>
    `;

    document.body.appendChild(_dashScreen);
    _spawnStars();
    _bindDashEvents();
}

function _statCardHTML(icon, label, id, val) {
    return `
        <div class="stat-card glass-panel">
            <div class="stat-card-icon">${icon}</div>
            <div class="stat-card-label">${label}</div>
            <div class="stat-card-value" id="${id}">${val}</div>
        </div>`;
}

// ── Animated stars ────────────────────────────────────────────────────────────
function _spawnStars() {
    const bg = document.getElementById('dash-stars-bg');
    if (!bg) return;
    for (let i = 0; i < 80; i++) {
        const s = document.createElement('div');
        s.className = 'login-star';
        s.style.cssText = `
            left:${Math.random()*100}%;
            top:${Math.random()*100}%;
            width:${Math.random()*2+0.5}px;
            height:${Math.random()*2+0.5}px;
            animation-delay:${(Math.random()*5).toFixed(2)}s;
            animation-duration:${(Math.random()*4+2).toFixed(2)}s;
        `;
        bg.appendChild(s);
    }
}

// ── Event wiring ──────────────────────────────────────────────────────────────
function _bindDashEvents() {
    document.getElementById('dash-logout').addEventListener('click', async () => {
        await signOutUser();
        // onAuthStateChanged fires → app.js shows login screen
    });

    document.getElementById('dash-start-btn').addEventListener('click', () => {
        sound.ensureAudioContext();
        if (_startGameCb) _startGameCb();
    });

    document.getElementById('dash-theme-btn')?.addEventListener('click', () => {
        toggleTheme();
    });

    document.getElementById('dash-mute-btn')?.addEventListener('click', () => {
        sound.toggleMute();
    });

    document.getElementById('dash-lb-refresh')?.addEventListener('click', () => {
        _loadLeaderboard();
    });

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.querySelectorAll('.dash-panel').forEach(p => p.classList.remove('active'));
            item.classList.add('active');
            const panelId = `dash-panel-${item.dataset.panel}`;
            document.getElementById(panelId)?.classList.add('active');

            if (item.dataset.panel === 'history') {
                _loadHistory(true);
            } else if (item.dataset.panel === 'leaderboard') {
                _loadLeaderboard();
            }
        });
    });

    document.getElementById('dash-load-more')?.addEventListener('click', () => {
        _loadHistory(false);
    });
}

// ── Skeleton / profile ────────────────────────────────────────────────────────
function _renderProfileSkeleton(user) {
    const avatar = document.getElementById('dash-avatar');
    const name   = document.getElementById('dash-name');
    const email  = document.getElementById('dash-email');
    if (avatar) avatar.src = user.photoURL || '';
    if (name)   name.textContent  = user.displayName || 'Space Traveller';
    if (email)  email.textContent = user.email || '';
}

// ── Load & render stats ───────────────────────────────────────────────────────
async function _loadAndRender() {
    try {
        const profile = await loadUserProfile(_user.uid);
        if (!profile) return;

        _set('dash-best-score',  profile.bestScore    > 0 ? profile.bestScore.toLocaleString() : '—');
        _set('dash-prev-score',  profile.previousScore > 0 ? profile.previousScore.toLocaleString() : '—');
        _set('dash-total-games', profile.totalGames   > 0 ? profile.totalGames : '—');
        _set('dash-total-coins', profile.totalCoins   > 0 ? profile.totalCoins.toLocaleString() : '—');
        _set('dash-high-stage',  profile.highestStage > 0 ? `Stage ${profile.highestStage}` : '—');
        _set('dash-total-time',  profile.totalSurvivalTime > 0
            ? _fmtTime(profile.totalSurvivalTime) : '—');

        const isEmpty = profile.totalGames === 0;
        document.getElementById('dash-empty-stats')?.classList.toggle('hidden', !isEmpty);

        // Keep leaderboard entry in sync for existing players
        if ((profile.bestScore || 0) > 0) {
            syncLeaderboardEntry(
                _user.uid,
                profile.displayName || _user.displayName,
                profile.bestScore,
                profile.highestStage || 1
            );
        }
    } catch (err) {
        console.error('[Dashboard] Failed to load profile:', err);
    }
}

// ── Load Top 10 Leaderboard ───────────────────────────────────────────────────
async function _loadLeaderboard() {
    const list = document.getElementById('dash-leaderboard-list');
    if (!list) return;
    list.innerHTML = '<div class="history-loading">Loading leaderboard…</div>';

    try {
        const entries = await fetchLeaderboard(10);
        list.innerHTML = '';

        if (!entries.length) {
            list.innerHTML = `
                <div class="history-empty">
                    <div class="empty-icon">🏆</div>
                    <p>No leaderboard scores yet — be the first to set a record!</p>
                </div>`;
            return;
        }

        const medals = ['🥇', '🥈', '🥉'];
        entries.forEach((entry, index) => {
            const isSelf = _user && entry.uid === _user.uid;
            const row = document.createElement('div');
            row.className = `lb-row glass-panel${isSelf ? ' lb-self' : ''}`;

            const rankEl = document.createElement('div');
            rankEl.className = 'lb-rank';
            rankEl.textContent = index < 3 ? medals[index] : `#${index + 1}`;

            const nameEl = document.createElement('div');
            nameEl.className = 'lb-name';
            nameEl.textContent = entry.displayName || 'Space Traveller';
            if (isSelf) {
                const badge = document.createElement('span');
                badge.className = 'lb-you-badge';
                badge.textContent = 'YOU';
                nameEl.appendChild(badge);
            }

            const stageEl = document.createElement('div');
            stageEl.className = 'lb-stage';
            stageEl.textContent = `Stage ${entry.highestStage || 1}`;

            const scoreEl = document.createElement('div');
            scoreEl.className = 'lb-score highlight-gold';
            scoreEl.textContent = `${(entry.bestScore || 0).toLocaleString()} pts`;

            row.appendChild(rankEl);
            row.appendChild(nameEl);
            row.appendChild(stageEl);
            row.appendChild(scoreEl);
            list.appendChild(row);
        });
    } catch (err) {
        console.error('[Dashboard] Failed to load leaderboard:', err);
        list.innerHTML = '<div class="history-empty">Failed to load leaderboard. Check Firestore rules.</div>';
    }
}

// ── Load history ──────────────────────────────────────────────────────────────
let _historyLoaded = false;

async function _loadHistory(reset = true) {
    if (reset) {
        _lastRunDoc    = null;
        _hasMore       = false;
        _historyLoaded = false;
        const list = document.getElementById('dash-history-list');
        if (list) list.innerHTML = '<div class="history-loading">Loading…</div>';
    }

    try {
        const { runs, lastDoc, hasMore } = await fetchRecentRuns(_user.uid, 10, reset ? null : _lastRunDoc);
        _lastRunDoc    = lastDoc;
        _hasMore       = hasMore;
        _historyLoaded = true;

        const list    = document.getElementById('dash-history-list');
        const moreBtn = document.getElementById('dash-load-more');

        if (reset) list.innerHTML = '';

        if (runs.length === 0 && reset) {
            list.innerHTML = `
                <div class="history-empty">
                    <div class="empty-icon">🌌</div>
                    <p>No games yet — start your first run!</p>
                </div>`;
        } else {
            runs.forEach((run, i) => {
                const row = document.createElement('div');
                row.className = 'history-row glass-panel';
                const date = run.playedAt?.toDate
                    ? _fmtDate(run.playedAt.toDate())
                    : '—';
                row.innerHTML = `
                    <div class="hr-left">
                        <span class="hr-date">${date}</span>
                        <span class="hr-stage">Stage ${run.highestStageReached || 1}: ${run.highestStageName || '—'}</span>
                    </div>
                    <div class="hr-right">
                        <span class="hr-score highlight-gold">${(run.score || 0).toLocaleString()} pts</span>
                        <span class="hr-coins">🪙 ${run.coinsCollected || 0}</span>
                        <span class="hr-time">⏱ ${_fmtTime(run.survivalTime || 0)}</span>
                    </div>
                `;
                list.appendChild(row);
            });
        }

        if (moreBtn) {
            moreBtn.classList.toggle('hidden', !hasMore);
        }
    } catch (err) {
        console.error('[Dashboard] Failed to load history:', err);
        const list = document.getElementById('dash-history-list');
        if (list) list.innerHTML = '<div class="history-empty">Failed to load history.</div>';
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _set(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function _fmtTime(seconds) {
    const h  = Math.floor(seconds / 3600);
    const m  = Math.floor((seconds % 3600) / 60);
    const s  = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

function _fmtDate(date) {
    return new Intl.DateTimeFormat('en-IN', {
        day:   '2-digit',
        month: 'short',
        year:  'numeric',
        hour:  '2-digit',
        minute:'2-digit'
    }).format(date);
}
