const chokidar = require('chokidar');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const CONFIG_PATH = path.join(__dirname, 'config', 'backend.json');
const LOG_FILE = path.join(__dirname, 'tunnel.log');  // cloudflared writes here

// GitHub settings – edit these
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'YapWeiXuan1';          // replace with your GitHub username
const REPO_NAME = 'SmartBuildingSystem';     // replace with your repo name
const FILE_PATH = 'config/backend.json';

let lastUrl = null;

function extractUrl(line) {
  const match = line.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
  return match ? match[0] : null;
}

async function updateLocalConfig(url) {
  const config = {
    backend_url: url,
    last_updated: new Date().toISOString(),
    version: '1.0.0'
  };
  await fs.writeJson(CONFIG_PATH, config, { spaces: 2 });
  console.log(`✅ Local config updated: ${url}`);
}

async function pushToGitHub(url) {
  if (!GITHUB_TOKEN) {
    console.warn('⚠️ GITHUB_TOKEN not set – skipping GitHub push');
    return;
  }
  try {
    // Get current file SHA
    const getUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
    const getResp = await axios.get(getUrl, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    const sha = getResp.data.sha;

    // Update file
    const content = await fs.readFile(CONFIG_PATH, 'utf8');
    const base64Content = Buffer.from(content).toString('base64');
    const putUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
    await axios.put(putUrl, {
      message: `chore: auto-update backend URL to ${url}`,
      content: base64Content,
      sha: sha,
      branch: 'main'
    }, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    console.log(`✅ GitHub file updated: ${url}`);
  } catch (error) {
    console.error('❌ GitHub API error:', error.response?.data || error.message);
  }
}

// Watch the tunnel log file
chokidar.watch(LOG_FILE, { persistent: true, usePolling: false, ignoreInitial: true })
  .on('change', async () => {
    try {
      const data = await fs.readFile(LOG_FILE, 'utf8');
      const lines = data.split('\n').filter(l => l.trim());
      const lastLine = lines[lines.length - 1];
      const url = extractUrl(lastLine);
      if (url && url !== lastUrl) {
        console.log(`🔄 New URL detected: ${url}`);
        await updateLocalConfig(url);
        await pushToGitHub(url);
        lastUrl = url;
      }
    } catch (err) { /* ignore read errors */ }
  });

console.log('👀 Watching tunnel.log for changes...');