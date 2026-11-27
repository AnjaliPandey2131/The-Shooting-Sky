/* -------------------------------------------------------------
   SHOOTING STARS - Player Dashboard Module
   Displays cloud statistics, game history, and links to the game.
   All data is sourced from the authenticated user's Firestore documents.
   ------------------------------------------------------------- */

import { signOutUser }                from './auth.js';
import { loadUserProfile, fetchRecentRuns, fetchLeaderboard, syncLeaderboardEntry, saveSelectedWorld, unlockAndEquipSkin, equipSkin } from './db.js';
import { toggleTheme, getTheme }      from './theme.js';
import { sound }                      from './audio.js';
import { WORLDS, isWorldUnlocked, getSavedWorldId, saveLocalWorldId } from './worlds.js';
import { SKINS, getSavedSkinId, saveLocalSkinId } from './skins.js';
import { MISSION_DEFS, normalizeDailyMissions } from './missions.js';

// ── State ─────────────────────────────────────────────────────────────────────
let _dashScreen     = null;
let _user           = null;
let _lastRunDoc     = null;
let _hasMore        = false;
let _startGameCb    = null;
let _selectedWorld  = getSavedWorldId();
let _selectedSkin   = getSavedSkinId();
let _currentStreak  = 0;
let _totalGems      = 0;
let _cachedProfile  = null;

// ── Public API ────────────────────────────────────────────────────────────────
export function getActiveWorldId() {
    return _selectedWorld;
}

export function getActiveStreak() {
    return _currentStreak;
}

export function getActiveGems() {
    return _totalGems;
}

export function getActiveSkinId() {
    return _selectedSkin;
}

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

