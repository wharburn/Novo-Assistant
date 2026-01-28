#!/usr/bin/env node

/**
 * Test Flux with Authorization header (not URL param)
 * This is what the bash/websocat script uses
 */

const WebSocket = require('ws');

const apiKey = '704e507250448fdec58e53d7bddf18a33d46f1e5';

// URL WITHOUT api_key in query string
const url = 'wss://api.deepgram.com/v2/listen?model=flux-general-en&encoding=linear16&sample_rate=16000&eot_threshold=0.7';

console.log('🧪 Testing Flux with Authorization header...\n');
console.log(`🔗 URL: wss://api.deepgram.com/v2/listen?model=flux-general-en&...`);
console.log(`🔑 Auth: Authorization: Token ${apiKey.substring(0, 10)}...\n`);

const ws = new WebSocket(url, {
  headers: {
    'Authorization': `Token ${apiKey}`
  }
});

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
  process.exit(1);
});

ws.on('close', () => {
  console.log('\n🔌 Connection closed');
  console.log(`📊 Messages: ${messageCount}`);
  
  if (messageCount > 0) {
    console.log('\n✅ SUCCESS - Flux works with Authorization header!');
  }
});
