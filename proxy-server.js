const http = require('http');
const httpProxy = require('http-proxy');
const url = require('url');

// Configuration
const TARGET = 'http://localhost:1880';          // Where Node‑RED is running
const PROXY_PORT = 1881;                         // Port the proxy listens on
const SECRET = 'secret123';          // CHANGE THIS to a strong secret

// Create proxy instance (with WebSocket support)
const proxy = httpProxy.createProxyServer({ target: TARGET, ws: true });

// Main HTTP server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // ----- Protection for Node‑RED admin routes -----
  if (pathname === '/' || pathname === '/flows') {
    // Check if the admin secret is present in the query string
    if (parsedUrl.query.admin === SECRET) {
      // 🟢 Admin access allowed – forward the request to Node‑RED
      // (optional: we could strip the secret here, but it's harmless)
      proxy.web(req, res);
      return;
    }

    // 🔴 Regular users:
    if (pathname === '/') {
      // Redirect root to the dashboard UI
      res.writeHead(302, { Location: '/ui/' });
      res.end();
      return;
    }

    if (pathname === '/flows') {
      // Block access to the flow editor
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Access Denied');
      return;
    }
  }

  // ----- All other paths (e.g., /ui, static assets, WebSocket handshakes) -----
  proxy.web(req, res);
});

// Handle WebSocket upgrades (for Node‑RED's live editing and dashboard)
server.on('upgrade', (req, socket, head) => {
  proxy.ws(req, socket, head);
});

// Error handling
proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err.message);
  if (res && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Proxy error: ' + err.message);
  }
});

// Start the proxy
server.listen(PROXY_PORT, () => {
  console.log(`🚀 Proxy running on http://localhost:${PROXY_PORT} -> ${TARGET}`);
  console.log(`Root / is redirected to /ui/.`);
  console.log(`🔑 Admin access: add ?admin=${SECRET} to the URL to see the flow editor.`);
});