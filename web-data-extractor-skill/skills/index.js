#!/usr/bin/env node
'use strict';

/**
 * ============================================================
 *  WebDataExtractor Skill
 * ============================================================
 *  触发条件：用户说类似“抓取这个网页上的表格/数据”“帮我提取这个
 *            页面的数据并做成可编辑表格”，且提供了网页 URL；
 *            或 Agent 已用自己的方式取得数据，想把它送入 SpreadJS 在线编辑。
 *
 *  执行流程：
 *    1. 获取数据（三选一）：
 *       a) 直接抓 URL 的 HTML，用内置解析器提取（table/list/dl/blocks，
 *          可 --type / --selector 指定，默认 auto）；
 *       b) --cdp：连接用户本机已登录的浏览器读取**渲染后**的页面——
 *          登录/JS 渲染/SPA 也能拿到（需用户先用调试端口启动 Chrome，见 lib/cdp.js）；
 *       c) --data <json文件>：直接读取 Agent 自取的二维数组（首行为表头），
 *          跳过抓取与提取。
 *    2. 在当前目录生成 ./temp_skill_web/index.html（内嵌 SpreadJS 设计器）。
 *    3. 启动本地 HTTP 服务（随机端口），打印访问链接。
 *    4. 用户在设计器里编辑后点击「下载表格 (xlsx)」，浏览器直接下载 xlsx 并 POST /save 回传。
 *    5. 服务收到数据后落盘（data.json + edited.xlsx），主流程输出结果退出。
 *
 *  用法：
 *    node index.js <网页URL> [--type table|list|dl|blocks|auto]
 *                     [--selector <CSS选择器>] [--no-open] [--keep-server]
 *                     [--no-style] [--no-chart] [--chart-config <文件.json>]
 *    node index.js <网页URL> --cdp [--cdp-port <端口>]   # 用用户浏览器读取（登录/JS渲染页）
 *    node index.js --data ./网页数据.json [--no-open]
 *    （--data：Agent 自由发挥入口——页面结构特殊/JS 渲染时，先用 Agent 自己的
 *     能力取数，把二维数组写入 JSON 文件交给本技能，进入 SpreadJS 在线编辑。）
 *    编辑页默认自动套用样式（表头/边框/行高列宽自适应/冻结表头）并根据数据自动
 *    添加图表（独立「图表」工作表）；--no-style / --no-chart 可分别关闭。
 *    --chart-config <文件.json>：AI 自行选择图表列与图型（category/series/type），
 *    列可用表头名或列号；适用所有数据入口，详见下方说明。
 *
 *  依赖：零第三方依赖，仅用 Node ≥ 18 内置模块（无需 npm install）；
 *        --cdp 模式额外需要 Node ≥ 22（内置全局 WebSocket）。
 * ============================================================
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const { startEditorServer } = require('./lib/server');
const { extractFromHtml } = require('./lib/extract');
const { buildPageHtml } = require('./lib/html-template');
const { fetchPageViaCdp } = require('./lib/cdp');

const TEMP_DIR_NAME = 'temp_skill_web';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/** 解析命令行参数。 */
function parseArgs(argv) {
  const args = argv.slice(2);
  const url = args.find((a) => !a.startsWith('-'));
  const getOpt = (name) => {
    const i = args.indexOf('--' + name);
    return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
  };
  const cdpPortRaw = getOpt('cdp-port');
  return {
    url,
    data: getOpt('data'),
    type: getOpt('type'),
    selector: getOpt('selector'),
    cdp: args.includes('--cdp'),
    cdpPort: cdpPortRaw ? parseInt(cdpPortRaw, 10) : 9222,
    noOpen: args.includes('--no-open'),
    keepServer: args.includes('--keep-server'),
    // 自动美化：默认开启，可用 --no-style / --no-chart 关闭
    style: !args.includes('--no-style'),
    chart: !args.includes('--no-chart'),
    chartConfig: getOpt('chart-config'), // AI 指定图表列/图型的配置文件路径
  };
}

/** 校验并读取 --chart-config 文件（AI 指定的图表配置）。 */
function loadChartConfig(file) {
  if (!file) return undefined;
  const p = path.resolve(file);
  if (!fs.existsSync(p)) {
    throw new Error(`--chart-config 文件不存在: ${p}`);
  }
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    throw new Error(`--chart-config 无法解析为 JSON（${e.message}）: ${p}`);
  }
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
    throw new Error('--chart-config 内容必须是 JSON 对象，如 {"type":"line","category":"产品","series":["销量","利润"]}');
  }
  const VALID_TYPES = ['column', 'bar', 'line', 'pie'];
  if (cfg.type !== undefined && !VALID_TYPES.includes(cfg.type)) {
    throw new Error(`--chart-config 的 type 未知: "${cfg.type}"，可选: ${VALID_TYPES.join(' / ')}`);
  }
  if (!Array.isArray(cfg.series) || cfg.series.length === 0 ||
      !cfg.series.every((s) => typeof s === 'string' || typeof s === 'number')) {
    throw new Error('--chart-config 必须包含非空 series 数组（表头名或列号），如 series: ["销量", "利润"]');
  }
  if (cfg.category !== undefined &&
      typeof cfg.category !== 'string' && typeof cfg.category !== 'number') {
    throw new Error('--chart-config 的 category 必须是表头名（字符串）或列号（数字）');
  }
  if (cfg.title !== undefined && typeof cfg.title !== 'string') {
    throw new Error('--chart-config 的 title 必须是字符串');
  }
  return cfg;
}

