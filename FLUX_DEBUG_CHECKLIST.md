# Flux Debugging Checklist

## Audio Pipeline Analysis

### CRITICAL FIXES APPLIED ✅

1. **Socket.IO Event Sync** ✅
   - Frontend sends `audio-stream` event ✓
   - Backend listens for `audio-stream` ✓
   - Field name: `chunk` (both sides) ✓

2. **Audio Data Format** ✅
   - Frontend: PCM16 (Uint8Array) → base64 ✓
   - Backend: base64 → Buffer ✓
   - Type: Binary audio data ✓

3. **Flux Endpoint** ✅
   - Changed from `/v2` base to `/v2/listen` (full path) ✓
   - URL: `wss://api.deepgram.com/v2/listen?model=flux-general-en&...&api_key=KEY` ✓
   - Format: linear16 (PCM16) @ 16kHz ✓

4. **Connection Sequencing** ✅
   - Message handler set BEFORE audio sent ✓
   - Flux connection created on first audio chunk ✓
   - Debug logging added for chunk flow ✓

## Test Steps

### 1. Browser Console Check
Go to https://novopresent.com and open DevTools (F12):

```javascript
// Should see in console:
// "📤 FIRST audio chunk sent (1024 bytes → X chars)"  [frontend]
```

### 2. Server Logs Check
Watch `/tmp/portal.log` (or stdout if running in foreground):

```
🔌 Establishing Flux connection for User...
   Model: flux-general-en
   Encoding: linear16 (PCM16)
   Sample rate: 16000 Hz
📥 FIRST AUDIO CHUNK RECEIVED from User (Flux enabled: true)
   Chunk size: 1024 bytes
📤 FIRST AUDIO CHUNK SENT TO FLUX
```

### 3. Flux Connection Events
Should see in logs:

```
✅ Connected to Deepgram Flux
🎤 Flux: StartOfTurn - user began speaking
📝 Flux: Update - "hello there..."
🛑 Flux: EndOfTurn (high confidence) - "hello there"
```

## Debugging Flags

### If audio chunks NOT being sent to backend:
- Check browser console for `sendAudioChunk()` errors
- Verify microphone permission granted
- Check that `this.client` is defined in `app-realtime.js`

### If Flux NOT connecting:
- Check backend logs for "Failed to connect to Flux"
- Verify DEEPGRAM_API_KEY is set and valid
- Check network: `curl -I "wss://api.deepgram.com/v2/listen?model=flux-general-en&api_key=KEY"`

### If audio sent but Flux not receiving:
- Check WebSocket `readyState` (should be `1` = OPEN)
- Verify audio format matches (linear16, 16kHz, PCM16)
- Check chunk size is reasonable (1024-2560 bytes per chunk)
- Log WebSocket error messages

### If transcription NOT arriving:
- Check Flux message handler is being called
- Verify `handleFluxMessage()` receives events
- Check for `case 'EndOfTurn'` being triggered
- Verify socket.emit() calls working

## Key Parameters to Verify

- **Endpoint**: `wss://api.deepgram.com/v2/listen` (NOT `/v1/listen`)
- **Model**: `flux-general-en` (NOT just `flux`)
- **Encoding**: `linear16` (required, not optional)
- **Sample Rate**: `16000` Hz
- **Chunk Size**: 1024 samples @ 16kHz = ~64ms (acceptable; 80ms = 2560 bytes recommended)

## Next Steps If All Working

1. Full conversation loop: speak → transcribe → respond → synthesize → play
2. Test EagerEndOfTurn for faster responses (requires higher LLM call volume)
3. Test TurnResumed handling (user interrupts themselves)
4. Optimize chunk size to 2560 bytes (80ms) for Flux recommendation

---

**Status**: Ready for end-to-end test
**Portal**: https://novopresent.com
**Backend**: localhost:3001
**Test Date**: 2026-01-28
