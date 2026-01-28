#!/usr/bin/env node

/**
 * Test Flux with raw WebSocket (NO SDK)
 * This is what we're using in the portal (deepgram-flux-service.js)
 */

const WebSocket = require('ws');

const apiKey = process.env.DEEPGRAM_API_KEY;

if (!apiKey) {
  console.error('❌ DEEPGRAM_API_KEY not set');
  process.exit(1);
}

console.log('🧪 Testing Flux WebSocket (raw, no SDK)...\n');

// Build URL properly using URLSearchParams
const url = new URL('wss://api.deepgram.com/v2/listen');
url.searchParams.append('model', 'flux-general-en');
url.searchParams.append('encoding', 'linear16');
url.searchParams.append('sample_rate', '16000');
url.searchParams.append('api_key', apiKey);

console.log(`🔗 URL: wss://api.deepgram.com/v2/listen?...`);
console.log(`🔑 API Key: ${apiKey.substring(0, 10)}...`);
console.log('');

const ws = new WebSocket(url.toString());
let messageCount = 0;

ws.on('open', () => {
  console.log('✅ WebSocket OPEN\n');
  
  // Send 1 second of silence
  const silence = Buffer.alloc(32000, 0);
  for (let i = 0; i < silence.length; i += 2560) {
    ws.send(silence.slice(i, Math.min(i + 2560, silence.length)));
  }
  
  console.log('✅ Audio sent (1 sec silence)\n');
  
  setTimeout(() => {
    console.log('⏹️  Closing...');
    ws.close();
  }, 2000);
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());
    messageCount++;
    
    if (msg.event === 'Connected') {
      console.log('✅ Flux Connected event received');
    } else if (msg.event === 'StartOfTurn') {
      console.log('🎤 StartOfTurn');
    } else if (msg.event === 'Update') {
      console.log(`📝 Update: "${msg.transcript}"`);
    } else if (msg.event === 'EndOfTurn') {
      console.log(`🛑 EndOfTurn: "${msg.transcript}" (confidence: ${(msg.end_of_turn_confidence * 100).toFixed(0)}%)`);
    } else {
      console.log(`📨 Event: ${msg.event}`);
    }
  } catch (e) {
    // Binary data, ignore
  }
});

ws.on('error', (err) => {
  console.error('\n❌ WebSocket ERROR:');
  console.error(`   ${err.message}`);
  console.error(`   Code: ${err.code}`);
  process.exit(1);
});

ws.on('close', () => {
  console.log('\n🔌 Connection closed');
  console.log(`📊 Messages: ${messageCount}`);
  
  if (messageCount > 0) {
    console.log('\n✅ SUCCESS - Flux is accessible!');
    console.log('   Our WebSocket implementation works correctly.');
  } else {
    console.log('\n⚠️  No messages (expected for silence)');
  }
});
