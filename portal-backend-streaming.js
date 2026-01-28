/**
 * Streaming Response Handler
 * Handles real-time audio streaming and response generation
 */

const DeepgramService = require('./deepgram-service');

class StreamingHandler {
  constructor(socket, deepgram, phonemeConverter) {
    this.socket = socket;
    this.deepgram = deepgram;
    this.phonemeConverter = phonemeConverter;
    this.audioBuffer = Buffer.alloc(0);
    this.lastTranscription = '';
    this.isProcessing = false;
  }

  /**
   * Handle incoming audio stream chunk
   */
  async handleAudioChunk(audioChunk) {
    try {
      // Append to buffer
      this.audioBuffer = Buffer.concat([this.audioBuffer, audioChunk]);

      // When we have enough audio (e.g., 500ms), send to Deepgram
      if (this.audioBuffer.length > 8000) { // ~500ms at 16kHz
        await this.processAudioBuffer();
        this.audioBuffer = Buffer.alloc(0); // Clear buffer
      }
    } catch (err) {
      console.error('Audio chunk error:', err);
      this.socket.emit('error', { message: err.message });
    }
  }

  /**
   * Process buffered audio
   */
  async processAudioBuffer() {
    if (this.isProcessing || this.audioBuffer.length === 0) return;
    
    this.isProcessing = true;

    try {
      // Transcribe audio buffer
      const result = await this.deepgram.transcribeAudio(this.audioBuffer);
      
      if (result.results?.channels?.[0]?.alternatives?.[0]) {
        const transcript = result.results.channels[0].alternatives[0].transcript;
        const confidence = result.results.channels[0].alternatives[0].confidence;

        // Only emit if new transcription
        if (transcript !== this.lastTranscription) {
          this.lastTranscription = transcript;
          
          this.socket.emit('transcription-partial', {
            text: transcript,
            confidence,
            isFinal: false
          });

          // If high confidence, consider it final
          if (confidence > 0.9) {
            this.socket.emit('transcription-final', {
              text: transcript,
              confidence
            });

            // Generate response
            await this.generateResponse(transcript);
          }
        }
      }
    } catch (err) {
      console.error('Transcription error:', err);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Generate and stream response
   */
  async generateResponse(userText) {
    try {
      // Get response from bridge (which routes to Novo in main session)
      const bridgeResponse = await this.getResponseFromBridge(userText);
      const responseText = bridgeResponse.text || 'I heard you, but I need a moment to think.';
      const emotion = bridgeResponse.emotion || 'neutral';

      console.log(`🤖 Novo response: "${responseText}" (emotion: ${emotion})`);

      // Convert to phonemes for avatar animation sync
      const phonemes = this.phonemeConverter.textToPhonemes(responseText);

      // Stream response start
      this.socket.emit('response-start', { emotion });
      
      // Stream phoneme sequence (for avatar mouth animation)
      this.socket.emit('phoneme-sequence', { phonemes });
      
      // Stream text
      this.socket.emit('text-response', { text: responseText });

      // Generate voice via Deepgram TTS
      try {
        const audioData = await this.deepgram.synthesizeText(responseText);
        if (audioData) {
          this.socket.emit('audio-response', { 
            audioBase64: audioData,
            emotion 
          });
        }
      } catch (err) {
        console.warn('TTS failed, continuing without audio:', err.message);
      }

      this.socket.emit('response-complete');

    } catch (err) {
      console.error('Response generation error:', err);
      this.socket.emit('error', { message: err.message });
    }
  }

  /**
   * Call bridge to get response from Novo
   */
  async getResponseFromBridge(userText) {
    return new Promise((resolve) => {
      const http = require('http');
      
      const postData = JSON.stringify({
        userId: this.socket.id || 'portal-user',
        text: userText,
        emotion: 'neutral'
      });

      const options = {
        hostname: 'localhost',
        port: 3002,
        path: '/message',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = http.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            resolve({
              text: response.response || response.text,
              emotion: response.emotion || 'neutral'
            });
          } catch (err) {
            console.error('Bridge response parse error:', err);
            resolve({
              text: 'Sorry, I had trouble understanding. Can you say that again?',
              emotion: 'thinking'
            });
          }
        });
      });

      req.on('error', (err) => {
        console.error('Bridge connection error:', err.message);
        resolve({
          text: 'I\'m having trouble connecting. Give me a moment.',
          emotion: 'thinking'
        });
      });

      req.write(postData);
      req.end();
    });
  }
}

module.exports = StreamingHandler;
