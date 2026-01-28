/**
 * Real-Time Audio Streaming
 * Captures microphone input and streams to backend
 */

class AudioStreamer {
  constructor(onAudioChunk = null) {
    this.audioContext = null;
    this.mediaStream = null;
    this.processor = null;
    this.isStreaming = false;
    this.onAudioChunk = onAudioChunk;
    this.sampleRate = 16000;
    // Flux recommends 80ms chunks: 16000 * 0.08 = 1280 samples
    // Must be power of 2: use 1024 (64ms) or 2048 (128ms)
    // 1024 is close to 80ms, better latency
    this.bufferSize = 1024;
  }

  /**
   * Start streaming microphone audio
   */
  async start() {
    try {
      // Get microphone access (relaxed constraints for compatibility)
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: {ideal: true},
          noiseSuppression: {ideal: true},
          autoGainControl: {ideal: true}
        }
      });

      // Create audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: this.sampleRate
      });

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      // Create script processor for real-time audio processing
      this.processor = this.audioContext.createScriptProcessor(this.bufferSize, 1, 1);

      this.processor.onaudioprocess = (event) => {
        const audioData = event.inputBuffer.getChannelData(0);
        
        // Convert float32 to PCM16
        const pcm16 = this.float32ToPcm16(audioData);
        
        // Send to server
        if (this.onAudioChunk) {
          this.onAudioChunk(pcm16);
        }
      };

      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      this.isStreaming = true;
      console.log('Audio streaming started');
      return true;
    } catch (err) {
      console.error('Microphone access denied:', err);
      throw err;
    }
  }

  /**
   * Stop streaming
   */
  stop() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }
    if (this.processor) {
      this.processor.disconnect();
    }
    this.isStreaming = false;
    console.log('Audio streaming stopped');
  }

  /**
   * Convert Float32 to PCM16 (16-bit signed)
   */
  float32ToPcm16(float32Array) {
    const pcm16 = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    // Return as Uint8Array (bytes) not ArrayBuffer
    return new Uint8Array(pcm16.buffer);
  }

  /**
   * Get audio level (for visual feedback)
   */
  getAudioLevel() {
    if (!this.audioContext || !this.processor) return 0;
    const analyser = this.audioContext.createAnalyser();
    this.processor.connect(analyser);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    return dataArray.reduce((a, b) => a + b) / dataArray.length / 255;
  }
}

// Export for use in browser
window.AudioStreamer = AudioStreamer;