const svg = (paths, size = 16) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const ICONS = {
    stats:       svg('<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>'),
    leaderboard: svg('<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>'),
    missions:    svg('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'),
    armory:      svg('<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2Z"/>'),
    history:     svg('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>'),
    play:        svg('<polygon points="6 3 20 12 6 21 6 3"/>', 15),
    logout:      svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>', 14),
    crosshair:   svg('<circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/>'),
    flame:       svg('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>'),
    gamepad:     svg('<line x1="6" x2="10" y1="12" y2="12"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="15" x2="15.01" y1="13" y2="13"/><line x1="18" x2="18.01" y1="11" y2="11"/><rect width="20" height="12" x="2" y="6" rx="2"/>'),
    coins:       svg('<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>'),
    gem:         svg('<path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>'),
    layers:      svg('<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>'),
    clock:       svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
    globe:       svg('<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>', 14),
    refresh:     svg('<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>', 14)
};

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
                    <button id="dash-logout" class="logout-btn" title="Sign out">
                        ${ICONS.logout}
                        <span>Logout</span>
                    </button>
                </div>

                <button id="dash-start-btn" class="primary-btn dash-start-btn">
                    <span class="btn-text">${ICONS.play}<span>START GAME</span></span>
                </button>

                <div class="dash-nav">
                    <div class="nav-item active" data-panel="stats">${ICONS.stats}<span>Stats</span></div>
                    <div class="nav-item" data-panel="leaderboard">${ICONS.leaderboard}<span>Top 10</span></div>
                    <div class="nav-item" data-panel="missions">${ICONS.missions}<span>Missions</span></div>
                    <div class="nav-item" data-panel="armory">${ICONS.armory}<span>Armory</span></div>
                    <div class="nav-item" data-panel="history">${ICONS.history}<span>History</span></div>
                </div>

                <div class="dash-controls-row">
                    <button id="dash-theme-btn" class="dash-util-btn" data-theme-toggle type="button" title="Toggle Theme">
                        <span class="theme-icon" data-svg-icon="true"></span>
                        <span class="theme-label">${isLight ? 'Solar Sky' : 'Midnight Space'}</span>
                    </button>
                    <button id="dash-mute-btn" class="dash-util-btn" type="button" title="Toggle Sound">
                        <span data-mute-icon data-svg-icon="true"></span>
                        <span data-mute-label>${sound.muted ? 'Sound Off' : 'Sound On'}</span>
                    </button>
                </div>
            </aside>

            <!-- ── RIGHT PANEL ── -->
            <main class="dash-main">
                <!-- 1. Stats panel (World Selector + Stats ONLY) -->
                <div id="dash-panel-stats" class="dash-panel active">
                    <div class="dash-heading-row">
                        <h2 class="dash-heading">Command Deck</h2>
                        <span id="dash-streak-badge" class="streak-bonus-badge hidden">${ICONS.flame}<span>Streak Bonus +10%</span></span>
                    </div>

                    <!-- World Selector -->
                    <div class="world-selector-wrap">
                        <div class="world-selector-title">${ICONS.globe}<span>SELECT WORLD</span></div>
                        <div id="dash-world-grid" class="world-grid"></div>
                    </div>

                    <div class="stats-cards" id="dash-stats-cards">
                        ${_statCardHTML(ICONS.leaderboard, 'Best Score',    'dash-best-score',  '—')}
                        ${_statCardHTML(ICONS.crosshair,   'Last Score',    'dash-prev-score',  '—')}
                        ${_statCardHTML(ICONS.flame,       'Daily Streak',  'dash-streak',      '0 Days')}
                        ${_statCardHTML(ICONS.gamepad,     'Games Played',  'dash-total-games', '—')}
                        ${_statCardHTML(ICONS.coins,       'Total Coins',   'dash-total-coins', '—')}
                        ${_statCardHTML(ICONS.gem,         'Gems',          'dash-total-gems',  '0')}
                        ${_statCardHTML(ICONS.layers,      'Highest Stage', 'dash-high-stage',  '—')}
                        ${_statCardHTML(ICONS.clock,       'Playtime',      'dash-total-time',  '—')}
                    </div>
                    <div id="dash-empty-stats" class="dash-empty hidden">
                        <div class="empty-icon">${ICONS.play}</div>
                        <p>Your telemetry will appear here after your first run.</p>
                        <p class="empty-sub">Press Start Game to launch.</p>
                    </div>
                </div>

                <!-- 2. Leaderboard panel -->
                <div id="dash-panel-leaderboard" class="dash-panel">
                    <div class="dash-heading-row">
                        <h2 class="dash-heading">Global Leaderboard (Top 10)</h2>
                        <button id="dash-lb-refresh" class="secondary-btn lb-refresh-btn" type="button">
                            ${ICONS.refresh}<span>Refresh</span>
                        </button>
                    </div>
                    <div id="dash-leaderboard-list" class="leaderboard-list">
                        <div class="history-loading">Loading…</div>
                    </div>
                </div>

                <!-- 3. Daily Missions panel (Dedicated Tab) -->
                <div id="dash-panel-missions" class="dash-panel">
                    <div class="dash-heading-row">
                        <h2 class="dash-heading">Daily Missions</h2>
                        <span class="missions-sub">Resets daily at midnight</span>
                    </div>
                    <div class="missions-wrap glass-panel">
                        <div id="dash-missions-list" class="missions-list"></div>
                    </div>
                </div>

                <!-- 4. Armory / Skins panel -->
                <div id="dash-panel-armory" class="dash-panel">
                    <div class="dash-heading-row">
                        <h2 class="dash-heading">Stickman Armory</h2>
                        <span id="armory-coin-balance" class="armory-balance">0 Coins</span>
                    </div>
                    <div id="dash-armory-grid" class="armory-grid"></div>
                </div>

                <!-- 5. History panel -->
                <div id="dash-panel-history" class="dash-panel">
                    <h2 class="dash-heading">Recent Games</h2>
                    <div id="dash-history-list" class="history-list">
                        <div class="history-loading">Loading…</div>
                    </div>
                    <button id="dash-load-more" class="secondary-btn load-more-btn hidden">Load More</button>
                </div>
            </main>
        </div>
    `;

    document.body.appendChild(_dashScreen);
    _spawnStars();
    _bindDashEvents();
    sound.syncMuteUI();
    const themeIconEl = document.querySelector('#dash-theme-btn .theme-icon');
    if (themeIconEl) {
        themeIconEl.innerHTML = isLight
            ? svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41"/>', 15)
            : svg('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>', 15);
    }
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
            } else if (item.dataset.panel === 'missions') {
                _renderDailyMissions(_cachedProfile);
            } else if (item.dataset.panel === 'armory') {
                _renderArmory(_cachedProfile);
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
        _cachedProfile = profile;

        _set('dash-best-score',  profile.bestScore    > 0 ? profile.bestScore.toLocaleString() : '—');
        _set('dash-prev-score',  profile.previousScore > 0 ? profile.previousScore.toLocaleString() : '—');
        _set('dash-total-games', profile.totalGames   > 0 ? profile.totalGames : '—');
        _set('dash-total-coins', profile.totalCoins   > 0 ? profile.totalCoins.toLocaleString() : '—');
        _totalGems = profile.totalGems || 0;
        _set('dash-total-gems', _totalGems.toLocaleString());
        _set('dash-high-stage',  profile.highestStage > 0 ? `Stage ${profile.highestStage}` : '—');
        _set('dash-total-time',  profile.totalSurvivalTime > 0
            ? _fmtTime(profile.totalSurvivalTime) : '—');

        // Daily Streak
        _currentStreak = profile.currentStreak || 0;
        const bestStreak = profile.bestStreak || 0;
        _set('dash-streak', _currentStreak > 0
            ? `${_currentStreak} Day${_currentStreak === 1 ? '' : 's'}${bestStreak > _currentStreak ? ` (Best ${bestStreak})` : ''}`
            : '0 Days');
        document.getElementById('dash-streak-badge')?.classList.toggle('hidden', _currentStreak < 3);

        // Selected World & Unlock status
        if (profile.selectedWorld && WORLDS.some(w => w.id === profile.selectedWorld)) {
            const wObj = WORLDS.find(w => w.id === profile.selectedWorld);
            if (isWorldUnlocked(wObj, profile.bestScore || 0, profile.totalCoins || 0, profile.unlockedWorlds)) {
                _selectedWorld = profile.selectedWorld;
                saveLocalWorldId(_selectedWorld);
            }
        }
        if (profile.selectedSkin && SKINS.some(s => s.id === profile.selectedSkin)) {
            _selectedSkin = profile.selectedSkin;
            saveLocalSkinId(_selectedSkin);
        }
        _renderWorldSelector(profile);
        _renderDailyMissions(profile);
        _renderArmory(profile);

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

// ── Render 4 Unlockable Worlds ────────────────────────────────────────────────
function _renderWorldSelector(profile) {
    const grid = document.getElementById('dash-world-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const bestScore = profile?.bestScore || 0;
    const totalCoins = profile?.totalCoins || 0;
    const unlockedList = profile?.unlockedWorlds || ['earth'];

    WORLDS.forEach(world => {
        const unlocked = isWorldUnlocked(world, bestScore, totalCoins, unlockedList);
        const selected = unlocked && _selectedWorld === world.id;

        const card = document.createElement('button');
        card.type = 'button';
        card.className = `world-card glass-panel${selected ? ' selected' : ''}${!unlocked ? ' locked' : ''}`;
        card.disabled = !unlocked;

        const top = document.createElement('div');
        top.className = 'world-card-top';
        top.textContent = `${world.icon} ${world.name}`;

        const sub = document.createElement('div');
        sub.className = 'world-card-sub';
        if (unlocked) {
            sub.textContent = selected ? `✓ ${world.twistLabel}` : world.twistLabel;
        } else {
            sub.textContent = `🔒 ${world.unlockScore.toLocaleString()} pts or ${world.unlockCoins} 🪙`;
        }

        card.appendChild(top);
        card.appendChild(sub);

        if (unlocked) {
            card.addEventListener('click', () => {
                _selectedWorld = world.id;
                saveLocalWorldId(world.id);
                if (_user) saveSelectedWorld(_user.uid, world.id);
                if (profile.selectedSkin && SKINS.some(s => s.id === profile.selectedSkin)) {
            _selectedSkin = profile.selectedSkin;
            saveLocalSkinId(_selectedSkin);
        }
        _renderWorldSelector(profile);
        _renderDailyMissions(profile);
        _renderArmory(profile);
            });
        }

        grid.appendChild(card);
    });
}

// ── Render 3 Daily Mini-Missions ──────────────────────────────────────────────
function _getLocalTodayStr() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function _renderDailyMissions(profile) {
    const list = document.getElementById('dash-missions-list');
    if (!list) return;
    list.innerHTML = '';

    const state = normalizeDailyMissions(profile?.dailyMissions, _getLocalTodayStr());

    MISSION_DEFS.forEach(m => {
        const prog = Math.min(m.target, state.progress[m.id] || 0);
        const done = Boolean(state.completed[m.id]);
        const pct = Math.round((prog / m.target) * 100);

        const row = document.createElement('div');
        row.className = `mission-row${done ? ' completed' : ''}`;

        const top = document.createElement('div');
        top.className = 'mission-top';

        const titleEl = document.createElement('span');
        titleEl.className = 'mission-title';
        titleEl.textContent = m.title;

        const rightEl = document.createElement('span');
        rightEl.className = done ? 'mission-done-badge' : 'mission-reward';
        rightEl.textContent = done ? '✓ Completed' : `+${m.reward} 🪙`;

        top.appendChild(titleEl);
        top.appendChild(rightEl);

        const barWrap = document.createElement('div');
        barWrap.className = 'mission-bar-row';

        const barOuter = document.createElement('div');
        barOuter.className = 'mission-bar-outer';
        const barFill = document.createElement('div');
        barFill.className = 'mission-bar-fill';
        barFill.style.width = `${pct}%`;
        barOuter.appendChild(barFill);

        const countEl = document.createElement('span');
        countEl.className = 'mission-count';
        countEl.textContent = `${prog}/${m.target}`;

        barWrap.appendChild(barOuter);
        barWrap.appendChild(countEl);

        row.appendChild(top);
        row.appendChild(barWrap);
        list.appendChild(row);
    });
}

// ── Render Stickman Armory / Skins Shop ───────────────────────────────────────
function _renderArmory(profile) {
    const grid = document.getElementById('dash-armory-grid');
    const balEl = document.getElementById('armory-coin-balance');
    if (!grid) return;

    const totalCoins = profile?.totalCoins || 0;
    const unlocked = new Set(Array.isArray(profile?.unlockedSkins) ? profile.unlockedSkins : ['cyan']);
    unlocked.add('cyan');

    if (balEl) balEl.textContent = `${totalCoins.toLocaleString()} Coins`;
    grid.innerHTML = '';

    SKINS.forEach(skin => {
        const isUnlocked = unlocked.has(skin.id) || skin.cost === 0;
        const isEquipped = isUnlocked && _selectedSkin === skin.id;
        const canAfford = totalCoins >= skin.cost;

        const card = document.createElement('div');
        card.className = `skin-card glass-panel${isEquipped ? ' equipped' : ''}`;

        const swatch = document.createElement('div');
        swatch.className = 'skin-swatch';
        swatch.style.background = `radial-gradient(circle, ${skin.bodyDark} 25%, ${skin.glow} 100%)`;
        swatch.style.boxShadow = `0 0 14px ${skin.glow}`;

        const info = document.createElement('div');
        info.className = 'skin-info';
        const nameEl = document.createElement('div');
        nameEl.className = 'skin-name';
        nameEl.textContent = skin.name;
        const descEl = document.createElement('div');
        descEl.className = 'skin-desc';
        descEl.textContent = skin.desc;
        info.appendChild(nameEl);
        info.appendChild(descEl);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = isEquipped ? 'secondary-btn skin-btn' : 'primary-btn skin-btn';

        if (isEquipped) {
            btn.textContent = '✓ Equipped';
            btn.disabled = true;
        } else if (isUnlocked) {
            btn.textContent = 'Equip';
            btn.addEventListener('click', async () => {
                _selectedSkin = skin.id;
                saveLocalSkinId(skin.id);
                if (_cachedProfile) _cachedProfile.selectedSkin = skin.id;
                _renderArmory(_cachedProfile);
                if (_user) await equipSkin(_user.uid, skin.id);
            });
        } else {
            btn.textContent = `Unlock (${skin.cost} 🪙)`;
            btn.disabled = !canAfford;
            btn.addEventListener('click', async () => {
                if (!_user || !canAfford) return;
                btn.disabled = true;
                btn.textContent = 'Unlocking…';
                try {
                    const res = await unlockAndEquipSkin(_user.uid, skin.id, skin.cost);
                    _selectedSkin = res.selectedSkin;
                    saveLocalSkinId(res.selectedSkin);
                    if (_cachedProfile) {
                        _cachedProfile.totalCoins = res.totalCoins;
                        _cachedProfile.unlockedSkins = res.unlockedSkins;
                        _cachedProfile.selectedSkin = res.selectedSkin;
                    }
                    _set('dash-total-coins', res.totalCoins > 0 ? res.totalCoins.toLocaleString() : '—');
                    _renderArmory(_cachedProfile);
                } catch (err) {
                    console.warn('[Armory] Unlock failed:', err.message);
                    _renderArmory(_cachedProfile);
                }
            });
        }

        card.appendChild(swatch);
        card.appendChild(info);
        card.appendChild(btn);
        grid.appendChild(card);
    });
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
