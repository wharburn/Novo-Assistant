/**
 * Novo Avatar Portal - Main Application (with backend integration)
 */

class AvatarPortal {
  constructor() {
    // Initialize components
    this.avatar = new AvatarEngine('avatarCanvas', '../assets');
    this.converter = new PhonemeConverter();
    
    // Backend client (auto-detects URL based on current domain)
    this.client = typeof PortalClient !== 'undefined' ? new PortalClient() : null;
    
    // DOM elements
    this.textInput = document.getElementById('textInput');
    this.recordBtn = document.getElementById('recordBtn');
    this.speakBtn = document.getElementById('speakBtn');
    this.stopBtn = document.getElementById('stopBtn');
    this.emotionButtons = document.querySelectorAll('.emotion-btn');
    this.transcript = document.getElementById('transcript');
    this.status = document.getElementById('status');
    this.emotionLabel = document.getElementById('emotionLabel');
    this.audioPlayer = document.getElementById('audioPlayer');

    // State
    this.isRecording = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.userId = this.generateUserId();
    this.isConnected = false;
    this.currentEmotion = 'neutral';

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
    // Event listeners
    this.recordBtn.addEventListener('click', () => this.toggleRecording());
    this.speakBtn.addEventListener('click', () => this.handleSpeak());
    this.stopBtn.addEventListener('click', () => this.handleStop());
    
    this.emotionButtons.forEach(btn => {
      btn.addEventListener('click', (e) => this.handleEmotionChange(e));
    });

    // Preload initial emotion
    this.avatar.preloadEmotion('neutral');
    
    // Try to connect to backend
    this.connectToBackend();
    
    this.showStatus('Ready to go! Type or record something.', 'info');
  }

  /**
   * Connect to backend WebSocket
   */
  async connectToBackend() {
    if (!this.client) {
      this.showStatus('Backend not available - local mode only', 'info');
      return;
    }

    try {
      this.showStatus('Connecting to backend...', 'info');
      const sessionData = await this.client.connect(this.userId, 'Guest User');
      this.isConnected = true;
      this.showStatus(`Connected! ${sessionData.greeting}`, 'success');

      // Listen for events
      this.setupBackendListeners();
    } catch (err) {
      console.error('Backend connection failed:', err);
      this.showStatus('Backend unavailable - offline mode', 'error');
    }
  }

  /**
   * Setup listeners for backend events
   */
  setupBackendListeners() {
    if (!this.client) return;

    this.client.onPhonemeSequence((phonemes) => {
      this.avatar.animatePhonemeSequence(phonemes);
    });

    this.client.onTextResponse((text) => {
      this.transcript.textContent = text;
      this.transcript.classList.add('has-content');
    });

    this.client.onTranscription((text, confidence) => {
      this.textInput.value = text;
      this.showStatus(`Heard: "${text}" (${(confidence * 100).toFixed(0)}% confidence)`, 'success');
    });

    this.client.onResponseStart((emotion) => {
      this.currentEmotion = emotion;
      this.avatar.setEmotion(emotion);
    });
  }

  /**
   * Handle emotion change
   */
  handleEmotionChange(e) {
    const emotion = e.target.dataset.emotion;
    
    // Update UI
    this.emotionButtons.forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    this.emotionLabel.textContent = emotion.charAt(0).toUpperCase() + emotion.slice(1);
    
    // Update avatar
    this.avatar.setEmotion(emotion);
    this.currentEmotion = emotion;
    
    // Preload sprites for smooth animation
    this.avatar.preloadEmotion(emotion);

    // Tell backend
    if (this.isConnected && this.client) {
      this.client.setEmotion(emotion);
    }
  }

  /**
   * Handle speak/animate text
   */
  async handleSpeak() {
    const text = this.textInput.value.trim();
    
    if (!text) {
      this.showStatus('Please enter some text first.', 'error');
      return;
    }

    this.recordBtn.disabled = true;
    this.speakBtn.disabled = true;
    this.stopBtn.disabled = false;

    try {
      this.showStatus('Processing...', 'info');

      if (this.isConnected && this.client) {
        // Send to backend for real response
        await this.client.sendText(text, this.currentEmotion);
      } else {
        // Local animation only
        const phonemes = this.converter.textToPhonemes(text);
        console.log('Phoneme sequence:', phonemes.join(' → '));
        await this.avatar.animatePhonemeSequence(phonemes);
      }

      this.showStatus('Done!', 'success');
    } catch (err) {
      console.error('Error:', err);
      this.showStatus(`Error: ${err.message}`, 'error');
    } finally {
      this.recordBtn.disabled = false;
      this.speakBtn.disabled = false;
      this.stopBtn.disabled = true;
    }
  }

  /**
   * Handle stop button
   */
  handleStop() {
    if (this.audioPlayer) {
      this.audioPlayer.pause();
      this.audioPlayer.currentTime = 0;
    }

    this.avatar.setPhoneme('closed');
    this.avatar.draw();

    this.showStatus('Stopped.', 'info');
    this.recordBtn.disabled = false;
    this.speakBtn.disabled = false;
    this.stopBtn.disabled = true;
  }

  /**
   * Toggle voice recording
   */
  async toggleRecording() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  /**
   * Start voice recording
   */
  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (e) => {
        this.audioChunks.push(e.data);
      };

      this.mediaRecorder.onstop = () => {
        this.handleRecordingComplete();
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      
      this.recordBtn.classList.add('btn-recording');
      this.recordBtn.textContent = '⏹ Stop Recording';
      this.speakBtn.disabled = true;
      
      this.showStatus('Recording... tap Stop when done.', 'info');
    } catch (err) {
      console.error('Microphone access denied:', err);
      this.showStatus('Microphone access denied. Try typing instead.', 'error');
    }
  }

  /**
   * Stop voice recording
   */
  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      
      this.recordBtn.classList.remove('btn-recording');
      this.recordBtn.textContent = '🎤 Record Voice';
      this.speakBtn.disabled = false;
      
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  }

  /**
   * Handle recording completion
   */
  async handleRecordingComplete() {
    try {
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
      
      this.showStatus('Processing voice...', 'info');

      if (this.isConnected && this.client) {
        // Send to backend for transcription
        await this.client.sendAudio(audioBlob);
      } else {
        this.showStatus('Backend not available for voice processing', 'error');
      }

      // Play back recording
      const audioUrl = URL.createObjectURL(audioBlob);
      this.audioPlayer.src = audioUrl;
      
    } catch (err) {
      console.error('Recording error:', err);
      this.showStatus('Recording failed. Please try again.', 'error');
    }
  }

  /**
   * Show status message
   */
  showStatus(message, type = 'info') {
    this.status.textContent = message;
    this.status.className = `status show ${type}`;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const portal = new AvatarPortal();
  
  // Expose globally for debugging
  window.avatarPortal = portal;
  window.avatar = portal.avatar;
  window.converter = portal.converter;
});
