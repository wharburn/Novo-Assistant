/**
 * Deepgram Flux Service
 * Real-time speech-to-text with end-of-turn detection
 * Optimized for voice agents (Novo Portal)
 */

const WebSocket = require('ws');

class DeepgramFluxService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    // CRITICAL: Flux requires /v2/listen (NOT /v1/listen)
    // /v1/listen does NOT support Flux model
    this.baseUrl = 'wss://api.deepgram.com/v2/listen';
    
    if (!apiKey) {
      throw new Error('DEEPGRAM_API_KEY not configured');
    }
  }

  /**
   * Connect to Flux streaming endpoint
   * Returns promise that resolves with WebSocket and handlers
   */
  connect(options = {}) {
    return new Promise((resolve, reject) => {
      try {
        // Flux v2/listen ONLY accepts these parameters:
        // - model (required)
        // - encoding (required)
        // - sample_rate (required)
        // - eot_threshold (optional)
        // - eager_eot_threshold (optional)
        // - eot_timeout_ms (optional)
        // DO NOT include: channels, language, smart_format, utterances, vad, tag
        const defaults = {
          model: 'flux-general-en',
          encoding: 'linear16',
          sample_rate: 16000,
          eot_threshold: 0.7,
          eot_timeout_ms: 5000,
          ...options
        };

        // Build WebSocket URL using URLSearchParams for proper encoding
        const url = new URL(this.baseUrl);
        
        // Add each parameter to the query string (NOT the API key!)
        url.searchParams.append('model', defaults.model);
        url.searchParams.append('encoding', defaults.encoding);
        url.searchParams.append('sample_rate', String(defaults.sample_rate));
        url.searchParams.append('eot_threshold', String(defaults.eot_threshold));
        url.searchParams.append('eot_timeout_ms', String(defaults.eot_timeout_ms));
        
        // Only add eager_eot_threshold if provided in options
        if (options.eager_eot_threshold !== undefined) {
          url.searchParams.append('eager_eot_threshold', String(options.eager_eot_threshold));
        }
        
        // API key goes in Authorization header, not URL!

        console.log(`🔗 Connecting to Deepgram Flux WebSocket...`);
        // Log URL without API key for security
        const safeUrl = url.toString().replace(this.apiKey, '***');
        console.log(`   URL: ${safeUrl}`);
        console.log(`   Params:`, {
          model: defaults.model,
          encoding: defaults.encoding,
          sample_rate: defaults.sample_rate,
          eot_threshold: defaults.eot_threshold,
          eot_timeout_ms: defaults.eot_timeout_ms,
          ...( options.eager_eot_threshold ? { eager_eot_threshold: options.eager_eot_threshold } : {} )
        });
        
        // Use Authorization header, not URL query param for API key
        const ws = new WebSocket(url.toString(), {
          headers: {
            'Authorization': `Token ${this.apiKey}`
          }
        });
        let messageCount = 0;

        ws.on('open', () => {
          console.log(`✅ Connected to Deepgram Flux`);
          resolve({
            ws,
            send: (audioBuffer) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(audioBuffer);
              }
            },
            close: () => {
              ws.close();
            }
          });
        });

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            messageCount++;

            // Track Flux state machine events
            if (message.event === 'StartOfTurn') {
              console.log(`🎤 Flux: StartOfTurn - user began speaking`);
            } else if (message.event === 'Update') {
              // Partial transcription - don't log every one
              if (messageCount % 5 === 0) {
                console.log(`📝 Flux: Update - "${message.transcript?.substring(0, 50)}..."`);
              }
            } else if (message.event === 'EagerEndOfTurn') {
              console.log(`⚡ Flux: EagerEndOfTurn (medium confidence) - "${message.transcript}"`);
            } else if (message.event === 'TurnResumed') {
              console.log(`🔄 Flux: TurnResumed - user continuing to speak`);
            } else if (message.event === 'EndOfTurn') {
              console.log(`🛑 Flux: EndOfTurn (high confidence) - "${message.transcript}"`);
              console.log(`   Confidence: ${(message.end_of_turn_confidence * 100).toFixed(0)}%`);
            } else if (message.event === 'Connected') {
              console.log(`✅ Flux: Connected message received`);
            } else {
              console.log(`📨 Flux: Unknown event type "${message.event}"`);
            }

            // Emit to caller's handler
            if (this.messageHandler) {
              this.messageHandler(message);
            }
          } catch (err) {
            // Binary data, ignore
          }
        });

        ws.on('error', (err) => {
          console.error(`❌ Deepgram Flux WebSocket error:`, err);
          console.error(`   Message: ${err.message}`);
          console.error(`   Code: ${err.code}`);
          reject(new Error(`Flux connection failed: ${err.message}`));
        });

        ws.on('close', () => {
          console.log(`🔌 Deepgram Flux connection closed`);
        });

      } catch (err) {
        console.error(`Failed to connect to Flux:`, err.message);
        reject(err);
      }
    });
  }

  /**
   * Set message handler callback
   */
  setMessageHandler(handler) {
    this.messageHandler = handler;
  }
}

module.exports = DeepgramFluxService;
