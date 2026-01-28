/**
 * Deepgram Service
 * Handles STT (transcription) and TTS (voice generation) with real-time streaming
 */

const https = require('https');

class DeepgramService {
  constructor() {
    this.apiKey = process.env.DEEPGRAM_API_KEY;
    this.baseUrl = 'https://api.deepgram.com/v1';

    if (!this.apiKey) {
      throw new Error('DEEPGRAM_API_KEY not configured');
    }
  }

  /**
   * Transcribe audio to text (STT)
   */
  async transcribeAudio(audioBuffer, options = {}) {
    const defaults = {
      model: 'nova-2',
      language: 'en',
      smart_format: true,
      vad: true,  // ✅ Voice Activity Detection - detects when speech starts/stops
      diarize: false,
      ...options
    };

    const queryParams = new URLSearchParams(defaults).toString();
    const url = `/listen?${queryParams}`;

    return this.makeRequest('POST', url, audioBuffer, 'audio/wav');
  }

  /**
   * Transcribe audio stream (real-time)
   */
  async transcribeStream(audioStream, options = {}) {
    const defaults = {
      model: 'nova-2',
      language: 'en',
      smart_format: true,
      vad: true,  // ✅ Voice Activity Detection - detects when speech starts/stops
      encoding: 'linear16',
      sample_rate: 16000,
      ...options
    };

    const queryParams = new URLSearchParams(defaults).toString();
    const url = `/listen?${queryParams}`;

    return this.streamRequest('POST', url, audioStream);
  }

  /**
   * Generate speech from text (TTS)
   */
  async synthesizeText(text, options = {}) {
    const defaults = {
      model: 'aura-asteria-en', // Deepgram's Aura voice
      encoding: 'mp3',
      ...options
    };

    const body = JSON.stringify({ text });
    const queryParams = new URLSearchParams(defaults).toString();
    const url = `/speak?${queryParams}`;

    return this.makeRequest('POST', url, body, 'application/json');
  }

  /**
   * Stream TTS (real-time voice generation)
   */
  async synthesizeStream(text, options = {}) {
    const defaults = {
      model: 'aura-asteria-en',
      encoding: 'mp3',
      ...options
    };

    const body = JSON.stringify({ text });
    const queryParams = new URLSearchParams(defaults).toString();
    const url = `/speak?${queryParams}`;

    return this.streamRequest('POST', url, body);
  }

  /**
   * Identify speaker (voice biometrics)
   */
  async identifySpeaker(audioBuffer, options = {}) {
    // Deepgram's speaker recognition
    const defaults = {
      model: 'nova-2',
      diarize: true, // Enable speaker diarization
      ...options
    };

    const queryParams = new URLSearchParams(defaults).toString();
    const url = `/listen?${queryParams}`;

    const result = await this.makeRequest('POST', url, audioBuffer, 'audio/wav');

    // Extract speaker info from diarization
    if (result.results?.channels?.[0]?.alternatives?.[0]?.words) {
      const speakers = new Set();
      result.results.channels[0].alternatives[0].words.forEach(word => {
        if (word.speaker !== undefined) {
          speakers.add(word.speaker);
        }
      });
      return {
        speakers: Array.from(speakers),
        speakerCount: speakers.size,
        transcript: result.results.channels[0].alternatives[0].transcript
      };
    }

    return null;
  }

  /**
   * Make HTTP request to Deepgram
   */
  async makeRequest(method, path, body, contentType = 'application/json') {
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl + path);

      const options = {
        method,
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Content-Type': contentType,
          'User-Agent': 'Novo-Avatar-Portal/1.0'
        }
      };

      if (typeof body === 'string' || Buffer.isBuffer(body)) {
        options.headers['Content-Length'] = Buffer.byteLength(body);
      }

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 400) {
            return reject(new Error(`Deepgram API error: ${res.statusCode} - ${data}`));
          }

          try {
            if (contentType.includes('json')) {
              resolve(JSON.parse(data));
            } else {
              // Return audio buffer
              resolve(Buffer.from(data));
            }
          } catch (err) {
            reject(new Error(`Failed to parse Deepgram response: ${data}`));
          }
        });
      });

      req.on('error', reject);

      if (body) {
        if (typeof body === 'string') {
          req.write(body);
        } else {
          req.write(body);
        }
      }

      req.end();
    });
  }

  /**
   * Stream request (for real-time applications)
   */
  async streamRequest(method, path, inputStream) {
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl + path);

      const options = {
        method,
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Transfer-Encoding': 'chunked',
          'User-Agent': 'Novo-Avatar-Portal/1.0'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 400) {
            return reject(new Error(`Deepgram API error: ${res.statusCode} - ${data}`));
          }

          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(new Error(`Failed to parse Deepgram response`));
          }
        });
      });

      req.on('error', reject);

      // Pipe input stream to request
      if (inputStream.pipe) {
        inputStream.pipe(req);
      } else {
        req.write(inputStream);
        req.end();
      }
    });
  }

  /**
   * Analyze audio for intelligence (emotion, intent, sentiment)
   */
  async analyzeAudio(audioBuffer, options = {}) {
    const defaults = {
      model: 'nova-2',
      language: 'en',
      smart_format: true,
      intents: true,
      sentiment: true,
      topics: true,
      ...options
    };

    const queryParams = new URLSearchParams(defaults).toString();
    const url = `/listen?${queryParams}`;

    return this.makeRequest('POST', url, audioBuffer, 'audio/wav');
  }

  /**
   * Real-time voice agent conversation
   */
  async startVoiceAgent(userId, agentConfig = {}) {
    const defaults = {
      model: 'nova-2',
      language: 'en',
      smart_format: true,
      diarize: false,
      ...agentConfig
    };

    // Voice Agent API endpoint
    const queryParams = new URLSearchParams(defaults).toString();
    const url = `/voice-agent?${queryParams}`;

    return this.streamRequest('POST', url, null);
  }

  /**
   * Get available voices
   */
  async getVoices() {
    return [
      { id: 'aura-asteria-en', name: 'Asteria', language: 'en', gender: 'female', style: 'warm' },
      { id: 'aura-luna-en', name: 'Luna', language: 'en', gender: 'female', style: 'professional' },
      { id: 'aura-stella-en', name: 'Stella', language: 'en', gender: 'female', style: 'energetic' },
      { id: 'aura-athena-en', name: 'Athena', language: 'en', gender: 'female', style: 'thoughtful' }
    ];
  }

  /**
   * Get supported languages
   */
  async getSupportedLanguages() {
    // Deepgram supports 100+ languages
    return [
      'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'nl', 'pl'
    ];
  }
}

module.exports = DeepgramService;
