/**
 * Avatar Sprite Engine
 * Phoneme-based animation with eye blinking
 */

class AvatarEngine {
  constructor(canvasId, assetsPath = '/assets') {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas?.getContext('2d');
    this.assetsPath = assetsPath;

    // Sprite cache
    this.spriteCache = {};

    // Current state
    this.currentEmotion = 'neutral';
    this.currentPhoneme = 'closed';
    this.currentEyeState = 'base';
    this.isBlinking = false;

    // Timing
    this.phonemeSequence = [];
    this.currentPhonemeIndex = 0;
    this.blinkInterval = null;
    this.blinkDuration = 100; // ms
    this.blinkFrequency = 4000; // ms between blinks
    this.animationInterval = null; // Track animation for cancellation
    this.isAnimating = false; // Track animation state

    // Available emotions and phonemes
    this.emotions = ['neutral', 'happy', 'thinking', 'sad', 'angry', 'suspicious'];
    this.phonemes = ['ai', 'e', 'o', 'closed', 'mbp', 'ldt', 'fv', 'wq'];
    this.eyeStates = ['base', 'closed', 'half'];

    this.init();
  }

  init() {
    if (!this.canvas) {
      console.error('Canvas element not found');
      return;
    }

    // Set canvas size
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Start blink cycle
    this.startBlinking();

    // Load initial sprite
    this.loadSprite(this.currentEmotion, this.currentPhoneme, this.currentEyeState);
  }

  resizeCanvas() {
    // Make canvas responsive
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.draw();
  }

  /**
   * Load and cache sprite image
   */
  async loadSprite(emotion, phoneme, eyeState) {
    const key = `${emotion}_${phoneme}_${eyeState}`;

    if (this.spriteCache[key]) {
      return this.spriteCache[key];
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.spriteCache[key] = img;
        resolve(img);
      };
      img.onerror = () => {
        console.warn(`Failed to load sprite: ${key}`);
        reject(new Error(`Sprite not found: ${key}`));
      };

      // Try to load from assets
      img.src = `${this.assetsPath}/${emotion}/${emotion}/${phoneme}${eyeState === 'base' ? '' : '_' + eyeState}.png`;
    });
  }

  /**
   * Draw current sprite on canvas
   */
  async draw() {
    if (!this.ctx) return;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    try {
      const img = await this.loadSprite(
        this.currentEmotion,
        this.currentPhoneme,
        this.currentEyeState
      );

      // Draw sprite centered, scaled to fit canvas
      const scale = Math.min(this.canvas.width / img.width, this.canvas.height / img.height);
      const x = (this.canvas.width - img.width * scale) / 2;
      const y = (this.canvas.height - img.height * scale) / 2;

      this.ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
    } catch (err) {
      // Draw placeholder
      this.drawPlaceholder();
    }
  }

  /**
   * Draw placeholder if sprite fails to load
   */
  drawPlaceholder() {
    this.ctx.fillStyle = '#f0f0f0';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.fillStyle = '#999';
    this.ctx.font = '16px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(
      `${this.currentEmotion} / ${this.currentPhoneme}`,
      this.canvas.width / 2,
      this.canvas.height / 2
    );
  }

  /**
   * Set emotion (neutral, happy, thinking, sad, angry, fearful)
   */
  setEmotion(emotion) {
    if (this.emotions.includes(emotion)) {
      this.currentEmotion = emotion;
      this.draw();
    }
  }

  /**
   * Set phoneme directly
   */
  setPhoneme(phoneme) {
    if (this.phonemes.includes(phoneme)) {
      this.currentPhoneme = phoneme;
      this.draw();
    }
  }

  /**
   * Animate through phoneme sequence with timing
   */
  async animatePhonemeSequence(sequence, audioEl) {
    // Stop any existing animation first
    this.stopAnimation();

    this.phonemeSequence = sequence;
    this.currentPhonemeIndex = 0;
    this.isAnimating = true;

    if (!audioEl) {
      // No audio, animate at fixed pace using interval (so it can be interrupted)
      let phonemeIndex = 0;
      this.animationInterval = setInterval(() => {
        if (!this.isAnimating || phonemeIndex >= sequence.length) {
          clearInterval(this.animationInterval);
          this.animationInterval = null;
          this.isAnimating = false;
          this.setPhoneme('closed');
          return;
        }

        this.setPhoneme(sequence[phonemeIndex]);
        phonemeIndex++;
      }, 150); // 150ms per phoneme
      return;
    }

    // Sync with audio playback
    const startTime = audioEl.currentTime;
    audioEl.play();

    this.animationInterval = setInterval(() => {
      if (!this.isAnimating) {
        clearInterval(this.animationInterval);
        this.animationInterval = null;
        this.setPhoneme('closed');
        return;
      }

      const elapsed = (audioEl.currentTime - startTime) * 1000;
      const phonemeIndex = Math.floor(elapsed / 150); // 150ms per phoneme

      if (phonemeIndex >= sequence.length || audioEl.ended) {
        clearInterval(this.animationInterval);
        this.animationInterval = null;
        this.isAnimating = false;
        this.setPhoneme('closed'); // Reset to closed mouth
        this.draw();
        return;
      }

      if (phonemeIndex !== this.currentPhonemeIndex) {
        this.setPhoneme(sequence[phonemeIndex]);
        this.currentPhonemeIndex = phonemeIndex;
      }
    }, 20); // Update every 20ms
  }

  /**
   * Stop any ongoing animation immediately
   */
  stopAnimation() {
    this.isAnimating = false;

    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }

    // Reset to closed mouth
    this.setPhoneme('closed');
    this.draw();
  }

  /**
   * Start natural blinking cycle
   */
  startBlinking() {
    this.blinkInterval = setInterval(() => {
      this.blink();
    }, this.blinkFrequency);
  }

  /**
   * Single blink animation
   */
  async blink() {
    // Blink: open → half → closed → half → open
    const sequence = ['base', 'half', 'closed', 'half', 'base'];
    const originalEyeState = this.currentEyeState;

    for (let state of sequence) {
      this.currentEyeState = state;
      this.draw();
      await this.sleep(this.blinkDuration / sequence.length);
    }

    this.currentEyeState = originalEyeState;
    this.draw();
  }

  /**
   * Stop blinking
   */
  stopBlinking() {
    if (this.blinkInterval) {
      clearInterval(this.blinkInterval);
      this.blinkInterval = null;
    }
  }

  /**
   * Utility: sleep for ms
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Quick test: cycle through phonemes
   */
  testPhonemes() {
    let index = 0;
    const testInterval = setInterval(() => {
      if (index < this.phonemes.length) {
        this.setPhoneme(this.phonemes[index++]);
      } else {
        clearInterval(testInterval);
      }
    }, 200);
  }

  /**
   * Preload all sprites for current emotion
   */
  async preloadEmotion(emotion) {
    const promises = [];
    for (let phoneme of this.phonemes) {
      for (let eyeState of this.eyeStates) {
        promises.push(
          this.loadSprite(emotion, phoneme, eyeState).catch((err) =>
            console.warn(`Could not preload ${emotion}/${phoneme}/${eyeState}`)
          )
        );
      }
    }
    await Promise.all(promises);
    console.log(`Preloaded emotion: ${emotion}`);
  }
}

// Export for use in HTML
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AvatarEngine;
}