/** 尽力打开默认浏览器（失败静默，不影响主流程）。 */
function openBrowser(url) {
  const cmd =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
      ? `open "${url}"`
      : `xdg-open "${url}"`;
  try {
    exec(cmd, () => {});
  } catch {
    /* ignore */
  }
}

/** 抓取网页 HTML（Node >= 18 内置 fetch）。 */
async function fetchHtml(url) {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  });
  if (!resp.ok) {
    throw new Error(`请求失败 HTTP ${resp.status} ${resp.statusText}`);
  }
  return resp.text();
}

/** 主流程。 */
async function main() {
  const opts = parseArgs(process.argv);

  if (!opts.url && !opts.data) {
    console.error('用法: node index.js <网页URL> [--type table|list|dl|blocks|auto] [--selector <CSS选择器>] [--no-open] [--keep-server] [--no-style] [--no-chart] [--chart-config <文件.json>]');
    console.error('       node index.js <网页URL> --cdp [--cdp-port <端口>]   # 用用户浏览器读取（登录/JS渲染页）');
    console.error('       node index.js --data ./网页数据.json [--no-open]');
    console.error('示例: node index.js https://example.com/scores.html');
    console.error('示例: node index.js https://example.com/products.html --type blocks');
    console.error('示例: node index.js https://example.com/login-page.html --cdp');
    console.error('示例: node index.js --data ./网页数据.json');
    console.error('示例: node index.js --data ./网页数据.json --chart-config ./chart.json');
    console.error('说明: 编辑页默认自动套用样式 + 自动图表；--no-style / --no-chart 可分别关闭；');
    console.error('      --chart-config 让 AI 指定图表列与图型（先看 stdout 打印的列名再选列）');
    process.exit(1);
  }
  let chartConfig;
  try {
    chartConfig = loadChartConfig(opts.chartConfig);
  } catch (e) {
    console.error(`错误: ${e.message}`);
    process.exit(1);
  }
  if (opts.cdp && !opts.url) {
    console.error('错误: --cdp 模式需要 <URL>（要读取的目标网页地址）');
    process.exit(1);
  }
  if (opts.cdp && opts.data) {
    console.error('错误: --cdp 与 --data 不能同时使用（CDP 读网页，--data 读 Agent 自取数据，二选一）');
    process.exit(1);
  }
  const VALID_TYPES = ['table', 'list', 'dl', 'blocks', 'auto'];
  if (opts.type && !VALID_TYPES.includes(opts.type)) {
    console.error(`错误: 未知 --type "${opts.type}"，可选: ${VALID_TYPES.join(' / ')}`);
    process.exit(1);
  }

  // ---------- 1. 获取数据（URL 抓取 / --cdp 浏览器读取 / --data Agent 自取） ----------
  let extraction;
  if (opts.data) {
    const dataFile = path.resolve(opts.data);
    if (!fs.existsSync(dataFile)) {
      console.error(`错误: --data 文件不存在: ${dataFile}`);
      process.exit(1);
    }
    let rows;
    try {
      rows = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    } catch (e) {
      console.error(`错误: 无法解析 --data 文件（需为 JSON 二维数组）: ${e.message}`);
      process.exit(1);
    }
    if (!Array.isArray(rows) || !rows.every((r) => Array.isArray(r))) {
      console.error('错误: --data 文件内容必须是 JSON 二维数组（首行为表头），如 [["列1","列2"],["a","1"]]');
      process.exit(1);
    }
    const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);
    extraction = {
      rows: rows.map((r) => {
        const out = r.slice(0);
        while (out.length < maxCols) out.push('');
        return out;
      }),
      title: '网页数据',
      hint: `从 ${path.basename(dataFile)} 加载了 ${rows.length} 行 × ${maxCols} 列`,
      kind: 'data',
    };
    console.log(`[1/5] 读取 Agent 提供的数据: ${dataFile}`);
    console.log('[2/5] 数据就绪，进入在线编辑');
  } else if (opts.cdp) {
    if (!/^https?:\/\//i.test(opts.url)) {
      console.error(`错误: URL 必须以 http:// 或 https:// 开头，收到: ${opts.url}`);
      process.exit(1);
    }
    console.log(`[1/5] 通过浏览器（CDP 127.0.0.1:${opts.cdpPort}）打开: ${opts.url}`);
    let html;
    try {
      html = (await fetchPageViaCdp(opts.url, { port: opts.cdpPort })).html;
    } catch (e) {
      console.error(`\n❌ ${e.message}`);
      process.exit(1);
    }

    // ---------- 2. 解析网页数据（多类型） ----------
    console.log('[2/5] 已读取渲染后的页面，解析结构化数据…');
    extraction = extractFromHtml(html, {
      type: opts.type || 'auto',
      selector: opts.selector,
    });
  } else {
    if (!/^https?:\/\//i.test(opts.url)) {
      console.error(`错误: URL 必须以 http:// 或 https:// 开头，收到: ${opts.url}`);
      process.exit(1);
    }
    console.log(`[1/5] 抓取网页: ${opts.url}`);
    const html = await fetchHtml(opts.url);

    // ---------- 2. 解析网页数据（多类型） ----------
    console.log('[2/5] 解析页面中的结构化数据…');
    extraction = extractFromHtml(html, {
      type: opts.type || 'auto',
      selector: opts.selector,
    });
  }
  if (!extraction.rows.length) {
    console.error(`\n未提取到数据（${extraction.hint}）。`);
    console.error('可能原因：该页面由 JavaScript 动态渲染，或没有符合该类型/选择器的结构化数据。');
    console.error('可尝试 --type 指定类型（table/list/dl/blocks）、--selector 精确指向，');
    console.error('或（若页面需登录/JS 渲染）用 `--cdp` 连接用户已登录的浏览器读取渲染后的页面，');
    console.error('或先用 Agent 自己的能力从页面取数，再 `--data ./data.json` 交给本技能进入 SpreadJS 在线编辑。');
    process.exit(1);
  }
  console.log(`      ${extraction.hint}`);
  // 打印列名，供 Agent 判断哪几列适合做图表（配 --chart-config 时按表头名选列）
  if (extraction.rows[0] && extraction.rows[0].length) {
    console.log('      列名: ' + extraction.rows[0].join(', '));
  }
  if (chartConfig) {
    console.log(`      图表配置: type=${chartConfig.type || 'column'} category=${chartConfig.category === undefined ? '(自动)' : chartConfig.category} series=[${chartConfig.series.join(', ')}]`);
  }

  // ---------- 3. 生成临时目录与 index.html ----------
  console.log('[3/5] 生成在线编辑页…');
  const tempDir = path.join(process.cwd(), TEMP_DIR_NAME);
  fs.mkdirSync(tempDir, { recursive: true });

  const pageHtml = buildPageHtml({
    type: extraction.kind || 'table',
    kind: extraction.kind || 'table',
    title: extraction.title || '网页数据',
    sourceUrl: opts.url,
    hint: extraction.hint,
    rows: extraction.rows,
    style: opts.style,
    chart: opts.chart,
    chartConfig: opts.chart ? chartConfig : undefined, // --no-chart 优先，图表整体关闭
  });
  fs.writeFileSync(path.join(tempDir, 'index.html'), pageHtml, 'utf8');

  // ---------- 4. 启动本地 HTTP 服务 ----------
  const server = await startEditorServer({
    rootDir: tempDir,
    onSave: (payload) => {
      // 收到浏览器确认后的编辑结果
      const kind = extraction.kind || 'table';
      const result = {
        type: kind,
        kind,
        table: payload.table || [],
        summary: payload.summary,
        extractionHint: extraction.hint,
      };
      // 存为 JSON，方便 Agent 主流程直接使用二维数组
      result.jsonPath = path.join(tempDir, 'data.json');
      fs.writeFileSync(result.jsonPath, JSON.stringify(result.table, null, 2), 'utf8');
      // 若前端同时导出了 xlsx base64，一并落盘
      if (payload.base64) {
        result.xlsxPath = path.join(tempDir, 'edited.xlsx');
        fs.writeFileSync(result.xlsxPath, Buffer.from(payload.base64, 'base64'));
      }
      result.savedDir = tempDir;
      return result;
    },
  });

  console.log('[4/5] 本地编辑服务已启动');
  console.log('');
  console.log('┌──────────────────────────────────────────────────────────────┐');
  console.log(`│  请在浏览器打开: ${server.url}`);
  console.log('│  在 SpreadJS 设计器中编辑表格，完成后点击右上角');
  console.log('│  「下载表格 (xlsx)」——浏览器直接下载，同时回传 Agent。');
  console.log('└──────────────────────────────────────────────────────────────┘');
  if (!opts.noOpen) openBrowser(server.url);

  // ---------- 5. 等待用户编辑并点击「下载表格」 ----------
  console.log('[5/5] 正在等待用户点击「下载表格」…');
  const result = await server.waitForSave();

  if (!opts.keepServer) {
    server.server.close(() => {});
  } else {
    console.log('(服务保持运行，可按 Ctrl+C 退出)');
  }

  // 输出结构化结果，供 WorkBuddy/TRAE Work 主流程继续执行后续任务
  console.log('\n✅ 已收到编辑后的数据。');
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error('\n❌ Skill 执行失败:', e && e.message ? e.message : e);
  process.exit(1);
});
