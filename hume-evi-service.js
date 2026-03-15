/**
 * Hume EVI (Empathic Voice Interface) Service
 * Integrates Hume's voice-based emotion detection and empathic responses
 * using the official Hume SDK
 *
 * Features:
 * - Real-time emotion detection from voice prosody
 * - WebSocket streaming for low-latency interaction
 * - 48+ emotion dimensions
 * - Empathic response generation
 */

const { HumeClient } = require('hume');

class HumeEVIService {
  constructor(apiKey, secretKey, configId) {
    this.apiKey = apiKey;
    this.configId = configId;

    if (!apiKey) {
      throw new Error('Hume API key is required');
    }

    // Initialize Hume client with API key
    this.client = new HumeClient({
      apiKey: this.apiKey,
    });

    console.log('✅ Hume EVI Service initialized with SDK');
  }

  /**
   * Connect to Hume EVI WebSocket for real-time emotion detection
   * Returns WebSocket connection and event handlers using the official Hume SDK
   */
  async connect(options = {}) {
    try {
      console.log('🔑 Connecting to Hume EVI with SDK...');
      if (this.configId) {
        console.log(`   Using config ID: ${this.configId}`);
      } else {
        console.log('   No config ID - using default configuration');
      }

      // Connect using the official Hume SDK
      const connectOptions = {};

      if (this.configId) {
        connectOptions.configId = this.configId;
      }

      // Add dynamic variables required by the EVI config
      connectOptions.sessionSettings = {
        variables: {
          user_name: options.user_name || 'Guest',
          user_email: options.user_email || 'guest@example.com',
          is_returning_user:
            options.is_returning_user !== undefined ? options.is_returning_user : false,
          visit_count: options.visit_count !== undefined ? parseInt(options.visit_count) : 1,
          vision_enabled: options.vision_enabled !== undefined ? options.vision_enabled : false,
        },
      };

      console.log('   Connect options:', JSON.stringify(connectOptions, null, 2));
      const socket = await this.client.empathicVoice.chat.connect(connectOptions);
      console.log('   Socket object created, waiting for open event...');

      // Wait for the socket to actually open before returning
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Hume socket open timeout after 10 seconds'));
        }, 10000);

        socket.on('open', () => {
          clearTimeout(timeout);
          console.log('✅ Hume EVI socket opened and ready');
          resolve();
        });

        socket.on('error', (err) => {
          clearTimeout(timeout);
          console.error('❌ Hume socket error during open:', err);
          reject(err);
        });

        socket.on('close', () => {
          clearTimeout(timeout);
          console.log('🔌 Hume socket closed before opening');
          reject(new Error('Socket closed before opening'));
        });
      });

      // Now socket is open and ready
      return {
        socket,
        sendAudio: (audioBuffer) => {
          try {
            // Convert Buffer to base64
            const base64Audio = audioBuffer.toString('base64');
            socket.sendAudioInput({ data: base64Audio });
          } catch (err) {
            console.error('Error sending audio to Hume:', err);
          }
        },
        sendMessage: (text) => {
          try {
            socket.sendUserInput({ text });
          } catch (err) {
            console.error('Error sending message to Hume:', err);
          }
        },
        close: () => {
          socket.close();
        },
      };
    } catch (err) {
      throw new Error(`Failed to connect to Hume EVI: ${err.message}`);
    }
  }

  /**
   * Analyze audio for emotions using Hume's prosody model
   */
  async analyzeAudioEmotions(audioBuffer) {
    return new Promise((resolve, reject) => {
      const base64Audio = audioBuffer.toString('base64');
      const payload = JSON.stringify({
        models: {
          prosody: {},
        },
        raw_text: false,
        data: base64Audio,
      });

      const options = {
        hostname: this.baseUrl,
        path: '/v0/batch/jobs',
        method: 'POST',
        headers: {
          'X-Hume-Api-Key': this.apiKey,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200 || res.statusCode === 201) {
            try {
              const response = JSON.parse(data);
              resolve(response);
            } catch (err) {
              reject(new Error('Failed to parse emotion response'));
            }
          } else {
            reject(new Error(`Emotion analysis failed: ${res.statusCode} - ${data}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`Emotion analysis error: ${err.message}`));
      });

      req.write(payload);
      req.end();
    });
  }

  /**
   * Parse emotion data from Hume response
   */
  parseEmotions(humeResponse) {
    const emotions = {};

    if (humeResponse.prosody && humeResponse.prosody.predictions) {
      const predictions = humeResponse.prosody.predictions;

      if (predictions.length > 0 && predictions[0].emotions) {
        predictions[0].emotions.forEach((emotion) => {
          emotions[emotion.name] = emotion.score;
        });
      }
    }

    return emotions;
  }

  /**
   * Get dominant emotion from emotion scores
   */
  getDominantEmotion(emotions) {
    let dominant = 'neutral';
    let maxScore = 0;

    Object.keys(emotions).forEach((emotion) => {
      if (emotions[emotion] > maxScore) {
        maxScore = emotions[emotion];
        dominant = emotion;
      }
    });

    return {
      emotion: dominant,
      confidence: maxScore,
    };
  }

  /**
   * Map Hume's 48+ emotions to avatar's 6 emotion states
   */
  mapToAvatarEmotion(humeEmotions) {
    const emotionMapping = {
      happy: ['joy', 'amusement', 'excitement', 'contentment', 'satisfaction'],
      sad: ['sadness', 'disappointment', 'grief', 'despair'],
      angry: ['anger', 'annoyance', 'contempt', 'disgust'],
      thinking: ['concentration', 'contemplation', 'confusion', 'realization'],
      suspicious: ['distrust', 'doubt', 'skepticism'],
      neutral: ['calmness', 'tiredness', 'boredom'],
    };

    let maxScore = 0;
    let avatarEmotion = 'neutral';

    Object.keys(emotionMapping).forEach((avatarState) => {
      const humeEmotionNames = emotionMapping[avatarState];
      let totalScore = 0;

      humeEmotionNames.forEach((humeName) => {
        if (humeEmotions[humeName]) {
          totalScore += humeEmotions[humeName];
        }
      });

      if (totalScore > maxScore) {
        maxScore = totalScore;
        avatarEmotion = avatarState;
      }
    });

    return {
      emotion: avatarEmotion,
      confidence: maxScore,
      rawEmotions: humeEmotions,
    };
  }
}

module.exports = HumeEVIService;
