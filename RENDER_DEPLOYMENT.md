# 🚀 Deploy NoVo Avatar Portal to Render

This guide will help you deploy the NoVo Avatar Portal to Render.com for free.

## Prerequisites

Before deploying, you'll need API keys from:

1. **Deepgram** (Required) - Speech-to-Text
   - Sign up at: https://console.deepgram.com/
   - Get your API key from the dashboard

2. **OpenRouter** (Required) - AI Brain (GPT-4o, Claude, etc.)
   - Sign up at: https://openrouter.ai/
   - Get your API key from settings

3. **Hume AI** (Required) - Emotion Detection
   - Sign up at: https://platform.hume.ai/
   - Get both API key and Secret key

4. **ElevenLabs** (Optional) - Text-to-Speech
   - Sign up at: https://elevenlabs.io/
   - Get your API key (optional, Deepgram TTS is used by default)

## Deployment Steps

### Option 1: Deploy with render.yaml (Recommended)

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Prepare for Render deployment"
   git push origin main
   ```

2. **Create a new Web Service on Render**
   - Go to https://dashboard.render.com/
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Render will automatically detect the `render.yaml` file

3. **Add Environment Variables**
   - In the Render dashboard, go to your service
   - Click "Environment" tab
   - Add the following variables:
     - `DEEPGRAM_API_KEY` = your_deepgram_api_key
     - `OPENROUTER_API_KEY` = your_openrouter_api_key
     - `HUME_API_KEY` = your_hume_api_key
     - `HUME_SECRET_KEY` = your_hume_secret_key
     - `ELEVENLABS_API_KEY` = your_elevenlabs_api_key (optional)
     - `USE_DEEPGRAM_FLUX` = true

4. **Deploy**
   - Click "Create Web Service"
   - Render will automatically build and deploy your app
   - Wait for the build to complete (usually 2-5 minutes)

### Option 2: Manual Deployment

1. **Create a new Web Service on Render**
   - Go to https://dashboard.render.com/
   - Click "New +" → "Web Service"
   - Connect your GitHub repository

2. **Configure the service**
   - **Name**: `novo-avatar-portal`
   - **Region**: Oregon (US West) or closest to you
   - **Branch**: `main`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

3. **Add Environment Variables** (same as Option 1)

4. **Deploy**
   - Click "Create Web Service"

## After Deployment

1. **Get your app URL**
   - Your app will be available at: `https://novo-avatar-portal.onrender.com`
   - (or whatever name you chose)

2. **Test the app**
   - Open the URL in your browser
   - Click "Start Talking" to begin a conversation
   - Test the photo feature by saying "take my photo" then "shoot"

3. **Important Notes**
   - Free tier apps sleep after 15 minutes of inactivity
   - First request after sleep takes ~30 seconds to wake up
   - For production use, upgrade to a paid plan for 24/7 uptime

## Troubleshooting

### App won't start
- Check the logs in Render dashboard
- Verify all required environment variables are set
- Make sure API keys are valid

### WebSocket connection fails
- Render supports WebSockets on all plans
- Check browser console for errors
- Verify the app URL is using `https://` (not `http://`)

### Audio/Video not working
- Browser must have microphone/camera permissions
- HTTPS is required for media access (Render provides this automatically)
- Check browser console for permission errors

## Updating Your Deployment

To update your deployed app:

```bash
git add .
git commit -m "Update app"
git push origin main
```

Render will automatically detect the changes and redeploy.

## Cost

- **Free Tier**: 750 hours/month (enough for one app running 24/7)
- **Paid Tier**: Starting at $7/month for always-on service

## Support

For issues with:
- **Render deployment**: https://render.com/docs
- **NoVo Avatar**: Check the main README.md
- **API services**: Contact respective service providers

