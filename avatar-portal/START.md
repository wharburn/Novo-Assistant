# Avatar Portal - Quick Start

## Overview

The Novo Avatar Portal is a **phoneme-based avatar animation system** that converts text to animated speech.

**Components:**
- `server/` — Upload & serve files (Node.js)
- `code/` — Avatar portal UI (HTML/JS)
- `assets/` — Sprite files (PNGs)

## Quick Start

### 1. Upload Server (Already Running)

The upload server should be running on port 8080:
```bash
PORT=8080 node server/server.js
```

Access: `http://72.61.17.251:8080` (or your domain)

### 2. Serve the Avatar Portal

The portal code needs to be served. Options:

**Option A: Simple HTTP Server (Quick test)**
```bash
cd /root/clawd/avatar-portal/code
python3 -m http.server 8000
```
Then open: `http://localhost:8000`

**Option B: Add to Nginx (Production)**
```nginx
server {
    listen 80;
    server_name novofriend.com;

    location / {
        root /root/clawd/avatar-portal/code;
        try_files $uri $uri/ /index.html;
    }
}
```

## How It Works

### 1. **Text Input**
User types text (or records audio)

### 2. **Text → Phonemes**
`PhonemeConverter` converts text to phoneme sequence:
- Text: "Hello"
- Phonemes: `closed → e → ldt → o`

### 3. **Phoneme → Sprite**
For each phoneme, load the matching sprite:
- Phoneme: `e` → Load `assets/neutral/neutral/e.png`
- Eye state cycles naturally (blink)

### 4. **Animation**
Display sprites in sequence ~150ms each, creating smooth mouth animation.

## Architecture

```
┌─────────────────────────────────┐
│   Avatar Portal UI              │
│   (index.html + JS)             │
├─────────────────────────────────┤
│ AvatarEngine                    │
│ ├─ Canvas rendering             │
│ ├─ Sprite loading & caching     │
│ ├─ Blinking cycle               │
│ └─ Phoneme animation            │
│                                 │
│ PhonemeConverter                │
│ ├─ Text → Phonemes              │
│ ├─ Phoneme timing               │
│ └─ Emotion mapping              │
├─────────────────────────────────┤
│ Emotion States                  │
│ ├─ Neutral                      │
│ ├─ Happy                        │
│ └─ Thinking                     │
│ (+ Sad, Angry, Fearful later)   │
├─────────────────────────────────┤
│ Sprite Assets (PNGs)            │
│ ├─ 3 emotions × 8 phonemes      │
│ ├─ × 3 eye states (blink)       │
│ = 72 sprites per emotion        │
└─────────────────────────────────┘
```

## Phoneme Mapping

Text is converted to these mouth shapes:

| Phoneme | Examples | Mouth Shape |
|---------|----------|-------------|
| `ai` | cat, say, pain | Open wide |
| `e` | bed, happy, friend | Teeth visible |
| `o` | go, boat, know | Rounded lips |
| `closed` | silence, /k/, /h/ | Closed mouth |
| `mbp` | mom, baby, paper | Lips together |
| `ldt` | lid, dog, tip | Tongue up |
| `fv` | fun, van | Teeth on lip |
| `wq` | wow, queen | Round lips |

## Features

### Current
- ✅ Text → Phoneme animation
- ✅ 3 emotions (Neutral, Happy, Thinking)
- ✅ Natural blinking
- ✅ Responsive mobile UI
- ✅ Emotion switching
- ✅ Test mode

### Coming Soon
- 🔜 Voice recording & transcription
- 🔜 Audio sync (play audio while animating)
- 🔜 3 more emotions (Sad, Angry, Fearful)
- 🔜 Gesture/body animation
- 🔜 Real-time WebSocket streaming

## Testing

### Test Phoneme Conversion
```javascript
// In browser console
converter.test();
// Prints: "Hello" → closed → e → ldt → o
```

### Test Avatar Animation
```javascript
// Type in text input, click "Animate Text"
// Or manually:
avatar.setEmotion('happy');
avatar.animatePhonemeSequence(['ai', 'e', 'o', 'ldt']);
```

### Test Sprite Loading
```javascript
// Check what's loaded
console.log(avatar.spriteCache);

// Preload all sprites for emotion
await avatar.preloadEmotion('neutral');
```

## File Structure

```
avatar-portal/
├── code/
│   ├── index.html              # Main UI
│   ├── css/
│   │   └── style.css           # Mobile-first responsive
│   └── js/
│       ├── app.js              # Main app logic
│       ├── avatar.js           # Canvas renderer + animation
│       └── phoneme-converter.js # Text → Phoneme converter
│
├── assets/
│   ├── neutral/neutral/        # 24 PNG sprites
│   ├── happy/happy/            # 24 PNG sprites
│   └── thinking/thinking/      # 24 PNG sprites
│
├── server/
│   ├── server.js               # Express upload server
│   ├── package.json
│   ├── public/index.html       # Upload UI
│   └── uploads/                # Uploaded files
│
└── docs/                        # Documentation
```

## Deployment Checklist

- [ ] Sprites uploaded to `/assets/`
- [ ] Upload server running on port 8080
- [ ] Portal code served (Python or Nginx)
- [ ] Domain points to VPS
- [ ] Test on mobile browser
- [ ] HTTPS configured (for production)

## Browser Support

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile Safari: ✅ Full support

Requires:
- Canvas API
- Web Audio API (for future voice features)
- Modern JavaScript (ES6+)

## Next Steps

1. **Test locally** — Serve portal, open in browser
2. **Upload remaining emotions** — Sad, Angry, Fearful
3. **Add voice sync** — Record/transcribe audio
4. **Connect to Novo backend** — Stream responses through portal
5. **Deploy to domain** — novofriend.com

---

Ready to animate! 🎤✨
