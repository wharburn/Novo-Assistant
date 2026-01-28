/**
 * NoVo Voice Conversation Backend
 * Integrates Deepgram Flux (STT) + OpenRouter (LLM) + Deepgram TTS
 * Handles real-time voice conversations with the NoVo avatar
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const OpenAI = require('openai');
const WebSocket = require('ws');
const { createClient, LiveTranscriptionEvents, LiveTTSEvents } = require('@deepgram/sdk');

// Configuration
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const HUME_API_KEY = process.env.HUME_API_KEY;
const PORT = process.env.PORT || 3001;

if (!DEEPGRAM_API_KEY) {
  console.error('❌ DEEPGRAM_API_KEY not set!');
  process.exit(1);
}

if (!OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY not set!');
  process.exit(1);
}

if (!HUME_API_KEY || HUME_API_KEY === 'your_hume_api_key_here') {
  console.warn('⚠️ HUME_API_KEY not set - emotion detection will be disabled');
}

// Initialize OpenRouter client (with required headers)
const openrouterClient = new OpenAI({
  apiKey: OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://github.com/novo-one/novo-avatar',
    'X-Title': 'NoVo Voice Conversation',
  },
});

// Express app
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Serve static files
const frontendPath = path.join(__dirname, 'code');
app.use(express.static(frontendPath));
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Session management
const activeSessions = new Map();

// Base system prompt for NoVo
const BASE_SYSTEM_PROMPT = `You are NoVo, a friendly and emotionally intelligent AI companion with vision and photo-taking capabilities. You are warm, conversational, and helpful. Keep your responses concise and natural, as if speaking to a friend. You can express emotions and empathy.

CRITICAL PHOTO INSTRUCTION: When the user mentions taking a photo, picture, or selfie, you MUST respond with this exact message:
"I can take your photo! Just say 'shoot' when you want me to take it."

Do NOT mention buttons, clicking, or any other method. Only voice command "shoot".

PHOTO CAPTURED RESPONSE: When you receive a [PHOTO CAPTURED] system message with vision analysis, respond naturally and enthusiastically like: "Hi, I can see you now! I see you're wearing [describe what you see]" or similar. Be warm and conversational about what you observe.`;

/**
 * Get dynamic system prompt based on camera status
 */
