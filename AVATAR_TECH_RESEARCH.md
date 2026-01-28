# Avatar Portal — Technology Research & Recommendations

## Research Summary

### Sprite Animation Approaches

**Best option: HTML5 Canvas + Sprite Sheet**
- **Pros:** Fast, full control, works on all mobile browsers, low overhead
- **Cons:** Slightly more code than CSS, but worth it for real-time performance
- **Reference:** Kirupa tutorials + Canvas-Sprite-Animations library
- **Performance:** 60fps capable on mobile

**CSS Sprite Animation (Alternative)**
- **Pros:** Simpler syntax, less code
- **Cons:** Less flexible timing, can have jitter with rapid frame changes
- **Use case:** If mouth changes are less frequent

**Recommendation:** Use Canvas for MVP due to real-time audio intensity driving frame updates.

---

### Audio Analysis for Mouth Sync

**Web Audio API + AnalyserNode**
- Fast-Fourier Transform (FFT) analysis of audio frequencies
- Real-time frequency/amplitude data available every frame
- No sync issues — driven by audio hardware clock

**Implementation:**
```javascript
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const analyser = audioContext.createAnalyser();
const source = audioContext.createMediaElementAudioSource(audioElement);
source.connect(analyser);
analyser.connect(audioContext.destination);

// Get amplitude data
const dataArray = new Uint8Array(analyser.frequencyBinCount);
analyser.getByteFrequencyData(dataArray);

// Calculate intensity (0-1)
const intensity = dataArray.reduce((a, b) => a + b) / dataArray.length / 255;
```

**Mouth frame mapping:**
```
intensity: 0.0-0.1   → Frame 0 (closed)
intensity: 0.1-0.25  → Frame 1 (almost closed)
intensity: 0.25-0.4  → Frame 2 (half open)
intensity: 0.4-0.6   → Frame 3 (open)
intensity: 0.6-0.8   → Frame 4 (wide open)
intensity: 0.8-1.0   → Frame 5-6 (very wide)
```

**Advantages:**
- No latency
- Works with any audio (streaming, pre-recorded)
- Simple, proven approach (Wayne already tested)
- Mobile-friendly

---

### Backend Architecture

**Recommended: WebSocket + Streaming Audio**

```
┌─────────────┐
│   Mobile    │
│   Browser   │
└──────┬──────┘
       │ WebSocket connection
       │ User input (voice/text)
       │
       ▼
┌─────────────────────┐
│  Clawdbot Gateway   │
│  (existing infra)   │
└──────┬──────────────┘
       │ Process with Novo agent
       │ Generate response
       │
       ▼
┌──────────────────────────┐
│  Stream Response         │
│  - Audio chunks (binary) │
│  - Metadata (emotion)    │
│  - Text (optional)       │
└──────────────┬───────────┘
               │ WebSocket stream
               ▼
         Portal receives
         - Plays audio
         - Analyzes intensity
         - Updates mouth sprite
```

**Why WebSocket over HTTP:**
- True bidirectional streaming
- Lower latency (no request/response overhead)
- Can send audio chunks as they're generated
- Better for real-time feel

**Hybrid fallback:**
- If WebSocket unavailable: Use HTTP streaming (Server-Sent Events)
- Degrade gracefully on older mobile browsers

---

### Frontend Architecture (Simple & Efficient)

**Tech Stack:**
```
- No framework (React/Vue overhead not needed)
- Vanilla HTML5 + JS
- Canvas for sprite animation
- Web Audio API for analysis
- WebSocket for communication
```

**File structure:**
```
avatar-portal/
├── index.html              # Main page
├── css/
│   └── style.css          # Mobile-first responsive
├── js/
│   ├── avatar.js          # Canvas + sprite animation
│   ├── audio-input.js     # Microphone + transcription
│   ├── audio-analysis.js  # Intensity analysis
│   ├── websocket.js       # Backend communication
│   └── main.js            # Init + event handlers
└── assets/
    └── sprites.png        # Your 7×6 sprite sheet
```

**Size estimate:**
- HTML: ~2KB
- JS: ~15KB (minified)
- CSS: ~3KB
- Sprite PNG: ~200-500KB (depends on resolution)
- **Total:** ~230-520KB (very mobile-friendly)

---

### Emotional State Management

**Simple approach (MVP):**
- Start with "warm" emotional state
- Map to correct sprite column (all 7 mouth shapes in warm state)

