/**
 * NoVo Voice Conversation App
 * Integrates Deepgram Flux voice workflow with NoVo avatar
 * Press "Talk" button → Listen → AI responds → Conversation continues
 */

class NovoVoiceApp {
  constructor() {
    // UI Elements
    this.avatar = null;
    this.client = null;
    this.talkBtn = null;
    this.stopBtn = null;
    this.transcript = null;
    this.status = null;
    this.emotionLabel = null;
    this.emotionButtons = null;

    // Voice conversation state
    this.socket = null;
    this.mediaStream = null;
    this.audioContext = null;
    this.processor = null;
    this.isConnected = false;
    this.isConversationActive = false;
    this.isRecording = false;
    this.selectedDeviceId = null;
    this.currentEmotion = 'neutral';

    // Audio playback state (for interruption)
    this.isPlayingAudio = false;
    this.currentAudioSource = null;
    this.audioQueue = []; // Queue for audio to prevent overlapping speech

    // Idle animation state (for when listening/waiting during conversation)
    this.idleAnimationInterval = null;
    this.lastIdleAnimationTime = 0;
    this.idleTimeout = null; // Timeout to switch to idle video after 15s
    this.lastActivityTime = Date.now();

    // Configuration (load from localStorage or use defaults)
    this.config = this.loadSettings() || {
      sample_rate: 16000,
      llm_model: 'openai/gpt-4o-mini',
      tts_model: 'aura-asteria-en',
      eot_threshold: 0.8,
      eot_timeout_ms: 3000,
    };

    // User ID
    this.userId = this.generateUserId();

    this.init();
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem('novo_voice_settings');
      if (saved) {
        const settings = JSON.parse(saved);
        console.log('✅ Loaded saved settings:', settings);
        return settings;
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    }
    return null;
  }

  saveSettings() {
    try {
      localStorage.setItem('novo_voice_settings', JSON.stringify(this.config));
      console.log('💾 Settings saved:', this.config);
      this.showSettingsStatus('✅ Settings saved!', '#4CAF50');
    } catch (err) {
      console.error('Error saving settings:', err);
      this.showSettingsStatus('❌ Error saving settings', '#f44336');
    }
  }

  showSettingsStatus(message, color) {
    const status = document.getElementById('settingsStatus');
    if (status) {
      status.textContent = message;
      status.style.color = color;
      setTimeout(() => {
        status.textContent = '';
      }, 3000);
    }
  }

