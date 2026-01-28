/**
 * Novo Avatar Portal Backend
 * WebSocket server for real-time bidirectional communication
 * Handles voice I/O, user recognition, memory, and response streaming
 */

require('dotenv').config({ path: '/root/clawd/.env.upstash' });

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const DeepgramService = require('./deepgram-service');
const UserProfileManager = require('./user-profiles');
const SessionManager = require('./session-manager');
const PhonemeConverter = require('./phoneme-converter');
const StreamingHandler = require('./portal-backend-streaming');

class PortalBackend {
  constructor(port = 3001) {
    this.port = port;
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: { origin: '*', methods: ['GET', 'POST'] }
    });

    // Initialize services
    this.deepgram = new DeepgramService();
    this.profiles = new UserProfileManager();
    this.sessions = new SessionManager();
    this.phonemeConverter = new PhonemeConverter();

    this.setupRoutes();
    this.setupWebSocket();
  }

  setupRoutes() {
    this.app.use(express.json());

    // Store frames globally for Novo to access
    if (!global.portalFrames) {
      global.portalFrames = new Map();
    }

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Get latest frame from a user
    this.app.get('/camera/:userId', (req, res) => {
      const frame = global.portalFrames.get(req.params.userId);
      if (frame) {
        res.json(frame);
      } else {
        res.status(404).json({ error: 'No frame' });
      }
    });

    // List all active users with frames
    this.app.get('/camera', (req, res) => {
      const users = Array.from(global.portalFrames.keys()).map(userId => ({
        userId,
        timestamp: global.portalFrames.get(userId).timestamp,
        emotion: global.portalFrames.get(userId).emotion
      }));
      res.json(users);
    });

    // Get user profile
    this.app.get('/user/:userId', async (req, res) => {
      try {
        const profile = await this.profiles.getProfile(req.params.userId);
        res.json(profile || { error: 'User not found' });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // List active users
    this.app.get('/users/active', async (req, res) => {
      try {
        const users = this.profiles.listUsers();
        res.json(users);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
  }

  setupWebSocket() {
    this.io.on('connection', (socket) => {
      console.log(`Portal user connected: ${socket.id}`);

      // User joins session
      socket.on('join', async (data) => {
        const { userId, name } = data;

        try {
          // Start session
          const session = await this.sessions.startSession(userId, { emotion: 'neutral' });

          // Load or create profile
          let profile = await this.profiles.getProfile(userId);
          if (!profile) {
            profile = await this.profiles.createOrUpdateProfile(userId, { name: name || 'Guest' });
          }

          // Generate greeting
          const greeting = await this.profiles.generateGreeting(userId);

          socket.emit('session-started', {
            sessionId: session,
            profile,
            greeting
          });

          console.log(`Session started for user: ${userId}`);
        } catch (err) {
          socket.emit('error', { message: err.message });
        }
      });

      // User sends camera frame capture request
      socket.on('camera-frame-capture', async (data) => {
        const { userId, base64, emotion } = data;
        
        // Store frame globally so Novo can access it
        global.portalFrames.set(userId, {
          timestamp: new Date().toISOString(),
          base64,
          emotion,
          size: base64.length
        });
        
        console.log(`📷 Frame stored for ${userId} (${(base64.length / 1024).toFixed(1)}KB), emotion: ${emotion}`);
      });

      // User sends camera frame (legacy)
      socket.on('camera-frame', async (data) => {
        const { userId, frame, detectedEmotion } = data;
        
        global.portalFrames.set(userId, {
          timestamp: new Date().toISOString(),
          base64: frame,
          emotion: detectedEmotion,
          size: frame.length
        });
        
        console.log(`📷 Frame captured from ${userId}, emotion: ${detectedEmotion}`);
      });

      // User sends text message
      socket.on('text-message', async (data) => {
        const { userId, text, emotion } = data;

        try {
          // Convert to phonemes
          const phonemes = this.phonemeConverter.textToPhonemes(text);

          // Update session emotion
          await this.sessions.updateSessionActivity(userId);
          await this.sessions.setConversationContext(userId, { lastMessage: text, emotion });

          // Generate voice response (simplified - would call Novo agent here)
          const responseText = `I heard you say: ${text}`;
          const phonemeSequence = this.phonemeConverter.textToPhonemes(responseText);

          // Stream response
          socket.emit('response-start', { emotion });
          socket.emit('phoneme-sequence', { phonemes: phonemeSequence });
          socket.emit('text-response', { text: responseText });

          // Save conversation
          await this.profiles.saveConversation(userId, text, responseText);

          socket.emit('response-complete');
        } catch (err) {
          socket.emit('error', { message: err.message });
        }
      });

      // User starts streaming audio
      socket.on('stream-start', async (data) => {
        const { userId } = data;
        
        // Create streaming handler for this user
        const streamingHandler = new StreamingHandler(socket, this.deepgram, this.phonemeConverter);
        socket.streamingHandler = streamingHandler;
        
        socket.emit('stream-ready', { streaming: true });
        console.log(`Audio streaming started for user: ${userId}`);
      });

      // User sends streaming audio chunk
      socket.on('audio-stream', async (data) => {
        if (!socket.streamingHandler) return;
        
        try {
          // data.chunk is already a buffer from Socket.IO binary support
          socket.streamingHandler.handleAudioChunk(data.chunk);
        } catch (err) {
          console.error('Stream error:', err);
          socket.emit('error', { message: err.message });
        }
      });

      // User stops streaming
      socket.on('stream-stop', async (data) => {
        const { userId } = data;
        
        if (socket.streamingHandler) {
          // Flush any remaining audio
          await socket.streamingHandler.processAudioBuffer();
          socket.streamingHandler = null;
        }
        
        socket.emit('stream-stopped', { streaming: false });
        console.log(`Audio streaming stopped for user: ${userId}`);
      });

      // User sets emotion
      socket.on('set-emotion', async (data) => {
        const { userId, emotion } = data;

        try {
          await this.sessions.setConversationContext(userId, { emotion });
          socket.emit('emotion-set', { emotion });
        } catch (err) {
          socket.emit('error', { message: err.message });
        }
      });

      // User disconnects
      socket.on('disconnect', async (reason) => {
        console.log(`User disconnected: ${socket.id} - ${reason}`);
      });

      socket.on('error', (err) => {
        console.error(`Socket error: ${err}`);
      });
    });
  }

  start() {
    this.server.listen(this.port, '0.0.0.0', () => {
      console.log(`🚀 Novo Avatar Portal Backend running on port ${this.port}`);
      console.log(`   WebSocket: ws://localhost:${this.port}`);
      console.log(`   REST API: http://localhost:${this.port}`);
    });
  }
}

// Start server if run directly
if (require.main === module) {
  const backend = new PortalBackend(process.env.PORT || 3001);
  backend.start();
}

module.exports = PortalBackend;
