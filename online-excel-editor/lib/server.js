'use strict';

/**
 * 轻量 HTTP 服务模块（零依赖，基于 Node 内置 http 模块）。
 *
 * 职责：
 *   1. 将 temp 目录下的 index.html 作为静态资源提供给浏览器。
 *   2. 暴露 POST /save 接口，接收浏览器「下载表格 (xlsx)」时 fetch 上来的编辑结果
 *      （编辑后导出的 xlsx base64），通过 onSave 回调落盘，并 resolve 一个 Promise
 *      供主流程 await。
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

function mimeType(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

/** 收集请求体（避免超大 base64 丢失），默认上限 300MB。 */
function collectBody(req, maxBytes = 300 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > maxBytes) {
        reject(new Error('请求体超过大小上限'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** 静态文件服务（带路径穿越防护）。 */
function serveStatic(req, res, rootDir) {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }
  if (urlPath === '/') urlPath = '/index.html';

  const root = path.resolve(rootDir);
  const filePath = path.resolve(root, '.' + path.sep + urlPath.replace(/^[\\/]+/, ''));

  if (filePath !== root && !filePath.startsWith(root + path.sep)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found: ' + urlPath);
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeType(filePath), 'Content-Length': data.length });
    res.end(data);
  });
}

/**
 * 启动本地 HTTP 服务，监听随机端口。
 *
 * @param {object} opts
 * @param {string} opts.rootDir  静态资源根目录（生成的 index.html 所在目录）
 * @param {(payload: object) => object} opts.onSave  收到 POST /save 时的处理函数，
 *                                                    返回结果对象会被 resolve 给 waitForSave()
 * @returns {Promise<{server, url, waitForSave}>}
 */
function startEditorServer({ rootDir, onSave }) {
  return new Promise((resolve, reject) => {
    let resolveSave;
    let rejectSave;
    const savePromise = new Promise((res, rej) => {
      resolveSave = res;
      rejectSave = rej;
    });

    const server = http.createServer((req, res) => {
      let urlObj;
      try {
        urlObj = new URL(req.url, 'http://localhost');
      } catch {
        res.writeHead(400);
        res.end('Bad Request');
        return;
      }
      const pathname = urlObj.pathname;

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method === 'POST' && pathname === '/save') {
        collectBody(req)
          .then((buf) => {
            let payload;
            try {
              payload = JSON.parse(buf.toString('utf8'));
            } catch (e) {
              throw new Error('无法解析请求体：' + e.message);
            }
            const result = onSave(payload);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true, result }));
            res.on('finish', () => resolveSave(result));
          })
          .catch((e) => {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, error: String((e && e.message) || e) }));
            rejectSave(e);
          });
        return;
      }

      serveStatic(req, res, rootDir);
    });

    server.on('error', reject);
    server.listen(0, () => {
      const port = server.address().port;
      const url = `http://localhost:${port}/index.html`;
      resolve({ server, url, waitForSave: () => savePromise });
    });
  });
}

module.exports = { startEditorServer, serveStatic, collectBody, mimeType };
