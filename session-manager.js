/**
 * Session Manager with Upstash Redis
 * Manages real-time user sessions, active conversations, and caching
 */

const https = require('https');

class SessionManager {
  constructor() {
    this.endpoint = process.env.UPSTASH_REDIS_REST_URL;
    this.token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!this.endpoint || !this.token) {
      throw new Error('Upstash Redis credentials not configured');
    }
  }

  /**
   * Create or update user session
   */
  async startSession(userId, sessionData = {}) {
    const session = {
      userId,
      startedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      messageCount: 0,
      emotion: sessionData.emotion || 'neutral',
      context: sessionData.context || '',
      ...sessionData
    };

    const ttl = 86400; // 24 hours
    await this.set(`session:${userId}`, JSON.stringify(session), ttl);

    return session;
  }

  /**
   * Get active session
   */
  async getSession(userId) {
    const data = await this.get(`session:${userId}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(userId, messageCount = null) {
    const session = await this.getSession(userId);
    if (!session) return null;

    session.lastActivityAt = new Date().toISOString();
    if (messageCount !== null) {
      session.messageCount = messageCount;
    }

    const ttl = 86400;
    await this.set(`session:${userId}`, JSON.stringify(session), ttl);

    return session;
  }

  /**
   * Cache user profile
   */
  async cacheProfile(userId, profile) {
    const ttl = 3600; // 1 hour
    await this.set(`profile:${userId}`, JSON.stringify(profile), ttl);
    return profile;
  }

  /**
   * Get cached profile
   */
  async getCachedProfile(userId) {
    const data = await this.get(`profile:${userId}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Store conversation context for real-time sync
   */
  async setConversationContext(userId, context) {
    const ttl = 1800; // 30 minutes
    await this.set(`context:${userId}`, JSON.stringify(context), ttl);
    return context;
  }

  /**
   * Get conversation context
   */
  async getConversationContext(userId) {
    const data = await this.get(`context:${userId}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Queue a message for streaming
   */
  async queueMessage(userId, message, type = 'text') {
    const queueKey = `queue:${userId}`;
    const msgData = {
      id: `${userId}_${Date.now()}`,
      type,
      content: message,
      queuedAt: new Date().toISOString()
    };

    // Push to list
    await this.rpush(queueKey, JSON.stringify(msgData));

    // Set expiry on queue
    await this.expire(queueKey, 300); // 5 minutes

    return msgData;
  }

  /**
   * Get next message from queue
   */
  async dequeueMessage(userId) {
    const queueKey = `queue:${userId}`;
    const data = await this.lpop(queueKey);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Store active conversation participants
   */
  async setActiveUser(userId, status = 'online') {
    const ttl = 3600;
    await this.set(`active:${userId}`, status, ttl);
    return status;
  }

  /**
   * Check if user is active
   */
  async isUserActive(userId) {
    const status = await this.get(`active:${userId}`);
    return status === 'online';
  }

  /**
   * Get all active users
   */
  async getActiveUsers() {
    // This is a simplified version - in production you'd use SCAN
    const keys = await this.keys('active:*');
    const users = [];

    for (const key of keys) {
      const userId = key.replace('active:', '');
      const status = await this.get(key);
      if (status === 'online') {
        users.push(userId);
      }
    }

    return users;
  }

  /**
   * Increment user message count
   */
  async incrementMessageCount(userId) {
    const key = `msgcount:${userId}`;
    return this.incr(key);
  }

  /**
   * Get user message count
   */
  async getMessageCount(userId) {
    const count = await this.get(`msgcount:${userId}`);
    return count ? parseInt(count) : 0;
  }

  /**
   * Set key-value with expiry
   */
  async set(key, value, ttl = null) {
    const parts = ['SET', key, value];
    if (ttl) {
      parts.push('EX', ttl.toString());
    }

    return this.command(parts);
  }

  /**
   * Get value
   */
  async get(key) {
    return this.command(['GET', key]);
  }

  /**
   * Delete key
   */
  async del(key) {
    return this.command(['DEL', key]);
  }

  /**
   * Increment value
   */
  async incr(key) {
    return this.command(['INCR', key]);
  }

  /**
   * Right push to list
   */
  async rpush(key, value) {
    return this.command(['RPUSH', key, value]);
  }

  /**
   * Left pop from list
   */
  async lpop(key) {
    return this.command(['LPOP', key]);
  }

  /**
   * Set key expiry
   */
  async expire(key, seconds) {
    return this.command(['EXPIRE', key, seconds.toString()]);
  }

  /**
   * Get all keys matching pattern
   */
  async keys(pattern) {
    return this.command(['KEYS', pattern]);
  }

  /**
   * Execute Redis command
   */
  async command(args) {
    return new Promise((resolve, reject) => {
      const url = new URL(this.endpoint);
      const path = `/${args.map(arg => encodeURIComponent(arg)).join('/')}`;

      const options = {
        method: 'GET',
        hostname: url.hostname,
        path,
        headers: {
          'Authorization': `Bearer ${this.token}`,
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            
            // Handle Redis responses
            if (result.result !== undefined) {
              resolve(result.result);
            } else if (result.error) {
              reject(new Error(result.error));
            } else {
              resolve(result);
            }
          } catch (err) {
            reject(new Error(`Failed to parse Redis response: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }
}

module.exports = SessionManager;
