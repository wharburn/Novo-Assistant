/**
 * Portal Vision API
 * Provides camera frame access for Novo to analyze and describe
 */

const http = require('http');

class PortalVisionAPI {
  constructor(port = 3003) {
    this.port = port;
    this.frames = new Map(); // userId -> latest frame
    this.startServer();
  }

  startServer() {
    this.server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Get latest frame from a user
      if (req.url.startsWith('/frame/') && req.method === 'GET') {
        const userId = req.url.split('/')[2];
        if (this.frames.has(userId)) {
          const frame = this.frames.get(userId);
          res.writeHead(200);
          res.end(JSON.stringify(frame));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'No frame available' }));
        }
        return;
      }

      // Store a frame (called from portal backend)
      if (req.url === '/store' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const { userId, base64, emotion } = data;
            
            this.frames.set(userId, {
              timestamp: new Date().toISOString(),
              base64,
              emotion,
              size: base64.length
            });
            
            res.writeHead(200);
            res.end(JSON.stringify({ stored: true }));
          } catch (err) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        return;
      }

      // List active users with frames
      if (req.url === '/users' && req.method === 'GET') {
        const users = Array.from(this.frames.keys()).map(userId => ({
          userId,
          timestamp: this.frames.get(userId).timestamp,
          emotion: this.frames.get(userId).emotion
        }));
        res.writeHead(200);
        res.end(JSON.stringify(users));
        return;
      }

      // Health check
      if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    });

    this.server.listen(this.port, () => {
      console.log(`🎬 Portal Vision API running on port ${this.port}`);
    });
  }

  storeFrame(userId, base64, emotion) {
    this.frames.set(userId, {
      timestamp: new Date().toISOString(),
      base64,
      emotion
    });
  }
}

if (require.main === module) {
  const vision = new PortalVisionAPI(3003);
}

module.exports = PortalVisionAPI;
