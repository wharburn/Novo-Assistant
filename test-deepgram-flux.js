#!/usr/bin/env node

/**
 * Test Deepgram Flux Connection
 * Verifies STT works with end-of-turn detection
 */

const DeepgramFlux = require('./deepgram-flux-service.js');
const fs = require('fs');
const path = require('path');

async function testFlux() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    console.error('❌ DEEPGRAM_API_KEY not set');
    process.exit(1);
  }

  console.log('🧪 Testing Deepgram Flux Connection\n');

  const deepgram = new DeepgramFlux(apiKey);

  try {
    // Connect to Flux
    const { ws, send, close } = await deepgram.connect({
      model: 'flux-general-en',
      vad: true,
      eot_threshold: 0.7,
      eager_eot_threshold: 0.5  // Enable early responses
    });

    console.log('✅ Connected to Deepgram Flux!\n');

    let transcripts = [];
    let endOfTurns = [];

    // Set up message handler
    deepgram.setMessageHandler((msg) => {
      if (msg.type === 'Results') {
        if (msg.channel?.alternatives?.[0]?.transcript) {
          const transcript = msg.channel.alternatives[0].transcript;
          console.log(`📝 Transcript: "${transcript}"`);
          transcripts.push(transcript);
        }
      } else if (msg.type === 'EndOfTurn') {
        console.log(`🛑 END OF TURN detected`);
        endOfTurns.push(Date.now());
      } else if (msg.type === 'EagerEndOfTurn') {
        console.log(`⚡ EAGER END OF TURN detected (early response opportunity)`);
      } else if (msg.type === 'error') {
        console.error(`❌ Flux error:`, msg.error);
      }
    });

    console.log('📋 Listening for audio...');
    console.log('   (Waiting for audio input. Press Ctrl+C to exit)\n');

    // Keep connection alive
    await new Promise((resolve) => {
      setTimeout(() => {
        console.log('\n✨ Test completed');
        console.log(`   Transcripts received: ${transcripts.length}`);
        console.log(`   End-of-turn detections: ${endOfTurns.length}`);
        close();
        resolve();
      }, 60000); // Run for 60 seconds
    });

  } catch (err) {
    console.error('❌ Failed to test Flux:', err.message);
    process.exit(1);
  }
}

testFlux();
