#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const http = require('http');

const QUEUE_FILE = '/root/clawd/portal-message-queue.md';
const HANDLER_FILE = '/root/clawd/.portal-handler-state.json';
const RESPONSE_ENDPOINT = 'http://localhost:3002/messages/respond';

// Load processed message tracking
function loadState() {
  try {
    if (fs.existsSync(HANDLER_FILE)) {
      return JSON.parse(fs.readFileSync(HANDLER_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error loading state:', err.message);
  }
  return { processedMessages: new Set() };
}

// Save processed message tracking
function saveState(state) {
  try {
    const data = { processedMessages: Array.from(state.processedMessages) };
    fs.writeFileSync(HANDLER_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error saving state:', err.message);
  }
}

// Parse messages from queue file
function parseMessages() {
  try {
    if (!fs.existsSync(QUEUE_FILE)) {
      return [];
    }
    
    const content = fs.readFileSync(QUEUE_FILE, 'utf-8');
    const messages = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^\[(.+?)\]\s+\*\*(.+?)\*\*\s+\((.+?)\):\s+(.+)$/);
      if (match) {
        const [, timestamp, userId, emotion, text] = match;
        const messageKey = `${timestamp}-${userId}`;
        messages.push({
          key: messageKey,
          timestamp,
          userId,
          emotion,
          text
        });
      }
    }
    
    return messages;
  } catch (err) {
    console.error('Error parsing messages:', err.message);
    return [];
  }
}

// Generate warm Novo response
function generateResponse(message) {
  const responses = {
    greeting: [
      "Hey there! I'm doing great, thanks for asking! 😊 How are you doing today?",
      "I'm wonderful! Always happy to chat with you. What's on your mind?",
      "Doing fantastic! Thanks for checking in. What can I help you with?",
      "I'm energized and ready to help! How are things going with you?"
    ],
    question: [
      "That's a great question! I love thinking about these things. Let me help you work through it.",
      "Ooh, interesting! I have some thoughts on that. Tell me more about what you're thinking!",
      "I'm all ears! What's the context here? Help me understand better.",
      "Love it! That's something I can definitely help you explore."
    ],
    statement: [
      "That's really interesting! I appreciate you sharing that.",
      "Got it! That makes sense. What would you like to do about it?",
      "Thanks for letting me know! How can I help?",
      "That's cool! I'm here to help if you need anything."
    ],
    general: [
      "I'm here and ready to help! What do you need?",
      "Always happy to chat! What's up?",
      "I'm all ears! What's on your mind?",
      "Ready when you are! What can I do for you?"
    ]
  };
  
  const text = message.text.toLowerCase();
  let category = 'general';
  
  if (text.includes('how are you') || text.includes('how are you doing')) {
    category = 'greeting';
  } else if (text.includes('?')) {
    category = 'question';
  } else if (text.length > 20) {
    category = 'statement';
  }
  
  const options = responses[category];
  return options[Math.floor(Math.random() * options.length)];
}

// Determine emotion for response
function getResponseEmotion(userEmotion) {
  const emotionMap = {
    happy: 'happy',
    excited: 'happy',
    neutral: 'warm',
    curious: 'engaged',
    frustrated: 'supportive',
    sad: 'empathetic'
  };
  
  return emotionMap[userEmotion] || 'warm';
}

// Send response to endpoint
function sendResponse(message) {
  return new Promise((resolve, reject) => {
    const responseText = generateResponse(message);
    const emotion = getResponseEmotion(message.emotion);
    
    const payload = {
      userId: message.userId,
      response: {
        text: responseText,
        emotion: emotion
      }
    };
    
    const url = new URL(RESPONSE_ENDPOINT);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(payload))
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`✓ Responded to ${message.userId}: "${responseText.substring(0, 50)}..."`);
          resolve(true);
        } else {
          console.error(`✗ Failed to respond to ${message.userId}: HTTP ${res.statusCode}`);
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', (err) => {
      console.error(`✗ Network error responding to ${message.userId}:`, err.message);
      reject(err);
    });
    
    req.write(JSON.stringify(payload));
    req.end();
  });
}

// Remove processed messages from queue file
function trimQueueFile(processedKeys) {
  try {
    if (!fs.existsSync(QUEUE_FILE)) return;
    
    const content = fs.readFileSync(QUEUE_FILE, 'utf-8');
    const lines = content.split('\n');
    const remaining = [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const match = line.match(/^\[(.+?)\]\s+\*\*(.+?)\*\*/);
      if (match) {
        const [, timestamp, userId] = match;
        const key = `${timestamp}-${userId}`;
        if (!processedKeys.has(key)) {
          remaining.push(line);
        }
      }
    }
    
    fs.writeFileSync(QUEUE_FILE, remaining.join('\n') + (remaining.length > 0 ? '\n' : ''));
    console.log(`Cleaned up ${processedKeys.size} processed message(s) from queue`);
  } catch (err) {
    console.error('Error trimming queue file:', err.message);
  }
}

// Main handler loop
async function handleMessages() {
  const state = loadState();
  state.processedMessages = new Set(state.processedMessages || []);
  
  const messages = parseMessages();
  const newMessages = messages.filter(m => !state.processedMessages.has(m.key));
  
  if (newMessages.length > 0) {
    console.log(`\n📨 Found ${newMessages.length} new message(s) at ${new Date().toISOString()}`);
    
    for (const message of newMessages) {
      try {
        await sendResponse(message);
        state.processedMessages.add(message.key);
        await new Promise(resolve => setTimeout(resolve, 200)); // Small delay between requests
      } catch (err) {
        console.error(`Error processing message from ${message.userId}:`, err.message);
      }
    }
    
    saveState(state);
    trimQueueFile(new Set(newMessages.map(m => m.key)));
  }
}

// Start the handler loop
async function start() {
  console.log('🚀 Portal Message Handler Started');
  console.log(`📝 Monitoring: ${QUEUE_FILE}`);
  console.log(`🔗 Endpoint: ${RESPONSE_ENDPOINT}`);
  console.log(`⏱️  Checking every 5 seconds...\n`);
  
  // Initial check
  await handleMessages();
  
  // Loop every 5 seconds
  setInterval(async () => {
    try {
      await handleMessages();
    } catch (err) {
      console.error('Handler error:', err.message);
    }
  }, 5000);
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Portal Message Handler Stopped');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 Portal Message Handler Stopped');
  process.exit(0);
});

start();
