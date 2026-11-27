/* -------------------------------------------------------------
   SHOOTING STARS - Sound Synthesizer (Web Audio API)
   Zero external asset dependencies; crisp retro sound generation
   + Funny stickman cartoon sounds for movement, jump, coins, death
   ------------------------------------------------------------- */

const MUTE_STORAGE_KEY = 'shooting_stars_muted';

class SoundManager {
    constructor() {
        this.ctx = null;
        this.muted = this._loadMuted();
        this.initialized = false;

        // Cooldown system — prevent sound spam
        this.moveSoundCooldown = 0;
        this.MOVE_SOUND_INTERVAL = 0.45; // seconds between movement sounds
        this.lastMoveSoundTime = 0;

        // Coin combo tracking
        this.coinComboCount = 0;
        this.lastCoinTime = 0;

        // Track active nodes (to limit overlap)
        this.activeNodes = 0;
        this.MAX_NODES = 12;
        this.rageBaitUtterance = null;
    }

    _loadMuted() {
        try {
            return localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
        } catch (e) {
            return false;
        }
    }

    _saveMuted() {
        try {
            localStorage.setItem(MUTE_STORAGE_KEY, this.muted ? 'true' : 'false');
        } catch (e) {}
    }

    init() {
        if (this.initialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            // Warm master bus: gentle low-pass filter + balanced gain
            this.masterFilter = this.ctx.createBiquadFilter();
            this.masterFilter.type = 'lowpass';
            this.masterFilter.frequency.setValueAtTime(2800, this.ctx.currentTime);
            this.masterFilter.Q.setValueAtTime(0.7, this.ctx.currentTime);

            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);

            this.masterFilter.connect(this.masterGain);
            this.masterGain.connect(this.ctx.destination);
            this.initialized = true;
        } catch (e) {
            console.warn("Web Audio API not supported", e);
        }
    }

    /** Destination node for all synth voices (falls back to ctx.destination). */
    _out() {
        return this.masterFilter || this.ctx?.destination;
    }

    ensureAudioContext() {
        if (!this.initialized) {
            this.init();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.muted) this.stopRageBaitSpeech();
        this._saveMuted();
        this.syncMuteUI();
        return this.muted;
    }

    /** Sync all mute toggle buttons across HUD and Dashboard. */
    syncMuteUI() {
        const icon = this.muted ? '🔇' : '🔊';
        const label = this.muted ? 'Sound Off' : 'Sound On';
        document.querySelectorAll('[data-mute-icon]').forEach(el => {
            el.textContent = icon;
        });
        document.querySelectorAll('[data-mute-label]').forEach(el => {
            el.textContent = label;
        });
        const hudIcon = document.getElementById('audio-icon');
        if (hudIcon) hudIcon.textContent = icon;
    }

    /** Helper: Create and connect a warm oscillator with smooth ADSR envelope */
    _makeOsc(type, freq, gainVal, duration, detune = 0, delay = 0) {
        if (!this.ctx) return null;
        if (this.activeNodes >= this.MAX_NODES) return null;
        this.activeNodes++;

        const start = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, start);
        if (detune) osc.detune.setValueAtTime(detune, start);

        // Smooth attack (12ms) and exponential release (no harsh clicks)
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(gainVal, start + Math.min(0.014, duration * 0.25));
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

        osc.connect(gain);
        gain.connect(this._out());

        osc.start(start);
        osc.stop(start + duration + 0.01);
        osc.onended = () => { this.activeNodes = Math.max(0, this.activeNodes - 1); };
        return { osc, gain, start };
    }

    /** ===================== ORIGINAL SOUNDS ===================== */

    playJump() {
        if (this.muted) return;
        this.ensureAudioContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        const pitchShift = (Math.random() - 0.5) * 30;

        // Soft upward whoosh (filtered noise + smooth sine sweep)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220 + pitchShift, t);
        osc.frequency.exponentialRampToValueAtTime(580 + pitchShift, t + 0.14);
        gain.gain.setValueAtTime(0.01, t);
        gain.gain.linearRampToValueAtTime(0.18, t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.19);

        // Subtle airy whoosh layer
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.14);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(600, t);
        filter.frequency.exponentialRampToValueAtTime(1800, t + 0.14);
        filter.Q.value = 1.8;
        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.09, t);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        noise.connect(filter);
        filter.connect(nGain);
        nGain.connect(this.ctx.destination);
        noise.start(t);
        noise.stop(t + 0.14);
    }

    playImpact() {
        if (this.muted) return;
        this.ensureAudioContext();
        if (!this.ctx) return;

        // Noise buffer for explosion crunch
        const bufferSize = this.ctx.sampleRate * 0.25;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.25);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        // Sub oscillator for punchy low-end impact thud
        const osc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(160, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(34, this.ctx.currentTime + 0.32);

        subGain.gain.setValueAtTime(0.6, this.ctx.currentTime);
        subGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.34);

        osc.connect(subGain);
        subGain.connect(this.ctx.destination);

        noise.start();
        osc.start();
        noise.stop(this.ctx.currentTime + 0.25);
        osc.stop(this.ctx.currentTime + 0.35);
    }

    playCrack() {
        if (this.muted) return;
        this.ensureAudioContext();
        if (!this.ctx) return;

        const voice = this._makeOsc('triangle', 150, 0.16, 0.14);
        if (voice) {
            voice.osc.frequency.exponentialRampToValueAtTime(55, voice.start + 0.13);
        }
    }

    playLevelUp() {
        if (this.muted) return;
        this.ensureAudioContext();
        if (!this.ctx) return;

        // Short celebratory synth arpeggio (C5 - E5 - G5 - C6)
        const notes = [523.25, 659.25, 783.99, 1046.50];
        const t = this.ctx.currentTime;
        notes.forEach((freq, idx) => {
            const start = t + idx * 0.065;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, start);

            gain.gain.setValueAtTime(0.001, start);
            gain.gain.linearRampToValueAtTime(0.18, start + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.24);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(start);
            osc.stop(start + 0.25);
        });
    }

    playWarning() {
        if (this.muted) return;
        this.ensureAudioContext();
        if (!this.ctx) return;

        this._makeOsc('triangle', 523.25, 0.09, 0.11, 0, 0);
        this._makeOsc('triangle', 659.25, 0.09, 0.14, 0, 0.09);
    }

    /** ===================== WARM ARCADE FOOTSTEPS ===================== */

    playMoveSound(now, cadence = 1.0) {
        if (this.muted) return;
        const effectiveInterval = this.MOVE_SOUND_INTERVAL / Math.max(0.3, cadence);
        if (now - this.lastMoveSoundTime < effectiveInterval) return;
        this.lastMoveSoundTime = now;
        this.ensureAudioContext();
        if (!this.ctx) return;

        // Subtle, warm soft tap (no harsh sawtooth/square buzz)
        const base = 240 + (Math.random() - 0.5) * 40;
        const voice = this._makeOsc('sine', base, 0.045, 0.075);
        if (voice) {
            voice.osc.frequency.exponentialRampToValueAtTime(base * 0.65, voice.start + 0.07);
        }
    }

    /**
     * "Coin collect!" — bright chime whose pitch rises with consecutive coins
     */
    playCoin() {
        if (this.muted) return;
        this.ensureAudioContext();
        if (!this.ctx) return;

        const now = performance.now() / 1000;
        if (now - this.lastCoinTime < 2.6) {
            this.coinComboCount = Math.min(10, this.coinComboCount + 1);
        } else {
            this.coinComboCount = 0;
        }
        this.lastCoinTime = now;

        const t = this.ctx.currentTime;
        const comboBoost = this.coinComboCount * 55;
        const baseFreq = 920 + comboBoost;

        // Crisp primary chime
        const osc1 = this.ctx.createOscillator();
        const g1 = this.ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(baseFreq, t);
        osc1.frequency.setValueAtTime(baseFreq * 1.33, t + 0.055);
        g1.gain.setValueAtTime(0.22, t);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc1.connect(g1); g1.connect(this.ctx.destination);
        osc1.start(t); osc1.stop(t + 0.23);

        // Harmonic sparkle overtone
        const osc2 = this.ctx.createOscillator();
        const g2 = this.ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(baseFreq * 2, t + 0.05);
        g2.gain.setValueAtTime(0.08, t + 0.05);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc2.connect(g2); g2.connect(this.ctx.destination);
        osc2.start(t + 0.05); osc2.stop(t + 0.21);
    }

    /**
     * "Shield earned!" — satisfying power-up hum/chord
     */
    playShieldEarned() {
        if (this.muted) return;
        this.ensureAudioContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        const chord = [392.00, 493.88, 587.33, 783.99]; // G4, B4, D5, G5
        chord.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = i === 0 ? 'triangle' : 'sine';
            osc.frequency.setValueAtTime(freq * 0.9, t);
            osc.frequency.exponentialRampToValueAtTime(freq, t + 0.12);
            g.gain.setValueAtTime(0.001, t);
            g.gain.linearRampToValueAtTime(0.12, t + 0.06);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.48);
            osc.connect(g);
            g.connect(this.ctx.destination);
            osc.start(t);
            osc.stop(t + 0.5);
        });
    }

    playRageBaitReaction(reaction, _dialogue = '') {
        if (this.muted) return;
        this.ensureAudioContext();
        if (!this.ctx) return;
        this._playRageBaitTone(reaction);
    }

    stopRageBaitSpeech() {
        this.rageBaitUtterance = null;
    }

    _playRageBaitTone(reaction) {
        if (this.muted || !this.ctx) return;

        const phrases = {
            appear:    [523.25, 659.25],
            escaped:   [440.00, 329.63],
            collected: [659.25, 987.77],
            laugh:     [587.33, 493.88],
            close:     [783.99, 587.33]
        }[reaction];
        if (!phrases) return;

        this._makeOsc('sine', phrases[0], 0.08, 0.12, 0, 0);
        this._makeOsc('triangle', phrases[1], 0.07, 0.16, 0, 0.08);
    }

    /**
     * "Whoa!" or "Yikes!" — surprised near-miss sound
     */
    playNearMiss() {
        if (this.muted) return;
        this.ensureAudioContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        const variant = Math.random() < 0.5;

        if (variant) {
            // "Whoa" — falling tone
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, t);
            osc.frequency.exponentialRampToValueAtTime(200, t + 0.25);
            g.gain.setValueAtTime(0.18, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
            osc.connect(g); g.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + 0.28);
        } else {
            // "Yikes" — fast up-down
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(400, t);
            osc.frequency.exponentialRampToValueAtTime(700, t + 0.08);
            osc.frequency.exponentialRampToValueAtTime(300, t + 0.2);
            g.gain.setValueAtTime(0.15, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
            osc.connect(g); g.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + 0.22);
        }
    }

    /**
     * Warm descending arcade game-over cue (smooth sine/triangle, no harsh buzz)
     */
    playWomp() {
        if (this.muted) return;
        this.ensureAudioContext();
        if (!this.ctx) return;

        const notes = [329.63, 293.66, 246.94, 196.00]; // E4 -> D4 -> B3 -> G3
        notes.forEach((freq, idx) => {
            this._makeOsc('triangle', freq, 0.13, 0.22, 0, idx * 0.11);
            this._makeOsc('sine', freq * 0.5, 0.10, 0.26, 0, idx * 0.11);
        });
    }

    /**
     * Update cooldown timers — call once per frame from game loop.
     * @param {number} dt - delta time in seconds
     */
    updateTimers(dt) {
        // Currently cooldown is time-based via lastMoveSoundTime comparisons
    }
}

export const sound = new SoundManager();
