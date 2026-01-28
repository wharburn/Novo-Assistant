# Real-Time Flux Testing Guide

## Quick Test (2 minutes)

1. **Open https://novopresent.com** in Chrome (mobile-friendly too)
2. **Open DevTools**: F12 → Console tab
3. **Watch server logs**: `tail -f /tmp/portal.log`
4. **Click "Start Talking"** in the portal
5. **Say something** (e.g., "hello world")
6. **Stop talking**, wait for Flux response

## What Should Happen (Step by Step)

### Phase 1: Connection Initialization
When you click "Start Talking", you should see:

```
✅ Client connected: [socket-id]
👤 User joined: user_[id] (User)
💬 Auto-greeting user with voice: "Hello User! I'm Novo. How can I help?"
🎙️  Synthesizing greeting audio with Lisa voice...
✅ Greeting audio ready
```

### Phase 2: Microphone Access
You should see in browser console:
```
✅ Connected to backend via polling
Audio streaming started
📤 FIRST audio chunk sent (2048 bytes → 2732 chars)
```

### Phase 3: Flux Connection (CRITICAL - This is what was failing)
In `/tmp/portal.log`, immediately after first audio chunk:

```
📥 FIRST AUDIO CHUNK RECEIVED from User (Flux enabled: true)
   Chunk size: 1024 bytes
🔌 Establishing Flux connection for User...
   Model: flux-general-en
   Encoding: linear16 (PCM16)
   Sample rate: 16000 Hz
✅ Flux connected for User - ready to receive audio
📤 FIRST AUDIO CHUNK SENT TO FLUX (1024 bytes)
```

### Phase 4: Flux Processing Audio
After a few more chunks, Flux should start recognizing speech:

```
📤 Sent 10 chunks (12.8 KB, ~0.8s audio)
📤 Sent 20 chunks (25.6 KB, ~1.6s audio)
📝 Flux: Update - "hello world..."
📤 Sent 30 chunks (38.4 KB, ~2.4s audio)
🛑 Flux: EndOfTurn (high confidence) - "hello world"
   Confidence: 95%
```

### Phase 5: Response Generation
```
✅ Sending to bridge: "hello world"
🤖 Novo: "I heard you say hello world" (neutral)
🎙️  Synthesizing response audio with Lisa voice...
✅ Response audio ready
```

### Phase 6: Audio Playback
In browser console:
```
📤 Received audio response from backend
🎵 Audio blob created: 45.3 KB, MIME: audio/mpeg
🔊 Audio playing...
Response complete
```

---

## Debugging: If Flux Connection Fails

### Error: "Flux connection failed"

**Check these in order:**

1. **API Key Valid?**
   ```bash
   curl -X POST "https://api.deepgram.com/v1/status" \
     -H "Authorization: Token 4b0368324b274cbac979b60ddf13b939c0edf4df"
   ```
   Should return `{ "api_key": { "status": "OK" } }`

2. **Network Reachable?**
   ```bash
   curl -I wss://api.deepgram.com/v2/listen 2>&1 | head -5
   ```

3. **Check Full Error Stack**
   Look in `/tmp/portal.log` for:
   ```
   ❌ Failed to connect to Flux: [ERROR MESSAGE]
      Stack: [detailed error]
   ```

4. **Check WebSocket Connection**
   The raw WebSocket should log:
   ```
   🔗 Connecting to Deepgram Flux WebSocket...
      Full URL: wss://api.deepgram.com/v2/listen?model=flux-general-en&...
   ✅ Connected to Deepgram Flux
   ```

### Common Issues & Fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| No Flux logs at all | Audio chunks not reaching backend | Check browser console for `audio-stream` emit errors |
| "Flux connection failed" with no error | WebSocket URL wrong | Check URL format in deepgram-flux-service.js |
| Connection succeeds but no transcription | Audio format mismatch | Verify: linear16 encoding, 16kHz sample rate |
| Transcription delayed (>1s) | Chunk size too small | Recommended: 2560 bytes (80ms), current: 1024 bytes (64ms) |
| False EndOfTurn events | eot_threshold too low | Default is 0.7 (good); increase to 0.8 if needed |

---

## Browser Console Checklist

When testing, the browser console should show (in this order):

✅ "Connected to backend via polling"
✅ "Audio streaming started"  
✅ "FIRST audio chunk sent (X bytes)"
✅ No "Socket error" messages
✅ "Transcription partial" events appearing (speech being recognized in real-time)
✅ "Response complete" when done

---

## Server Log Checklist

In `/tmp/portal.log`, you should see:

✅ "FIRST AUDIO CHUNK RECEIVED"
✅ "Establishing Flux connection"
✅ "Flux connected for User"
✅ "FIRST AUDIO CHUNK SENT TO FLUX"
✅ "StartOfTurn" / "Update" events
✅ "EndOfTurn" with transcript
✅ Bridge response message
✅ "Response audio ready"

---

## Performance Notes

- **First connection**: 1-2 seconds (WebSocket handshake + Flux initialization)
- **Speech recognition**: Real-time transcription (50-100ms latency)
- **End-of-turn detection**: 260ms after user stops speaking (Flux default)
- **Response synthesis**: 0.5-1.5 seconds (depends on response length)
- **Audio playback**: Immediate (already buffered)

---

## Advanced: Custom Flux Parameters

Edit `portal-server.js` line where `deepgramClient.connect()` is called:

```javascript
const fluxConnection = await deepgramClient.connect({
  model: 'flux-general-en',
  encoding: 'linear16',
  sample_rate: 16000,
  eot_threshold: 0.8,        // Higher = more reliable, slower
  eot_timeout_ms: 3000,      // Faster timeout = quicker response
  tag: `novo-user-${socket.userName.replace(/\s/g, '-')}` 
});
```

**Parameters:**
- `eot_threshold`: 0.5-0.9 (default 0.7) - confidence level for end-of-turn
- `eot_timeout_ms`: 500-10000 (default 5000) - max silence before forcing end-of-turn

---

## If Everything Works 🎉

Once you see the full flow working, you can:

1. **Test interruptions**: Start speaking, pause, continue
2. **Test noisy env**: Add background noise, see if transcription stays accurate
3. **Test response latency**: Measure time from EndOfTurn to response playback
4. **Optimize chunk size**: Change frontend buffer size to 2560 bytes for better Flux performance

---

**Current Status**: Portal ready, WebSocket Flux configured, waiting for audio input to trigger connection.
