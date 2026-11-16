// Disposable image proof only. Opaque TCP forwarding preserves PostgreSQL TLS.
// Both listeners bind loopback; POST /silence freezes only sockets already open.
// No SQL, credentials, or payloads are logged. See docs/db-stall-staging-proof.md.
import net from 'node:net';
import http from 'node:http';
const connections = new Set();
net.createServer(client => {
  const upstream = net.connect(55341, '127.0.0.1');
  const state = { client, upstream, silent: false };
  connections.add(state);
  client.on('data', data => { if (!state.silent) upstream.write(data); });
  upstream.on('data', data => { if (!state.silent) client.write(data); });
  const close = () => { connections.delete(state); client.destroy(); upstream.destroy(); };
  client.on('error', close); upstream.on('error', close);
  client.on('close', close); upstream.on('close', close);
}).listen(55342, '127.0.0.1');
http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/silence') { res.writeHead(404).end(); return; }
  for (const connection of connections) connection.silent = true;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ silenced: connections.size }));
}).listen(55344, '127.0.0.1');
