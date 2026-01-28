# Architecture Analysis: novo-avatar-chatbot vs Novo Portal

Comparing your existing avatar chatbot with what we're building.

## 🏗 Your Repo: novo-avatar-chatbot

**Stack:** Next.js + React + Hume AI Voice SDK
**Approach:** Full integration with Hume's managed service
**Real-time Communication:** WebSocket via `@humeai/voice-react` library

### Key Components

```
app/page.tsx
  ↓ fetches Hume access token
  ↓
app/components/Chat/ClientChat.tsx
  ↓ loads Chat component dynamically (browser-only)
  ↓
app/components/Chat/Chat.tsx
  ├─ useVoice() hook from @humeai/voice-react
  ├─ Handles all audio streaming automatically
  ├─ Emotion detection via Hume (48+ emotions)
  ├─ Vision integration (camera + emotion detection)
  └─ Tool calling + conversation management
```

### Dependencies

- `@humeai/voice-react` — Hume's managed WebSocket library
- `hume` — SDK for getting access tokens
- `@upstash/redis` — Session/user management
- `@tensorflow/tfjs` + `@tensorflow-models/coco-ssd` — Local object detection
- `resend` — Email sending
- `zustand` — State management

### Authentication Flow

```typescript
// 1. Server-side: Get Hume access token
const token = await fetchAccessToken({ apiKey, secretKey });

// 2. Pass to client
<Chat accessToken={token} configId={configId} />

// 3. Client: Connect to Hume WebSocket
const { send, transcript, emotions } = useVoice();

// 4. Real-time bidirectional:
//    - Audio captured → sent to Hume
//    - Hume responds with text + emotions + audio
//    - Display avatar with emotions + voice
```

### Real-Time Flow

```
User speaks
  ↓
Audio captured by browser
  ↓
Sent to Hume WebSocket
  ↓
Hume (real-time):
  - Transcribes speech
  - Detects prosodic emotions
  - Calls LLM for response
  - Generates voice (EVI)
  - Detects emotions in response
  ↓
Return to client:
  - Transcript
  - Emotions (48+ dimensions)
  - Response text
  - Audio (MP3)
  ↓
Client:
  - Display avatar with emotion
  - Play audio
  - Update UI with transcript
```

### Emotion Handling

**Hume provides 48+ emotions:**
```
joy, amusement, love, contentment, satisfaction, relief, admiration,
gratitude, calmness, pride, ecstasy, triumph, excitement,
sadness, fear, anger, disgust, surprise, etc.
```

**Maps to avatar emotions:**
```typescript
const EMOTION_MAPPING = {
  joy: 'happy',
  sadness: 'sad',
  anger: 'angry',
  surprise: 'surprised',
  fear: 'fear',
  disgust: 'disgust',
  // ... etc
};
```

**Detection sources:**
1. Hume's prosody analysis (voice tone/emotion)
2. Text keyword matching (fallback)
3. Camera vision (your face emotion)

---

## 🚀 Our Approach: Novo Portal

**Stack:** Node.js + Socket.io + Deepgram + Custom
**Approach:** Manual implementation, more control
**Real-time Communication:** Socket.io WebSocket

### Current Architecture

```
/root/clawd/avatar-portal/code/index.html
  ├─ emotion-buttons.js (emotion selection)
  ├─ audio-stream.js (microphone capture)
  ├─ portal-client.js (Socket.io WebSocket)
  └─ app-realtime.js (orchestrates everything)
    ↓
portal-server.js
  ├─ Accepts WebSocket connection
  ├─ Receives audio chunks
  ├─ Sends to Deepgram for transcription
  ├─ Gets response from bridge (port 3002)
  └─ Streams response to client
    ↓
deepgram-service.js
  ├─ Audio → text (STT)
  └─ Text → audio (TTS)
    ↓
portal-clawdbot-bridge.js
  └─ Routes to Novo (main session)
```

### Key Differences

| Feature | Your Repo | Novo Portal |
|---------|-----------|------------|
| **Audio Streaming** | Hume WebSocket (managed) | Socket.io + manual buffering |
| **Transcription** | Hume (integrated) | Deepgram (batch) |
| **Emotion Detection** | Hume prosody + vision | Camera only (Hume disabled) |
| **LLM Integration** | Hume's managed system prompt | Custom bridge to Clawdbot |
| **Voice Generation** | Hume EVI (built-in) | Deepgram TTS |
| **Complexity** | High-level API (simpler) | Low-level implementation (more control) |

---

## 💡 What We Should Adopt

### 1. **VAD (Voice Activity Detection) - DONE ✅**
Already enabled in Deepgram:
```typescript
const defaults = {
  model: 'nova-2',
  vad: true,  // ✅ Detect when speech ends
  smart_format: true,
  ...
};
```

### 2. **Streaming Transcription (NOT DONE YET)**
Currently using batch (POST requests).
Your repo: Real-time WebSocket streaming.

**Should implement:**
```typescript
// Instead of:
POST /v1/listen  // Wait for response

// Use:
WebSocket /v1/listen/stream  // Real-time results
```

