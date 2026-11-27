/* -------------------------------------------------------------
   SHOOTING STARS - Guided First-Run Tutorial
   4-step interactive tutorial that pauses briefly at key moments:
     1. Controls (Keyboard keys on Desktop / Touch buttons on Mobile)
     2. Dodge Falling Stars (when first hazard appears)
     3. Collect Coins & Energy (highlights Energy bar)
     4. Power-Ups & Gems (Magnet, Slow-Mo, 2x, Revive)
   Persists completion in localStorage ('shooting_stars_tutorial_done').
   ------------------------------------------------------------- */

const TUTORIAL_DONE_KEY = 'shooting_stars_tutorial_done';

export function isTutorialDone() {
    try {
        return localStorage.getItem(TUTORIAL_DONE_KEY) === 'true';
    } catch (e) {
        return false;
    }
}

export function markTutorialDone() {
    try {
        localStorage.setItem(TUTORIAL_DONE_KEY, 'true');
    } catch (e) {}
}

export function resetTutorial() {
    try {
        localStorage.removeItem(TUTORIAL_DONE_KEY);
    } catch (e) {}
}

export class TutorialManager {
    constructor({ onPauseChange, isTouchDevice }) {
        this.onPauseChange = onPauseChange;
        this.isTouchDevice = isTouchDevice;

        this.overlay = document.getElementById('tutorial-overlay');
        this.stepBadge = document.getElementById('tut-step-badge');
        this.titleEl = document.getElementById('tut-title');
        this.bodyEl = document.getElementById('tut-body');
        this.keysEl = document.getElementById('tut-keys-visual');
        this.nextBtn = document.getElementById('tut-next-btn');
        this.skipBtn = document.getElementById('tut-skip-btn');

        this.active = false;
        this.step = 0;       // 0 = idle, 1..4 = steps
        this.showing = false;
        this.elapsedSinceLastStep = 0;

        this._bindEvents();
    }

    _bindEvents() {
        this.nextBtn?.addEventListener('click', () => this._advanceFromStep());
        this.skipBtn?.addEventListener('click', () => this.skip());
    }

    start(force = false) {
        this.stop();
        if (!force && isTutorialDone()) {
            this.active = false;
            return;
        }
        this.active = true;
        this.step = 1;
        this.showing = false;
        this.elapsedSinceLastStep = 0;
    }

    stop() {
        this.active = false;
        this.step = 0;
        this.showing = false;
        this._clearHighlights();
        if (this.overlay) this.overlay.classList.add('hidden');
    }

    skip() {
        markTutorialDone();
        this.stop();
        if (this.onPauseChange) this.onPauseChange(false);
    }

    update(dt, hasHazard) {
        if (!this.active || this.showing) return;

        this.elapsedSinceLastStep += dt;

        if (this.step === 1 && this.elapsedSinceLastStep >= 0.25) {
            this._showStep(1);
        } else if (this.step === 2 && (hasHazard || this.elapsedSinceLastStep >= 2.2)) {
            this._showStep(2);
        } else if (this.step === 3 && this.elapsedSinceLastStep >= 2.4) {
            this._showStep(3);
        } else if (this.step === 4 && this.elapsedSinceLastStep >= 2.4) {
            this._showStep(4);
        }
    }

    _showStep(stepNum) {
        if (!this.overlay) return;
        this.showing = true;
        this._clearHighlights();

        const isTouch = typeof this.isTouchDevice === 'function' ? this.isTouchDevice() : false;

        if (stepNum === 1) {
            this.stepBadge.textContent = 'STEP 1 OF 4';
            this.titleEl.textContent = 'Controls';
            this.bodyEl.textContent = 'Move left/right, jump onto platforms, and crouch to dodge!';
            this.nextBtn.textContent = 'Next';
            if (isTouch) {
                this.keysEl.classList.add('hidden');
                document.getElementById('touch-controls')?.classList.add('tutorial-highlight');
            } else {
                this.keysEl.classList.remove('hidden');
            }
        } else if (stepNum === 2) {
            this.stepBadge.textContent = 'STEP 2 OF 4';
            this.titleEl.textContent = 'Watch Out!';
            this.bodyEl.textContent = 'Dodge falling shooting stars & asteroids — getting hit ends your run!';
            this.keysEl.classList.add('hidden');
            this.nextBtn.textContent = 'Got it';
        } else if (stepNum === 3) {
            this.stepBadge.textContent = 'STEP 3 OF 4';
            this.titleEl.textContent = 'Coins & Energy';
            this.bodyEl.textContent = 'Collect Coins to refill your Energy bar. Every 10 coins earns you a protective Shield!';
            this.keysEl.classList.add('hidden');
            this.nextBtn.textContent = 'Got it';
            document.getElementById('energy-hud')?.classList.add('tutorial-highlight');
        } else if (stepNum === 4) {
            this.stepBadge.textContent = 'STEP 4 OF 4';
            this.titleEl.textContent = 'Power-Ups & Gems';
            this.bodyEl.textContent = 'Grab glowing Power-Ups (Magnet, Slow-Mo, 2x) and rare Gems to Revive if you crash!';
            this.keysEl.classList.add('hidden');
            this.nextBtn.textContent = "Let's Play!";
        }

        this.overlay.classList.remove('hidden');
        if (this.onPauseChange) this.onPauseChange(true);
    }

    _advanceFromStep() {
        if (!this.showing) return;
        this.showing = false;
        this._clearHighlights();
        if (this.overlay) this.overlay.classList.add('hidden');

        if (this.step >= 4) {
            markTutorialDone();
            this.active = false;
            this.step = 0;
        } else {
            this.step += 1;
            this.elapsedSinceLastStep = 0;
        }

        if (this.onPauseChange) this.onPauseChange(false);
    }

    _clearHighlights() {
        document.getElementById('touch-controls')?.classList.remove('tutorial-highlight');
        document.getElementById('energy-hud')?.classList.remove('tutorial-highlight');
    }
}
