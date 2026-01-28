# Avatar Portal Plan

## Overview
Mobile web portal for real-time animated avatar conversation. Novo speaks with animated mouth, lip-sync driven by audio intensity.

## Assets
- **Sprite sheet:** 7 mouth shapes × 6 emotional states (42 total frames)
- **Animation driver:** Audio intensity analysis (Wayne's code)

## Architecture

### Frontend (Mobile Web)
```
┌─────────────────────────────────────┐
│      Mobile Web Portal              │
├─────────────────────────────────────┤
│  Avatar Display                     │
│  ├─ Face image                      │
│  ├─ Sprite mouth (7 × 6 states)    │
│  └─ Emotional state badge           │
├─────────────────────────────────────┤
│  Input Area                         │
│  ├─ Microphone (voice input)        │
│  ├─ Text input (fallback)           │
│  └─ Send button                     │
├─────────────────────────────────────┤
│  Chat/Transcript (optional)         │
├─────────────────────────────────────┤
```

### Mouth Animation Flow
1. **Audio plays** (my response)
2. **Audio intensity analyzed** (via Web Audio API)
3. **Intensity mapped to mouth shape:**
   - Low intensity → closed mouth (frame 0)
   - Medium intensity → mid-open (frames 1-3)
   - High intensity → wide open (frames 4-6)
4. **Mouth sprite updated** in real-time (60fps or audio-driven)

### Emotional State Logic
**Current plan (simple):**
- Start in neutral/warm emotional state
- Could evolve to detect sentiment in text (happy, serious, etc.)
- For MVP: Use "warm" state (matches Utochka 2 voice tone)

**Example state mapping:**
- Question asked → curious/attentive
- Delivering info → confident
- Empathetic moment → warm/caring

**Implementation:** Add emotional state parameter to response. Select matching sprite frames from [mouth][emotion] grid.

### Real-Time Conversation Flow

```
User sends voice/text
    ↓
Backend receives input
    ↓
Transcribe (if voice)
    ↓
Process with Novo agent
    ↓
Generate response audio + text
    ↓
Stream response (audio plays)
    ↓
Frontend receives audio stream
    ↓
Web Audio API analyzes intensity
    ↓
Update mouth sprite frame every 10-50ms
    ↓
Conversation continues or ends
```

### Backend Integration

**Endpoint:** POST /portal/respond
```json
// Request
{
  "input": "audio|text",
  "content": "base64 audio or text string",
  "emotionalContext": "optional state hint"
}

// Response (streaming)
{
  "audio": "<audio stream URL or base64>",
  "text": "<response text>",
  "emotion": "warm|confident|curious|empathetic|neutral|serious",
  "duration": "<audio length in ms>"
}
```

### Technical Stack

| Layer | Tech | Notes |
|-------|------|-------|
| Frontend | HTML5 + Vanilla JS | No framework overhead on mobile |
| Animation | Canvas or CSS (TBD) | Sprite frame swapping |
| Audio Input | Web Audio API + Recorder.js | Microphone access |
| Audio Analysis | FFT/Frequency analysis | Intensity detection |
| Backend | Clawdbot message tool | Existing infra |
| Transport | WebSocket or HTTP streaming | Real-time audio delivery |

### Mobile UX Decisions

**Portrait-first:**
- Avatar takes 60-70% of viewport
- Input area below (20-30%)
- Responsive: scales down on small phones

**Interactions:**
- Tap microphone → record voice input
- Voice plays → mouth animates
- Text input as fallback
- Show transcription (visual confirmation)
- Option to see transcript history

**Performance:**
- Sprite frames pre-loaded
- Audio buffering strategy for low latency
- Frame rate adaptive (60fps if smooth, 30fps if laggy)

### Mouth Sprite Frame Selection

**Grid structure:**
```
[mouthShape][emotionalState]

Mouth shapes (0-6):
  0 = Closed
  1 = Almost closed / consonants (t, p, b, d)
  2 = Partially open (vowels a, e)
  3 = Open (vowels o, u)
  4 = Wide open (ah, exclamation)
  5-6 = Variations for expression

Emotional states (0-5):
  0 = Neutral
  1 = Warm
  2 = Confident
  3 = Curious
  4 = Empathetic
  5 = Serious
```

### Animation Timing

**Audio-driven (preferred):**
- Sample audio intensity every 10-30ms
- Map intensity to mouth shape in real-time
- No sync issues, feels natural

**Fallback (frame-based):**
- If audio intensity unavailable
- Cycle through frames on phoneme triggers
- Less smooth but acceptable

### MVP Features
- ✅ Avatar display with animated mouth
- ✅ Voice input (microphone)
- ✅ Real-time mouth sync to audio intensity
- ✅ Response streaming (audio + text)
- ✅ One emotional state (warm)
- ✅ Mobile responsive layout

### Phase 2 (Later)
- Emotional state switching
- Gesture/body animation
- Transcript history
- Share link feature
- Custom backgrounds
- Text-to-speech fallback for accessibility

## Tomorrow's Integration

**When Wayne shows code:**
1. Review audio intensity analysis implementation
2. Understand mouth frame mapping logic
3. Understand emotional state detection
4. Identify where sprite selection happens
5. Integrate with portal backend
6. Test on mobile browser

**Files to create:**
- `/avatar-portal/index.html` — Main page
- `/avatar-portal/avatar.js` — Sprite animation logic
- `/avatar-portal/audio.js` — Web Audio API + intensity analysis
- `/avatar-portal/api.js` — Backend communication
- `/avatar-portal/style.css` — Mobile responsive styling
- `/avatar-portal/backend.js` — If needed for streaming response

## Notes
- Audio intensity alone is surprisingly effective (Wayne tested this)
- 7 mouth shapes gives smooth transitions
- 6 emotional states allows real personality to show
- Mobile-first keeps it accessible and deployable everywhere

---

Ready to build when you're ready.
