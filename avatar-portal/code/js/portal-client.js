/**
 * Novo Avatar Portal Client
 * WebSocket connection to backend for real-time communication
 */

class PortalClient {
  constructor(backendUrl = null) {
    // Auto-detect backend URL based on current domain
    if (!backendUrl) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      backendUrl = `${protocol}//${host}`;
    }
    this.backendUrl = backendUrl;
    this.socket = null;
    this.userId = null;
    this.isConnected = false;
  }

  /**
   * Connect to backend
   */
  connect(userId, userName = 'Guest') {
    return new Promise((resolve, reject) => {
      try {
        // Use Socket.IO (requires socket.io-client library)
        if (typeof io !== 'undefined') {
          this.socket = io(this.backendUrl, {
            transports: ['polling', 'websocket'],  // Try polling first (more reliable through Nginx)
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5
          });

          this.socket.on('connect', () => {
            console.log(`✅ Connected to backend via ${this.socket.io.engine.transport.name}`);
            this.isConnected = true;

            // Send join event
            this.socket.emit('join', { userId, name: userName });
          });

          this.socket.on('session-started', (data) => {
            console.log('Session started:', data);
            this.userId = userId;
            resolve(data);
          });

          this.socket.on('error', (err) => {
            console.error('Socket error:', err);
            reject(err);
          });

          this.socket.on('disconnect', () => {
            console.log('Disconnected from backend');
            this.isConnected = false;
          });
        } else {
          reject(new Error('Socket.IO client not loaded'));
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Send text message
   */
  sendText(text, emotion = 'neutral') {
    if (!this.socket || !this.isConnected) {
      throw new Error('Not connected to backend');
    }

    return new Promise((resolve) => {
      this.socket.emit('text-message', {
        userId: this.userId,
        text,
        emotion
      });

      // Listen for response
      this.socket.once('response-complete', () => {
        resolve();
      });
    });
  }

  /**
   * Send audio chunk (streaming)
   * Called continuously during microphone capture
   */
  sendAudioChunk(pcm16Uint8Array) {
    if (!this.socket || !this.isConnected) {
      console.warn('Not connected to backend, dropping audio chunk');
      return;
    }

    try {
      // Convert Uint8Array to base64 for Socket.IO transmission
      let binary = '';
      for (let i = 0; i < pcm16Uint8Array.length; i++) {
        binary += String.fromCharCode(pcm16Uint8Array[i]);
      }
      const base64 = btoa(binary);
      
      // Emit to backend with correct event and field names
      this.socket.emit('audio-stream', {
        chunk: base64  // Backend expects 'chunk', not 'audioData'
      });
    } catch (err) {
      console.error('Failed to send audio chunk:', err);
    }
  }

  /**
   * Send audio blob (for backwards compatibility)
   */
  async sendAudio(audioBlob) {
    if (!this.socket || !this.isConnected) {
      throw new Error('Not connected to backend');
    }

    return new Promise(async (resolve, reject) => {
      try {
        // Convert blob to base64
        const reader = new FileReader();
        reader.onload = () => {
          const base64Audio = reader.result.split(',')[1]; // Remove data: prefix
          
          this.socket.emit('audio-chunk', {
            userId: this.userId,
            audioData: base64Audio
          });

          // Wait for response
          this.socket.once('response-complete', () => {
            resolve();
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Set emotion
   */
  setEmotion(emotion) {
    if (!this.socket || !this.isConnected) {
      throw new Error('Not connected to backend');
    }

    this.socket.emit('set-emotion', {
      userId: this.userId,
      emotion
    });
  }

  /**
   * Listen for phoneme updates
   */
  onPhonemeSequence(callback) {
    if (this.socket) {
      this.socket.on('phoneme-sequence', (data) => {
        callback(data.phonemes);
      });
    }
  }

  /**
   * Listen for text response
   */
  onTextResponse(callback) {
    if (this.socket) {
      this.socket.on('text-response', (data) => {
        callback(data.text);
      });
    }
  }

  /**
   * Listen for transcription
   */
  onTranscription(callback) {
    if (this.socket) {
      this.socket.on('transcription', (data) => {
        callback(data.text, data.confidence);
      });
    }
  }

  /**
   * Listen for response start
   */
  onResponseStart(callback) {
    if (this.socket) {
      this.socket.on('response-start', (data) => {
        callback(data.emotion);
      });
    }
  }

  /**
   * Disconnect
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.isConnected = false;
    }
  }
}

// Expose globally
window.PortalClient = PortalClient;
