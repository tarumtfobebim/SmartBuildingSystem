const http = require('http');
const httpProxy = require('http-proxy');
const url = require('url');
const crypto = require('crypto');
require('dotenv').config();

// ---------- Configuration from .env with fallbacks ----------
const TARGET = process.env.TARGET || 'http://localhost:1880';
const PROXY_PORT = parseInt(process.env.PROXY_PORT) || 1881;
const SECRET = process.env.SECRET;

// NEW: Read authentication credentials from .env
const AUTH_USER = process.env.AUTH_USER;
const AUTH_PASS = process.env.AUTH_PASS;
const AUTH_TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || SECRET || `${AUTH_USER}:${AUTH_PASS}`;
const AUTH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

function createAuthToken() {
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + AUTH_TOKEN_TTL_SECONDS
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', AUTH_TOKEN_SECRET)
    .update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function isValidAuthToken(token) {
  if (!token || typeof token !== 'string') return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;

  const expected = crypto.createHmac('sha256', AUTH_TOKEN_SECRET)
    .update(payload).digest();
  let supplied;
  try {
    supplied = Buffer.from(signature, 'base64url');
  } catch (_) {
    return false;
  }
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number.isFinite(data.exp) && data.exp > Math.floor(Date.now() / 1000);
  } catch (_) {
    return false;
  }
}

// Allowed origins for framing (GitHub Pages domains)
const ALLOWED_FRAME_ANCESTORS = [
  'https://tarumtfobebim.github.io',
  'https://*.github.io'
];

// ---------- CORS headers helper ----------
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// ---------- Proxy instance ----------
const proxy = httpProxy.createProxyServer({ target: TARGET, ws: true });

// ---------- Modify response headers to allow iframe embedding ----------
proxy.on('proxyRes', (proxyRes, req, res) => {
  setCorsHeaders(res);

  // Remove X-Frame-Options entirely
  delete proxyRes.headers['x-frame-options'];

  // Add CORS headers to upstream response too
  proxyRes.headers['access-control-allow-origin'] = '*';
  proxyRes.headers['access-control-allow-methods'] = 'GET, POST, OPTIONS';
  proxyRes.headers['access-control-allow-headers'] = 'Content-Type, Authorization, X-Requested-With';

  // Add Content-Security-Policy with frame-ancestors
  const frameAncestors = ALLOWED_FRAME_ANCESTORS.join(' ');
  const csp = `frame-ancestors ${frameAncestors};`;
  const existingCsp = proxyRes.headers['content-security-policy'] || '';
  proxyRes.headers['content-security-policy'] = existingCsp + csp;
});

// ---------- Authentication handler ----------
const authHandler = (req, res) => {
  setCorsHeaders(res); // Allow cross-origin access

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const { username, password } = JSON.parse(body);
      if (username === AUTH_USER && password === AUTH_PASS) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, token: createAuthToken() }));
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

const verifyAuthHandler = (req, res) => {
  setCorsHeaders(res);
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const { token } = JSON.parse(body);
      const valid = isValidAuthToken(token);
      res.writeHead(valid ? 200 : 401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: valid }));
    } catch (_) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Bad request' }));
    }
  });
};

// ---------- Main HTTP server ----------
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Handle CORS preflight for auth and any proxied endpoint
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    res.writeHead(200);
    res.end();
    return;
  }

  setCorsHeaders(res);

  // Handle authentication endpoint
  if (pathname === '/auth' && req.method === 'POST') {
    authHandler(req, res);
    return;
  }

  if (pathname === '/auth/verify' && req.method === 'POST') {
    verifyAuthHandler(req, res);
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
