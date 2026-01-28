/**
 * User Profile Manager
 * Handles user identification, profiles, and recognition
 */

const fs = require('fs');
const path = require('path');
const UpstashMemorySystem = require('./memory-system');

class UserProfileManager {
  constructor() {
    this.upstash = new UpstashMemorySystem();
    this.profilesDir = path.join(__dirname, 'memory', 'users');
    this.ensureProfilesDir();
  }

  ensureProfilesDir() {
    if (!fs.existsSync(this.profilesDir)) {
      fs.mkdirSync(this.profilesDir, { recursive: true });
    }
  }

  /**
   * Create or update user profile
   */
  async createOrUpdateProfile(userId, profileData) {
    const profile = {
      id: userId,
      name: profileData.name || 'Unknown',
      voiceId: profileData.voiceId || null,
      phoneNumber: profileData.phoneNumber || null,
      email: profileData.email || null,
      firstMeetAt: profileData.firstMeetAt || new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      preferences: profileData.preferences || {
        emoteTone: 'warm',
        voiceType: 'Lisa',
        updateFrequency: 'weekly'
      },
      relationType: profileData.relationType || 'user', // user, friend, colleague, etc.
      notes: profileData.notes || ''
    };

    // Save locally
    const filePath = path.join(this.profilesDir, `${userId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(profile, null, 2));

    // Save to Upstash
    await this.upstash.saveUserProfile(userId, profile);

    return profile;
  }

  /**
   * Get user profile
   */
  async getProfile(userId) {
    const filePath = path.join(this.profilesDir, `${userId}.json`);
    
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }

    return null;
  }

  /**
   * Add learned detail about user
   */
  async learnDetail(userId, detail, importance = 'normal') {
    const detailsFile = path.join(this.profilesDir, `${userId}-details.json`);
    let details = [];

    if (fs.existsSync(detailsFile)) {
      details = JSON.parse(fs.readFileSync(detailsFile, 'utf-8'));
    }

    details.push({
      detail,
      importance,
      learnedAt: new Date().toISOString()
    });

    fs.writeFileSync(detailsFile, JSON.stringify(details, null, 2));
    await this.upstash.saveUserDetail(userId, detail, importance);

    return details;
  }

  /**
   * Get learned details about user
   */
  async getDetails(userId) {
    const detailsFile = path.join(this.profilesDir, `${userId}-details.json`);
    
    if (fs.existsSync(detailsFile)) {
      return JSON.parse(fs.readFileSync(detailsFile, 'utf-8'));
    }

    return [];
  }

  /**
   * Save conversation with user
   */
  async saveConversation(userId, userMessage, novoResponse) {
    const convFile = path.join(this.profilesDir, `${userId}-conversations.json`);
    let conversations = [];

    if (fs.existsSync(convFile)) {
      conversations = JSON.parse(fs.readFileSync(convFile, 'utf-8'));
    }

    conversations.push({
      userMessage,
      novoResponse,
      timestamp: new Date().toISOString()
    });

    // Keep only last 100 conversations locally
    if (conversations.length > 100) {
      conversations = conversations.slice(-100);
    }

    fs.writeFileSync(convFile, JSON.stringify(conversations, null, 2));
    
    // Save to Upstash for semantic search
    await this.upstash.saveConversationMemory(userId, userMessage, novoResponse);

    return conversations;
  }

  /**
   * Get recent conversations
   */
  async getConversations(userId, limit = 10) {
    const convFile = path.join(this.profilesDir, `${userId}-conversations.json`);
    
    if (fs.existsSync(convFile)) {
      const conversations = JSON.parse(fs.readFileSync(convFile, 'utf-8'));
      return conversations.slice(-limit);
    }

    return [];
  }

  /**
   * Recognize user (returns profile or null)
   */
  async recognizeUser(identifier) {
    // identifier could be: phone number, email, user ID, or voice fingerprint
    
    // First check if we have a direct profile
    if (fs.existsSync(path.join(this.profilesDir, `${identifier}.json`))) {
      return this.getProfile(identifier);
    }

    // Search through profiles for matching identifier
    const files = fs.readdirSync(this.profilesDir);
    for (const file of files) {
      if (!file.endsWith('.json') || file.includes('-details') || file.includes('-conversations')) {
        continue;
      }

      const data = JSON.parse(fs.readFileSync(path.join(this.profilesDir, file), 'utf-8'));
      
      if (data.phoneNumber === identifier || data.email === identifier || data.voiceId === identifier) {
        return data;
      }
    }

    return null;
  }

  /**
   * List all users
   */
  listUsers() {
    const files = fs.readdirSync(this.profilesDir);
    const users = [];

    for (const file of files) {
      if (!file.endsWith('.json') || file.includes('-details') || file.includes('-conversations')) {
        continue;
      }

      const data = JSON.parse(fs.readFileSync(path.join(this.profilesDir, file), 'utf-8'));
      users.push(data);
    }

    return users.sort((a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt));
  }

  /**
   * Generate greeting for returning user
   */
  async generateGreeting(userId) {
    const profile = await this.getProfile(userId);
    if (!profile) return "Hey there! Nice to meet you.";

    const daysSince = Math.floor(
      (Date.now() - new Date(profile.lastSeenAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSince === 0) {
      return `Hey ${profile.name}, back again?`;
    } else if (daysSince === 1) {
      return `${profile.name}, good to see you again!`;
    } else if (daysSince < 7) {
      return `Welcome back, ${profile.name}! Been a few days.`;
    } else {
      return `${profile.name}! It's been a while. Good to hear from you.`;
    }
  }
}

module.exports = UserProfileManager;
