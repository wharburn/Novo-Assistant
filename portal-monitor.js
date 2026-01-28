#!/usr/bin/env node

/**
 * Portal Service Monitor
 * Keeps all services running and healthy
 */

const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class PortalMonitor {
  constructor() {
    this.services = [
      {
        name: 'Portal UI (:8000)',
        url: 'http://localhost:8000/',
        port: 8000,
        restartCmd: 'cd /root/clawd/avatar-portal/code && python3 -m http.server 8000 > /tmp/portal-server.log 2>&1 &'
      },
      {
        name: 'Portal Backend (:3001)',
        url: 'http://localhost:3001/health',
        port: 3001,
        restartCmd: 'cd /root/clawd && export $(cat .env.upstash | xargs) && nohup node portal-backend.js > /tmp/portal-backend.log 2>&1 &'
      },
      {
        name: 'Portal Bridge (:3002)',
        url: 'http://localhost:3002/health',
        port: 3002,
        restartCmd: 'cd /root/clawd && export $(cat .env.upstash | xargs) && nohup node portal-clawdbot-bridge.js > /tmp/bridge.log 2>&1 &'
      }
    ];

    this.logFile = '/tmp/portal-monitor.log';
    this.checkInterval = 30000; // 30 seconds
    this.startMonitoring();
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logMsg = `[${timestamp}] ${message}`;
    console.log(logMsg);
    fs.appendFileSync(this.logFile, logMsg + '\n');
  }

  startMonitoring() {
    this.log('🔍 Portal Monitor started');
    
    // Check immediately
    this.checkAll();

    // Then check every 30 seconds
    setInterval(() => this.checkAll(), this.checkInterval);
  }

  checkAll() {
    this.services.forEach(service => this.checkService(service));
  }

  checkService(service) {
    const req = http.get(service.url, { timeout: 5000 }, (res) => {
      if (res.statusCode === 200 || res.statusCode === 301) {
        this.log(`✅ ${service.name} - OK`);
      } else {
        this.log(`⚠️ ${service.name} - Status ${res.statusCode}, restarting...`);
        this.restart(service);
      }
    });

    req.on('error', (err) => {
      this.log(`❌ ${service.name} - Down (${err.code}), restarting...`);
      this.restart(service);
    });

    req.on('timeout', () => {
      req.abort();
      this.log(`⏱️ ${service.name} - Timeout, restarting...`);
      this.restart(service);
    });
  }

  restart(service) {
    this.log(`🔄 Restarting ${service.name}...`);
    
    // Kill any existing processes on this port
    exec(`lsof -ti:${service.port} | xargs kill -9 2>/dev/null || true`, (err) => {
      // Wait a moment then start
      setTimeout(() => {
        exec(service.restartCmd, (err) => {
          if (err) {
            this.log(`❌ Failed to restart ${service.name}: ${err.message}`);
          } else {
            this.log(`✅ ${service.name} restarted`);
          }
        });
      }, 2000);
    });
  }
}

// Start the monitor
const monitor = new PortalMonitor();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 Monitor shutting down');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Monitor interrupted');
  process.exit(0);
});
