#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const http = require('http');

/**
 * log-activity.js
 * Invoked by Claude Code lifecycle hooks (UserPromptSubmit, PostToolUse, Stop, SessionStart, SessionEnd).
 * Runs fast, safely captures activity, and updates .planner/activity.json without blocking.
 */

let inputData = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', chunk => {
  inputData += chunk;
});

process.stdin.on('end', async () => {
  try {
    let payload = {};
    if (inputData.trim()) {
      try {
        payload = JSON.parse(inputData);
      } catch (e) {}
    }

    const cwd = payload.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const activityPipeline = path.resolve(__dirname, '../commands/activity-pipeline.js');

    if (fs.existsSync(activityPipeline)) {
      const { buildActivityData } = require(activityPipeline);
      await buildActivityData(cwd);
    }

    // Ping planning server on localhost:8000 if running to notify new activity
    const req = http.request({
      hostname: '127.0.0.1',
      port: 8000,
      path: '/api/activity/refresh',
      method: 'POST',
      timeout: 300
    }, () => {});
    req.on('error', () => {}); // Ignore if server is not currently running
    req.end();
  } catch (err) {
    // Fail safely: never crash or block Claude Code execution
  }
  process.exit(0);
});

// Safeguard timeout: never block Claude for more than 500ms
setTimeout(() => {
  process.exit(0);
}, 500);
