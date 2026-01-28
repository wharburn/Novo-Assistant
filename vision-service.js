/**
 * Vision Service
 * Analyzes video frames for face detection, emotion, and identity
 */

const https = require('https');

class VisionService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY not configured for vision');
    }
  }

  /**
   * Analyze frame for faces and emotions
   */
  async analyzeFrame(base64Image) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        model: 'gpt-4-vision',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              },
              {
                type: 'text',
                text: 'Analyze this image. Return JSON with: {faces: number, emotions: [emotion names], confidence: 0-1, description: "brief"}'
              }
            ]
          }
        ],
        max_tokens: 100
      });

      const options = {
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.choices?.[0]?.message?.content) {
              const content = result.choices[0].message.content;
              // Parse the JSON response
              const analysisMatch = content.match(/\{[\s\S]*\}/);
              if (analysisMatch) {
                resolve(JSON.parse(analysisMatch[0]));
              } else {
                resolve({
                  faces: 0,
                  emotions: [],
                  confidence: 0,
                  description: 'Unable to analyze'
                });
              }
            } else {
              reject(new Error('Invalid API response'));
            }
          } catch (err) {
            reject(err);
          }
        });
      });

      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  /**
   * Simple face detection (fallback - uses frame analysis)
   */
  async detectFace(base64Image) {
    try {
      const analysis = await this.analyzeFrame(base64Image);
      return {
        faceDetected: analysis.faces > 0,
        faceCount: analysis.faces,
        emotion: analysis.emotions?.[0] || 'neutral',
        confidence: analysis.confidence
      };
    } catch (err) {
      console.error('Face detection error:', err);
      return {
        faceDetected: false,
        faceCount: 0,
        emotion: 'unknown',
        confidence: 0
      };
    }
  }

  /**
   * Analyze emotional state from frame
   */
  async detectEmotion(base64Image) {
    try {
      const analysis = await this.analyzeFrame(base64Image);
      return {
        primaryEmotion: analysis.emotions?.[0] || 'neutral',
        allEmotions: analysis.emotions || [],
        confidence: analysis.confidence
      };
    } catch (err) {
      console.error('Emotion detection error:', err);
      return {
        primaryEmotion: 'neutral',
        allEmotions: [],
        confidence: 0
      };
    }
  }
}

module.exports = VisionService;
