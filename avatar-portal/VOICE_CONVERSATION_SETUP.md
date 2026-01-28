# NoVo Voice Conversation Setup

This guide explains how to use the new **Deepgram Flux voice conversation** feature integrated into NoVo One.

## 🎯 What This Does

Press the **"Start Talking"** button → Speak naturally → NoVo listens, understands, and responds with voice → Conversation continues in real-time!

This integrates the Deepgram Flux workflow (STT → LLM → TTS) directly into the NoVo avatar interface.

---

## 📋 Prerequisites

You need API keys for:

1. **Deepgram API Key** - For speech-to-text (Flux) and text-to-speech
   - Get it at: https://console.deepgram.com/
   - Free tier available

2. **OpenRouter API Key** - For AI responses (GPT-4o, Claude, etc.)
   - Get it at: https://openrouter.ai/
   - Pay-per-use pricing

---

## 🚀 Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

This installs:
- `openai` - OpenRouter client
- `ws` - WebSocket client for Deepgram
- `socket.io` - Real-time communication
- Other existing dependencies

### 2. Configure Environment Variables

Create or update `.env` file in the root directory:

```env
# Deepgram API Key (required)
DEEPGRAM_API_KEY=your_deepgram_api_key_here

# OpenRouter API Key (required)
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Port (optional, defaults to 3001)
PORT=3001
```

### 3. Start the Server

```bash
npm start
```

You should see:

```
🚀 NoVo Voice Conversation Backend running on port 3001
📡 Frontend: http://localhost:3001
🎤 Deepgram Flux: ✅ Ready
🤖 OpenRouter: ✅ Ready

💡 Press "Start Talking" to begin a conversation!
```

### 4. Open the App

Navigate to: **http://localhost:3001**

---

## 🎮 How to Use

1. **Click "Start Talking"** - Grants microphone access and starts listening
2. **Speak naturally** - Say anything you want to NoVo
3. **Wait for response** - NoVo will respond with voice and animate
4. **Continue conversation** - Keep talking, it's a continuous conversation!
5. **Click "Stop"** - Ends the conversation

---

## ⚙️ Admin Settings

Click **"Admin Settings"** to configure:

### AI Model Options:
- **GPT-4o Mini** (Fast, cheap)
- **GPT-4o** (Best quality)
- **Claude 3.5 Sonnet** (Creative)
- **Claude 3.5 Haiku** (Fast)

### Voice Options (Deepgram Aura):
- **Female voices**: Asteria, Luna, Stella, Athena, Hera
- **Male voices**: Orion, Arcas, Perseus, Angus, Orpheus, Helios, Zeus

### Microphone:
- Select your preferred microphone device

---

## 🔧 Technical Details

### Architecture:

```
User speaks → Microphone (16kHz PCM16)
           ↓
Frontend (app-voice-conversation.js)
           ↓
Socket.IO → Backend (novo-voice-backend.js)
           ↓
Deepgram Flux WebSocket (STT)
           ↓
Transcript → OpenRouter LLM (GPT-4o/Claude)
           ↓
Response Text → Deepgram TTS WebSocket
           ↓
Audio bytes → Frontend
           ↓
Play audio + Animate avatar with phonemes
```

### Key Files:

- **Frontend**: `avatar-portal/code/js/app-voice-conversation.js`
- **Backend**: `avatar-portal/novo-voice-backend.js`
- **HTML**: `avatar-portal/code/index.html`

---

## 🐛 Troubleshooting

### "Microphone access denied"
- Grant microphone permissions in your browser
- Check browser settings → Privacy → Microphone

### "Not connected to backend"
- Make sure the server is running (`npm start`)
- Check console for errors
- Verify port 3001 is not in use

### "Deepgram connection error"
- Verify `DEEPGRAM_API_KEY` is set correctly in `.env`
- Check your Deepgram account has credits

### "Failed to generate response"
- Verify `OPENROUTER_API_KEY` is set correctly in `.env`
- Check your OpenRouter account has credits

### No audio playback
- Check browser audio permissions
- Verify speakers/headphones are working
- Check browser console for errors

---

## 💰 Cost Estimates

**Deepgram:**
- STT (Flux): ~$0.0043/minute
- TTS (Aura): ~$0.015/1000 characters

**OpenRouter:**
- GPT-4o Mini: ~$0.15/1M input tokens, ~$0.60/1M output tokens
- GPT-4o: ~$2.50/1M input tokens, ~$10/1M output tokens
- Claude 3.5 Sonnet: ~$3/1M input tokens, ~$15/1M output tokens

**Example:** 10-minute conversation ≈ $0.10 - $0.50 depending on model choice

---

## 🎉 Enjoy!

You now have a fully functional voice conversation system integrated with the NoVo avatar!

