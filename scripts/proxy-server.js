const http = require('http');
const httpProxy = require('http-proxy');
const url = require('url');
require('dotenv').config();

// ---------- Configuration from .env with fallbacks ----------
const TARGET = process.env.TARGET;
const PROXY_PORT = parseInt(process.env.PROXY_PORT);
const SECRET = process.env.SECRET;

// NEW: Read authentication credentials from .env
const AUTH_USER = process.env.AUTH_USER;
const AUTH_PASS = process.env.AUTH_PASS;

// Allowed origins for framing (GitHub Pages domains)
// You can optionally read from .env as a comma-separated list:
// const ALLOWED_FRAME_ANCESTORS = process.env.ALLOWED_FRAME_ANCESTORS
//   ? process.env.ALLOWED_FRAME_ANCESTORS.split(',').map(s => s.trim())
//   : ['https://yapweixuan1.github.io', 'https://*.github.io'];
const ALLOWED_FRAME_ANCESTORS = [
  'https://yapweixuan1.github.io',
  'https://*.github.io'
];

// ---------- Proxy instance ----------
const proxy = httpProxy.createProxyServer({ target: TARGET, ws: true });

// ---------- Modify response headers to allow iframe embedding ----------
proxy.on('proxyRes', (proxyRes, req, res) => {
  // Remove X-Frame-Options entirely
  delete proxyRes.headers['x-frame-options'];

  // Add Content-Security-Policy with frame-ancestors
  const frameAncestors = ALLOWED_FRAME_ANCESTORS.join(' ');
  const csp = `frame-ancestors ${frameAncestors};`;
  const existingCsp = proxyRes.headers['content-security-policy'] || '';
  proxyRes.headers['content-security-policy'] = existingCsp + csp;
});

// ---------- Authentication handler ----------
const authHandler = (req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const { username, password } = JSON.parse(body);
      if (username === AUTH_USER && password === AUTH_PASS) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Invalid credentials' }));
      }
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Bad request' }));
    }
  });
};

// ---------- Main HTTP server ----------
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // NEW: Handle authentication endpoint
  if (pathname === '/auth' && req.method === 'POST') {
    authHandler(req, res);
    return;
  }

  // Admin secret for flow editor
  if (pathname === '/' || pathname === '/flows') {
    if (parsedUrl.query.admin === SECRET) {
      proxy.web(req, res);
      return;
    }

    if (pathname === '/') {
      res.writeHead(302, { Location: '/ui/' });
      res.end();
      return;
    }

    if (pathname === '/flows') {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Access Denied');
      return;
    }
  }

  proxy.web(req, res);
});

// ---------- WebSocket upgrade ----------
server.on('upgrade', (req, socket, head) => {
  proxy.ws(req, socket, head);
});

// ---------- Error handling ----------
proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err.message);
  if (res && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Proxy error: ' + err.message);
  }
});

// ---------- Start server ----------
server.listen(PROXY_PORT, () => {
  console.log(`🚀 Proxy running on http://localhost:${PROXY_PORT} -> ${TARGET}`);
  console.log(`🔑 Admin secret: ?admin=${SECRET}`);
  console.log(`👤 Auth: ${AUTH_USER} / ${AUTH_PASS.replace(/./g, '*')}`);
  console.log(`🖼️  IFrame allowed for: ${ALLOWED_FRAME_ANCESTORS.join(', ')}`);
});