  generateUserId() {
    let userId = localStorage.getItem('novo_user_id');
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.getItem('novo_user_id', userId);
    }
    return userId;
  }

  async init() {
    console.log('🚀 NoVo Voice Conversation initializing...');

    // Get UI elements
    this.talkBtn = document.getElementById('talkBtn');
    this.stopBtn = document.getElementById('stopBtn');
    this.resetBtn = document.getElementById('resetBtn');
    this.cameraToggleBtn = document.getElementById('cameraToggleBtn');
    this.cameraPreview = document.getElementById('cameraPreview');
    this.cameraPreviewVideo = document.getElementById('cameraPreviewVideo');
    this.transcript = document.getElementById('transcript');
    this.status = document.getElementById('status');
    this.emotionLabel = document.getElementById('emotionLabel');
    this.emotionButtons = document.querySelectorAll('.emotion-btn');
    this.adminToggleBottom = document.getElementById('adminToggleBottom');
    this.adminPanel = document.getElementById('adminPanel');
    this.llmModel = document.getElementById('llmModel');
    this.ttsModel = document.getElementById('ttsModel');
    this.microphoneSelect = document.getElementById('microphoneSelect');
    this.saveSettingsBtn = document.getElementById('saveSettings');

    // Camera state
    this.cameraActive = false;
    this.cameraStream = null;
    this.lastVisionAnalysis = null;
    this.visionCheckInterval = null;
    this.waitingForShoot = false; // Flag for photo capture mode

    // Initialize avatar
    const canvas = document.getElementById('avatarCanvas');
    this.avatar = new AvatarEngine('avatarCanvas');
    this.avatar.preloadEmotion('neutral');

    // Initialize idle video system
    this.idleVideo = document.getElementById('idleVideo');
    this.avatarCanvas = document.getElementById('avatarCanvas');
    this.idleVideos = ['mp4/wait1.mp4', 'mp4/wait2.mp4'];
    this.currentIdleVideoIndex = 0;
    this.setupIdleVideo();

    // Apply saved settings to UI
    this.applySavedSettings();

    // Setup event listeners
    this.setupEventListeners();

    // Load microphones
    await this.loadMicrophones();

    // Initialize Socket.IO connection to backend
    this.initSocket();

    this.showStatus('Ready! Press "Start Talking" to begin.', 'success');
  }

  applySavedSettings() {
    // Apply saved model and voice to dropdowns
    if (this.llmModel && this.config.llm_model) {
      this.llmModel.value = this.config.llm_model;
    }
    if (this.ttsModel && this.config.tts_model) {
      this.ttsModel.value = this.config.tts_model;
    }
    console.log('✅ Applied saved settings to UI');
  }

  setupIdleVideo() {
    if (!this.idleVideo) return;

    // Start with first idle video
    this.playNextIdleVideo();

    // When video ends, play the next one (alternating)
    this.idleVideo.addEventListener('ended', () => {
      this.playNextIdleVideo();
    });

    console.log('🎬 Idle video system initialized');
  }

  playNextIdleVideo() {
    if (!this.idleVideo) return;

    // Alternate between wait1.mp4 and wait2.mp4
    this.idleVideo.src = this.idleVideos[this.currentIdleVideoIndex];
    this.idleVideo.load();
    this.idleVideo.play().catch((err) => {
      console.warn('⚠️ Could not autoplay idle video:', err);
    });

    // Switch to next video for next time
    this.currentIdleVideoIndex = (this.currentIdleVideoIndex + 1) % this.idleVideos.length;
    console.log(`🎬 Playing idle video: ${this.idleVideo.src}`);
  }

  showIdleVideo() {
    if (this.idleVideo && this.avatarCanvas) {
      console.log('📺 Switching to idle video');
      this.stopIdleAnimation(); // Stop avatar idle animation
      this.idleVideo.style.display = 'block';
      this.avatarCanvas.style.display = 'none';
      // Resume playing if paused
      if (this.idleVideo.paused) {
        this.idleVideo.play().catch((err) => console.warn('⚠️ Could not play idle video:', err));
      }
    }
  }

  showAvatarCanvas() {
    if (this.idleVideo && this.avatarCanvas) {
      console.log('🎨 Switching to avatar canvas');
      this.idleVideo.style.display = 'none';
      this.avatarCanvas.style.display = 'block';
      // Pause idle video to save resources
      this.idleVideo.pause();
    }
  }

  /**
   * Start idle animation during conversation (blinking + occasional thinking/mouth movements)
   */
  startIdleAnimation() {
    console.log('😌 Starting idle animation (blinking + occasional movements)');
    this.stopIdleAnimation(); // Clear any existing

    // Reset activity tracking
    this.lastActivityTime = Date.now();
    this.resetIdleTimeout();

    // Show avatar canvas
    this.showAvatarCanvas();

    // Set avatar to neutral with closed mouth
    if (this.avatar) {
      this.avatar.setEmotion('neutral');
      this.avatar.setPhoneme('closed');
    }

    // Every 10 seconds, do a subtle animation
    this.idleAnimationInterval = setInterval(() => {
      if (!this.isPlayingAudio && this.isConversationActive) {
        const now = Date.now();

        // Random choice: thinking emotion or subtle mouth movement
        const action = Math.random() > 0.5 ? 'thinking' : 'mouth';

        if (action === 'thinking') {
          console.log('🤔 Idle: Showing thinking emotion');
          this.avatar.setEmotion('thinking');
          setTimeout(() => {
            if (!this.isPlayingAudio) {
              this.avatar.setEmotion('neutral');
            }
          }, 2000); // Show thinking for 2 seconds
        } else {
          console.log('👄 Idle: Subtle mouth movement');
          // Quick mouth open/close
          this.avatar.setPhoneme('o');
          setTimeout(() => {
            if (!this.isPlayingAudio) {
              this.avatar.setPhoneme('closed');
            }
          }, 300);
        }
      }
    }, 10000); // Every 10 seconds
  }

  /**
   * Stop idle animation
   */
  stopIdleAnimation() {
    if (this.idleAnimationInterval) {
      clearInterval(this.idleAnimationInterval);
      this.idleAnimationInterval = null;
    }
    this.clearIdleTimeout();
  }

  /**
   * Reset the 15-second timeout to switch to idle video
   */
  resetIdleTimeout() {
    this.clearIdleTimeout();

    // Only set timeout if conversation is active
    if (this.isConversationActive) {
      this.idleTimeout = setTimeout(() => {
        console.log('⏰ 15 seconds of inactivity - switching to idle video');
        this.showIdleVideo();
      }, 15000); // 15 seconds
    }
  }

  /**
   * Clear idle timeout
   */
  clearIdleTimeout() {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
      this.idleTimeout = null;
    }
  }

  /**
   * Mark activity (user spoke, avatar responded, etc.)
   */
  markActivity() {
    this.lastActivityTime = Date.now();
    this.resetIdleTimeout();
  }

  setupEventListeners() {
    // Talk button
    this.talkBtn.addEventListener('click', () => {
      console.log('▶️ Start Talking button clicked');
      this.startConversation();
    });

    // Stop button
    this.stopBtn.addEventListener('click', () => {
      console.log('⏹️ Stop button clicked');
      this.stopConversation();
    });

    // Reset button
    this.resetBtn.addEventListener('click', () => {
      console.log('🔄 Reset button clicked');
      this.resetApp();
    });

    // Camera toggle button
    this.cameraToggleBtn.addEventListener('click', () => {
      this.toggleCamera();
    });

    // Admin toggle (bottom button only)
    this.adminToggleBottom.addEventListener('click', () => {
      const isHidden = this.adminPanel.style.display === 'none';
      this.adminPanel.style.display = isHidden ? 'block' : 'none';
    });

    // Emotion buttons
    this.emotionButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => this.handleEmotionChange(e));
    });

    // Config changes (auto-update but don't auto-save)
    this.llmModel.addEventListener('change', (e) => {
      this.config.llm_model = e.target.value;
      this.sendConfigUpdate();
      this.showSettingsStatus('⚠️ Click "Save Settings" to persist', '#FFA500');
    });

    this.ttsModel.addEventListener('change', (e) => {
      this.config.tts_model = e.target.value;
      this.sendConfigUpdate();
      this.showSettingsStatus('⚠️ Click "Save Settings" to persist', '#FFA500');
    });

    this.microphoneSelect.addEventListener('change', (e) => {
      this.selectedDeviceId = e.target.value;
      this.showSettingsStatus('⚠️ Click "Save Settings" to persist', '#FFA500');
    });

    // Save settings button
    this.saveSettingsBtn.addEventListener('click', () => {
      this.saveSettings();
    });
  }

  async loadMicrophones() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((device) => device.kind === 'audioinput');

      this.microphoneSelect.innerHTML = '';
      audioInputs.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Microphone ${index + 1}`;
        this.microphoneSelect.appendChild(option);
      });

      if (audioInputs.length > 0) {
        this.selectedDeviceId = audioInputs[0].deviceId;
      }
    } catch (err) {
      console.error('Error loading microphones:', err);
    }
  }

  handleEmotionChange(e) {
    const emotion = e.target.dataset.emotion;

    this.emotionButtons.forEach((btn) => btn.classList.remove('active'));
    e.target.classList.add('active');
    this.emotionLabel.textContent = emotion.charAt(0).toUpperCase() + emotion.slice(1);

    this.avatar.setEmotion(emotion);
    this.currentEmotion = emotion;
    this.avatar.preloadEmotion(emotion);
  }

  initSocket() {
    console.log('🔌 Connecting to backend...');

    // Connect to the portal backend
    this.socket = io({
      transports: ['polling', 'websocket'],
      reconnection: true,
    });

    this.socket.on('connect', () => {
      console.log('✅ Connected to backend');
      this.isConnected = true;
      this.showStatus('Connected! Ready to talk.', 'success');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from backend');
      this.isConnected = false;
      this.showStatus('Disconnected', 'error');
    });

    // Listen for conversation events
    this.socket.on('conversation_started', () => {
      console.log('✅ RECEIVED conversation_started event from backend');
      this.isConversationActive = true;
      console.log('✅ Set isConversationActive = true');
      this.showStatus('Listening...', 'info');

      // Start idle animation (avatar canvas with blinking + occasional movements)
      this.startIdleAnimation();
    });

    // CRITICAL: Interrupt audio when user starts speaking
    this.socket.on('user_started_speaking', () => {
      console.log('🎤 USER STARTED SPEAKING - INTERRUPTING AUDIO!');
      this.markActivity(); // Reset idle timeout
      this.stopAudioPlayback();
      this.showStatus('Listening...', 'info');
    });

    this.socket.on('user_speech', (data) => {
      console.log('👤 User said:', data.transcript);

      // Check if waiting for "shoot" command
      console.log(
        `🔍 Checking shoot: waitingForShoot=${this.waitingForShoot}, transcript="${data.transcript}"`
      );
      if (this.waitingForShoot && data.transcript.toLowerCase().includes('shoot')) {
        console.log('📸 "Shoot" detected! Taking photo...');
        this.waitingForShoot = false;
        this.takePhotoWithCountdown();
        return; // Don't process this as normal speech
      }

      // Prepend to show at top
      const userMsg = document.createElement('div');
      userMsg.className = 'transcript-user';
      userMsg.innerHTML = `<strong>You:</strong> ${data.transcript}`;
      this.transcript.prepend(userMsg);
      this.showStatus('Processing...', 'info');
    });

    this.socket.on('agent_response', (data) => {
      console.log('🤖 Agent response:', data.text);
      // Prepend to show at top
      const agentMsg = document.createElement('div');
      agentMsg.className = 'transcript-agent';
      agentMsg.innerHTML = `<strong>NoVo:</strong> ${data.text}`;
      this.transcript.prepend(agentMsg);
    });

    this.socket.on('vision_result', (data) => {
      console.log('👁️ Vision analysis result:', data.description);
      this.lastVisionAnalysis = data.description;

      // If this was an immediate request, show it to the user
      if (data.immediate) {
        this.showStatus('Vision analysis complete', 'success');
      }
    });

    this.socket.on('request_vision_analysis', (data) => {
      console.log('👁️ Backend requesting vision analysis');

      // Immediately capture and analyze current camera frame
      if (this.cameraActive) {
        this.requestVisionAnalysis(data.prompt);
      } else {
        console.warn('⚠️ Camera not active, cannot analyze');
        this.showStatus('Camera is not enabled', 'warning');
      }
    });

    this.socket.on('prepare_photo', () => {
      console.log('📸 Backend requesting photo preparation - waiting for "shoot"');

      if (this.cameraActive) {
        this.waitingForShoot = true;
        this.showStatus('Say "shoot" when ready!', 'info');
      } else {
        console.warn('⚠️ Camera not active, cannot take photo');
        this.showStatus('Please turn on the camera first', 'warning');
      }
    });

    this.socket.on('turn_on_camera_and_prepare_photo', async () => {
      console.log('📸 Backend requesting camera ON and photo preparation');

      // Turn on camera if not already on
      if (!this.cameraActive) {
        console.log('📷 Auto-enabling camera for photo...');
        await this.toggleCamera();
      }

      // Set waiting for shoot flag
      this.waitingForShoot = true;
      this.showStatus('Say "shoot" when ready!', 'info');
    });

    this.socket.on('agent_speaking', async (data) => {
      console.log('🔊 Agent speaking event received');
      console.log('📊 Audio data:', data.audio ? `${data.audio.length} bytes` : 'NO AUDIO');
      console.log('📝 Text:', data.text);

      // Mark activity (reset 15s idle timeout)
      this.markActivity();

      // CRITICAL: Only one audio at a time!
      // If already playing, stop current audio and clear queue
      if (this.isPlayingAudio) {
        console.log('⚠️ Already playing audio - stopping current and replacing');
        this.stopAudioPlayback();
        this.audioQueue = []; // Clear any queued audio
      }

      this.showStatus('Speaking...', 'info');

      // Play audio and animate avatar
      if (data.audio && data.audio.length > 0) {
        console.log('▶️ Starting audio playback...');
        await this.playAudioAndAnimate(data.audio, data.text);
        console.log('✅ Audio playback complete');
      } else {
        console.warn('⚠️ No audio data received!');
      }

      // Return to listening state with idle animation
      if (this.isConversationActive) {
        this.showStatus('Listening...', 'info');
        this.startIdleAnimation(); // Start idle animation while listening
      }
    });

    this.socket.on('emotions_detected', (data) => {
      console.log('🎭 Emotions detected:', data.emotions);
      this.updateEmotionButtons(data.emotions);
    });

    this.socket.on('conversation_stopped', () => {
      console.log('✅ Backend confirmed conversation stopped');
      // Ensure everything is cleaned up
      this.isConversationActive = false;
      this.isRecording = false;
      this.isPlayingAudio = false;
      this.audioQueue = [];

      // Update UI
      this.talkBtn.disabled = false;
      this.stopBtn.disabled = true;
      this.talkBtn.classList.remove('active');
      this.talkBtn.innerHTML =
        '<span class="btn-icon">🎤</span><span class="btn-text">Start<br/>Talking</span>';
      this.showStatus('Ready to talk', 'success');
    });

    this.socket.on('conversation_error', (data) => {
      console.error('❌ Conversation error:', data.error);
      this.showStatus(`Error: ${data.error}`, 'error');
    });
  }

  async startConversation() {
    if (!this.isConnected) {
      this.showStatus('Not connected to backend', 'error');
      return;
    }

    if (this.isConversationActive) {
      return;
    }

    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: this.selectedDeviceId ? { exact: this.selectedDeviceId } : undefined,
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Create audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000,
      });

      // Setup audio processing
      this.setupAudioProcessing();
      console.log('✅ Audio processing setup complete');

      // Notify backend to start conversation
      console.log('📤 Sending start_conversation to backend with config:', this.config);
      this.socket.emit('start_conversation', this.config);
      console.log('✅ start_conversation event sent');

      // Update UI
      this.talkBtn.disabled = true;
      this.stopBtn.disabled = false;
      this.talkBtn.classList.add('active');
      this.talkBtn.innerHTML =
        '<span class="btn-icon">🎤</span><span class="btn-text">Listening...</span>';
      this.showStatus('Conversation started! Speak now...', 'success');
    } catch (err) {
      console.error('Error starting conversation:', err);
      this.showStatus('Microphone access denied', 'error');
    }
  }

  setupAudioProcessing() {
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    const bufferSize = 4096;
    this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    let lastSendTime = 0;
    const sendInterval = 100; // Send every 100ms
    let audioChunkCount = 0;

    this.processor.onaudioprocess = (e) => {
      const now = Date.now();

      // Debug logging for first few calls
      if (audioChunkCount < 3) {
        console.log(`🔍 Audio process callback #${audioChunkCount}:`, {
          socketConnected: this.socket?.connected,
          isConversationActive: this.isConversationActive,
          timeSinceLastSend: now - lastSendTime,
          sendInterval: sendInterval,
          shouldSend:
            this.socket?.connected &&
            this.isConversationActive &&
            now - lastSendTime >= sendInterval,
        });
      }

      if (
        this.socket?.connected &&
        this.isConversationActive &&
        now - lastSendTime >= sendInterval
      ) {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = this.convertFloatToPcm(inputData);

        // Send audio data to backend
        this.socket.emit('audio_data', pcmData.buffer);
        lastSendTime = now;

        audioChunkCount++;
        if (audioChunkCount === 1) {
          console.log('🎙️ Started sending audio to backend');
        }
        if (audioChunkCount % 10 === 0) {
          console.log(`📡 Sent ${audioChunkCount} audio chunks`);
        }
      }
    };

    this.isRecording = true;
  }

  convertFloatToPcm(floatData) {
    const pcmData = new Int16Array(floatData.length);
    for (let i = 0; i < floatData.length; i++) {
      const s = Math.max(-1, Math.min(1, floatData[i]));
      pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return pcmData;
  }

  stopConversation() {
    console.log('🛑 Stopping conversation...');
    console.trace('stopConversation called from:');

    // CRITICAL: Stop any playing audio IMMEDIATELY
    this.stopAudioPlayback();

    // Clear audio queue
    this.audioQueue = [];

    // Stop audio processing
    if (this.processor) {
      try {
        this.processor.disconnect();
      } catch (err) {
        console.warn('⚠️ Error disconnecting processor:', err);
      }
      this.processor = null;
    }

    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((track) => track.stop());
      } catch (err) {
        console.warn('⚠️ Error stopping media stream:', err);
      }
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch (err) {
        console.warn('⚠️ Error closing audio context:', err);
      }
      this.audioContext = null;
    }

    // Notify backend to stop everything
    if (this.socket && this.isConversationActive) {
      this.socket.emit('stop_conversation');
    }

    // Update state
    this.isConversationActive = false;
    this.isRecording = false;
    this.isPlayingAudio = false;

    // Reset avatar to neutral
    if (this.avatar) {
      this.avatar.setEmotion('neutral');
    }

    // Return to idle video
    this.showIdleVideo();

    // Update UI
    this.talkBtn.disabled = false;
    this.stopBtn.disabled = true;
    this.talkBtn.classList.remove('active');
    this.talkBtn.innerHTML =
      '<span class="btn-icon">🎤</span><span class="btn-text">Start<br/>Talking</span>';
    this.showStatus('Conversation stopped', 'info');
  }

  resetApp() {
    console.log('🔄 RESETTING APP - Clearing all data and reloading...');

    // First stop the conversation
    this.stopConversation();

    // Clear the transcript
    if (this.transcript) {
      this.transcript.innerHTML = '';
      console.log('✅ Transcript cleared');
    }

    // Clear local storage (if any settings are saved)
    try {
      localStorage.clear();
      console.log('✅ Local storage cleared');
    } catch (err) {
      console.warn('⚠️ Could not clear local storage:', err);
    }

    // Show reset message
    this.showStatus('Resetting app...', 'info');

    // Reload the page after a short delay
    setTimeout(() => {
      console.log('🔄 Reloading page...');
      window.location.reload();
    }, 500);
  }

  async playAudioAndAnimate(audioBytes, text) {
    try {
      console.log('🎵 Playing audio, bytes:', audioBytes.length);

      // Switch from idle video to avatar canvas when speaking
      this.showAvatarCanvas();

      // Stop any currently playing audio first
      this.stopAudioPlayback();

      // Ensure we have an audio context
      if (!this.audioContext || this.audioContext.state === 'closed') {
        console.log('⚠️ Creating new AudioContext for playback');
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 16000,
        });
      }

      // Resume audio context if suspended
      if (this.audioContext.state === 'suspended') {
        console.log('▶️ Resuming AudioContext');
        await this.audioContext.resume();
      }

      // Convert audio bytes to AudioBuffer
      const audioData = new Uint8Array(audioBytes);
      console.log('🎵 Audio data length:', audioData.length);

      // Convert PCM16 to AudioBuffer
      const audioBuffer = await this.pcm16ToAudioBuffer(audioData);
      console.log('🎵 AudioBuffer created, duration:', audioBuffer.duration);

      // Play audio
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);

      // Track playback state
      this.isPlayingAudio = true;
      this.currentAudioSource = source;

      source.start(0);
      console.log('🔊 Audio playback started');

      // Animate avatar with phonemes
      if (text) {
        const phonemeConverter = new PhonemeConverter();
        const phonemes = phonemeConverter.textToPhonemes(text);
        await this.avatar.animatePhonemeSequence(phonemes);
      }

      // Wait for audio to finish
      await new Promise((resolve) => {
        source.onended = () => {
          console.log('✅ Audio playback finished');
          this.isPlayingAudio = false;
          this.currentAudioSource = null;

          // CRITICAL: Stop animation immediately when audio ends
          if (this.avatar) {
            this.avatar.stopAnimation();
          }

          // Return to idle video when done speaking
          this.showIdleVideo();

          resolve();
        };
      });
    } catch (err) {
      console.error('❌ Error playing audio:', err);
      this.isPlayingAudio = false;
      this.currentAudioSource = null;

      // Return to idle video on error too
      this.showIdleVideo();
    }
  }

  stopAudioPlayback() {
    console.log('⏹️ STOPPING AUDIO PLAYBACK');

    // Clear audio queue
    this.audioQueue = [];

    // Stop current audio
    if (this.isPlayingAudio && this.currentAudioSource) {
      try {
        this.currentAudioSource.stop();
        this.currentAudioSource.disconnect();
      } catch (err) {
        console.warn('⚠️ Error stopping audio source:', err);
      }
    }

    this.isPlayingAudio = false;
    this.currentAudioSource = null;

    // CRITICAL: Stop avatar animation AND reset to neutral
    if (this.avatar) {
      this.avatar.stopAnimation(); // Stop mouth movement immediately!
      this.avatar.setEmotion('neutral');
    }
  }

  async pcm16ToAudioBuffer(pcm16Data) {
    // PCM16 is 16-bit signed integers, 2 bytes per sample
    const numSamples = pcm16Data.length / 2;
    const audioBuffer = this.audioContext.createBuffer(1, numSamples, 16000);
    const channelData = audioBuffer.getChannelData(0);

    // Convert PCM16 to float32 (-1.0 to 1.0)
    for (let i = 0; i < numSamples; i++) {
      const int16 = (pcm16Data[i * 2 + 1] << 8) | pcm16Data[i * 2];
      // Convert to signed int16
      const signed = int16 > 32767 ? int16 - 65536 : int16;
      // Normalize to -1.0 to 1.0
      channelData[i] = signed / 32768.0;
    }

    return audioBuffer;
  }

  async toggleCamera() {
    console.log('📷 toggleCamera called, current state:', this.cameraActive);

    if (this.cameraActive) {
      // Turn off camera
      console.log('📷 Turning camera OFF');
      if (this.cameraStream) {
        this.cameraStream.getTracks().forEach((track) => track.stop());
        this.cameraStream = null;
      }

      // Stop vision analysis
      if (this.visionCheckInterval) {
        clearInterval(this.visionCheckInterval);
        this.visionCheckInterval = null;
      }

      this.cameraPreview.style.display = 'none';
      this.cameraToggleBtn.classList.remove('active');
      this.cameraActive = false;
      this.lastVisionAnalysis = null;
      console.log('📷 Camera disabled');
      this.showStatus('Camera disabled', 'info');

      // Notify backend that camera is off
      if (this.socket && this.isConnected) {
        this.socket.emit('camera_status', { active: false });
      }
    } else {
      // Turn on camera
      console.log('📷 Turning camera ON');
      try {
        console.log('📷 Requesting camera access...');
        this.cameraStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
          },
        });
        console.log('📷 Camera stream obtained:', this.cameraStream);
        this.cameraPreviewVideo.srcObject = this.cameraStream;
        this.cameraPreview.style.display = 'block';
        this.cameraToggleBtn.classList.add('active');
        this.cameraActive = true;
        console.log('📷 Camera enabled, cameraActive =', this.cameraActive);
        this.showStatus('Camera enabled - I can see you now!', 'success');

        // Notify backend that camera is on
        if (this.socket && this.isConnected) {
          this.socket.emit('camera_status', { active: true });
        }

        // Start periodic vision analysis (every 5 seconds)
        this.startVisionAnalysis();
      } catch (err) {
        console.error('❌ Camera access denied:', err);
        this.showStatus('Camera access denied', 'error');
      }
    }
  }

  /**
   * Capture current camera frame as base64 image
   */
  captureCurrentFrame() {
    if (!this.cameraActive || !this.cameraPreviewVideo) {
      console.warn('⚠️ Camera not active, cannot capture frame');
      return null;
    }

    try {
      // Create canvas to capture frame
      const canvas = document.createElement('canvas');
      canvas.width = this.cameraPreviewVideo.videoWidth || 640;
      canvas.height = this.cameraPreviewVideo.videoHeight || 480;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(this.cameraPreviewVideo, 0, 0, canvas.width, canvas.height);

      // Get base64 image (JPEG format, 80% quality)
      const base64Image = canvas.toDataURL('image/jpeg', 0.8);
      console.log('📸 Captured camera frame');
      return base64Image;
    } catch (err) {
      console.error('❌ Error capturing frame:', err);
      return null;
    }
  }

  /**
   * Start periodic vision analysis to detect scene changes
   */
  startVisionAnalysis() {
    // Clear any existing interval
    if (this.visionCheckInterval) {
      clearInterval(this.visionCheckInterval);
    }

    // Analyze scene every 5 seconds
    this.visionCheckInterval = setInterval(() => {
      if (this.cameraActive && this.isConversationActive) {
        this.analyzeCurrentScene();
      }
    }, 5000);
  }

  /**
   * Analyze current camera scene (SILENT - just updates context)
   */
  async analyzeCurrentScene() {
    const frame = this.captureCurrentFrame();
    if (!frame) return;

    // Send to backend for SILENT vision analysis (immediate: false)
    if (this.socket && this.isConnected) {
      this.socket.emit('analyze_vision', {
        image: frame,
        prompt: 'Briefly describe what you see in this image in one sentence.',
        immediate: false, // SILENT - don't generate spoken response
      });
    }
  }

  /**
   * Request immediate vision analysis (when user asks "can you see" etc.)
   */
  async requestVisionAnalysis(userPrompt = null) {
    const frame = this.captureCurrentFrame();
    if (!frame) {
      this.showStatus('Camera not active', 'error');
      return null;
    }

    console.log('👁️ Requesting vision analysis...');
    this.showStatus('Analyzing what I see...', 'info');

    // Send to backend for vision analysis
    if (this.socket && this.isConnected) {
      const prompt = userPrompt || 'Describe everything you see in this image in detail.';
      this.socket.emit('analyze_vision', {
        image: frame,
        prompt: prompt,
        immediate: true, // Flag for immediate response
      });
    }
  }

  /**
   * Take photo with countdown and flash effect
   */
  async takePhotoWithCountdown() {
    console.log('📸 Starting photo countdown...');

    // Create countdown overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 120px;
      font-weight: bold;
      color: white;
      z-index: 10000;
      background: rgba(0, 0, 0, 0.5);
      text-shadow: 0 0 20px rgba(0, 0, 0, 0.8);
    `;
    document.body.appendChild(overlay);

    try {
      // Countdown 3-2-1
      for (let i = 3; i > 0; i--) {
        overlay.textContent = i;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Play camera click sound
      const clickSound = new Audio('mp4/camera-click.mp3');
      clickSound.play().catch((err) => console.warn('Could not play camera click:', err));

      // Flash white
      overlay.style.background = 'white';
      overlay.textContent = '';

      // Capture photo
      const frame = this.captureCurrentFrame();

      if (frame) {
        // Download image
        const link = document.createElement('a');
        link.href = frame;
        link.download = `novo-photo-${Date.now()}.jpg`;
        link.click();

        console.log('✅ Photo captured and saved!');
        this.showStatus('Photo saved!', 'success');

        // Send photo to backend for vision analysis
        console.log('📤 Sending photo to backend for vision analysis...');
        this.socket.emit('photo_captured', { image: frame });
      } else {
        console.error('❌ Failed to capture photo');
        this.showStatus('Failed to capture photo', 'error');
      }

      // Remove overlay after flash
      setTimeout(() => {
        document.body.removeChild(overlay);
      }, 200);
    } catch (err) {
      console.error('❌ Error taking photo:', err);
      document.body.removeChild(overlay);
      this.showStatus('Error taking photo', 'error');
    }
  }

  updateEmotionButtons(emotions) {
    // Map ALL 53 Hume AI emotions to NoVo's 6 emotion buttons
    const emotionMapping = {
      // HAPPY emotions (positive, energetic, joyful, surprised)
      Joy: 'happy',
      Amusement: 'happy',
      Excitement: 'happy',
      Satisfaction: 'happy',
      Triumph: 'happy',
      Admiration: 'happy',
      Adoration: 'happy',
      Ecstasy: 'happy',
      Love: 'happy',
      Pride: 'happy',
      'Aesthetic Appreciation': 'happy',
      Entrancement: 'happy',
      Nostalgia: 'happy',
      Romance: 'happy',
      Sympathy: 'happy',
      Craving: 'happy',
      Desire: 'happy',
      'Surprise (positive)': 'happy',

      // SAD emotions (negative, low energy, melancholic, fearful)
      Sadness: 'sad',
      Disappointment: 'sad',
      Distress: 'sad',
      Grief: 'sad',
      Despair: 'sad',
      Shame: 'sad',
      Guilt: 'sad',
      Boredom: 'sad',
      Tiredness: 'sad',
      Awkwardness: 'sad',
      Embarrassment: 'sad',
      Pain: 'sad',
      Fear: 'sad',
      Terror: 'sad',

      // ANGRY emotions (negative, high energy, aggressive)
      Anger: 'angry',
      Contempt: 'angry',
      Annoyance: 'angry',
      Rage: 'angry',
      Envy: 'angry',
      Horror: 'angry',

      // THINKING emotions (cognitive, focused, contemplative)
      Concentration: 'thinking',
      Contemplation: 'thinking',
      Interest: 'thinking',
      Realization: 'thinking',
      Confusion: 'thinking',
      Determination: 'thinking',
      'Surprise (negative)': 'thinking',
      'Surprise (positive)': 'thinking',

      // SUSPICIOUS emotions (cautious, uncertain, worried, distrustful)
      Suspicion: 'suspicious',
      Doubt: 'suspicious',
      Anxiety: 'suspicious',
      Fear: 'suspicious',
      Nervousness: 'suspicious',
      Worry: 'suspicious',
      Concern: 'suspicious',
      Terror: 'suspicious',
      Disgust: 'suspicious',

      // NEUTRAL emotions (calm, balanced, relaxed)
      Calmness: 'neutral',
      Contentment: 'neutral',
      Relief: 'neutral',
      Serenity: 'neutral',
    };

    // Color schemes for each emotion
    const emotionColors = {
      happy: { r: 0, g: 255, b: 0 }, // Green
      sad: { r: 0, g: 100, b: 255 }, // Blue
      angry: { r: 255, g: 0, b: 0 }, // Red
      thinking: { r: 128, g: 0, b: 128 }, // Purple
      suspicious: { r: 255, g: 165, b: 0 }, // Orange
      neutral: { r: 128, g: 128, b: 128 }, // Gray
    };

    // Calculate intensity for each NoVo emotion
    const emotionIntensities = {
      happy: 0,
      sad: 0,
      angry: 0,
      thinking: 0,
      suspicious: 0,
      neutral: 0,
    };

    // Sum up scores for each mapped emotion
    Object.entries(emotions).forEach(([emotionName, score]) => {
      const mappedEmotion = emotionMapping[emotionName];
      if (mappedEmotion) {
        emotionIntensities[mappedEmotion] += score;
      }
    });

    // Update button colors based on intensity
    this.emotionButtons.forEach((btn) => {
      const emotion = btn.dataset.emotion;
      const intensity = emotionIntensities[emotion] || 0;

      if (intensity > 0.05) {
        // Only light up if intensity is significant
        const color = emotionColors[emotion];
        const alpha = Math.min(intensity * 2, 1); // Amplify for visibility (max 1.0)

        // Apply glowing effect
        btn.style.backgroundColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha * 0.6})`;
        btn.style.boxShadow = `0 0 ${10 + intensity * 20}px rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
        btn.style.opacity = '1';
        btn.style.transform = `scale(${1 + intensity * 0.2})`; // Slight scale effect
      } else {
        // Reset to default
        btn.style.backgroundColor = '';
        btn.style.boxShadow = '';
        btn.style.opacity = '0.5';
        btn.style.transform = 'scale(1)';
      }
    });
  }

  sendConfigUpdate() {
    if (this.socket && this.isConnected) {
      this.socket.emit('update_config', this.config);
      console.log('📤 Config updated:', this.config);
    }
  }

  showStatus(message, type = 'info') {
    if (!this.status) return;

    this.status.textContent = message;
    this.status.className = 'status';

    if (type === 'success') {
      this.status.style.color = '#4CAF50';
    } else if (type === 'error') {
      this.status.style.color = '#f44336';
    } else if (type === 'info') {
      this.status.style.color = '#2196F3';
    }
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.novoApp = new NovoVoiceApp();
  });
} else {
  window.novoApp = new NovoVoiceApp();
}
