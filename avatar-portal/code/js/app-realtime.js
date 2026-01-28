/**
 * Novo Avatar Portal - Real-Time Conversation Mode
 * Always-on streaming voice interaction
 */

class AvatarPortalRealtime {
  constructor() {
    this.avatar = new AvatarEngine('avatarCanvas', '../assets');
    this.converter = new PhonemeConverter();
    this.client = typeof PortalClient !== 'undefined' ? new PortalClient() : null;
    this.audioStreamer = null;
    this.cameraStreamer = null;
    
    // DOM elements
    this.startBtn = document.getElementById('recordBtn');
    this.stopBtn = document.getElementById('stopBtn');
    this.textInput = document.getElementById('textInput');
    this.transcript = document.getElementById('transcript');
    this.status = document.getElementById('status');
    this.emotionLabel = document.getElementById('emotionLabel');
    this.emotionButtons = document.querySelectorAll('.emotion-btn');

    // State
    this.isStreaming = false;
    this.queuedAudio = null;  // Audio waiting to play
    this.audioInteractionSetup = false;
    this.userId = this.generateUserId();
    this.isConnected = false;
    this.currentEmotion = 'neutral';
    this.cameraEnabled = false;
    this.hume = null;
    this.humeBatch = null;

    this.init();
  }

  generateUserId() {
    let userId = localStorage.getItem('novo_user_id');
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('novo_user_id', userId);
    }
    return userId;
  }

  init() {
    this.startBtn.innerHTML = '🎤 Start Talking';
    this.stopBtn.innerHTML = '⏹ Stop';

    // Set up audio interaction (needed for browser autoplay policy)
    if (!this.audioInteractionSetup) {
      document.addEventListener('click', () => {
        if (this.queuedAudio) {
          console.log('🎤 User clicked, playing queued audio...');
          this.playAudio(this.queuedAudio);
          this.queuedAudio = null;
        }
      }, { once: true });
      this.audioInteractionSetup = true;
    }

    this.startBtn.addEventListener('click', () => this.startStreaming());
    this.stopBtn.addEventListener('click', () => this.stopStreaming());

    // Add camera toggle button
    const cameraToggle = document.createElement('button');
    cameraToggle.id = 'cameraToggle';
    cameraToggle.className = 'btn btn-secondary';
    cameraToggle.innerHTML = '📷 Enable Camera';
    cameraToggle.addEventListener('click', () => this.toggleCamera());
    this.startBtn.parentElement.insertBefore(cameraToggle, this.stopBtn);
    this.cameraToggle = cameraToggle;

    this.emotionButtons.forEach(btn => {
      btn.addEventListener('click', (e) => this.handleEmotionChange(e));
    });

    this.avatar.preloadEmotion('neutral');
    this.connectToBackend();
    
    this.showStatus('Ready to talk! Click "Start Talking" to begin...', 'info');
  }

  async connectToBackend() {
    if (!this.client) {
      this.showStatus('Backend not available', 'error');
      return;
    }

    try {
      this.showStatus('Connecting...', 'info');
      const sessionData = await this.client.connect(this.userId, 'User');
      this.isConnected = true;
      this.showStatus(`Connected! ${sessionData.greeting}`, 'success');
      this.setupBackendListeners();
    } catch (err) {
      this.showStatus('Backend unavailable', 'error');
    }
  }

  setupBackendListeners() {
    if (!this.client) return;

    this.client.socket.on('transcription-partial', (data) => {
      this.transcript.textContent = data.text + ' (listening...)';
      this.transcript.classList.add('has-content');
    });

    this.client.socket.on('transcription-final', (data) => {
      this.transcript.textContent = data.text;
    });

    this.client.socket.on('phoneme-sequence', (data) => {
      this.avatar.animatePhonemeSequence(data.phonemes);
    });

    this.client.socket.on('response-start', (data) => {
      this.avatar.setEmotion(data.emotion);
    });

    this.client.socket.on('stream-ready', () => {
      this.showStatus('🎤 Listening...', 'success');
    });

    this.client.socket.on('stream-stopped', () => {
      this.showStatus('Awaiting response...', 'info');
    });

    this.client.socket.on('text-response', (data) => {
      this.transcript.textContent = data.text;
      this.transcript.classList.add('has-content');
    });

    this.client.socket.on('audio-response', (data) => {
      if (data.audioBase64) {
        console.log('📥 Received audio response from backend');
        // Try to play immediately, queue if autoplay blocked
        this.playAudioWithFallback(data.audioBase64);
      }
    });

    this.client.socket.on('response-complete', () => {
      this.showStatus('Response complete', 'success');
    });
  }

  /**
   * Play audio with fallback for autoplay policy
   */
  playAudioWithFallback(audioBase64) {
    const tryPlay = () => {
      this.playAudio(audioBase64);
    };

    // Try to play immediately
    tryPlay();
    
    // If that fails, queue for first user interaction
    document.addEventListener('click', () => {
      if (this.queuedAudio) {
        this.playAudio(this.queuedAudio);
        this.queuedAudio = null;
      }
    }, { once: true });
  }

  /**
   * Play audio from base64 (MP3 from ElevenLabs)
   */
  playAudio(audioBase64) {
    try {
      const audioPlayer = document.getElementById('audioPlayer');
      if (!audioPlayer) {
        console.error('Audio player element not found');
        return;
      }

      // Decode base64 to binary
      const binaryString = atob(audioBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Create blob with correct MIME type for audio
      const blob = new Blob([bytes.buffer], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      
      console.log(`🎵 Audio blob created: ${(bytes.length / 1024).toFixed(1)} KB, MIME: audio/mpeg`);

      audioPlayer.src = url;
      
      // Try to play
      const playPromise = audioPlayer.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('🔊 Audio playing...');
          })
          .catch(err => {
            if (err.name === 'NotAllowedError') {
              // Autoplay blocked - queue for next user click
              console.log('⏳ Autoplay blocked, queuing audio for next click...');
              this.queuedAudio = audioBase64;
              this.showStatus('Click to hear Novo 🎤', 'info');
            } else {
              console.error('Audio playback failed:', err.message);
            }
          });
      }
    } catch (err) {
      console.error('Audio setup failed:', err);
    }
  }

  async startStreaming() {
    if (this.isStreaming) {
      this.showStatus('Already streaming', 'warning');
      return;
    }
    
    // Allow streaming even if backend not connected yet - will connect on first audio chunk
    if (!this.isConnected) {
      this.showStatus('Connecting to backend...', 'info');
      await this.connectToBackend();
    }

    try {
      this.showStatus('Starting microphone...', 'info');

      let audioChunkCount = 0;
      this.audioStreamer = new AudioStreamer((audioChunk) => {
        try {
          // Convert Uint8Array PCM16 to base64
          let binaryString;
          if (audioChunk instanceof Uint8Array) {
            // Safe conversion for Uint8Array
            binaryString = Array.prototype.map.call(audioChunk, x => String.fromCharCode(x)).join('');
          } else {
            binaryString = String.fromCharCode.apply(null, audioChunk);
          }
          const base64Chunk = btoa(binaryString);
          
          audioChunkCount++;
          if (audioChunkCount === 1) {
            console.log(`📤 FIRST audio chunk sent (${audioChunk.length} bytes → ${base64Chunk.length} chars)`);
          }
          if (audioChunkCount % 10 === 0) {
            console.log(`📤 Sent ${audioChunkCount} audio chunks to backend...`);
          }
          
          this.client.socket.emit('audio-stream', {
            userId: this.userId,
            chunk: base64Chunk
          });
        } catch (err) {
          console.error('❌ Audio chunk conversion failed:', err);
        }
      });

      await this.audioStreamer.start();
      this.client.socket.emit('stream-start', { userId: this.userId });
      
      this.isStreaming = true;
      this.startBtn.disabled = true;
      this.startBtn.classList.add('btn-recording');
      this.stopBtn.disabled = false;
      
      this.showStatus('🎤 Listening...', 'success');
    } catch (err) {
      this.showStatus('Microphone access denied', 'error');
    }
  }

  stopStreaming() {
    if (!this.isStreaming) return;

    if (this.audioStreamer) {
      this.audioStreamer.stop();
    }

    this.client.socket.emit('stream-stop', { userId: this.userId });

    this.isStreaming = false;
    this.startBtn.disabled = false;
    this.startBtn.classList.remove('btn-recording');
    this.stopBtn.disabled = true;

    this.showStatus('Processing...', 'info');
  }

  handleEmotionChange(e) {
    const emotion = e.target.dataset.emotion;
    
    this.emotionButtons.forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    this.emotionLabel.textContent = emotion.charAt(0).toUpperCase() + emotion.slice(1);
    
    this.avatar.setEmotion(emotion);
    this.currentEmotion = emotion;
    this.avatar.preloadEmotion(emotion);

    if (this.isConnected) {
      this.client.setEmotion(emotion);
    }
  }

  async toggleCamera() {
    if (this.cameraEnabled) {
      this.disableCamera();
    } else {
      this.enableCamera();
    }
  }

  async enableCamera() {
    try {
      this.showStatus('Requesting camera access...', 'info');

      // Hume AI WebSocket - optional for emotion detection
      // (Currently disabled due to auth issues - will enable after backend integration)
      const humeApiKey = 'bQvGqibCpWOG3SHgtZ4utXh7Nvhs7Hltp1YAFi6lSPvkD48A';
      
      // Skip Hume for now - emotion detection will come from backend
      console.log('⚠️  Hume emotion detection temporarily disabled');
      this.hume = null;
      this.humeBatch = null;

      // Get camera preview element
      const cameraPreview = document.getElementById('cameraPreview');
      const previewVideo = document.getElementById('cameraPreviewVideo');

      // Get camera stream
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      previewVideo.srcObject = stream;
      cameraPreview.style.display = 'block';

      // Create camera frame handler
      this.cameraStreamer = new CameraStreamer((frameBlob) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64Frame = reader.result.split(',')[1];
          
          // Send to backend for storage
          if (this.client && this.client.socket) {
            this.client.socket.emit('camera-frame-capture', {
              userId: this.userId,
              base64: base64Frame,
              emotion: this.currentEmotion
            });
          }

          // Emotion detection
          if (this.hume && this.hume.isConnected) {
            this.hume.sendFrame(base64Frame, (emotions) => {
              this.updateAvatarEmotion(emotions);
            });
          } else if (this.humeBatch) {
            this.humeBatch.analyzeFrame(base64Frame).then(emotions => {
              this.updateAvatarEmotion(emotions);
            }).catch(err => {
              console.warn('Emotion detection error:', err.message);
            });
          }
        };
        reader.readAsDataURL(frameBlob);
      });

      await this.cameraStreamer.start();
      
      this.cameraEnabled = true;
      this.cameraToggle.innerHTML = '📷 Disable Camera';
      this.cameraToggle.classList.add('active');
      
      this.showStatus('📷 Camera enabled - Emotion detection active', 'success');
    } catch (err) {
      this.showStatus('Camera access denied', 'error');
    }
  }

  disableCamera() {
    if (this.cameraStreamer) {
      this.cameraStreamer.stop();
      this.cameraStreamer = null;
    }

    const cameraPreview = document.getElementById('cameraPreview');
    const previewVideo = document.getElementById('cameraPreviewVideo');
    cameraPreview.style.display = 'none';
    if (previewVideo.srcObject) {
      previewVideo.srcObject.getTracks().forEach(track => track.stop());
      previewVideo.srcObject = null;
    }

    this.cameraEnabled = false;
    this.cameraToggle.innerHTML = '📷 Enable Camera';
    this.cameraToggle.classList.remove('active');
    
    this.showStatus('Camera disabled', 'info');
  }

  updateAvatarEmotion(emotions) {
    const avatarEmotions = {
      joy: ['joy', 'ecstasy', 'amusement', 'excitement', 'enthusiasm', 'triumph', 'satisfaction'],
      sadness: ['sadness', 'disappointment', 'distress', 'pain', 'shame', 'guilt'],
      anger: ['anger', 'annoyance', 'disapproval', 'contempt', 'disgust'],
      surprise: ['surprise_positive', 'surprise_negative', 'awe'],
      fear: ['fear', 'anxiety', 'horror'],
      neutral: ['calmness', 'concentration', 'interest', 'confusion']
    };
    
    let bestEmotion = 'neutral';
    let bestScore = 0;
    
    Object.keys(avatarEmotions).forEach(avatarEmotion => {
      const humeEmotions = avatarEmotions[avatarEmotion];
      const score = humeEmotions.reduce((sum, hume) => sum + (emotions[hume] || 0), 0);
      if (score > bestScore) {
        bestScore = score;
        bestEmotion = avatarEmotion;
      }
    });
    
    if (bestScore > 0.15) {
      this.avatar.setEmotion(bestEmotion);
    }
  }

  showStatus(message, type = 'info') {
    this.status.textContent = message;
    this.status.className = `status show ${type}`;
  }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  const portal = new AvatarPortalRealtime();
  window.avatarPortal = portal;
  window.avatar = portal.avatar;
  window.converter = portal.converter;
});
