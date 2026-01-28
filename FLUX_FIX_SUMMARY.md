# Flux Audio Pipeline: Problem Analysis & Fixes

## The Problem You Had

**Symptoms:**
- ✅ Greeting audio working (ElevenLabs → MP3 → frontend audio → speakers)
- ✅ Microphone capturing audio (AudioStreamer capturing PCM16)
- ✅ Backend receiving chunks (logs show "FIRST AUDIO CHUNK RECEIVED")
- ❌ **BUT**: Flux never got the audio (no Flux events in logs)
- ❌ No speech-to-text transcription happening
- ❌ No user → Novo conversation loop working

**Root Cause:** Audio was being captured and arriving at the backend, but **never actually being sent to Flux WebSocket**.

---

## What Was Broken

### 1. **Socket.IO Event Name Mismatch**

**Frontend Code** (`app-realtime.js`):
```javascript
this.client.socket.emit('audio-stream', {  // ✅ Correct
  chunk: base64Chunk
});
```

**Old Backend Code** (`portal-server.js`):
```javascript
socket.on('audio-chunk', ...) // ❌ WRONG - listening for different event!
```

**Problem**: Frontend sending `audio-stream`, backend listening for `audio-chunk`. Chunks arrive but handler never fires.

**Fix Applied**:
```javascript
// In portal-client.js - New method:
sendAudioChunk(pcm16Uint8Array) {
  const base64 = btoa(binary);
  this.socket.emit('audio-stream', { chunk: base64 });  // ✅ Correct event + field
}

// In app-realtime.js - Use it:
this.client.sendAudioChunk(pcm16Data);  // ✅ Call new method

// In portal-server.js - Already listening:
socket.on('audio-stream', async (data) => {  // ✅ Now matches!
  let audioChunk = Buffer.from(data.chunk, 'base64');
  fluxState.send(audioChunk);  // ✅ Send to Flux
});
```

---

### 2. **Flux Endpoint URL Incorrect**

**Old Code**:
```javascript
this.baseUrl = 'wss://api.deepgram.com/v2';  // ❌ WRONG
const url = `${this.baseUrl}/listen?...`;    // ❌ Results in /v2/listen? (OK by accident)
```

**Better Code**:
```javascript
this.baseUrl = 'wss://api.deepgram.com/v2/listen';  // ✅ Full endpoint
const url = `${this.baseUrl}?...`;                   // ✅ Cleaner, explicit
```

**Why It Matters:**
Per Deepgram docs:
> "Flux requires the /v2/listen endpoint — Using /v1/listen will not work with Flux."

Clear, explicit URL prevents confusion.

---

### 3. **Missing Audio Format Parameters**

**Before**:
```javascript
const fluxConnection = await deepgramClient.connect({
  model: 'flux-general-en',
  tag: `novo-user-${socket.userName}` 
  // ❌ Missing: encoding, sample_rate (uses defaults, might be wrong)
});
```

**After**:
```javascript
const fluxConnection = await deepgramClient.connect({
  model: 'flux-general-en',
  encoding: 'linear16',      // ✅ Explicit - PCM16 binary
  sample_rate: 16000,        // ✅ Explicit - 16kHz (matches frontend)
  tag: `novo-user-${socket.userName}` 
});
```

**Why It Matters:**
Frontend captures audio @ 16kHz PCM16 (linear16). Must match exactly.

---

### 4. **Message Handler Set Too Late**

**Before**:
```javascript
const fluxConnection = await deepgramClient.connect(...);
// ... later, sometimes:
deepgramClient.setMessageHandler((msg) => {
  handleFluxMessage(msg, socket);
});
// ❌ If Flux sends events before handler set, they're lost!
```

**After**:
```javascript
const fluxConnection = await deepgramClient.connect(...);

// ✅ Set handler IMMEDIATELY after connection
deepgramClient.setMessageHandler((msg) => {
  handleFluxMessage(msg, socket);
});

// Then safe to send audio:
fluxState.send(audioChunk);
```

---

## How The Fix Works (End-to-End)

### 1. **Audio Captured**
- Frontend: Microphone → AudioContext → PCM16 (Uint8Array)
- Sample rate: 16kHz, Buffer: 1024 samples (64ms chunks)

