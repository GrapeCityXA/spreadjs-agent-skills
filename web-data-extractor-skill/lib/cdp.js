'use strict';

/**
 * ============================================================
 *  CDP 浏览器读取（零第三方依赖）
 * ============================================================
 *  通过 Chrome DevTools Protocol 连接用户本机**已登录**的浏览器，
 *  打开新标签页导航到目标 URL，读取渲染完成后的完整 DOM——
 *  登录态、JS 动态渲染、SPA 一次性解决（普通 fetch 抓不到的页面也能拿）。
 *
 *  使用前提：
 *    1. Node ≥ 22（依赖内置全局 WebSocket；旧版本会给出明确报错）；
 *    2. 用户以调试端口启动自己的 Chrome，并**在该浏览器里登录目标站点**：
 *         chrome.exe --remote-debugging-port=9222 ^
 *                    --user-data-dir="%TEMP%\skill-cdp" ^
 *                    --remote-allow-origins=*
 *       （--user-data-dir 用新目录，避免和默认浏览器冲突；
 *         --remote-allow-origins=* 允许本技能连接 CDP。）
 *    3. 本技能必须运行在**用户本机**（CDP 连 127.0.0.1）。
 *
 *  流程：/json/new 开 about:blank → 连接 WS → Page.enable →
 *        Page.navigate → 轮询 readyState='complete'（不依赖事件，避免竞态）
 *        → Runtime.evaluate 读 document.documentElement.outerHTML →
 *        关闭标签页。
 * ============================================================
 */

const http = require('http');

const DEFAULT_PORT = 9222;
const NAV_TIMEOUT_MS = 30000;
// 页面 load 后再等一下，让客户端 JS 渲染出内容
const RENDER_SETTLE_MS = 1200;

/** DevTools HTTP 接口（GET/PUT /json/...），零依赖。 */
function devtoolsRequest(port, path, method) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(d));
          } catch (e) {
            reject(new Error(`DevTools 返回非 JSON：${String(d).slice(0, 200)}`));
          }
        });
      }
    );
    req.on('error', (e) =>
      reject(new Error(`无法连接 DevTools（127.0.0.1:${port}）：${e.message}`))
    );
    req.setTimeout(5000, () => req.destroy(new Error(`DevTools 请求超时（127.0.0.1:${port}）`)));
    req.end();
  });
}

/** 建立 CDP WebSocket 会话，返回 { send(method, params), close }。 */
function connectCdp(wsUrl) {
  return new Promise((resolve, reject) => {
    let ws;
    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      return reject(new Error(`创建 WebSocket 失败：${e.message}`));
    }
    const pending = new Map();
    let nextId = 1;
    ws.onopen = () => {
      resolve({
        send(method, params) {
          return new Promise((res, rej) => {
            const id = nextId++;
            pending.set(id, { res, rej });
            ws.send(JSON.stringify({ id, method, params: params || {} }));
          });
        },
        close() {
          try {
            ws.close();
          } catch {
            /* ignore */
          }
        },
      });
    };
    ws.onerror = (e) =>
      reject(
        new Error(
          '无法连接 Chrome DevTools WebSocket：' +
            (e && e.message ? e.message : '未知错误')
        )
      );
    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data));
      } catch {
        return;
      }
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) p.rej(new Error(`CDP 错误 ${msg.error.message}`));
        else p.res(msg.result);
      }
    };
  });
}

/** 生成「启动调试浏览器」的中文引导信息（连接失败时打印给用户）。 */
function browserLaunchHint(port) {
  return (
    '请先用调试端口启动你自己的 Chrome 并登录目标站点，例如（Windows）：\n' +
    `  chrome.exe --remote-debugging-port=${port} --user-data-dir="%TEMP%\\skill-cdp" --remote-allow-origins=*\n` +
    '  说明：--user-data-dir 用一个新目录（避免和默认浏览器冲突）；\n' +
    '        --remote-allow-origins=* 允许本技能连接 CDP；\n' +
    '  启动后在该浏览器里登录目标网站，再运行本技能（需在同一台电脑上）。\n' +
    '  Mac/Linux 把 chrome.exe 换成对应浏览器命令即可。'
  );
}

/**
 * 通过用户浏览器读取目标页面的渲染后 HTML。
 * @param {string} url 目标网页地址
 * @param {{port?: number, timeout?: number}} [opts]
 * @returns {Promise<{html: string, finalUrl: string, title: string}>}
 */
async function fetchPageViaCdp(url, { port = DEFAULT_PORT, timeout = NAV_TIMEOUT_MS } = {}) {
  if (typeof WebSocket !== 'function') {
    throw new Error(
      'CDP 模式需要 Node ≥ 22（内置全局 WebSocket）。当前 Node 版本不支持，' +
        '请升级 Node，或改用直接抓取 / --data 方式。'
    );
  }

  // 1. 打开一个新标签页（about:blank，先不导航）
  let target;
  try {
    target = await devtoolsRequest(port, '/json/new', 'PUT');
  } catch (e) {
    throw new Error(
      `${e.message}\n\n${browserLaunchHint(port)}\n` +
        '（若端口不同，请用 --cdp-port <端口> 指定。）'
    );
  }
  if (!target || !target.webSocketDebuggerUrl) {
    throw new Error('DevTools 返回的标签页缺少 webSocketDebuggerUrl');
  }

  const cdp = await connectCdp(target.webSocketDebuggerUrl);
  try {
    await cdp.send('Page.enable');
    await cdp.send('Page.navigate', { url });

    // 2. 轮询页面就绪（不依赖 loadEventFired，避免 /json/new 提前导航的竞态）
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const r = await cdp.send('Runtime.evaluate', {
        expression: 'document.readyState',
        returnByValue: true,
      });
      if (r && r.result && r.result.value === 'complete') break;
      await new Promise((res) => setTimeout(res, 200));
    }

    // 3. 给客户端 JS 渲染一点时间，再读完整 DOM
    await new Promise((res) => setTimeout(res, RENDER_SETTLE_MS));

    const evalRes = await cdp.send('Runtime.evaluate', {
      expression:
        '({ html: document.documentElement.outerHTML, url: location.href, title: document.title })',
      returnByValue: true,
    });
    const v = evalRes && evalRes.result ? evalRes.result.value : null;
    if (!v || typeof v.html !== 'string' || !v.html) {
      throw new Error('无法读取页面 HTML（页面可能为空或被拦截）');
    }
    return { html: v.html, finalUrl: v.url, title: v.title };
  } finally {
    try {
      cdp.close();
    } catch {
      /* ignore */
    }
    try {
      if (target.id) await devtoolsRequest(port, `/json/close/${target.id}`, 'PUT');
    } catch {
      /* ignore */
    }
  }
}

module.exports = { fetchPageViaCdp, browserLaunchHint, DEFAULT_PORT };
