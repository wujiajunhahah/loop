const { WebSocketServer } = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const WEB_PORT = 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// 确保上传目录存在
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ========== WebSocket 服务器 (8080) ==========
const wss = new WebSocketServer({ port: PORT });

console.log(`[WS Server] 监听端口 ${PORT}`);

wss.on('connection', (ws) => {
  console.log('[WS Server] 客户端已连接');

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      console.log(`[收到] ${msg.text}`);

      // 广播给所有网页客户端
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === 1) {
          client.send(data.toString());
        }
      });
    } catch (e) {
      console.log('[收到] (非JSON):', data.toString());
    }
  });

  ws.on('close', () => {
    console.log('[WS Server] 客户端断开');
  });
});

// ========== HTTP 服务器 (3000) - 托管网页 + 接收文件上传 ==========
const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ===== 文件上传接口 =====
  if (req.method === 'POST' && req.url === '/upload') {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      res.writeHead(400);
      res.end('Bad Request: expected multipart/form-data');
      return;
    }

    const boundary = '--' + contentType.split('boundary=')[1];
    const chunks = [];

    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const parts = parseMultipart(buffer, boundary);

      let savedCount = 0;
      for (const part of parts) {
        if (part.filename && part.data) {
          const timestamp = Date.now();
          const ext = path.extname(part.filename) || '.wav';
          const savePath = path.join(UPLOAD_DIR, `audio_${timestamp}${ext}`);
          fs.writeFileSync(savePath, part.data);
          console.log(`[Upload] 文件已保存: ${savePath} (${part.data.length} bytes)`);
          savedCount++;
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, files: savedCount }));
    });

    req.on('error', (err) => {
      console.error('[Upload] Error:', err);
      res.writeHead(500);
      res.end('Internal Server Error');
    });
    return;
  }

  // ===== Memory 接收接口 =====
  if (req.method === 'POST' && req.url === '/memory') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const msg = JSON.parse(body);
        console.log(`[Memory] 收到: ${msg.content}`);
        console.log(`[Memory] 分类: ${msg.category}`);

        // 广播给所有网页客户端
        wss.clients.forEach((client) => {
          if (client.readyState === 1) {
            client.send(JSON.stringify({
              type: 'diary',
              text: msg.content,
              timestamp: msg.timestamp || Date.now(),
            }));
          }
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400);
        res.end('Bad Request');
      }
    });
    return;
  }

  // ===== 静态文件 =====
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, 'public', filePath);

  const extMap = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
  };
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': extMap[ext] || 'text/plain' });
    res.end(data);
  });
});

server.listen(WEB_PORT, () => {
  console.log(`[Web Server] 浏览器打开 http://localhost:${WEB_PORT}`);
  console.log(`[Upload] 接收文件 POST http://localhost:${WEB_PORT}/upload`);
});

// ===== 简易 multipart 解析器 =====
function parseMultipart(buffer, boundary) {
  const parts = [];
  const str = buffer.toString('binary');
  const sections = str.split(boundary);

  for (const section of sections) {
    if (section.startsWith('--') || section.trim() === '') continue;

    const headerEnd = section.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;

    const header = section.substring(0, headerEnd);
    const body = section.substring(headerEnd + 4);

    // 去掉末尾的 \r\n
    const cleanBody = body.endsWith('\r\n') ? body.slice(0, -2) : body;

    const nameMatch = header.match(/name="([^"]+)"/);
    const filenameMatch = header.match(/filename="([^"]+)"/);

    // 二进制数据
    const dataStart = buffer.indexOf(Buffer.from('\r\n\r\n')) + 4;
    // 简化：用字符串方式找 header 长度，然后取二进制
    const headerBytes = Buffer.from(section.substring(0, headerEnd + 4), 'binary');
    const bodyStart = buffer.indexOf(headerBytes) + headerBytes.length;
    const bodyEnd = buffer.indexOf(Buffer.from(boundary, 'binary'), bodyStart);
    const bodyData = bodyEnd > 0
      ? buffer.slice(bodyStart, bodyEnd - 2) // 去掉 \r\n
      : buffer.slice(bodyStart, buffer.length - 2);

    parts.push({
      name: nameMatch ? nameMatch[1] : null,
      filename: filenameMatch ? filenameMatch[1] : null,
      data: bodyData.length > 0 ? bodyData : null,
    });
  }

  return parts;
}