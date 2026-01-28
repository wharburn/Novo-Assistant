/**
 * Deepgram Flux Service - Using Official SDK
 * Proper Flux connection using @deepgram/sdk v4
 * 
 * CRITICAL: The SDK wraps a WebSocket. Messages come via events.
 */

const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');

class DeepgramFluxSDK {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('DEEPGRAM_API_KEY is required');
    }
    this.apiKey = apiKey;
    this.client = createClient(apiKey);
    this.messageHandler = null;
    this.connection = null;
  }

  /**
   * Connect to Flux WebSocket and return connection object
   * The SDK handles the WebSocket under the hood.
   */
  async connect(options = {}) {
    try {
      const defaults = {
        model: 'flux-general-en',
        encoding: 'linear16',
        sample_rate: 16000,
        eot_threshold: 0.7,
        eot_timeout_ms: 5000,
        tag: 'novo-portal',
        ...options
      };

      console.log(`🔗 Connecting to Deepgram Flux (SDK)...`);
      console.log(`   Model: ${defaults.model}`);
      console.log(`   Encoding: ${defaults.encoding}`);
      console.log(`   Sample rate: ${defaults.sample_rate}`);
      console.log(`   EOT Threshold: ${defaults.eot_threshold}`);

      // Use official SDK to connect to Flux
      // This returns a connection object that wraps the WebSocket
      const connection = await this.client.listen.live({
        model: defaults.model,
        encoding: defaults.encoding,
        sample_rate: defaults.sample_rate,
        eot_threshold: defaults.eot_threshold,
        eot_timeout_ms: defaults.eot_timeout_ms
      });

      console.log(`✅ Flux connected (SDK)`);

      // Set up event handlers ON THE CONNECTION
      if (connection) {
        // The SDK emits events as the connection processes
        connection.on(LiveTranscriptionEvents.Open, () => {
          console.log(`🔌 Flux WebSocket opened`);
        });

        connection.on(LiveTranscriptionEvents.Transcript, (msg) => {
          // Flux sends transcript events here
          if (msg && msg.type === 'Transcript') {
            console.log(`📝 Flux transcript: "${msg.channel?.alternatives?.[0]?.transcript}"`);
            if (this.messageHandler) {
              this.messageHandler({
                event: 'Update',
                transcript: msg.channel?.alternatives?.[0]?.transcript,
                end_of_turn_confidence: 0
              });
            }
          }
        });

        connection.on(LiveTranscriptionEvents.UtteranceEnd, (msg) => {
          // This is Flux's EndOfTurn equivalent
          console.log(`🛑 Flux: UtteranceEnd`);
          if (this.messageHandler) {
            this.messageHandler({
              event: 'EndOfTurn',
              transcript: msg.channel?.alternatives?.[0]?.transcript || '',
              end_of_turn_confidence: 1.0
            });
          }
        });

        connection.on(LiveTranscriptionEvents.Error, (err) => {
          console.error(`❌ Flux error: ${err.message}`);
          if (this.messageHandler) {
            this.messageHandler({
              event: 'error',
              error: err.message
            });
          }
        });

        connection.on(LiveTranscriptionEvents.Close, () => {
          console.log(`🔌 Flux WebSocket closed`);
        });
      }

      // Store connection for later use
      this.connection = connection;

      return {
        ws: connection,  // For compatibility
        connection,
        send: (audioBuffer) => {
          try {
            if (connection && connection.send) {
              connection.send(audioBuffer);
            }
          } catch (err) {
            console.error(`Failed to send audio to Flux: ${err.message}`);
          }
        },
        close: () => {
          try {
            if (connection && connection.finalize) {
              connection.finalize();
            }
          } catch (err) {
            console.error(`Failed to close Flux connection: ${err.message}`);
          }
        }
      };
    } catch (err) {
      console.error(`❌ Flux connection failed:`);
      console.error(`   Error: ${err.message}`);
      console.error(`   Stack: ${err.stack?.substring(0, 200)}`);
      throw new Error(`Flux connection failed: ${err.message}`);
    }
  }

  /**
   * Set message handler for Flux events
   */
  setMessageHandler(handler) {
    this.messageHandler = handler;
  }
}

module.exports = DeepgramFluxSDK;
