// relay/server.js
// Tiny in-memory state relay. The playfield screen POSTs game state to
// /state; the DMD and backglass screens GET /state to render it. No
// dependencies: pure Node, runs on the stock node:alpine image.

const http = require('http');

let state = '{}';

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'POST' && req.url === '/state') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 100000) req.destroy(); // guard against runaway input
    });
    req.on('end', () => {
      state = body || '{}';
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/state') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(state);
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('hetic pinball relay');
});

server.listen(8090, () => console.log('pinball relay listening on :8090'));
