import http from 'node:http';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 4173);
const allowed = new Set(['index.html', 'app.js', 'model.js', 'styles.css']);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer(async (req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
  if (!allowed.has(name)) { res.writeHead(404); res.end('Not found'); return; }
  try {
    const data = await readFile(path.join(root, name));
    res.writeHead(200, { 'Content-Type': `${types[path.extname(name)]}; charset=utf-8`, 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch { res.writeHead(500); res.end('Unable to read file'); }
});
function openBrowser() {
  if (!process.argv.includes('--open')) return;
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', `http://localhost:${port}`] : [`http://localhost:${port}`];
  spawn(command, args, { stdio: 'ignore' }).on('error', () => {});
}
server.on('error', error => {
  if (error.code === 'EADDRINUSE') { console.log(`Port ${port} is already in use. If Days off is running, open http://localhost:${port}`); }
  else console.error(error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => { console.log(`Days off is running at http://localhost:${port}\nKeep this window open. Press Control-C to stop.`); openBrowser(); });