### 3. **Emotion Detection (PARTIALLY DONE)**
- ✅ Added emotion detection panel in UI
- ❌ Not actually detecting (Hume WebSocket disabled)
- ⚠️ Could use:
  - Hume's REST API (batch)
  - Local ML model (on-device)
  - Backend voice prosody analysis

### 4. **Tool Calling Pattern**
Your repo uses Hume's native tool calling.
We use a custom bridge system.

**Pattern to learn:**
```typescript
// Tool calls come back from Hume
socket.on('tool_calls', (tools) => {
  for (const tool of tools) {
    const result = executeLocalTool(tool.name, tool.parameters);
    sendToolResult(tool.toolCallId, result);
  }
});
```

### 5. **Session Management**
Your repo: Per-user sessions with profile tracking
Portal: Simple user_id from localStorage

**Should track:**
- Conversation history
- User preferences
- Emotion trends
- Interaction patterns

---

## 🎯 Next Steps for Novo Portal

### Immediate (Week 1)
- ✅ VAD enabled
- ⏳ Streaming transcription with Deepgram WebSocket
- ⏳ Fix emotion detection (enable Hume or use local alternative)

### Short-term (Week 2-3)
- Session persistence (Redis)
- User profile tracking
- Conversation history
- Emotion trend analysis

### Medium-term (Week 4+)
- Tool calling system (like Hume's)
- Local emotion detection (TensorFlow)
- Advanced prosody analysis
- Multi-user support

---

## 📊 Technical Comparisons

### WebSocket Libraries
- **Hume's approach:** `@humeai/voice-react` (managed, high-level)
- **Our approach:** Socket.io (flexible, manual)
- **Advantage:** Socket.io gives us more control over:
  - Message format
  - Retry logic
  - Custom events
  - Multi-user scenarios

### Audio Handling
- **Hume:** Handles all encoding/decoding internally
- **Ours:** Manual Float32→PCM16 conversion
- **Deepgram VAD:** Works on raw PCM16 audio

### LLM Integration
- **Hume:** Built-in system prompt, managed by Hume
- **Ours:** Custom bridge to Clawdbot for full control

### Emotion Detection
- **Hume:** Prosody analysis (voice tone) + Vision
- **Ours:** Currently camera-only (if enabled)

---

## Code Patterns to Steal

### 1. Emotion Mapping
Your emotion detection to avatar states pattern is perfect:
```typescript
const EMOTION_MAPPING: Record<string, Emotion> = {
  joy: 'happy',
  sadness: 'sad',
  // ... etc
};

function getDominantEmotion(scores: Record<string, number>): Emotion {
  // Find highest scoring emotion
  // Only update if score > 0.1 (10% confidence threshold)
  // Return mapped emotion or 'neutral'
}
```

### 2. Text-based Emotion Detection
Fallback when prosody unavailable:
```typescript
const TEXT_EMOTION_KEYWORDS: Record<Emotion, string[]> = {
  happy: ['happy', 'glad', 'love', 'excited', ...],
  sad: ['sad', 'sorry', 'disappointed', ...],
  // ...
};

function detectEmotionFromText(text: string): Emotion | null {
  // Scan text for emotion keywords
  // Boost score if early in sentence
  // Return if found >= 1 keyword
}
```

### 3. Dynamic Component Loading
```typescript
const Chat = dynamic(() => import('./Chat'), {
  ssr: false,  // Browser-only (uses Web Audio API)
  loading: () => <LoadingSpinner />
});
```

### 4. Session Setup
```typescript
const sendBaseSessionSettings = useCallback(() => {
  if (!isConnected) return;
  sendSessionSettings({
    systemPrompt: BASE_SYSTEM_PROMPT,
    config: { 
      language: 'en',
      emotionsEnabled: true 
    }
  });
}, [isConnected]);
```

---

## 🎓 Lessons Learned

1. **Hume's integration is powerful but opinionated**
   - Pros: Less code, managed backend
   - Cons: Less flexibility, locked into their patterns

2. **Manual Socket.io approach is more flexible**
   - Can customize everything
   - Better for multi-user scenarios
   - Harder to implement correctly

3. **Emotion detection is key**
   - User expectations: "I should be understood"
   - Multiple sources needed: prosody + vision + text
   - Threshold matters (10% confidence prevents false positives)

4. **Streaming > Batch for real-time**
   - Users want instant feedback
   - Batching adds latency
   - Streaming with VAD is sweet spot

5. **Tool calling pattern is universal**
   - Execute local actions (take photo, send email, etc.)
   - Return results to LLM
   - LLM decides next step

---

## What to Implement Next

1. **Deepgram WebSocket streaming** (real-time transcription)
2. **Emotion detection** (re-enable with proper auth or local model)
3. **Session persistence** (save conversations)
4. **Tool calling** (like Hume's pattern)
5. **Prosody analysis** (voice tone emotion detection)

---

*This analysis is based on studying novo-avatar-chatbot (Wayne's existing implementation).*
*Reference: https://github.com/wharburn/novo-avatar-chatbot.git*
