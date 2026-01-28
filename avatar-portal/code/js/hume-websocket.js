/**
 * Hume AI WebSocket Streaming
 * Real-time emotion detection from camera feed
 */

class HumeWebSocketStream {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.wsEndpoint = 'wss://api.hume.ai/v0/stream/models/face';
    this.socket = null;
    this.isConnected = false;
  }

  /**
   * Connect to Hume WebSocket stream
   */
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        // WebSocket URL with API key as query param (browser limitation)
        const url = `${this.wsEndpoint}?api_key=${this.apiKey}`;
        
        this.socket = new WebSocket(url);

        this.socket.onopen = () => {
          console.log('✅ Connected to Hume WebSocket');
          this.isConnected = true;
          
          // Send configuration
          const config = {
            models: {
              face: {}
            }
          };
          this.socket.send(JSON.stringify(config));
          resolve();
        };

        this.socket.onerror = (err) => {
          console.error('❌ Hume WebSocket error:', err);
          reject(err);
        };

        this.socket.onclose = () => {
          console.log('Hume WebSocket closed');
          this.isConnected = false;
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Send image frame for real-time analysis
   */
  sendFrame(base64Image, onEmotions) {
    if (!this.isConnected) {
      console.warn('WebSocket not connected');
      return;
    }

    // Set up listener for this request
    const messageHandler = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.face && data.face.predictions && data.face.predictions[0]) {
          const emotions = {};
          const pred = data.face.predictions[0];
          
          if (pred.emotions) {
            pred.emotions.forEach(emotion => {
              emotions[emotion.name.toLowerCase().replace(/\s+/g, '_')] = emotion.score;
            });
          }
          
          onEmotions(emotions);
        }
      } catch (err) {
        console.error('Error parsing Hume response:', err);
      }
    };

    this.socket.onmessage = messageHandler;

    // Send the frame
    const message = {
      data: base64Image
    };
    this.socket.send(JSON.stringify(message));
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.isConnected = false;
    }
  }
}

// Export globally
window.HumeWebSocketStream = HumeWebSocketStream;
