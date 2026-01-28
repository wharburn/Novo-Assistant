#!/usr/bin/env node

/**
 * Direct test of Flux WebSocket connection
 * Does NOT use Socket.IO, bypasses the portal entirely
 * This tests if Flux itself is reachable and working
 */

const WebSocket = require('ws');
const fs = require('fs');

const apiKey = process.env.DEEPGRAM_API_KEY;
if (!apiKey) {
  console.error('❌ DEEPGRAM_API_KEY not set');
  process.exit(1);
}

console.log('🧪 Testing Flux WebSocket connection...\n');

// CRITICAL: Use /v2/listen endpoint with ONLY valid parameters
const url = new URL('wss://api.deepgram.com/v2/listen');
url.searchParams.append('model', 'flux-general-en');
url.searchParams.append('encoding', 'linear16');
url.searchParams.append('sample_rate', '16000');
url.searchParams.append('eot_threshold', '0.7');

console.log(`🔗 URL: ${url.toString()}`);
console.log(`🔑 API Key: ${apiKey.substring(0, 10)}...`);

const ws = new WebSocket(url.toString(), {
  headers: {
    'Authorization': `Token ${apiKey}`
  }
});

let messageCount = 0;
let transcripts = [];

ws.on('open', () => {
  console.log('\n✅ WebSocket OPEN\n');
  
  // Read a sample PCM16 file or generate silence
  console.log('📋 Sending test audio (silence, 1 second)...');
  
  // Generate 1 second of silence at 16kHz PCM16
  // 16000 samples/sec * 2 bytes/sample = 32000 bytes
  const silenceBuffer = Buffer.alloc(32000, 0);
  
  // Send in chunks (80ms = 2560 bytes)
  const chunkSize = 2560;
  for (let i = 0; i < silenceBuffer.length; i += chunkSize) {
    const chunk = silenceBuffer.slice(i, Math.min(i + chunkSize, silenceBuffer.length));
    ws.send(chunk);
  }
  
  console.log('✅ Audio sent\n');
  
  // Wait a bit then close
  setTimeout(() => {
    console.log('⏹️  Closing...');
    ws.close();
  }, 5000);
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());
    messageCount++;
    
    if (msg.event === 'StartOfTurn') {
      console.log(`🎤 Flux: StartOfTurn`);
    } else if (msg.event === 'Update') {
      if (msg.transcript) {
        console.log(`📝 Flux: Update - "${msg.transcript}"`);
        transcripts.push(msg.transcript);
      }
    } else if (msg.event === 'EndOfTurn') {
      console.log(`🛑 Flux: EndOfTurn - "${msg.transcript}" (conf: ${(msg.end_of_turn_confidence * 100).toFixed(0)}%)`);
    } else {
      console.log(`📨 Message ${messageCount}:`, msg.event || msg.type);
    }
  } catch (err) {
    // Binary data, ignore
  }
});

ws.on('error', (err) => {
  console.error('\n❌ WebSocket ERROR:');
  console.error(`   ${err.message}`);
  if (err.code) console.error(`   Code: ${err.code}`);
  process.exit(1);
});

ws.on('close', () => {
  console.log('\n🔌 WebSocket CLOSED');
  console.log(`📊 Messages received: ${messageCount}`);
  console.log(`📊 Transcripts: ${transcripts.length}`);
  if (transcripts.length > 0) {
    console.log(`📝 Transcript: "${transcripts.join(' ')}"`);
  }
  console.log('\n✨ Test complete\n');
});
