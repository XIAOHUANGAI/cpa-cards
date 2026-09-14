/**
 * CPA 考点速记卡 —— 本地静态服务器
 * 用途：让手机（同一 WiFi）也能通过浏览器访问卡片。
 * 启动：双击「手机访问.bat」，或在命令行执行 node server.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = __dirname;
const DEFAULT_PORT = Number(process.env.PORT) || 8787;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function getLanIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

function createServer(port) {
  return http.createServer((req, res) => {
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';

    const filePath = path.normalize(path.join(ROOT, urlPath));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('403 Forbidden');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found: ' + urlPath);
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
  }).listen(port, '0.0.0.0', () => {
    const ip = getLanIP();
    console.log('==============================================');
    console.log('  CPA 考点速记卡 服务已启动');
    console.log('----------------------------------------------');
    console.log('  电脑打开:  http://localhost:' + port);
    console.log('  手机打开:  http://' + ip + ':' + port);
    console.log('----------------------------------------------');
    console.log('  手机需与电脑连接同一个 WiFi');
    console.log('  如手机打不开，请允许 Windows 防火墙放行 Node');
    console.log('  按 Ctrl+C 停止服务');
    console.log('==============================================');
  });
}

// 端口被占用时自动顺延（最多尝试 30 个端口）
function tryListen(port) {
  const server = createServer(port);
  server.on('error', (err) => {
    if ((err.code === 'EADDRINUSE' || err.code === 'EACCES') && port < DEFAULT_PORT + 30) {
      tryListen(port + 1);
    } else {
      console.error('启动失败：', err.code || err.message);
      process.exit(1);
    }
  });
}

tryListen(DEFAULT_PORT);
