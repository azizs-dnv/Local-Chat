const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const os = require('os');
const crypto = require('crypto');
const QRCode = require('qrcode');

// ── Configuration ──────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000', 10);
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_FILE_SIZE = 100 * 1024 * 1024 * 1024; // 100 GB
const MIME_TYPES = {
  '.7z': 'application/x-7z-compressed',
  '.apk': 'application/vnd.android.package-archive',
  '.avi': 'video/x-msvideo',
  '.css': 'text/css; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.exe': 'application/vnd.microsoft.portable-executable',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.m4a': 'audio/mp4',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.rar': 'application/vnd.rar',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.zip': 'application/zip',
};

// Ensure upload directory exists
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ── State ──────────────────────────────────────────────────────────────────
const sharedFiles = new Map();   // fileId -> { id, name, size, uploadedBy, uploadedAt }
const clients = new Map();       // clientId -> { ws, name }
const activeUploads = new Map(); // fileId -> { bytesReceived, totalSize, fileName }

// ── HTTP Server ────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  // Disable timeout for upload/download of huge files
  req.setTimeout(0);
  res.setTimeout(0);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'POST' && url.pathname === '/upload') {
    return handleUpload(req, res, url);
  }

  if (req.method === 'GET' && url.pathname.startsWith('/download/')) {
    return handleDownload(req, res, url);
  }

  if (req.method === 'DELETE' && url.pathname.startsWith('/files/')) {
    return handleDelete(req, res, url);
  }

  if (req.method === 'GET' && url.pathname === '/api/files') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify([...sharedFiles.values()]));
  }

  // Server status endpoint for GUI and web
  if (req.method === 'GET' && url.pathname === '/api/status') {
    const ips = getLocalIPs();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      running: true,
      port: PORT,
      clientsCount: clients.size,
      filesCount: sharedFiles.size,
      ips: ips
    }));
  }

  // QR code endpoint — generates SVG with high-contrast for phone cameras
  if (req.method === 'GET' && url.pathname === '/api/qrcode') {
    const ips = getLocalIPs();
    const mainIP = ips.length > 0 ? ips[0].address : 'localhost';
    const serverUrl = `http://${mainIP}:${PORT}`;

    try {
      const svg = await QRCode.toString(serverUrl, {
        type: 'svg',
        width: 400,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      return res.end(svg);
    } catch (err) {
      res.writeHead(500);
      return res.end('QR generation error');
    }
  }

  // Server info endpoint
  if (req.method === 'GET' && url.pathname === '/api/info') {
    const ips = getLocalIPs();
    const urls = ips.map(ip => `http://${ip.address}:${PORT}`);
    if (urls.length === 0) urls.push(`http://localhost:${PORT}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ urls, port: PORT }));
  }

  serveStatic(req, res, url);
});

// No timeouts for large transfers
server.timeout = 0;
server.requestTimeout = 0;
server.headersTimeout = 60000;
server.keepAliveTimeout = 0;

// ── Upload Handler (streaming – no memory buffering) ───────────────────────
function handleUpload(req, res, url) {
  const fileName = decodeURIComponent(url.searchParams.get('name') || 'unnamed');
  const userName = decodeURIComponent(url.searchParams.get('user') || 'Anonymous');
  const totalSize = parseInt(req.headers['content-length'] || '0', 10);

  if (totalSize > MAX_FILE_SIZE) {
    res.writeHead(413, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'File exceeds the 100 GB limit' }));
  }

  const fileId = crypto.randomUUID();
  const filePath = path.join(UPLOAD_DIR, fileId);
  const writeStream = fs.createWriteStream(filePath);
  let bytesReceived = 0;

  activeUploads.set(fileId, { bytesReceived: 0, totalSize, fileName });

  // Broadcast upload started
  broadcast({
    type: 'upload-progress',
    fileId,
    fileName,
    userName,
    bytesReceived: 0,
    totalSize,
  });

  req.on('data', (chunk) => {
    bytesReceived += chunk.length;
    writeStream.write(chunk);

    const info = activeUploads.get(fileId);
    if (info) info.bytesReceived = bytesReceived;

    // Broadcast progress every ~2 MB
    if (bytesReceived % (2 * 1024 * 1024) < chunk.length || bytesReceived === totalSize) {
      broadcast({
        type: 'upload-progress',
        fileId,
        fileName,
        userName,
        bytesReceived,
        totalSize,
      });
    }
  });

  req.on('end', () => {
    writeStream.end(() => {
      activeUploads.delete(fileId);

      const fileInfo = {
        id: fileId,
        name: fileName,
        size: bytesReceived,
        uploadedBy: userName,
        uploadedAt: new Date().toISOString(),
      };
      sharedFiles.set(fileId, fileInfo);

      broadcast({ type: 'file-shared', file: fileInfo });

      // System message in chat
      broadcast({
        type: 'message',
        name: 'System',
        text: `${userName} uploaded "${fileName}" (${formatSize(bytesReceived)})`,
        time: new Date().toISOString(),
        system: true,
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, file: fileInfo }));
    });
  });

  req.on('error', (err) => {
    activeUploads.delete(fileId);
    writeStream.destroy();
    fs.unlink(filePath, () => {});
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  });

  writeStream.on('error', (err) => {
    activeUploads.delete(fileId);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  });
}

// ── Download Handler (streaming + Range support) ───────────────────────────
function handleDownload(req, res, url) {
  const parts = url.pathname.split('/');
  const fileId = parts[2];
  const fileInfo = sharedFiles.get(fileId);

  if (!fileInfo) {
    res.writeHead(404);
    return res.end('File not found');
  }

  const filePath = path.join(UPLOAD_DIR, fileId);
  if (!fs.existsSync(filePath)) {
    sharedFiles.delete(fileId);
    res.writeHead(404);
    return res.end('File was removed from disk');
  }

  const stat = fs.statSync(filePath);
  const encodedName = encodeURIComponent(fileInfo.name).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
  const fallbackName = fileInfo.name.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '\\$&');
  const disposition = `attachment; filename="${fallbackName || 'download'}"; filename*=UTF-8''${encodedName}`;
  const contentType = MIME_TYPES[path.extname(fileInfo.name).toLowerCase()] || 'application/octet-stream';

  // Range requests (resume / parallel download)
  const range = req.headers.range;
  if (range) {
    const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
    const start = parseInt(startStr, 10);
    const end = endStr ? parseInt(endStr, 10) : stat.size - 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Type': contentType,
      'Content-Disposition': disposition,
      'X-Content-Type-Options': 'nosniff',
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': contentType,
      'Content-Disposition': disposition,
      'X-Content-Type-Options': 'nosniff',
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(filePath).pipe(res);
  }
}

// ── Delete File Handler ────────────────────────────────────────────────────
function handleDelete(req, res, url) {
  const fileId = url.pathname.split('/')[2];
  const fileInfo = sharedFiles.get(fileId);

  if (!fileInfo) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'File not found' }));
  }

  const filePath = path.join(UPLOAD_DIR, fileId);
  sharedFiles.delete(fileId);
  fs.unlink(filePath, () => {});

  broadcast({ type: 'file-deleted', fileId });
  broadcast({
    type: 'message',
    name: 'System',
    text: `"${fileInfo.name}" was deleted`,
    time: new Date().toISOString(),
    system: true,
  });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true }));
}

// ── Static File Server ─────────────────────────────────────────────────────
function serveStatic(req, res, url) {
  let filePath = path.join(PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname);

  // Prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not Found');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext.toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}

// ── WebSocket Server ───────────────────────────────────────────────────────
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  const clientId = crypto.randomUUID();
  clients.set(clientId, { ws, name: null });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      handleWsMessage(clientId, ws, msg);
    } catch (_) {}
  });

  ws.on('close', () => {
    const client = clients.get(clientId);
    if (client?.name) {
      broadcast({
        type: 'message',
        name: 'System',
        text: `${client.name} left the chat`,
        time: new Date().toISOString(),
        system: true,
      });
    }
    clients.delete(clientId);
    broadcastUsers();
  });
});

function handleWsMessage(clientId, ws, msg) {
  const client = clients.get(clientId);
  if (!client) return;

  switch (msg.type) {
    case 'join': {
      client.name = msg.name?.trim() || 'Anonymous';

      // Send the full file list to the newcomer
      ws.send(JSON.stringify({
        type: 'file-list',
        files: [...sharedFiles.values()],
      }));

      broadcast({
        type: 'message',
        name: 'System',
        text: `${client.name} joined the chat`,
        time: new Date().toISOString(),
        system: true,
      });

      broadcastUsers();
      break;
    }

    case 'message': {
      if (!client.name || !msg.text?.trim()) return;
      broadcast({
        type: 'message',
        name: client.name,
        text: msg.text.trim(),
        time: new Date().toISOString(),
      });
      break;
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const [, c] of clients) {
    if (c.ws.readyState === 1) c.ws.send(data);
  }
}

function broadcastUsers() {
  const list = [...clients.values()].filter(c => c.name).map(c => c.name);
  broadcast({ type: 'users', list });
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

function getLocalIPs() {
  const nets = os.networkInterfaces();
  const results = [];
  for (const [name, addrs] of Object.entries(nets)) {
    for (const a of addrs) {
      if (a.family === 'IPv4' && !a.internal) {
        results.push({ iface: name, address: a.address });
      }
    }
  }
  return results;
}

// ── Start ──────────────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIPs();

  console.log('');
  console.log('====================================================');
  console.log('          LocalShare — Chat + File Sharing           ');
  console.log('====================================================');
  console.log(`  Port: ${PORT}`);
  console.log('  Open in a browser:');
  console.log(`    http://localhost:${PORT}`);
  for (const ip of ips) {
    console.log(`    http://${ip.address}:${PORT}  (${ip.iface})`);
  }
  console.log('  Max file size: 100 GB (streamed transfer)');
  console.log('====================================================');
  console.log('');
});
