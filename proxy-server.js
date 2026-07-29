const http = require('http');
const httpProxy = require('http-proxy');
const url = require('url');

// Configuration
const TARGET = 'http://localhost:1880';
const PROXY_PORT = 1881;
const SECRET = 'secret123';   // CHANGE THIS

// Allowed origins for framing (GitHub Pages domains)
const ALLOWED_FRAME_ANCESTORS = [
  'https://yapweixuan1.github.io',
  'https://*.github.io'       // allows all GitHub Pages subdomains (optional)
];

// Create proxy instance
const proxy = httpProxy.createProxyServer({ target: TARGET, ws: true });

// Modify response headers to allow framing
proxy.on('proxyRes', (proxyRes, req, res) => {
  // Remove X-Frame-Options entirely
  proxyRes.headers['x-frame-options'] = '';
  // Remove or override X-Frame-Options if present
  delete proxyRes.headers['x-frame-options'];

  // Add Content-Security-Policy to allow framing from allowed origins
  const frameAncestors = ALLOWED_FRAME_ANCESTORS.join(' ');
  const csp = `frame-ancestors ${frameAncestors};`;
  // Merge with any existing CSP (if any)
  const existingCsp = proxyRes.headers['content-security-policy'] || '';
  proxyRes.headers['content-security-policy'] = existingCsp + csp;
});

// Main HTTP server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

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

// WebSocket upgrade
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

server.listen(PROXY_PORT, () => {
  console.log(`🚀 Proxy running on http://localhost:${PROXY_PORT} -> ${TARGET}`);
  console.log(`🔑 Admin secret: ?admin=${SECRET}`);
  console.log(`🖼️  IFrame embedding allowed for: ${ALLOWED_FRAME_ANCESTORS.join(', ')}`);
});