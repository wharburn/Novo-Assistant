# 🚀 NoVo Voice Conversation - Quick Start

Get up and running in 3 minutes!

---

## Step 1: Install Dependencies

```bash
npm install
```

---

## Step 2: Get API Keys

### Deepgram API Key (Free tier available)
1. Go to https://console.deepgram.com/
2. Sign up for free account
3. Create a new API key
4. Copy the key

### OpenRouter API Key (Pay-per-use)
1. Go to https://openrouter.ai/
2. Sign up
3. Add credits ($5 minimum)
4. Create API key
5. Copy the key

---

## Step 3: Create `.env` File

Create a file named `.env` in the root directory:

```env
DEEPGRAM_API_KEY=your_deepgram_key_here
OPENROUTER_API_KEY=your_openrouter_key_here
PORT=3001
```

Replace `your_deepgram_key_here` and `your_openrouter_key_here` with your actual keys.

---

## Step 4: Start the Server

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

---

## Step 5: Open in Browser

Navigate to: **http://localhost:3001**

---

## Step 6: Start Talking!

1. Click the **"Start Talking"** button
2. Allow microphone access when prompted
3. Speak naturally: "Hello, how are you?"
4. Wait for NoVo to respond with voice
5. Continue the conversation!

---

## 🎛️ Optional: Configure Settings

Click **"Admin Settings"** to change:

- **AI Model**: GPT-4o Mini (fast) or GPT-4o (best quality)
- **Voice**: Choose from 12 different voices
- **Microphone**: Select your preferred mic

---

## ❓ Troubleshooting

**Problem**: "Not connected to backend"  
**Solution**: Make sure server is running (`npm start`)

**Problem**: "Microphone access denied"  
**Solution**: Grant microphone permissions in browser settings

**Problem**: "Deepgram connection error"  
**Solution**: Check your `DEEPGRAM_API_KEY` in `.env` file

**Problem**: "Failed to generate response"  
**Solution**: Check your `OPENROUTER_API_KEY` in `.env` file

---

## 📖 More Information

- **Full Setup Guide**: See `VOICE_CONVERSATION_SETUP.md`
- **Implementation Details**: See `IMPLEMENTATION_SUMMARY.md`

---

## 🎉 That's It!

You now have a working voice conversation system with the NoVo avatar!

**Enjoy talking to NoVo!** 🎤