function getSystemPrompt(session) {
  let prompt = BASE_SYSTEM_PROMPT;

  if (session.cameraActive) {
    prompt += `\n\nThe user's camera is currently ON. You can see what they're showing you. When they ask vision-related questions like "can you see this?", "what am I holding?", "look at this", etc., you will receive vision context about what the camera sees. Use this information naturally in your responses.`;

    if (session.lastVisionDescription) {
      prompt += `\n\nCurrent view: ${session.lastVisionDescription}`;
    }
  } else {
    prompt += `\n\nThe user's camera is currently OFF. If they ask you to see something or ask vision-related questions, politely ask them to turn on the camera by clicking the camera button (📷).`;
  }

  return prompt;
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);

  // Initialize session
  activeSessions.set(socket.id, {
    messages: [],
    config: {
      llm_model: 'openai/gpt-4o-mini',
      tts_model: 'aura-asteria-en',
      sample_rate: 16000,
      eot_threshold: 0.8,
      eot_timeout_ms: 3000,
    },
    fluxWs: null,
    conversationActive: false,
    audioBuffer: [],
    lastInterruptTime: 0, // For debouncing interrupt signals
    lastVisionDescription: null, // Store latest vision analysis
    cameraActive: false,
    isGenerating: false, // Prevent multiple simultaneous responses
    humeWs: null, // Hume AI WebSocket for emotion detection
    currentEmotions: {}, // Current detected emotions
  });

  // Start conversation
  socket.on('start_conversation', async (config) => {
    console.log(`🎤 Starting conversation for ${socket.id}`);
    console.log(`📋 Received config:`, config);

    const session = activeSessions.get(socket.id);
    if (!session) {
      console.error(`❌ No session found for ${socket.id}`);
      return;
    }

    // Update config if provided
    if (config) {
      session.config = { ...session.config, ...config };
    }

    session.conversationActive = true;
    session.messages = [];
    console.log(`✅ Session updated, conversationActive = ${session.conversationActive}`);

    // Connect to Deepgram Flux
    await connectToFlux(socket.id);

    // Connect to Hume AI for emotion detection
    await connectToHume(socket.id);

    console.log(`📤 Sending conversation_started to ${socket.id}`);
    socket.emit('conversation_started');
    console.log(`✅ conversation_started event sent`);
  });

  // Stop conversation
  socket.on('stop_conversation', () => {
    console.log(`🛑 Stopping conversation for ${socket.id}`);

    const session = activeSessions.get(socket.id);
    if (!session) return;

    session.conversationActive = false;

    // Close Flux WebSocket
    if (session.fluxWs) {
      session.fluxWs.close();
      session.fluxWs = null;
    }

    // Close Hume WebSocket
    if (session.humeWs) {
      session.humeWs.close();
      session.humeWs = null;
    }

    socket.emit('conversation_stopped');
  });

  // Camera status update
  socket.on('camera_status', (data) => {
    console.log(`📷 Camera status update from ${socket.id}: ${data.active ? 'ON' : 'OFF'}`);

    const session = activeSessions.get(socket.id);
    if (!session) return;

    session.cameraActive = data.active;

    if (!data.active) {
      // Clear vision data when camera is turned off
      session.lastVisionDescription = null;
    }
  });

  // Vision analysis
  socket.on('analyze_vision', async (data) => {
    console.log(`👁️ Vision analysis request from ${socket.id}`);

    const session = activeSessions.get(socket.id);
    if (!session) return;

    try {
      const { image, prompt, immediate } = data;

      // Analyze image using OpenRouter with vision model
      const visionResult = await analyzeImageWithVision(image, prompt);

      console.log(`✅ Vision analysis complete: ${visionResult}`);

      // Store in session (this is SILENT - just updates context)
      session.lastVisionDescription = visionResult;

      // Send result back to client
      socket.emit('vision_result', {
        description: visionResult,
        immediate: immediate || false,
      });

      // ONLY generate spoken response if this was an immediate/explicit request
      // Background analysis should be SILENT
      if (immediate) {
        // Add vision context to conversation
        session.messages.push({
          role: 'user',
          content: prompt,
        });

        session.messages.push({
          role: 'system',
          content: `[VISION CONTEXT] Current camera view: ${visionResult}`,
        });

        // Generate natural response about what was seen
        await generateAgentResponse(socket.id, prompt);
      }
    } catch (err) {
      console.error(`❌ Vision analysis error:`, err);
      socket.emit('vision_result', {
        description: 'Sorry, I had trouble analyzing the image.',
        immediate: data.immediate || false,
        error: true,
      });
    }
  });

  // Photo captured - analyze and respond
  socket.on('photo_captured', async (data) => {
    console.log(`📸 Photo captured from ${socket.id}`);

    const session = activeSessions.get(socket.id);
    if (!session) return;

    try {
      const { image } = data;

      // Analyze the photo
      const visionResult = await analyzeImageWithVision(
        image,
        "Describe what you see in this photo, focusing on the person and what they're wearing. Be specific but concise."
      );

      console.log(`✅ Photo vision analysis complete: ${visionResult}`);

      // Store in session and mark camera as active
      session.lastVisionDescription = visionResult;
      session.cameraActive = true;

      // Add vision context to conversation
      session.messages.push({
        role: 'system',
        content: `[PHOTO CAPTURED] The user just took a photo. You can now see them. Vision analysis: ${visionResult}`,
      });

      // Generate automatic response
      await generateAgentResponse(socket.id, 'Photo taken - describe what you see');
    } catch (err) {
      console.error(`❌ Photo vision analysis error:`, err);
    }
  });

  // Receive audio data
  let audioChunkCount = 0;
  socket.on('audio_data', (data) => {
    const session = activeSessions.get(socket.id);
    if (!session || !session.conversationActive) return;

    // Buffer audio for Flux
    const audioBytes = Buffer.from(data);
    session.audioBuffer.push(audioBytes);

    // Send audio to Hume for emotion analysis (every 10 chunks to avoid overload)
    if (audioChunkCount % 10 === 0) {
      analyzeEmotionsFromAudio(socket.id, audioBytes);
    }

    audioChunkCount++;
    if (audioChunkCount === 1) {
      console.log(`🎙️ Started receiving audio from ${socket.id}`);
    }
    if (audioChunkCount % 50 === 0) {
      console.log(`📡 Received ${audioChunkCount} audio chunks from ${socket.id}`);
    }
  });

  // Update configuration
  socket.on('update_config', (config) => {
    const session = activeSessions.get(socket.id);
    if (!session) return;

    session.config = { ...session.config, ...config };
    console.log(`⚙️ Config updated for ${socket.id}:`, session.config);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);

    const session = activeSessions.get(socket.id);
    if (session && session.fluxWs) {
      session.fluxWs.close();
    }

    activeSessions.delete(socket.id);
  });
});

