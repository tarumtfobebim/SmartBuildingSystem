const chokidar = require('chokidar');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const CONFIG_PATH = path.join(__dirname, 'config', 'backend.json');
const LOG_FILE = path.join(__dirname, 'tunnel.log');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'YapWeiXuan1';          // change
const REPO_NAME = 'SmartBuildingSystem';     // change
const FILE_PATH = 'config/backend.json';

let lastUrl = null;

function extractUrl(line) {
  const match = line.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
  return match ? match[0] : null;
}

// Read the whole log and return the last URL found
function getLatestUrlFromLog() {
  try {
    const data = fs.readFileSync(LOG_FILE, 'utf8');
    const lines = data.split('\n');
    const urls = lines.map(extractUrl).filter(Boolean);
    return urls.length > 0 ? urls[urls.length - 1] : null;
  } catch (err) {
    return null;
  }
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

async function pushToGitHub(url, retries = 3) {
  if (!GITHUB_TOKEN) {
    console.warn('⚠️ GITHUB_TOKEN not set – skipping GitHub push');
    return;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // 1. Get the latest SHA (fresh each time)
      const getUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
      const getResp = await axios.get(getUrl, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` }
      });
      const sha = getResp.data.sha;

      // 2. Read the local file
      const content = await fs.readFile(CONFIG_PATH, 'utf8');
      const base64Content = Buffer.from(content).toString('base64');

      // 3. Update the file
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
      return; // Success – exit the function

    } catch (error) {
      if (error.response?.status === 409 && attempt < retries) {
        console.log(`⚠️ Conflict on attempt ${attempt}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // wait 1 second
      } else {
        console.error('❌ GitHub API error:', error.response?.data || error.message);
        return;
      }
    }
  }
}

// Main update function
async function checkAndUpdate() {
  const url = getLatestUrlFromLog();
  if (url && url !== lastUrl) {
    console.log(`🔄 New URL detected: ${url}`);
    await updateLocalConfig(url);
    await pushToGitHub(url);
    lastUrl = url;
  }
}

// Watch the log file (with polling on Windows)
const watcher = chokidar.watch(LOG_FILE, {
  persistent: true,
  usePolling: true,        // ✅ force polling for Windows
  interval: 2000,          // check every 2 seconds
  ignoreInitial: false     // ✅ process existing content on start
});

watcher.on('change', checkAndUpdate);
watcher.on('add', checkAndUpdate);  // also run when file is created

// Also run a periodic check every 10 seconds as a safety net
setInterval(checkAndUpdate, 10000);

console.log('👀 Watching tunnel.log for changes (polling enabled)...');

// Initial check
setTimeout(checkAndUpdate, 1000);