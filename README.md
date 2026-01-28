# 🎭 NoVo One - Interactive AI Avatar with Voice & Vision

NoVo One is an advanced interactive AI avatar system featuring real-time voice conversation, emotion detection, vision capabilities, and photo capture with automatic image analysis.

![NoVo Avatar](avatar-portal/code/favicon.png)

## ✨ Features

### 🎤 Voice Conversation
- **Real-time speech-to-text** using Deepgram Flux
- **Natural AI responses** via OpenRouter (GPT-4o, Claude, etc.)
- **Text-to-speech** with Deepgram TTS (multiple voice options)
- **Interrupt capability** - Stop NoVo mid-sentence by speaking

### 🎭 Emotion Detection
- **Real-time emotion analysis** from voice using Hume AI
- **6 emotion states**: Happy, Sad, Angry, Thinking, Suspicious, Neutral
- **Visual feedback** with animated avatar expressions
- **53 Hume AI emotions** mapped to 6 NoVo emotions

### 👁️ Vision Capabilities
- **Camera integration** for real-time video
- **Image analysis** using OpenRouter vision models
- **Photo capture** with voice commands
- **Automatic description** of captured photos

### 📸 Photo Feature
1. Say "take my photo"
2. NoVo responds: "I can take your photo! Just say 'shoot' when you want me to take it."
3. Camera turns on automatically
4. Say "shoot"
5. 3-2-1 countdown with camera click sound
6. Photo captured and downloaded
7. NoVo automatically describes what she sees!

### 🎨 Avatar Animation
- **Phoneme-based lip sync** synchronized with speech
- **Idle video system** with multiple rotating videos
- **Blinking eyes** and periodic movements
- **Smooth transitions** between emotions

## 🚀 Quick Start

### Prerequisites

You'll need API keys from:
- [Deepgram](https://console.deepgram.com/) - Speech-to-Text & TTS
- [OpenRouter](https://openrouter.ai/) - AI Brain (GPT-4o, Claude, etc.)
- [Hume AI](https://platform.hume.ai/) - Emotion Detection
- [ElevenLabs](https://elevenlabs.io/) - Optional TTS alternative

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/Novo-One.git
   cd Novo-One
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your API keys:
   ```env
   DEEPGRAM_API_KEY=your_deepgram_api_key
   OPENROUTER_API_KEY=your_openrouter_api_key
   HUME_API_KEY=your_hume_api_key
   HUME_SECRET_KEY=your_hume_secret_key
   ```

4. **Start the server**
   ```bash
   npm start
   ```

5. **Open in browser**
   ```
   http://localhost:3001
   ```

## 🎮 Usage

### Basic Controls

- **🎤 Start Talking**: Begin voice conversation
- **🛑 Stop**: End conversation
- **🔄 Reset** (top-left): Clear history and reload
- **📷 Camera**: Toggle camera on/off
- **⚙️ Settings**: Change AI model, voice, microphone

### Voice Commands

- **"Hello"** - Start a conversation
- **"Take my photo"** - Initiate photo capture
- **"Shoot"** - Trigger photo countdown
- **"Can you see me?"** - Ask NoVo about camera view

## 📦 Project Structure

```
Novo-One/
├── avatar-portal/
│   ├── code/
│   │   ├── css/          # Styles
│   │   ├── js/           # Frontend JavaScript
│   │   ├── mp4/          # Videos and sounds
│   │   └── index.html    # Main HTML
│   └── novo-voice-backend.js  # Backend server
├── package.json
├── .env.example
└── README.md
```

## 🌐 Deploy to Render

See [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) for detailed deployment instructions.

**Quick Deploy:**
1. Push to GitHub
2. Connect to Render
3. Add environment variables
4. Deploy!

## 🛠️ Technology Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Node.js, Express, Socket.io
- **Speech-to-Text**: Deepgram Flux
- **Text-to-Speech**: Deepgram TTS
- **AI Brain**: OpenRouter (GPT-4o, Claude, etc.)
- **Emotion Detection**: Hume AI
- **Vision**: OpenRouter Vision Models
- **Real-time Communication**: WebSockets

## 📝 Configuration

### AI Models
Choose from multiple AI models in the settings panel:
- GPT-4o Mini (fastest, cheapest)
- GPT-4o (best quality)
- Claude 3.5 Sonnet (most capable)
- And more!

### Voice Options
12+ voice options including:
- Female: Asteria, Luna, Stella, Athena, Hera
- Male: Orion, Arcas, Perseus, Angus, Orpheus, Helios, Zeus

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Deepgram for amazing speech services
- OpenRouter for AI model access
- Hume AI for emotion detection
- The open-source community

## 📧 Support

For issues or questions, please open an issue on GitHub.

---

Made with ❤️ by the NoVo Team

