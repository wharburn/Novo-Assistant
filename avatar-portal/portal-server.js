require('dotenv').config();

const express = require('express');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');
const fs = require('fs');

// Deepgram for transcription (STT)
let deepgramClient = null;
const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
const useFlux = process.env.USE_DEEPGRAM_FLUX !== 'false'; // Default to Flux (true)

if (deepgramApiKey) {
  try {
    if (useFlux) {
      // Use raw WebSocket service for more control over Flux
      const DeepgramFluxService = require('../deepgram-flux-service');
      deepgramClient = new DeepgramFluxService(deepgramApiKey);
      console.log(`✅ Deepgram Flux initialized (WebSocket, real-time STT)`);
    } else {
      const DeepgramService = require('../deepgram-service');
      deepgramClient = new DeepgramService(deepgramApiKey);
      console.log(`✅ Deepgram Nova initialized (batch mode)`);
    }
  } catch (err) {
    console.warn('⚠️  Deepgram not available:', err.message);
  }
} else {
  console.warn('⚠️  DEEPGRAM_API_KEY not set in environment');
}

// ElevenLabs for TTS (voice synthesis with Lisa voice)
let elevenLabsClient = null;
const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

if (elevenLabsApiKey) {
  try {
    const ElevenLabsTTS = require('../elevenlabs-tts-service');
    elevenLabsClient = new ElevenLabsTTS(elevenLabsApiKey);
    console.log(`✅ ElevenLabs TTS initialized (Lisa voice)`);
  } catch (err) {
    console.warn('⚠️  ElevenLabs not available:', err.message);
  }
} else {
  console.warn('⚠️  ELEVENLABS_API_KEY not set in environment');
}

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3001;
const frontendPath = path.join(__dirname, 'code');
const uploadsPath = path.join(__dirname, 'server', 'uploads');

// Middleware
app.use(express.json());
app.use(express.static(frontendPath));

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// API Routes

// Get recent uploads
app.get('/api/uploads', (req, res) => {
  try {
    if (!fs.existsSync(uploadsPath)) {
      return res.json({ uploads: [] });
    }

    const dirs = fs.readdirSync(uploadsPath);
    const uploads = dirs
      .map((dir) => {
        const fullPath = path.join(uploadsPath, dir);
        const stats = fs.statSync(fullPath);
        const files = fs.readdirSync(fullPath);
        return {
          name: dir,
          timestamp: stats.mtime.getTime(),
          files: files.length,
          fileList: files,
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);

    res.json({ uploads });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', port: PORT });
});

// Test endpoint - simulate a message and get response from bridge
app.post('/api/test-message', express.json(), (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'No text provided' });
  }

  console.log(`\n📝 TEST: Sending "${text}" to bridge...`);

  getNovoResponse(text, {
    emit: (event, data) => {
      console.log(`📤 Would emit ${event}:`, data);
    },
  });

  res.json({
    status: 'testing',
    message: 'Check server logs for bridge response',
    testMessage: text,
  });
});

// Flux WebSocket connections per user
const fluxConnections = new Map();

// Audio buffer per user
const audioBuffers = new Map();

