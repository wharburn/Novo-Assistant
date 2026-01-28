#!/usr/bin/env node

/**
 * Test Deepgram SDK v2 endpoint
 * Try using listen.v2.connect() if available
 */

const { createClient } = require("@deepgram/sdk");

async function testDeepgramSDKv2() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  
  if (!apiKey) {
    console.error('❌ DEEPGRAM_API_KEY not set');
    process.exit(1);
  }

  console.log('🧪 Testing Deepgram SDK v2 endpoint...\n');

  const deepgram = createClient(apiKey);

  try {
    // Try v2 endpoint
    console.log('1️⃣  Attempting listen.v2.connect()...\n');
    
    if (deepgram.listen.v2 && deepgram.listen.v2.connect) {
      console.log('✅ v2 endpoint available!\n');
      
      const connection = await deepgram.listen.v2.connect({
        model: "flux-general-en",
        encoding: "linear16",
        sample_rate: 16000
      });

      console.log('✅ Connected to Flux v2!\n');

      // Send test audio
      const silence = Buffer.alloc(32000, 0);
      for (let i = 0; i < silence.length; i += 2560) {
        connection.send(silence.slice(i, Math.min(i + 2560, silence.length)));
      }

      console.log('✅ Audio sent');
      
      setTimeout(() => {
        connection.finalize();
        console.log('\n✨ Test complete - Flux v2 works!');
      }, 2000);

    } else {
      console.log('❌ v2 endpoint NOT available in this SDK version');
      console.log('   Available methods:', Object.keys(deepgram.listen));
    }

  } catch (err) {
    console.error('❌ Error:', err.message || err);
  }

  await new Promise(resolve => setTimeout(resolve, 5000));
}

testDeepgramSDKv2().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