/**
 * Connect to Deepgram Flux WebSocket for real-time STT
 */
async function connectToFlux(socketId) {
  const session = activeSessions.get(socketId);
  if (!session) return;

  const { config } = session;

  // Build Flux WebSocket URL
  // Using flux-general-en model (Flux API v2)
  const fluxUrl = `wss://api.deepgram.com/v2/listen?model=flux-general-en&encoding=linear16&sample_rate=${config.sample_rate}`;

  console.log(`🔌 Connecting to Deepgram Flux for ${socketId}...`);

  try {
    const ws = new WebSocket(fluxUrl, {
      headers: {
        Authorization: `Token ${DEEPGRAM_API_KEY}`,
      },
    });

    session.fluxWs = ws;

    ws.on('open', () => {
      console.log(`✅ Flux WebSocket opened for ${socketId}`);

      // Start sending buffered audio
      const sendInterval = setInterval(() => {
        if (!session.conversationActive || !ws || ws.readyState !== WebSocket.OPEN) {
          clearInterval(sendInterval);
          return;
        }

        // Send buffered audio chunks
        while (session.audioBuffer.length > 0) {
          const audioChunk = session.audioBuffer.shift();
          ws.send(audioChunk);
        }
      }, 50); // Send every 50ms

      session.sendInterval = sendInterval;
    });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());

        // Log ALL messages from Deepgram for debugging
        console.log(`📨 Deepgram message for ${socketId}:`, JSON.stringify(message, null, 2));

        // Handle connection confirmation
        if (message.type === 'receiveConnected') {
          console.log(`✅ Deepgram Flux connected and ready for ${socketId}`);

          // Handle different Flux event types
          // Deepgram Flux sends: { type: "TurnInfo", event: "StartOfTurn" }
        } else if (message.type === 'TurnInfo') {
          const event = message.event;

          if (event === 'StartOfTurn') {
            console.log(`🎤 User started speaking (${socketId})`);

            // Send interrupt signal (debounced)
            const now = Date.now();
            if (now - session.lastInterruptTime > 500) {
              session.lastInterruptTime = now;
              io.to(socketId).emit('user_started_speaking');
            }
          } else if (event === 'Update') {
            // Partial transcript - ALSO interrupt audio here for more sensitivity
            const transcript = message.transcript || '';
            if (transcript) {
              console.log(`📝 Partial: "${transcript}"`);
              io.to(socketId).emit('interim_transcript', { transcript });

              // CRITICAL: Interrupt audio on ANY speech activity (debounced to prevent spam)
              const now = Date.now();
              if (now - session.lastInterruptTime > 500) {
                session.lastInterruptTime = now;
                io.to(socketId).emit('user_started_speaking');
              }
            }
          } else if (event === 'EndOfTurn') {
            // Final transcript - user finished speaking
            const transcript = message.transcript || '';

            if (transcript && transcript.trim()) {
              console.log(`✅ Final transcript: "${transcript}"`);

              // Emit to client
              io.to(socketId).emit('user_speech', { transcript });

              // Check if this is "shoot" command for photo capture
              if (transcript.toLowerCase().includes('shoot')) {
                console.log(`📸 "Shoot" command detected - frontend will handle photo capture`);
                // Don't add to conversation history or generate response
                // Let the frontend handle the photo countdown
                return;
              }

              // Add to conversation history
              session.messages.push({
                role: 'user',
                content: transcript,
              });

              // Generate AI response
              await generateAgentResponse(socketId, transcript);
            }
          }
        }
      } catch (err) {
        console.error(`❌ Error processing Flux message:`, err);
      }
    });

    ws.on('error', (error) => {
      console.error(`❌ Flux WebSocket error for ${socketId}:`, error);
      io.to(socketId).emit('conversation_error', { error: 'Deepgram connection error' });
    });

    ws.on('close', () => {
      console.log(`🔌 Flux WebSocket closed for ${socketId}`);
      if (session.sendInterval) {
        clearInterval(session.sendInterval);
      }
    });
  } catch (err) {
    console.error(`❌ Failed to connect to Flux:`, err);
    io.to(socketId).emit('conversation_error', { error: 'Failed to connect to Deepgram' });
  }
}

/**
 * Generate AI response using OpenRouter LLM
 */
