# Flux Connection Fix - Complete Analysis

## What Was Wrong

Your Flux connection was failing with **"Socket error: {message: 'Flux connection failed'}"** because the portal was sending **invalid parameters** to the Deepgram Flux endpoint.

### Invalid Parameters That Were Being Sent

```javascript
// ❌ WRONG - Invalid parameters for Flux
{
  model: 'flux-general-en',
  encoding: 'linear16',
  sample_rate: 16000,
  eot_threshold: 0.7,
  eot_timeout_ms: 5000,
  tag: 'novo-user-...'     // ❌ NOT A VALID FLUX PARAMETER
}
```

The `tag` parameter (and others like `vad`, `utterances`) are **valid for Nova-3 STT** but **NOT for Flux**. Deepgram Flux has a strict set of parameters.

## What's Fixed

### 1. **Valid Flux Parameters (ONLY These)**

Per official Deepgram docs, Flux `/v2/listen` accepts:

```javascript
// ✅ CORRECT - Only valid Flux parameters
{
  model: 'flux-general-en',              // ✅ Required
  encoding: 'linear16',                  // ✅ Required (for raw audio)
  sample_rate: 16000,                    // ✅ Required (for raw audio)
  eot_threshold: 0.7,                    // ✅ Optional (default 0.7)
  eager_eot_threshold: 0.5,              // ✅ Optional (enables early mode)
  eot_timeout_ms: 5000                   // ✅ Optional (default 5000)
}
```

**Parameters to AVOID for Flux:**
- ❌ `tag` (for Nova, not Flux)
- ❌ `vad` (for Nova, not Flux)
- ❌ `utterances` (for Nova, not Flux)
- ❌ `smart_format` (for Nova, not Flux)
- ❌ `language` (use model name instead: `flux-general-en`)

### 2. **Verified Flux Endpoint is Working**

Created `test-flux-direct.js` — pure WebSocket test with no Socket.IO overhead:

```bash
$ DEEPGRAM_API_KEY=... node test-flux-direct.js

✅ WebSocket OPEN
📨 Message 1: Connected
✅ Audio sent (silence, 1 second)
🔌 WebSocket CLOSED
📊 Messages received: 5
```

**This proves:**
- ✅ Deepgram API is reachable
- ✅ `/v2/listen` endpoint is responding
- ✅ API key is valid
- ✅ WebSocket connection works end-to-end

## Current Status

### What's Working ✅
- Flux endpoint reachable
- WebSocket connection established
- ElevenLabs TTS working (voice greeting plays)
- Socket.IO polling transport working (frontend ↔ backend)
- Audio capture from microphone (frontend)
- Base64 encoding of PCM16 chunks (frontend)

### What Needs Testing ⏳
- Audio chunks being received by backend (`audio-stream` event)
- Flux connection creation when first chunk arrives
- Flux message processing (StartOfTurn, Update, EndOfTurn)
- Bridge response generation
- End-to-end conversation loop

## How to Test Now

### Step 1: Start the Portal
```bash
cd /root/clawd/avatar-portal
DEEPGRAM_API_KEY=4b0368... ELEVENLABS_API_KEY=sk_... node portal-server.js
```

### Step 2: Open https://novopresent.com
- Wait for greeting (you should hear Lisa's voice)
- Check browser console (F12) for connection status

### Step 3: Click "Start Talking"
- Microphone permission should prompt
- Browser console should show: "Audio streaming started"
- Server logs should show:
  ```
  📥 FIRST AUDIO CHUNK RECEIVED from User (Flux enabled: true)
     Chunk size: 1024 bytes
  🔌 Establishing Flux connection for User...
     Model: flux-general-en
     Encoding: linear16 (PCM16)
     Sample rate: 16000 Hz
  ✅ Connected to Deepgram Flux WebSocket...
     Full URL: wss://api.deepgram.com/v2/listen?model=flux-general-en&...
  ✅ Flux: Connected message received
  📤 FIRST AUDIO CHUNK SENT TO FLUX (1024 bytes)
  ```

### Step 4: Say Something
- Speak clearly (e.g., "hello world")
- Stop talking
- Server logs should show:
  ```
  📝 Flux: Update - "hello world"...
  🛑 Flux: EndOfTurn - "hello world" (Confidence: 95%)
  ✅ Sending to bridge: "hello world"
  🤖 Novo: "I heard you say hello world" (neutral)
  ✅ Response audio ready
  ```

- Browser should play Novo's response

## If It's Still Failing

### Check These in Order

1. **Are audio chunks reaching the backend?**
   - Look for "FIRST AUDIO CHUNK RECEIVED" in logs
   - If NOT: issue is in Socket.IO event emission
   - If YES: continue to step 2

2. **Is Flux WebSocket connecting?**
   - Look for "Flux: Connected message received"
   - If NOT: Flux endpoint unreachable (test with `test-flux-direct.js`)
   - If YES: continue to step 3

3. **Is audio being sent to Flux?**
   - Look for "FIRST AUDIO CHUNK SENT TO FLUX"
   - If NOT: check `fluxState.send()` error handling
   - If YES: continue to step 4

4. **Is Flux recognizing speech?**
   - Look for "Flux: Update" or "Flux: EndOfTurn"
   - If NOT: audio format mismatch (verify PCM16, 16kHz, 1024-byte chunks)
   - If YES: continue to step 5

5. **Is bridge responding?**
   - Look for "Sending to bridge" message
   - If NOT: check bridge connection on :3002
   - If YES: response synthesis will follow

## Debug Commands

### Test Flux directly (no portal involved)
```bash
node test-flux-direct.js
```

### Check API key validity
```bash
curl -X POST "https://api.deepgram.com/v1/status" \
  -H "Authorization: Token YOUR_API_KEY"
```

### Watch portal logs in real-time
```bash
tail -f /tmp/portal.log | grep -E "AUDIO|Flux|bridge"
```

### Watch frontend console messages
Open DevTools → Console tab, look for:
- `Audio streaming started` ✅
- `📤 FIRST audio chunk sent` ✅
- Socket errors ❌

## Architecture After Fix

```
Browser Microphone
        ↓ (PCM16, 16kHz, 1024-byte chunks)
Frontend: AudioStreamer
        ↓ (base64 encoding)
Socket.IO: emit('audio-stream', { chunk: base64 })
        ↓ (WebSocket polling transport)
Backend: socket.on('audio-stream')
        ↓ (base64 → Buffer conversion)
Flux WebSocket: connection.send(audioBuffer)
        ↓ (binary PCM16 audio)
Deepgram Flux Processing
        ↓ (real-time transcription)
Backend: handleFluxMessage()
        ↓ (extract transcript)
Bridge HTTP POST: /message
        ↓ (send to LLM)
Response Generation
        ↓ (text → speech synthesis)
ElevenLabs TTS
        ↓ (MP3 audio base64)
Frontend: socket.emit('audio-response')
        ↓ (base64 → Blob → HTML5 audio)
Speaker: Audio Playback 🔊
```

## Next Steps

1. **Test the full flow** — Portal running, browser test with audio
2. **Confirm Flux events appear** — Should see Update/EndOfTurn in logs
3. **Verify bridge connection** — Should see response generation
4. **Optimize latency** — Adjust eot_threshold, eot_timeout_ms if needed

---

**Status**: Flux endpoint verified, invalid parameters removed, ready for end-to-end test.
