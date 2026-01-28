/**
 * Portal ↔ Clawdbot Bridge
 * Connects the Novo Avatar Portal to Clawdbot main session
 * Routes messages bidirectionally and handles response streaming
 */

const http = require('http');
const DeepgramService = require('./deepgram-service');
const PhonemeConverter = require('./phoneme-converter');

class PortalClawdbotBridge {
  constructor(options = {}) {
    this.deepgram = new DeepgramService();
    this.phonemeConverter = new PhonemeConverter();
    this.port = options.port || 3002;
    this.clawdbotSession = options.clawdbotSession || null;
    
    // Map of active portal sessions to their state
    this.sessions = new Map();
    
    this.startServer();
  }

  startServer() {
    this.server = http.createServer(async (req, res) => {
      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Content-Type', 'application/json');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
        return;
      }

      // Portal sends user message (text or audio)
      if (req.url === '/message' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            const response = await this.handlePortalMessage(data);
            res.writeHead(200);
            res.end(JSON.stringify(response));
          } catch (err) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        return;
      }

      // Get user profile/session
      if (req.url.startsWith('/session/') && req.method === 'GET') {
        const userId = req.url.split('/')[2];
        const session = this.sessions.get(userId) || {};
        res.writeHead(200);
        res.end(JSON.stringify(session));
        return;
      }

      // Get all pending messages for Novo
      if (req.url === '/messages/pending' && req.method === 'GET') {
        const messages = this.getPendingMessages();
        res.writeHead(200);
        res.end(JSON.stringify(messages));
        return;
      }

      // Novo responds to a portal user
      if (req.url === '/messages/respond' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            this.handleResponse(data);
            res.writeHead(200);
            res.end(JSON.stringify({ success: true }));
          } catch (err) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    });

    this.server.listen(this.port, () => {
      console.log(`🌉 Portal ↔ Clawdbot Bridge running on port ${this.port}`);
    });
  }

  /**
   * Handle incoming message from portal
   * Returns: { text, audioUrl, phonemes, emotion, success }
   */
  async handlePortalMessage(data) {
    const { userId, text, audioBase64, emotion = 'neutral' } = data;
    
    // Ensure session exists
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, {
        userId,
        emotion,
        createdAt: new Date(),
        messageCount: 0
      });
    }

    const session = this.sessions.get(userId);
    session.messageCount++;
    session.lastMessage = new Date();
    session.emotion = emotion;

    let userMessage = text;

    // If audio was provided, transcribe it
    if (audioBase64) {
      try {
        const buffer = Buffer.from(audioBase64, 'base64');
        const transcription = await this.deepgram.transcribeBuffer(buffer);
        userMessage = transcription || text || 'unsure';
      } catch (err) {
        console.error('Transcription error:', err.message);
        userMessage = text || 'error transcribing audio';
      }
    }

    console.log(`📨 Portal message from ${userId}: "${userMessage}" (emotion: ${emotion})`);

    // Send to Clawdbot main session
    // This needs to be handled by the Clawdbot side
    // For now, we'll queue it and wait for a response
    const response = await this.sendToClawdbot(userId, userMessage, emotion);

    // Generate audio response
    let audioUrl = null;
    let phonemes = [];
    try {
      if (response.text) {
        // Generate phoneme sequence for animation sync
        phonemes = this.phonemeConverter.convert(response.text);
        
        // Generate audio (would need sag or other TTS)
        // For now, just indicate it's ready
        console.log(`🎤 Generating audio for: "${response.text}"`);
        audioUrl = `/audio/${userId}/${Date.now()}.mp3`;
      }
    } catch (err) {
      console.error('Audio generation error:', err.message);
    }

    return {
      success: true,
      userId,
      userMessage,
      response: response.text,
      emotion: response.emotion || emotion,
      audioUrl,
      phonemes,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Send message to Clawdbot and wait for response
   * Queues message and waits for Novo (main session) to respond
   */
  async sendToClawdbot(userId, message, emotion) {
    const fs = require('fs');
    const path = require('path');
    
    // Queue the message for Novo to pick up
    const queuePath = path.join(__dirname, 'portal-message-queue.md');
    const timestamp = new Date().toISOString();
    const queueEntry = `\n[${timestamp}] **${userId}** (${emotion}): ${message}`;
    
    try {
      fs.appendFileSync(queuePath, queueEntry);
    } catch (err) {
      console.error('Queue error:', err.message);
    }

    // Store pending response for this user
    if (!this.pendingResponses) {
      this.pendingResponses = new Map();
    }

    const pendingKey = `${userId}-${Date.now()}`;
    let responseText = null;
    let responseEmotion = emotion;

    // Wait up to 30 seconds for Novo to respond
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        // Check if response was set
        if (this.pendingResponses.has(pendingKey)) {
          const response = this.pendingResponses.get(pendingKey);
          this.pendingResponses.delete(pendingKey);
          clearInterval(checkInterval);
          resolve({
            text: response.text,
            emotion: response.emotion || emotion
          });
        }
      }, 500);

      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        this.pendingResponses.delete(pendingKey);
        resolve({
          text: `I'm here, but I'm a bit slow at the moment. What would you like to know?`,
          emotion: 'thinking'
        });
      }, 30000);
    });
  }

  /**
   * Get all pending messages (for Novo to read)
   */
  getPendingMessages() {
    const fs = require('fs');
    const path = require('path');
    const queuePath = path.join(__dirname, 'portal-message-queue.md');

    try {
      if (!fs.existsSync(queuePath)) {
        return [];
      }

      const content = fs.readFileSync(queuePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.startsWith('['));
      
      return lines.map(line => {
        // Parse: [timestamp] **userId** (emotion): message
        const match = line.match(/\[([^\]]+)\]\s\*\*([^\*]+)\*\*\s\(([^)]+)\):\s(.+)/);
        if (match) {
          return {
            timestamp: match[1],
            userId: match[2],
            emotion: match[3],
            message: match[4]
          };
        }
        return null;
      }).filter(Boolean);
    } catch (err) {
      console.error('Error reading queue:', err.message);
      return [];
    }
  }

  /**
   * Handle Novo's response to a portal user
   */
  handleResponse(data) {
    const { userId, text, emotion = 'neutral' } = data;

    if (!this.pendingResponses) {
      this.pendingResponses = new Map();
    }

    // Find the matching pending request and fulfill it
    for (const [key, _] of this.pendingResponses) {
      if (key.startsWith(userId)) {
        this.pendingResponses.set(key, { text, emotion });
        console.log(`✅ Response queued for ${userId}: "${text}"`);
        return;
      }
    }

    console.warn(`No pending request found for user: ${userId}`);
  }

  // Method to be called from Clawdbot when responding to portal users
  async receiveClawdbotResponse(userId, text, emotion = 'neutral', audioPath = null) {
    if (!this.sessions.has(userId)) {
      return { error: 'Session not found' };
    }

    const session = this.sessions.get(userId);
    session.lastResponse = text;
    session.emotion = emotion;

    return {
      success: true,
      userId,
      text,
      emotion,
      audioPath,
      phonemes: this.phonemeConverter.convert(text)
    };
  }
}

// Start the bridge
const bridge = new PortalClawdbotBridge({ port: 3002 });

module.exports = bridge;