async function generateAgentResponse(socketId, userMessage) {
  const session = activeSessions.get(socketId);
  if (!session) return;

  // CRITICAL: Only one response at a time!
  if (session.isGenerating) {
    console.log(`⚠️ Already generating response, ignoring new request`);
    return;
  }

  session.isGenerating = true;

  const { config, messages } = session;

  console.log(`🤖 Generating AI response for: "${userMessage}"`);

  try {
    // Check if this is a photo request
    if (isPhotoRequest(userMessage)) {
      console.log(`📸 Photo request detected!`);

      // Tell frontend to turn on camera (if needed) and prepare for photo
      io.to(socketId).emit('turn_on_camera_and_prepare_photo');

      // Let the LLM generate the "say shoot when ready" response naturally
      // Don't return here - let it continue to generate response
    }

    // Check if this is a vision-related query
    if (isVisionQuery(userMessage)) {
      console.log(`👁️ Vision query detected, requesting camera analysis...`);

      // Request immediate vision analysis from frontend
      io.to(socketId).emit('request_vision_analysis', {
        prompt: userMessage,
      });

      // Wait a moment for vision analysis to complete
      // The vision result will be added to context automatically
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Add vision context to the message if available
      if (session.lastVisionDescription) {
        messages.push({
          role: 'system',
          content: `[VISION CONTEXT] You can see through the camera: ${session.lastVisionDescription}`,
        });
      }
    }

    // Call OpenRouter LLM with dynamic system prompt
    const systemPrompt = getSystemPrompt(session);
    const completion = await openrouterClient.chat.completions.create({
      model: config.llm_model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature: 0.7,
      max_tokens: 150,
    });

    const responseText =
      completion.choices[0]?.message?.content || 'I apologize, I did not understand that.';

    console.log(`💬 AI Response: "${responseText}"`);

    // Add to conversation history
    session.messages.push({
      role: 'assistant',
      content: responseText,
    });

    // Emit response text to client
    io.to(socketId).emit('agent_response', { text: responseText });

    // Generate TTS audio
    await generateTTSAudio(socketId, responseText);

    // Clear generating flag
    session.isGenerating = false;
  } catch (err) {
    console.error(`❌ Error generating AI response:`, err);
    io.to(socketId).emit('conversation_error', { error: 'Failed to generate response' });

    // Clear generating flag on error
    session.isGenerating = false;
  }
}
/**
 * Generate TTS audio using Deepgram SDK (copied from working Python implementation)
 */