// WebSocket events
io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);

  // Initialize audio buffer for this connection
  audioBuffers.set(socket.id, {
    buffer: Buffer.alloc(0),
    lastProcessed: Date.now(),
    chunkCount: 0,
  });

  // Handle join event
  socket.on('join', async (data) => {
    console.log(`👤 User joined: ${data.userId} (${data.name})`);
    socket.userId = data.userId;
    socket.userName = data.name;

    const greeting = `Hello ${data.name}! I'm Novo. How can I help?`;

    // Send session-started event to acknowledge connection
    socket.emit('session-started', {
      greeting,
      sessionId: socket.id,
      userId: data.userId,
    });

    // Auto-greet with voice: Convert text to speech and play
    console.log(`💬 Auto-greeting user with voice: "${greeting}"`);
    try {
      if (elevenLabsClient) {
        console.log(`🎙️  Synthesizing greeting audio with Lisa voice...`);
        const audioBase64 = await elevenLabsClient.synthesizeText(greeting);

        if (audioBase64) {
          console.log(`✅ Greeting audio ready (${audioBase64.length} chars)`);

          // Send greeting response with audio
          socket.emit('response-start', { emotion: 'happy' });
          socket.emit('text-response', { text: greeting });
          socket.emit('audio-response', {
            audioBase64,
            emotion: 'happy',
            isGreeting: true,
          });
          socket.emit('response-complete');
        }
      }
    } catch (err) {
      console.warn(`⚠️  Greeting TTS failed: ${err.message} (continuing without audio)`);
      // Fall back to text-only greeting
      socket.emit('response-start', { emotion: 'happy' });
      socket.emit('text-response', { text: greeting });
      socket.emit('response-complete');
    }
  });

  // Handle emotion change
  socket.on('emotion-change', (data) => {
    console.log(`😊 Emotion changed to: ${data.emotion}`);
    io.emit('emotion-updated', { emotion: data.emotion, clientId: socket.id });
  });

  // Handle emotion button selection
  socket.on('set-emotion', (data) => {
    console.log(`🎨 ${socket.userName} set emotion to: ${data.emotion}`);
    socket.emit('emotion-set', { emotion: data.emotion });
  });

  // Handle avatar animation
  socket.on('avatar-animation', (data) => {
    console.log(`🎬 Animation triggered: ${data.text}`);
    io.emit('avatar-animate', { text: data.text, emotion: data.emotion });
  });

  // Handle text message
  socket.on('text-message', (data) => {
    console.log(`💬 Message from ${socket.userName}: ${data.text}`);
    socket.emit('response-complete', { text: 'Message received' });
  });

  // Handle audio stream chunk
  let audioChunkCount = 0;
  socket.on('audio-stream', async (data) => {
    try {
      audioChunkCount++;
      if (audioChunkCount === 1) {
        console.log(
          `📥 FIRST AUDIO CHUNK RECEIVED from ${socket.userName} (Flux enabled: ${useFlux})`
        );
      }
      if (audioChunkCount % 10 === 0) {
        console.log(`📥 Backend received ${audioChunkCount} audio chunks from frontend...`);
      }

      if (!data || !data.chunk) {
        console.warn(`⚠️  Empty audio chunk at count ${audioChunkCount}`);
        return;
      }

      // Convert base64 to Buffer (binary audio data)
      let audioChunk;
      if (typeof data.chunk === 'string') {
        // Base64 from frontend → binary Buffer
        audioChunk = Buffer.from(data.chunk, 'base64');
      } else if (data.chunk instanceof ArrayBuffer) {
        audioChunk = Buffer.from(data.chunk);
      } else if (Buffer.isBuffer(data.chunk)) {
        audioChunk = data.chunk;
      } else {
        console.warn(`⚠️  Unknown audio chunk type: ${typeof data.chunk}`);
        return;
      }

      // Debug first chunk details
      if (audioChunkCount === 1) {
        console.log(
          `   Chunk size: ${audioChunk.length} bytes (expected ~1024-2560 for PCM16 @ 16kHz)`
        );
        console.log(`   Buffer type: ${audioChunk.constructor.name}`);
      }

      // Get or initialize Flux connection for this user
      let fluxState = fluxConnections.get(socket.id);
      if (!fluxState) {
        // First chunk from this user - establish Flux connection
        if (deepgramClient && useFlux) {
          try {
            console.log(`🔌 Establishing Flux connection for ${socket.userName}...`);
            console.log(`   Model: flux-general-en`);
            console.log(`   Encoding: linear16 (PCM16)`);
            console.log(`   Sample rate: 16000 Hz`);

            const fluxConnection = await deepgramClient.connect({
              model: 'flux-general-en',
              encoding: 'linear16',
              sample_rate: 16000,
              eot_threshold: 0.7,
              eot_timeout_ms: 5000,
            });

            fluxState = {
              ws: fluxConnection.ws,
              send: fluxConnection.send,
              close: fluxConnection.close,
              connection: fluxConnection,
              connected: true,
              lastTranscript: '',
              chunksSent: 0,
              bytesTotal: 0,
              messageHandler: (msg) => {
                // Handle Flux messages for this specific user/socket
                handleFluxMessage(msg, socket);
              },
            };

            // Set the message handler on the deepgramClient for this connection
            deepgramClient.setMessageHandler(fluxState.messageHandler);

            fluxConnections.set(socket.id, fluxState);
            console.log(`✅ Flux connected for ${socket.userName} - ready to receive audio`);
          } catch (err) {
            console.error(`❌ Failed to connect to Flux: ${err.message}`);
            console.error(`   Stack: ${err.stack?.substring(0, 300)}`);
            socket.emit('error', { message: 'Flux connection failed: ' + err.message });
            return;
          }
        }
      }

      // Send audio chunk to Flux WebSocket
      if (fluxState && fluxState.send) {
        try {
          fluxState.send(audioChunk);
          fluxState.chunksSent++;
          fluxState.bytesTotal += audioChunk.length;

          if (fluxState.chunksSent === 1) {
            console.log(`📤 FIRST AUDIO CHUNK SENT TO FLUX (${audioChunk.length} bytes)`);
          }
          if (fluxState.chunksSent % 10 === 0) {
            const kbSent = (fluxState.bytesTotal / 1024).toFixed(1);
            const durationSec = (fluxState.bytesTotal / 16000 / 2).toFixed(1); // 16kHz * 2 bytes (16-bit)
            console.log(
              `   Sent ${fluxState.chunksSent} chunks (${kbSent} KB, ~${durationSec}s audio)`
            );
          }
        } catch (err) {
          console.error(`❌ Failed to send audio to Flux: ${err.message}`);
        }
      }
    } catch (err) {
      console.error('Audio stream error:', err);
    }
  });

  // Handle transcript
  socket.on('transcript', (data) => {
    console.log(`📝 Transcript: ${data.text}`);
    io.emit('transcript-update', { text: data.text, confidence: data.confidence });
  });

  // Handle camera frame
  socket.on('camera-frame-capture', (data) => {
    console.log(`📷 Camera frame from ${socket.userName}`);
  });

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id} (${socket.userName})`);

    // Clean up Flux connection
    const fluxState = fluxConnections.get(socket.id);
    if (fluxState && fluxState.close) {
      fluxState.close();
    }
    fluxConnections.delete(socket.id);
    audioBuffers.delete(socket.id);
  });
});

/**
 * Handle Flux state machine messages
 */
function handleFluxMessage(msg, socket) {
  if (!msg) return;

  // Track state and transcripts
  let fluxState = fluxConnections.get(socket.id);
  if (!fluxState) return;

  switch (msg.event) {
    case 'StartOfTurn':
      console.log(`🎤 ${socket.userName}: Started speaking`);
      socket.emit('stream-status', { status: 'listening', message: 'Recording...' });
      break;

    case 'Update':
      // Partial transcription - send to client for real-time display
      if (msg.transcript && msg.transcript !== fluxState.lastTranscript) {
        fluxState.lastTranscript = msg.transcript;
        socket.emit('transcription-partial', {
          text: msg.transcript,
          confidence: msg.end_of_turn_confidence,
          isFinal: false,
        });
      }
      break;

    case 'EagerEndOfTurn':
      console.log(`⚡ ${socket.userName}: EagerEndOfTurn - "${msg.transcript}"`);
      // Optional: Could start preparing response here
      socket.emit('transcription-intermediate', {
        text: msg.transcript,
        confidence: msg.end_of_turn_confidence,
      });
      break;

    case 'TurnResumed':
      console.log(`🔄 ${socket.userName}: Continued speaking`);
      // User still talking, don't process yet
      break;

    case 'EndOfTurn':
      console.log(
        `🛑 ${socket.userName}: EndOfTurn - "${msg.transcript}" (conf: ${(msg.end_of_turn_confidence * 100).toFixed(0)}%)`
      );

      if (msg.transcript && msg.transcript.trim()) {
        // Send final transcription
        socket.emit('transcription-final', {
          text: msg.transcript,
          confidence: msg.end_of_turn_confidence,
          isFinal: true,
        });

        // Get Novo's response
        console.log(`✅ Sending to Novo for response...`);
        getNovoResponse(msg.transcript, socket);
      }
      break;

    case 'error':
      console.error(`❌ Flux error: ${msg.error}`);
      socket.emit('transcription-error', { message: msg.error });
      break;
  }
}

/**
 * Get response from Novo via bridge
 */
function getNovoResponse(userText, socket, isGreeting = false) {
  const greetingLabel = isGreeting ? ' [GREETING]' : '';
  console.log(`📤 Sending to bridge${greetingLabel}: "${userText}"`);

  const postData = JSON.stringify({
    userId: socket.userId || socket.id,
    text: userText,
    emotion: 'neutral',
  });

  const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/message',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
    timeout: 5000,
  };

  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        const responseText =
          response.response || response.text || 'I heard you, but I need a moment to think.';
        const emotion = response.emotion || 'neutral';

        console.log(`🤖 Novo: "${responseText}" (${emotion})`);

        // Send response to client
        socket.emit('response-start', { emotion });
        socket.emit('text-response', { text: responseText });

        // Placeholder for phoneme sequence (if available)
        socket.emit('phoneme-sequence', { phonemes: [] });

        // Try to synthesize audio with ElevenLabs (or fallback to Deepgram)
        if (elevenLabsClient) {
          elevenLabsClient
            .synthesizeText(responseText)
            .then((audioBase64) => {
              if (audioBase64) {
                socket.emit('audio-response', { audioBase64, emotion });
              }
              socket.emit('response-complete');
            })
            .catch((err) => {
              console.warn('ElevenLabs TTS failed:', err.message);
              socket.emit('response-complete');
            });
        } else if (deepgramClient && deepgramClient.synthesizeText) {
          deepgramClient
            .synthesizeText(responseText)
            .then((audioBase64) => {
              if (audioBase64) {
                socket.emit('audio-response', { audioBase64, emotion });
              }
              socket.emit('response-complete');
            })
            .catch((err) => {
              console.warn('Deepgram TTS failed:', err.message);
              socket.emit('response-complete');
            });
        } else {
          socket.emit('response-complete');
        }
      } catch (err) {
        console.error('Response parse error:', err);
        socket.emit('error', { message: 'Failed to parse response' });
      }
    });
  });

  req.on('error', (err) => {
    console.error('Bridge error:', err.message);

    // Fallback response if bridge is down
    const fallback = "I'm having trouble connecting right now. Can you try again?";
    socket.emit('response-start', { emotion: 'thinking' });
    socket.emit('text-response', { text: fallback });
    socket.emit('response-complete');
  });

  req.on('timeout', () => {
    req.destroy();
    console.error('Bridge timeout');
    socket.emit('error', { message: 'Bridge connection timed out' });
  });

  req.write(postData);
  req.end();
}

// Start server
server.listen(PORT, () => {
  console.log(`\n✨ Avatar Portal running at http://localhost:${PORT}`);
  console.log(`   Frontend: ${frontendPath}`);
  console.log(`   WebSocket: ws://localhost:${PORT}`);
  if (deepgramClient) {
    console.log(`   🎤 Deepgram: Configured (transcription enabled)`);
  } else {
    console.log(`   ⚠️  Deepgram: Not configured (audio won't be transcribed)`);
    console.log(`      Set DEEPGRAM_API_KEY environment variable to enable`);
  }
  console.log(`   Uploads: ${uploadsPath}\n`);
});