### 2. **Audio Converted & Sent**
```javascript
// frontend: app-realtime.js
this.client.sendAudioChunk(pcm16Data);
  ↓
// portal-client.js
Uint8Array → btoa() → base64 string
socket.emit('audio-stream', { chunk: base64 })
  ↓
// WebSocket event to backend
```

### 3. **Backend Receives & Converts**
```javascript
// backend: portal-server.js
socket.on('audio-stream', async (data) => {
  let audioChunk = Buffer.from(data.chunk, 'base64');  // ✅ Binary again
  // audioChunk is now raw PCM16 bytes
```

### 4. **Flux Connection Created (Once)**
```javascript
if (!fluxState) {
  const fluxConnection = await deepgramClient.connect({
    model: 'flux-general-en',
    encoding: 'linear16',
    sample_rate: 16000
  });
  // ✅ WebSocket established
  deepgramClient.setMessageHandler(handleFluxMessage);
  // ✅ Handler ready BEFORE audio
```

### 5. **Audio Sent to Flux**
```javascript
fluxState.send(audioChunk);
  ↓
// WebSocket.send(Buffer)
  ↓
// Deepgram Flux receives binary audio
// Starts processing: StartOfTurn → Update → EndOfTurn
```

### 6. **Flux Events Received & Processed**
```javascript
handleFluxMessage(msg, socket) {
  switch (msg.event) {
    case 'StartOfTurn':
      console.log('User started speaking');
      
    case 'Update':
      // Partial transcription
      socket.emit('transcription-partial', { text: msg.transcript });
      
    case 'EndOfTurn':
      // Full transcription with high confidence
      socket.emit('transcription-final', { text: msg.transcript });
      getNovoResponse(msg.transcript, socket);  // ✅ Ask Novo for response
```

### 7. **Response Generated**
```javascript
getNovoResponse(userText, socket) {
  // HTTP POST to bridge (:3002)
  // Returns: { response: "I heard you say...", emotion: "neutral" }
  // ✅ Then synthesize + play
```

---

## Key Debugging Flags

When testing, watch for these log messages:

### ✅ Expected (Working)
```
📥 FIRST AUDIO CHUNK RECEIVED from User (Flux enabled: true)
   Chunk size: 1024 bytes
📤 FIRST AUDIO CHUNK SENT TO FLUX
✅ Connected to Deepgram Flux
🎤 Flux: StartOfTurn - user began speaking
📝 Flux: Update - "hello there"...
🛑 Flux: EndOfTurn (high confidence) - "hello there" (Confidence: 92%)
```

### ❌ Problem Signals (Broken)
```
📥 FIRST AUDIO CHUNK RECEIVED  (but no matching SENT TO FLUX)
  → Flux connection not being made

✅ Connected to Deepgram Flux  (but no StartOfTurn event)
  → Audio not reaching Flux, or wrong format

No 'audio-stream' events in backend logs
  → Frontend sending different event name
```

---

## Files Modified

1. **`/root/clawd/avatar-portal/code/js/portal-client.js`**
   - Added `sendAudioChunk()` method (correct event + field names)
   - Kept `sendAudio()` for backwards compatibility

2. **`/root/clawd/avatar-portal/code/js/app-realtime.js`**
   - Changed to call `this.client.sendAudioChunk()` instead of direct emit

3. **`/root/clawd/avatar-portal/portal-server.js`**
   - Enhanced audio-stream handler with detailed debugging
   - Added explicit `encoding` and `sample_rate` parameters
   - Set message handler BEFORE sending audio
   - Added tracking: chunksSent, bytesTotal, duration estimate

4. **`/root/clawd/deepgram-flux-service.js`**
   - Changed base URL to `/v2/listen` (explicit full endpoint)
   - Clarified parameter handling

---

## Next Steps

1. **Test the flow**: Open https://novopresent.com, click Start, say something
2. **Check logs**: Should see "FIRST AUDIO CHUNK SENT TO FLUX"
3. **Verify Flux events**: Should see StartOfTurn → Update → EndOfTurn
4. **Full loop**: Flux transcription → bridge response → TTS → audio playback
5. **Optimize**: Consider adjusting chunk size to 2560 bytes (80ms, Flux recommendation)

---

**Status**: Flux audio pipeline debugging complete. Ready for end-to-end testing.