async function generateTTSAudio(socketId, text) {
  const session = activeSessions.get(socketId);
  if (!session) return;

  const { config } = session;

  console.log(`🔊 *** STARTING TTS GENERATION ***`);
  console.log(`🔊 TTS Text: "${text}"`);
  console.log(`🔊 TTS Model: ${config.tts_model}`);

  try {
    // Create Deepgram TTS WebSocket client using SDK (matching Python bot)
    console.log(`🔊 Creating Deepgram TTS WebSocket client...`);
    const deepgram = createClient(DEEPGRAM_API_KEY);
    const dgTtsWs = deepgram.speak.live({
      model: config.tts_model,
      encoding: 'linear16',
      sample_rate: config.sample_rate,
    });
    console.log(`🔊 TTS WebSocket client created`);

    const audioChunks = [];
    let audioChunksReceived = 0;
    let flushed = false;

    return new Promise((resolve, reject) => {
      // TTS event handlers (matching Python bot implementation)
      dgTtsWs.on(LiveTTSEvents.Open, () => {
        console.log(`🔊 *** TTS WEBSOCKET OPENED ***`);

        // Send text to TTS (matching Python bot pattern)
        console.log(`🔊 Sending text to TTS: "${text}"`);
        dgTtsWs.sendText(text);
        console.log(`🔊 Text sent, now flushing...`);
        dgTtsWs.flush();
        console.log(`🔊 Flush called, waiting for audio chunks...`);
      });

      dgTtsWs.on(LiveTTSEvents.Audio, (data) => {
        audioChunksReceived++;
        console.log(
          `🔊 *** TTS AUDIO DATA RECEIVED *** Chunk #${audioChunksReceived}, ${data.length} bytes`
        );
        audioChunks.push(Buffer.from(data));
        console.log(
          `📊 Total chunks: ${audioChunks.length}, Total bytes: ${audioChunks.reduce((sum, chunk) => sum + chunk.length, 0)}`
        );
      });

      dgTtsWs.on(LiveTTSEvents.Flushed, () => {
        console.log(`🔊 *** TTS FLUSHED EVENT RECEIVED ***`);
        flushed = true;

        // Send audio immediately when flushed (matching Python bot pattern)
        console.log(`✅ TTS generation complete, total chunks: ${audioChunks.length}`);

        if (audioChunks.length > 0) {
          // Combine all audio chunks
          const fullAudio = Buffer.concat(audioChunks);
          console.log(`🎵 *** TTS SUCCESS *** Total bytes: ${fullAudio.length}`);

          // Send audio to client
          console.log(
            `📤 Sending agent_speaking event to ${socketId} with ${fullAudio.length} bytes`
          );
          io.to(socketId).emit('agent_speaking', {
            audio: Array.from(fullAudio),
            text: text,
          });
          console.log(`✅ agent_speaking event sent successfully`);
        } else {
          console.error(`❌ *** TTS FAILED - NO AUDIO CHUNKS RECEIVED ***`);
        }

        // Close the WebSocket (SDK doesn't have finish(), just resolve)
        console.log(`🔊 Flushed event complete, resolving...`);
        resolve();
      });

      dgTtsWs.on(LiveTTSEvents.Close, () => {
        console.log(`🔊 *** TTS WEBSOCKET CLOSED ***`);
        // Audio already sent in Flushed event handler
      });

      dgTtsWs.on(LiveTTSEvents.Error, (error) => {
        console.error(`❌ *** TTS WEBSOCKET ERROR ***`, error);
        reject(error);
      });

      dgTtsWs.on(LiveTTSEvents.Warning, (warning) => {
        console.warn(`⚠️ *** TTS WEBSOCKET WARNING ***`, warning);
      });

      dgTtsWs.on(LiveTTSEvents.Metadata, (metadata) => {
        console.log(`📋 *** TTS METADATA ***`, metadata);
      });
    });
  } catch (err) {
    console.error(`❌ Error generating TTS:`, err);
    io.to(socketId).emit('conversation_error', { error: 'Failed to generate speech' });
  }
}

/**
 * Analyze image using OpenRouter with vision-capable model
 */
async function analyzeImageWithVision(base64Image, prompt) {
  try {
    console.log(`👁️ Analyzing image with vision model...`);

    // Remove data URL prefix if present
    const imageData = base64Image.replace(/^data:image\/\w+;base64,/, '');

    // Use GPT-4 Vision via OpenRouter
    const response = await openrouterClient.chat.completions.create({
      model: 'openai/gpt-4o', // GPT-4o has vision capabilities
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt || 'Describe what you see in this image in detail.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageData}`,
              },
            },
          ],
        },
      ],
      max_tokens: 300,
    });

    const description = response.choices[0]?.message?.content || 'Unable to analyze image';
    console.log(`✅ Vision analysis: ${description}`);
    return description;
  } catch (err) {
    console.error(`❌ Vision analysis error:`, err);
    throw err;
  }
}

/**
 * Check if user message is asking about vision/camera
 */
function isVisionQuery(text) {
  const visionKeywords = [
    'see',
    'look',
    'watch',
    'camera',
    'view',
    'show',
    'what am i',
    'where am i',
    "what's in front",
    'describe',
    'identify',
    'recognize',
  ];

  const lowerText = text.toLowerCase();
  return visionKeywords.some((keyword) => lowerText.includes(keyword));
}

/**
 * Check if user message is requesting a photo
 */
function isPhotoRequest(text) {
  const photoKeywords = [
    'take a picture',
    'take a photo',
    'take photo',
    'take picture',
    'take my photo',
    'take your photo',
    'take my', // Partial phrase - user might say "take my" and get cut off
    'take your', // Partial phrase
    'photograph',
    'snap a photo',
    'capture',
    'selfie',
    'photo', // Catch-all for any mention of "photo"
    'picture', // Catch-all for any mention of "picture"
  ];

  const lowerText = text.toLowerCase();
  console.log(`🔍 Checking if photo request: "${text}"`);
  const isPhoto = photoKeywords.some((keyword) => lowerText.includes(keyword));
  console.log(`🔍 Photo request result: ${isPhoto}`);
  return isPhoto;
}

/**
 * Connect to Hume AI WebSocket for real-time emotion detection
 */
