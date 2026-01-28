/**
 * Novo Avatar Portal - Debug Mode
 * Logs everything to console for troubleshooting
 */

class DebugPortal {
  constructor() {
    console.log('🔍 DEBUG MODE ENABLED');
    
    this.checks = {
      socketIo: false,
      audioApi: false,
      mediaDevices: false,
      permissions: {}
    };

    this.runDiagnostics();
    this.setupDebugUI();
  }

  async runDiagnostics() {
    console.log('\n=== PORTAL DIAGNOSTICS ===\n');

    // Check Socket.IO
    if (typeof io !== 'undefined') {
      console.log('✅ Socket.IO library loaded');
      this.checks.socketIo = true;
    } else {
      console.error('❌ Socket.IO NOT loaded');
    }

    // Check Web Audio API
    if (window.AudioContext || window.webkitAudioContext) {
      console.log('✅ Web Audio API available');
      this.checks.audioApi = true;
    } else {
      console.error('❌ Web Audio API NOT available');
    }

    // Check getUserMedia
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      console.log('✅ getUserMedia API available');
      this.checks.mediaDevices = true;

      // Test microphone access
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('✅ Microphone accessible');
        this.checks.permissions.microphone = 'granted';
        stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.error('❌ Microphone access denied:', err.name, err.message);
        this.checks.permissions.microphone = err.name;
      }

      // Test camera access
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        console.log('✅ Camera accessible');
        this.checks.permissions.camera = 'granted';
        stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.error('❌ Camera access denied:', err.name, err.message);
        this.checks.permissions.camera = err.name;
      }
    } else {
      console.error('❌ getUserMedia API NOT available');
    }

    // Check browser info
    console.log('\n=== BROWSER INFO ===');
    console.log('User Agent:', navigator.userAgent);
    console.log('Platform:', navigator.platform);
    console.log('Online:', navigator.onLine);

    console.log('\n=== DIAGNOSTICS COMPLETE ===\n');
    this.logDiagnostics();
  }

  logDiagnostics() {
    console.log('📊 Summary:', JSON.stringify(this.checks, null, 2));
  }

  setupDebugUI() {
    // Add debug panel to page
    const panel = document.createElement('div');
    panel.id = 'debug-panel';
    panel.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #1a1a1a;
      color: #00ff00;
      padding: 15px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      max-width: 300px;
      max-height: 400px;
      overflow-y: auto;
      z-index: 9999;
      border: 2px solid #00ff00;
    `;

    panel.innerHTML = `
      <div style="margin-bottom: 10px; font-weight: bold;">🔍 DEBUG PANEL</div>
      <div id="debug-output"></div>
      <button id="test-mic" style="margin-top: 10px; padding: 5px; background: #00ff00; color: #000; border: none; border-radius: 4px; cursor: pointer; width: 100%;">Test Microphone</button>
      <button id="test-camera" style="margin-top: 5px; padding: 5px; background: #00ff00; color: #000; border: none; border-radius: 4px; cursor: pointer; width: 100%;">Test Camera</button>
      <button id="close-debug" style="margin-top: 5px; padding: 5px; background: #ff0000; color: #fff; border: none; border-radius: 4px; cursor: pointer; width: 100%;">Close</button>
    `;

    document.body.appendChild(panel);

    const output = document.getElementById('debug-output');
    output.innerHTML = `
      <div>Socket.IO: ${this.checks.socketIo ? '✅' : '❌'}</div>
      <div>Audio API: ${this.checks.audioApi ? '✅' : '❌'}</div>
      <div>Media Devices: ${this.checks.mediaDevices ? '✅' : '❌'}</div>
      <div>Microphone: ${this.checks.permissions.microphone || '?'}</div>
      <div>Camera: ${this.checks.permissions.camera || '?'}</div>
    `;

    document.getElementById('test-mic').addEventListener('click', () => this.testMicrophone());
    document.getElementById('test-camera').addEventListener('click', () => this.testCamera());
    document.getElementById('close-debug').addEventListener('click', () => panel.remove());
  }

  async testMicrophone() {
    console.log('\n🎤 Testing microphone...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      console.log('✅ Microphone test active. Speak now...');
      
      const checkAudio = setInterval(() => {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const level = data.reduce((a, b) => a + b) / data.length / 255;
        console.log(`Audio level: ${(level * 100).toFixed(1)}%`);
      }, 500);

      setTimeout(() => {
        clearInterval(checkAudio);
        stream.getTracks().forEach(track => track.stop());
        console.log('✅ Microphone test complete');
      }, 5000);
    } catch (err) {
      console.error('❌ Microphone test failed:', err);
    }
  }

  async testCamera() {
    console.log('\n📷 Testing camera...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      console.log('✅ Camera test active');

      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      setTimeout(() => {
        stream.getTracks().forEach(track => track.stop());
        console.log('✅ Camera test complete');
      }, 3000);
    } catch (err) {
      console.error('❌ Camera test failed:', err);
    }
  }
}

// Run on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new DebugPortal();
  });
} else {
  new DebugPortal();
}
