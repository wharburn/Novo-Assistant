/**
 * Real-Time Camera Streaming
 * Captures video and streams frames for vision AI processing
 */

class CameraStreamer {
  constructor(onFrameCapture = null) {
    this.video = null;
    this.canvas = null;
    this.mediaStream = null;
    this.isStreaming = false;
    this.onFrameCapture = onFrameCapture;
    this.frameRate = 5; // 5 FPS for real-time (balances latency vs bandwidth)
    this.intervalId = null;
  }

  /**
   * Start camera streaming
   */
  async start(videoElement = null) {
    try {
      // Get camera access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
          facingMode: 'user'
        }
      });

      // Setup video element
      if (videoElement) {
        this.video = videoElement;
        this.video.srcObject = this.mediaStream;
        await this.video.play();
      } else {
        this.video = document.createElement('video');
        this.video.srcObject = this.mediaStream;
        this.video.style.display = 'none';
        document.body.appendChild(this.video);
        await this.video.play();
      }

      // Setup canvas for frame capture
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.video.videoWidth || 320;
      this.canvas.height = this.video.videoHeight || 240;

      // Start frame capture loop
      this.startFrameCapture();

      this.isStreaming = true;
      console.log('Camera streaming started');
      return true;
    } catch (err) {
      console.error('Camera access denied:', err);
      throw err;
    }
  }

  /**
   * Capture frames at specified rate
   */
  startFrameCapture() {
    const frameInterval = 1000 / this.frameRate;

    this.intervalId = setInterval(() => {
      if (!this.isStreaming || !this.video) return;

      try {
        const ctx = this.canvas.getContext('2d');
        ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

        // Get frame as JPEG blob
        this.canvas.toBlob((blob) => {
          if (this.onFrameCapture) {
            this.onFrameCapture(blob);
          }
        }, 'image/jpeg', 0.7); // 70% quality for faster transmission
      } catch (err) {
        console.error('Frame capture error:', err);
      }
    }, frameInterval);
  }

  /**
   * Stop camera streaming
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }
    this.isStreaming = false;
    console.log('Camera streaming stopped');
  }

  /**
   * Get current frame as base64
   */
  getFrameBase64() {
    if (!this.video) return null;
    
    const ctx = this.canvas.getContext('2d');
    ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    
    return this.canvas.toDataURL('image/jpeg', 0.7);
  }

  /**
   * Display camera feed in UI
   */
  attachToElement(elementId) {
    const element = document.getElementById(elementId);
    if (element && this.video) {
      element.appendChild(this.video);
      this.video.style.display = 'block';
      this.video.style.width = '100%';
      this.video.style.borderRadius = '8px';
    }
  }
}

window.CameraStreamer = CameraStreamer;