**Dynamic approach (Phase 2):**
- Detect sentiment from response text
- Switch emotional state during response
- Could be rule-based (question → curious, declaration → confident)

**Signal to backend:**
```javascript
// Frontend sends
{ input: "user text", emotionalContext: "responding" }

// Backend responds with
{ audio: AudioBlob, emotion: "warm|confident|curious", text: "response" }
```

---

### Mobile Performance Optimization

**Key constraints:**
- Mobile browsers: 60fps target
- Audio streaming: must not stutter
- Sprite sheet: pre-loaded in memory

**Optimization strategies:**
1. **Preload everything:** Sprite PNG loaded at start
2. **Use requestAnimationFrame:** Sync animation to browser refresh (60fps)
3. **Throttle audio analysis:** Update mouth every 10-50ms (not every frame)
4. **Lazy-load sprites:** Only load emotional states used
5. **Audio buffering:** Keep 500ms ahead to prevent stuttering

**Example timing:**
```
Audio update:  Every 50ms (20 updates/sec)
Frame update:  Every 16ms (60fps)
Mouth change:  Only when frame number changes (smooth, not jittery)
```

---

### Real-Time Sync Challenges & Solutions

**Challenge 1: Audio playback lag**
- Solution: Buffer 200-500ms audio before playing

**Challenge 2: Mouth updates lagging behind audio**
- Solution: Use AnalyserNode tied to audio hardware clock (no lag)

**Challenge 3: Network latency**
- Solution: Pipeline responses — start playing audio as chunks arrive, don't wait for full response

**Challenge 4: Browser compatibility (old mobile)**
- Solution: Fallback to simpler sprite cycle if Web Audio API unavailable

---

### Libraries Worth Considering

| Library | Purpose | Size | Notes |
|---------|---------|------|-------|
| **No framework** | Keep it light | — | Vanilla JS is fastest |
| **Tone.js** | Audio (optional) | 50KB | Overkill, Web Audio API is enough |
| **Babylon.js** | 3D (Phase 2) | 200KB | If we add 3D avatar later |
| **Phaser.js** | Game framework | 300KB | Too heavy for avatar |

**Recommendation:** Vanilla Web Audio API + Canvas. Don't add libraries until needed.

---

### Mobile Responsiveness Considerations

**Viewport settings:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
```

**Layout priorities:**
1. Avatar (60-70% of viewport)
2. Transcript (optional, 10%)
3. Input area (20-30%)

**Orientation:**
- Portrait: Primary (most mobile usage)
- Landscape: Secondary (nice to have)

**Touch events:**
- Tap microphone icon to record
- Tap avatar for optional features (transcript, settings)
- Auto-hide keyboard after input

---

### Streaming Strategy

**Chunked audio streaming:**
```
Backend generates audio in chunks (e.g., 100ms @ 48kHz)
Send as:
  - Binary WebSocket messages (fast)
  - Or base64 if necessary (slower but compatible)
  
Browser:
  - Receive chunk
  - Add to audio queue
  - Play continuously
  - Analyze intensity in real-time
  - Update mouth sprite
```

**Response metadata:**
```json
{
  "chunk": 1,
  "totalChunks": 5,
  "audio": "base64 or binary",
  "emotion": "warm",
  "text": "partial response text",
  "isDone": false
}
```

---

### Next Steps When Wayne Provides Code

1. **Review sprite sheet structure** — Confirm 7×6 grid
2. **Understand intensity analysis** — How he's calculating it
3. **Identify integration points** — Where sprite selection happens
4. **Check for Web Audio API usage** — Confirm real-time sync method
5. **Test on actual mobile device** — Performance metrics
6. **Build streaming endpoint** — Integrate with Clawdbot message tool

---

### Efficiency Wins

**For MVP (~2-3 days):**
- Skip Web RTC (WebSocket is enough)
- Single emotional state (warm)
- No gesture/body animation
- Simple intensity → mouth mapping
- HTTP streaming fallback not needed yet

**Measurable targets:**
- Load time: <2 seconds
- Frame rate: 55+ fps on mobile
- Audio latency: <500ms
- Mouth sync: ±50ms accuracy

---

## Summary

**Best approach:** Canvas + Web Audio intensity analysis + WebSocket streaming to Clawdbot. Simple, efficient, no heavy frameworks. Targets ~230KB total + sprite PNG.

When Wayne shows code, we'll integrate with existing Clawdbot infrastructure and have a working portal within a few hours.
