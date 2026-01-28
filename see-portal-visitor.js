#!/usr/bin/env node

/**
 * See Portal Visitor
 * Allows Novo to see and describe what portal visitors are showing
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

async function getLatestFrame(userId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: `/camera/${userId}`,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function listVisitors() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/camera',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function saveFrame(userId, base64) {
  // Save to file for later analysis
  const filename = `/tmp/portal-visitor-${userId}-${Date.now()}.jpg`;
  const buffer = Buffer.from(base64, 'base64');
  fs.writeFileSync(filename, buffer);
  return filename;
}

// Example usage
async function main() {
  console.log('🎬 Portal Visitor Vision System');
  console.log('================================\n');

  try {
    const visitors = await listVisitors();
    console.log(`Active visitors: ${visitors.length}`);
    
    if (visitors.length > 0) {
      for (const visitor of visitors) {
        console.log(`\n📍 User: ${visitor.userId}`);
        console.log(`   Emotion: ${visitor.emotion}`);
        console.log(`   Timestamp: ${visitor.timestamp}`);
        
        try {
          const frame = await getLatestFrame(visitor.userId);
          const filename = await saveFrame(visitor.userId, frame.base64);
          console.log(`   ✅ Frame saved: ${filename}`);
          console.log(`   Size: ${(frame.base64.length / 1024).toFixed(1)}KB`);
        } catch (err) {
          console.log(`   ❌ Could not retrieve frame: ${err.message}`);
        }
      }
    } else {
      console.log('No active visitors with camera enabled');
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { getLatestFrame, listVisitors, saveFrame };
