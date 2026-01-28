/**
 * ElevenLabs TTS Service
 * High-quality voice synthesis with Lisa voice
 */

const https = require('https');

class ElevenLabsTTSService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.elevenlabs.io/v1';
    this.voiceId = '6kx3BlgoKqbjD35DFpnN'; // Lisa - Warm, Playful and Inviting

    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY not configured');
    }
  }

  /**
   * Synthesize text to speech using Lisa voice
   */
  async synthesizeText(text) {
    return new Promise((resolve, reject) => {
      if (!text || text.trim().length === 0) {
        reject(new Error('Text cannot be empty'));
        return;
      }

      const url = `${this.baseUrl}/text-to-speech/${this.voiceId}`;

      const options = {
        hostname: 'api.elevenlabs.io',
        path: `/v1/text-to-speech/${this.voiceId}`,
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
      };

      const payload = JSON.stringify({
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.75,
          similarity_boost: 0.85,
        },
      });

      const req = https.request(options, (res) => {
        const chunks = [];

        res.on('data', (chunk) => {
          chunks.push(chunk);
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            // Combine binary chunks and convert to base64
            const audioBuffer = Buffer.concat(chunks);
            const audioBase64 = audioBuffer.toString('base64');
            resolve(audioBase64);
          } else {
            const errorData = Buffer.concat(chunks).toString();
            try {
              const error = JSON.parse(errorData);
              reject(
                new Error(
                  `ElevenLabs API error: ${error.detail?.message || error.error || 'Unknown error'}`
                )
              );
            } catch {
              reject(new Error(`ElevenLabs API error (${res.statusCode}): ${errorData}`));
            }
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`ElevenLabs connection error: ${err.message}`));
      });

      req.write(payload);
      req.end();
    });
  }
}

module.exports = ElevenLabsTTSService;
