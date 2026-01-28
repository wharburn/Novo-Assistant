/**
 * User Memory System with Upstash Vector
 * Stores and retrieves user profiles, conversations, and learned details
 */

const https = require('https');

class UpstashMemorySystem {
  constructor() {
    this.endpoint = process.env.UPSTASH_SEARCH_REST_URL;
    this.token = process.env.UPSTASH_SEARCH_REST_TOKEN;
    this.indexName = 'novo-users';
    
    if (!this.endpoint || !this.token) {
      throw new Error('Upstash credentials not configured. Set UPSTASH_SEARCH_REST_URL and UPSTASH_SEARCH_REST_TOKEN');
    }
  }

  /**
   * Create or upsert a user profile
   */
  async saveUserProfile(userId, profile) {
    const data = {
      id: `user_${userId}`,
      values: await this.textToEmbedding(JSON.stringify(profile)),
      metadata: {
        type: 'profile',
        userId,
        name: profile.name,
        createdAt: new Date().toISOString(),
        ...profile
      }
    };

    return this.upsert([data]);
  }

  /**
   * Store a conversation memory
   */
  async saveConversationMemory(userId, message, response) {
    const timestamp = new Date().toISOString();
    const conversationData = `User: ${message}\nNovo: ${response}\nTime: ${timestamp}`;
    
    const data = {
      id: `conversation_${userId}_${Date.now()}`,
      values: await this.textToEmbedding(conversationData),
      metadata: {
        type: 'conversation',
        userId,
        userMessage: message,
        novoResponse: response,
        timestamp
      }
    };

    return this.upsert([data]);
  }

  /**
   * Store a learned detail about a user
   */
  async saveUserDetail(userId, detail, importance = 'normal') {
    const data = {
      id: `detail_${userId}_${Date.now()}`,
      values: await this.textToEmbedding(detail),
      metadata: {
        type: 'detail',
        userId,
        detail,
        importance,
        learnedAt: new Date().toISOString()
      }
    };

    return this.upsert([data]);
  }

  /**
   * Search user memories by semantic similarity
   */
  async searchUserMemories(userId, query, limit = 5) {
    const queryVector = await this.textToEmbedding(query);
    
    const options = {
      topK: limit,
      filter: `userId = "${userId}"`
    };

    return this.search(queryVector, options);
  }

  /**
   * Get all memories for a user
   */
  async getUserMemories(userId, limit = 20) {
    const queryVector = await this.textToEmbedding(userId);
    
    const options = {
      topK: limit,
      filter: `userId = "${userId}"`
    };

    return this.search(queryVector, options);
  }

  /**
   * Text to embedding using OpenAI API
   * Creates semantic embeddings for similarity search
   */
  async textToEmbedding(text) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured for embeddings');
    }

    return new Promise((resolve, reject) => {
      const https = require('https');
      const data = JSON.stringify({
        input: text,
        model: 'text-embedding-3-small'
      });

      const options = {
        hostname: 'api.openai.com',
        path: '/v1/embeddings',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            const result = JSON.parse(body);
            if (result.data && result.data[0]) {
              resolve(result.data[0].embedding);
            } else {
              reject(new Error('No embedding in response'));
            }
          } catch (err) {
            reject(err);
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  /**
   * Upsert vectors to Upstash
   */
  async upsert(vectors) {
    return this.makeRequest('POST', '/upsert', { vectors });
  }

  /**
   * Search vectors in Upstash
   */
  async search(vector, options = {}) {
    const data = {
      vector,
      topK: options.topK || 10,
      includeMetadata: true,
      ...options
    };

    return this.makeRequest('POST', '/query', data);
  }

  /**
   * Make HTTP request to Upstash
   */
  makeRequest(method, path, body) {
    return new Promise((resolve, reject) => {
      const url = new URL(this.endpoint + path);
      
      const options = {
        method,
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
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
            resolve(result);
          } catch (err) {
            reject(new Error(`Failed to parse Upstash response: ${data}`));
          }
        });
      });

      req.on('error', reject);
      
      if (body) {
        req.write(JSON.stringify(body));
      }
      
      req.end();
    });
  }
}

module.exports = UpstashMemorySystem;
