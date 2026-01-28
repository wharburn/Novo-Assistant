/**
 * Novo Avatar Portal - Main Application
 */

class AvatarPortal {
  constructor() {
    // Initialize components
    this.avatar = new AvatarEngine('avatarCanvas', './assets');
    this.converter = new PhonemeConverter();
    
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

    this.init();
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
    
    this.showStatus('Ready to go! Type or record something.', 'info');
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
    
    // Preload sprites for smooth animation
    this.avatar.preloadEmotion(emotion);
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
      this.showStatus('Animating...', 'info');

      // Convert text to phonemes
      const phonemes = this.converter.textToPhonemes(text);
      console.log('Phoneme sequence:', phonemes.join(' → '));

      // Animate through phonemes
      await this.avatar.animatePhonemeSequence(phonemes);

      this.showStatus('Animation complete!', 'success');
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
    // Stop audio playback
    if (this.audioPlayer) {
      this.audioPlayer.pause();
      this.audioPlayer.currentTime = 0;
    }

    // Reset avatar
    this.avatar.setPhoneme('closed');
    this.avatar.draw();

    this.showStatus('Animation stopped.', 'info');
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
      
      // Stop all tracks
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  }

  /**
   * Handle recording completion
   */
  async handleRecordingComplete() {
    try {
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
      
      this.showStatus('Transcribing audio...', 'info');

      // For now, we'd need to send this to a backend for transcription
      // This is a placeholder - in production, you'd:
      // 1. Send audioBlob to your backend
      // 2. Backend calls Whisper API
      // 3. Returns transcript
      // 4. We convert to phonemes and animate

      // For MVP, show placeholder
      this.showStatus('Audio recorded! Send to server for transcription.', 'success');
      
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
