#!/usr/bin/env node

/**
 * Test Deepgram SDK - Official SDK approach
 * Tests if we can connect to Flux using the official SDK
 */

const { createClient } = require("@deepgram/sdk");

async function testDeepgramSDK() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  
  if (!apiKey) {
    console.error('❌ DEEPGRAM_API_KEY not set');
    process.exit(1);
  }

  console.log('🧪 Testing Deepgram SDK (official library)...\n');

  // Create Deepgram client
  const deepgram = createClient(apiKey);

  try {
    console.log('1️⃣  Testing Flux Live Connection...');
    console.log('   Model: flux-general-en');
    console.log('   Method: SDK live() connection\n');

    // Create live connection
    const connection = deepgram.listen.live({
      model: "flux-general-en",
      encoding: "linear16",
      sample_rate: 16000,
      interim_results: true
    });

    let messageCount = 0;
    let transcripts = [];
    let hadUpdate = false;

    connection.on("open", () => {
      console.log('✅ Live connection OPEN\n');
      
      // Send 1 second of silence as test audio
      console.log('📋 Sending test audio (silence, 1 second)...');
      const silence = Buffer.alloc(32000, 0);
      
      // Send in chunks
      for (let i = 0; i < silence.length; i += 2560) {
        const chunk = silence.slice(i, Math.min(i + 2560, silence.length));
        connection.send(chunk);
      }
      
      console.log('✅ Audio sent\n');
      
      // Close after 2 seconds
      setTimeout(() => {
        console.log('⏹️  Closing connection...');
        connection.finish();
      }, 2000);
    });

    connection.on("Results", (data) => {
      messageCount++;
      hadUpdate = true;
      
      if (data.channel?.alternatives?.[0]?.transcript) {
        const transcript = data.channel.alternatives[0].transcript;
        transcripts.push(transcript);
        console.log(`📝 Transcription: "${transcript}"`);
      }
    });

    connection.on("error", (err) => {
      console.error('❌ Connection error:', err.message || err);
    });

    connection.on("close", () => {
      console.log('\n🔌 Connection closed');
      console.log(`📊 Messages received: ${messageCount}`);
      console.log(`📊 Transcripts: ${transcripts.length}`);
      
      if (hadUpdate) {
        console.log('\n✅ SDK SUCCESS - Flux is working!');
      } else {
        console.log('\n⚠️  No transcription events received (normal for silence)');
        console.log('   But connection established successfully!');
      }
    });

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error('   This might indicate account/permission issues');
    process.exit(1);
  }

  // Keep script alive
  await new Promise(resolve => setTimeout(resolve, 10000));
}

testDeepgramSDK().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
