/**
 * Hume AI Integration
 * Real-time emotion detection from facial expressions
 * 
 * Usage:
 * const hume = new HumeAIIntegration(accessToken);
 * const emotions = await hume.analyzeFrame(imageData);
 * // Returns: { joy: 0.85, sadness: 0.02, anger: 0.01, ... }
 */

class HumeAIIntegration {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.apiEndpoint = 'https://api.hume.ai/v0/stream/models/face';
    this.emotionThreshold = 0.1;
    
    if (!accessToken) {
      console.warn('⚠️ Hume AI access token not configured');
    }
  }

  /**
   * Analyze a single frame for emotions
   * @param {Blob|ArrayBuffer|base64String} imageData - Image to analyze
   * @returns {Promise<Object>} - Emotion scores (0-1)
   */
  async analyzeFrame(imageData) {
    if (!this.accessToken) {
      console.error('❌ Hume AI token not configured');
      return this.getDefaultEmotions();
    }

    try {
      const formData = new FormData();
      
      // Convert different input formats
      if (typeof imageData === 'string') {
        // Base64 string
        const blob = this.base64ToBlob(imageData);
        formData.append('file', blob, 'frame.jpg');
      } else if (imageData instanceof Blob) {
        formData.append('file', imageData, 'frame.jpg');
      } else if (imageData instanceof ArrayBuffer) {
        const blob = new Blob([imageData], { type: 'image/jpeg' });
        formData.append('file', blob, 'frame.jpg');
      }

      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Hume API error: ${response.status}`);
      }

      const data = await response.json();
      return this.parseEmotions(data);
    } catch (err) {
      console.error('Hume AI analysis failed:', err.message);
      return this.getDefaultEmotions();
    }
  }

  /**
   * Parse Hume API response into emotion scores
   */
  parseEmotions(data) {
    const emotions = {
      joy: 0,
      sadness: 0,
      anger: 0,
      surprise: 0,
      fear: 0,
      disgust: 0,
      contempt: 0,
      neutral: 0.5
    };

    if (data.face && data.face.predictions && data.face.predictions[0]) {
      const prediction = data.face.predictions[0];
      
      // Map Hume emotions to our format
      if (prediction.emotions) {
        Object.keys(prediction.emotions).forEach(emotion => {
          const score = prediction.emotions[emotion];
          if (emotions.hasOwnProperty(emotion)) {
            emotions[emotion] = score;
          }
        });
      }
    }

    return emotions;
  }

  /**
   * Determine dominant emotion
   */
  getDominantEmotion(emotions) {
    let dominant = 'neutral';
    let maxScore = 0;

    Object.keys(emotions).forEach(emotion => {
      if (emotions[emotion] > maxScore) {
        maxScore = emotions[emotion];
        dominant = emotion;
      }
    });

    return {
      emotion: dominant,
      confidence: maxScore
    };
  }

  /**
   * Get default emotions (neutral)
   */
  getDefaultEmotions() {
    return {
      joy: 0,
      sadness: 0,
      anger: 0,
      surprise: 0,
      fear: 0,
      disgust: 0,
      contempt: 0,
      neutral: 1
    };
  }

  /**
   * Convert base64 string to Blob
   */
  base64ToBlob(base64, mimeType = 'image/jpeg') {
    // Handle data: URL format
    if (base64.startsWith('data:')) {
      base64 = base64.split(',')[1];
    }

    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  /**
   * Stream camera frames for continuous emotion detection
   */
  async startEmotionStream(videoElement, onEmotionChange) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    const frameInterval = setInterval(async () => {
      if (videoElement.paused) {
        clearInterval(frameInterval);
        return;
      }

      ctx.drawImage(videoElement, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg', 0.7);

      try {
        const emotions = await this.analyzeFrame(imageData);
        const dominant = this.getDominantEmotion(emotions);

        if (onEmotionChange) {
          onEmotionChange({
            emotions,
            dominant: dominant.emotion,
            confidence: dominant.confidence
          });
        }
      } catch (err) {
        console.error('Stream analysis failed:', err);
      }
    }, 1000); // Analyze every second

    return frameInterval;
  }
}

// Export for Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HumeAIIntegration;
} else if (typeof window !== 'undefined') {
  window.HumeAIIntegration = HumeAIIntegration;
}