async function connectToHume(socketId) {
  if (!HUME_API_KEY || HUME_API_KEY === 'your_hume_api_key_here') {
    console.log(`⚠️ Hume API key not configured, skipping emotion detection`);
    return;
  }

  const session = activeSessions.get(socketId);
  if (!session) return;

  try {
    console.log(`🎭 Connecting to Hume AI for emotion detection...`);

    // Create WebSocket connection to Hume AI
    const humeWs = new WebSocket('wss://api.hume.ai/v0/stream/models', {
      headers: {
        'X-Hume-Api-Key': HUME_API_KEY,
      },
    });

    session.humeWs = humeWs;

    humeWs.on('open', () => {
      console.log(`✅ Connected to Hume AI for ${socketId}`);
      console.log(`🎭 Hume WebSocket ready - will send models config with each audio chunk`);
    });

    humeWs.on('message', (data) => {
      try {
        const result = JSON.parse(data.toString());
        console.log(`🎭 Hume message received:`, JSON.stringify(result).substring(0, 200));

        // Extract emotion predictions
        if (result.prosody && result.prosody.predictions && result.prosody.predictions.length > 0) {
          const emotions = result.prosody.predictions[0].emotions;

          // Get top 5 emotions
          const topEmotions = emotions
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .reduce((acc, emotion) => {
              acc[emotion.name] = emotion.score;
              return acc;
            }, {});

          session.currentEmotions = topEmotions;

          // Send emotions to frontend
          io.to(socketId).emit('emotions_detected', {
            emotions: topEmotions,
            timestamp: Date.now(),
          });

          console.log(`🎭 Emotions detected:`, Object.keys(topEmotions).join(', '));
        } else if (result.error) {
          console.error(`❌ Hume error:`, result.error);
        }
      } catch (err) {
        console.error(`❌ Error parsing Hume response:`, err);
      }
    });

    humeWs.on('error', (error) => {
      console.error(`❌ Hume WebSocket error for ${socketId}:`, error);
    });

    humeWs.on('close', () => {
      console.log(`🔌 Hume WebSocket closed for ${socketId}`);
    });
  } catch (err) {
    console.error(`❌ Failed to connect to Hume:`, err);
  }
}

/**
 * Send audio to Hume for emotion analysis
 */
// Helper function to create WAV file header
function createWavHeader(dataLength, sampleRate = 16000, numChannels = 1, bitsPerSample = 16) {
  const header = Buffer.alloc(44);

  // "RIFF" chunk descriptor
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4); // File size - 8
  header.write('WAVE', 8);

  // "fmt " sub-chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  header.writeUInt16LE(numChannels, 22); // NumChannels
  header.writeUInt32LE(sampleRate, 24); // SampleRate
  header.writeUInt32LE((sampleRate * numChannels * bitsPerSample) / 8, 28); // ByteRate
  header.writeUInt16LE((numChannels * bitsPerSample) / 8, 32); // BlockAlign
  header.writeUInt16LE(bitsPerSample, 34); // BitsPerSample

  // "data" sub-chunk
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40); // Subchunk2Size

  return header;
}

function analyzeEmotionsFromAudio(socketId, audioBuffer) {
  const session = activeSessions.get(socketId);
  if (!session || !session.humeWs || session.humeWs.readyState !== WebSocket.OPEN) {
    return;
  }

  try {
    // Create WAV file from raw PCM audio
    const wavHeader = createWavHeader(audioBuffer.length, 16000, 1, 16);
    const wavFile = Buffer.concat([wavHeader, audioBuffer]);

    // Convert WAV file to base64
    const base64Audio = wavFile.toString('base64');

    // Send audio data to Hume with models config
    const message = {
      models: {
        prosody: {},
      },
      data: base64Audio,
      stream_window_ms: 2000, // 2 second sliding window for context
    };

    session.humeWs.send(JSON.stringify(message));
    console.log(
      `🎭 Sent WAV audio to Hume (${wavFile.length} bytes, ${audioBuffer.length} bytes PCM data)`
    );
  } catch (err) {
    console.error(`❌ Error sending audio to Hume:`, err);
  }
}

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 NoVo Voice Conversation Backend running on port ${PORT}`);
  console.log(`📡 Frontend: http://localhost:${PORT}`);
  console.log(`🎤 Deepgram Flux: ${DEEPGRAM_API_KEY ? '✅ Ready' : '❌ Not configured'}`);
  console.log(`🤖 OpenRouter: ${OPENROUTER_API_KEY ? '✅ Ready' : '❌ Not configured'}`);
  console.log(`\n💡 Press "Start Talking" to begin a conversation!\n`);
});
