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
            this.initialized = true;
        } catch (e) {
            console.warn("Web Audio API not supported", e);
        }
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

    /** Helper: Create and connect a basic oscillator node */
    _makeOsc(type, freq, gainVal, duration, detune = 0) {
        if (!this.ctx) return null;
        if (this.activeNodes >= this.MAX_NODES) return null;
        this.activeNodes++;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (detune) osc.detune.setValueAtTime(detune, this.ctx.currentTime);
        gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + duration);
        osc.onended = () => { this.activeNodes = Math.max(0, this.activeNodes - 1); };
        return { osc, gain };
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

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, this.ctx.currentTime);
        osc.frequency.setValueAtTime(60, this.ctx.currentTime + 0.08);

        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.12);
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

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(440, this.ctx.currentTime);
        osc.frequency.setValueAtTime(880, this.ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }

    /** ===================== NEW FUNNY CARTOON SOUNDS ===================== */

    /**
     * Play a random funny movement sound.
     * Called with cooldown tracking to avoid spam.
     * @param {number} now    - current time in seconds (performance.now() / 1000)
     * @param {number} cadence - energy cadence multiplier (0–1); lower = less frequent sounds
     */
    playMoveSound(now, cadence = 1.0) {
        if (this.muted) return;
        // Extend interval when tired (cadence < 1) → fewer foot sounds
        const effectiveInterval = this.MOVE_SOUND_INTERVAL / Math.max(0.3, cadence);
        if (now - this.lastMoveSoundTime < effectiveInterval) return;
        this.lastMoveSoundTime = now;
        this.ensureAudioContext();
        if (!this.ctx) return;

        const variant = Math.floor(Math.random() * 5);
        const pitchShift = (Math.random() - 0.5) * 80;
        const t = this.ctx.currentTime;

        switch (variant) {
            case 0: // "Boop-boop!" — two quick pops
                this._boopBoop(t, pitchShift);
                break;
            case 1: // "Nyoom!" — fast swipe
                this._nyoom(t, pitchShift);
                break;
            case 2: // "Blblbl!" — stuttered lips
                this._blblbl(t, pitchShift);
                break;
            case 3: // "Weee!" — rising whine
                this._weee(t, pitchShift);
                break;
            case 4: // "Brrrup!" — rolling growl
                this._brrrup(t, pitchShift);
                break;
        }
    }

    _boopBoop(t, shift) {
        [0, 0.12].forEach((delay, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440 + shift + i * 80, t + delay);
            osc.frequency.exponentialRampToValueAtTime(320 + shift + i * 60, t + delay + 0.07);
            gain.gain.setValueAtTime(0.16, t + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.1);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t + delay); osc.stop(t + delay + 0.1);
        });
    }

    _nyoom(t, shift) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600 + shift, t);
        osc.frequency.exponentialRampToValueAtTime(120 + shift, t + 0.18);
        gain.gain.setValueAtTime(0.14, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(t); osc.stop(t + 0.2);
    }

    _blblbl(t, shift) {
        for (let i = 0; i < 4; i++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(300 + shift + i * 20, t + i * 0.05);
            gain.gain.setValueAtTime(0.1, t + i * 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.05 + 0.04);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t + i * 0.05); osc.stop(t + i * 0.05 + 0.05);
        }
    }

    _weee(t, shift) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(280 + shift, t);
        osc.frequency.exponentialRampToValueAtTime(760 + shift, t + 0.22);
        gain.gain.setValueAtTime(0.16, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(t); osc.stop(t + 0.25);
    }

    _brrrup(t, shift) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        // LFO-style amplitude modulation using a second osc connected to gain
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220 + shift, t);
        osc.frequency.exponentialRampToValueAtTime(180 + shift, t + 0.18);
        gain.gain.setValueAtTime(0.14, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        // Add a quick wobble via detune oscillation
        osc.detune.setValueAtTime(0, t);
        osc.detune.linearRampToValueAtTime(400, t + 0.05);
        osc.detune.linearRampToValueAtTime(-200, t + 0.12);
        osc.detune.linearRampToValueAtTime(0, t + 0.2);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(t); osc.stop(t + 0.22);
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

    playRageBaitReaction(reaction, dialogue = '') {
        if (this.muted) return;
        this.ensureAudioContext();
        if (!this.ctx && (!window.speechSynthesis || !window.SpeechSynthesisUtterance)) return;

        if ((reaction === 'escaped' || reaction === 'collected') && this.rageBaitUtterance) {
            this.stopRageBaitSpeech();
        }
        if (dialogue && this._speakRageBait(dialogue, reaction)) return;
        this._playRageBaitTone(reaction);
    }

    _speakRageBait(dialogue, reaction) {
        if (this.rageBaitUtterance) return true;
        const synthesis = window.speechSynthesis;
        const Utterance = window.SpeechSynthesisUtterance;
        if (!synthesis || !Utterance || synthesis.speaking) return false;

        try {
            const utterance = new Utterance(dialogue);
            utterance.lang = 'en-US';
            utterance.rate = 1.12;
            utterance.pitch = 1.18;
            utterance.volume = 0.72;
            const voices = typeof synthesis.getVoices === 'function' ? synthesis.getVoices() : [];
            const englishVoice = voices.find(voice =>
                voice.lang && voice.lang.toLowerCase().startsWith('en')
            );
            if (englishVoice) utterance.voice = englishVoice;
            this.rageBaitUtterance = utterance;
            utterance.onend = () => {
                if (this.rageBaitUtterance === utterance) this.rageBaitUtterance = null;
            };
            utterance.onerror = () => {
                if (this.rageBaitUtterance !== utterance) return;
                this.rageBaitUtterance = null;
                if (!this.muted) this._playRageBaitTone(reaction);
            };
            synthesis.speak(utterance);
            return true;
        } catch (error) {
            this.rageBaitUtterance = null;
            this._playRageBaitTone(reaction);
            return true;
        }
    }

    stopRageBaitSpeech() {
        const utterance = this.rageBaitUtterance;
        this.rageBaitUtterance = null;
        if (!utterance) return;
        const synthesis = window.speechSynthesis;
        if (synthesis) synthesis.cancel();
    }

    _playRageBaitTone(reaction) {
        if (this.muted) return;
        this.ensureAudioContext();
        if (!this.ctx) return;

        const notes = {
            appear: [560, 390],
            escaped: [420, 230],
            collected: [760, 1120],
            laugh: [740, 610],
            close: [880, 540]
        }[reaction];
        if (!notes) return;

        const first = this._makeOsc('triangle', notes[0], 0.11, 0.16);
        this._makeOsc('sine', notes[1], 0.09, 0.2);
        if (first) {
            first.osc.frequency.exponentialRampToValueAtTime(
                notes[1],
                this.ctx.currentTime + 0.16
            );
        }
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
     * "Womp-womp!" — cartoon death/loss sound
     */
    playWomp() {
        if (this.muted) return;
        this.ensureAudioContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;

        // Trombone-style descending "waaah"
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(380, t);
        osc.frequency.exponentialRampToValueAtTime(260, t + 0.2);
        osc.frequency.exponentialRampToValueAtTime(180, t + 0.45);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.7);
        g.gain.setValueAtTime(0.28, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.75);

        // Low-pass filter for trombone warmth
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, t);
        filter.frequency.exponentialRampToValueAtTime(200, t + 0.7);

        osc.connect(filter);
        filter.connect(g);
        g.connect(this.ctx.destination);
        osc.start(t); osc.stop(t + 0.75);

        // Second "womp" at lower pitch
        setTimeout(() => {
            if (!this.ctx) return;
            const t2 = this.ctx.currentTime;
            const osc2 = this.ctx.createOscillator();
            const g2 = this.ctx.createGain();
            osc2.type = 'sawtooth';
            osc2.frequency.setValueAtTime(260, t2);
            osc2.frequency.exponentialRampToValueAtTime(100, t2 + 0.55);
            g2.gain.setValueAtTime(0.25, t2);
            g2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.6);
            const f2 = this.ctx.createBiquadFilter();
            f2.type = 'lowpass'; f2.frequency.value = 800;
            osc2.connect(f2); f2.connect(g2); g2.connect(this.ctx.destination);
            osc2.start(t2); osc2.stop(t2 + 0.6);
        }, 350);
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
