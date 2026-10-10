#!/usr/bin/env node
'use strict';

/**
 * ============================================================
 *  OnlineXlsxEditor Skill
 * ============================================================
 *  触发条件：用户说类似“帮我处理这个 Excel 文件”“打开并编辑我的
 *            附件表格”“我想预览并修改这个 xlsx 文件”，并提供本地
 *            文件路径或上传附件。
 *
 *  执行流程：
 *    1. 接收文件路径（或在未指定时扫描最近下载的表格文件并询问）。
 *    2. 读取文件 → base64 → 注入生成 ./temp_skill_xlsx/index.html
 *       （内嵌 SpreadJS 设计器，前端用 import 保留原始格式）。
 *    3. 启动本地 HTTP 服务（随机端口），打印访问链接。
 *    4. 用户编辑后点击「下载表格 (xlsx)」，浏览器直接下载 xlsx 并 POST /save 回传。
 *    5. 服务落盘 edited.xlsx，同时返回修改摘要（增删行/列/单元格数）。
 *
 *  用法：
 *    node index.js <文件路径> [--no-open] [--keep-server]
 *    node index.js --form <表单定义.json> [--no-open] [--keep-server]
 *
 *  --form 模式（表单采集）：Agent 提供表单定义 JSON（fields: name/label/type/
 *    required/width/options，type ∈ text|number|dropdown|checkbox|date），
 *    skill 渲染成可填写网格，用户填好后点「下载表格 (xlsx)」：浏览器下载
 *    填好的 xlsx，同时回传结构化 records 数组并落盘 form_records.json /
 *    form_records.xlsx，供主流程继续处理。
 *
 *  依赖：无第三方包（文件解析/导出全部在浏览器端由 SpreadJS 完成，
 *        比后端 xlsx 库解析更完整地保留格式与样式）。
 * ============================================================
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { exec } = require('child_process');

const { startEditorServer } = require('./lib/server');
const { buildPageHtml } = require('./lib/html-template');

const TEMP_DIR_NAME = 'temp_skill_xlsx';
const SUPPORTED = ['.xlsx', '.xlsm', '.xltx', '.xltm', '.csv', '.sjs', '.ssjson'];
const LOOKBACK_DAYS = 7; // 扫描最近 7 天
const MAX_CANDIDATES = 5;
const MAX_BYTES = 60 * 1024 * 1024; // 60MB，避免生成超大 HTML
const FORM_TYPES = ['text', 'number', 'dropdown', 'checkbox', 'date']; // 表单采集支持的字段类型

/** 解析命令行参数。 */
function parseArgs(argv) {
  const args = argv.slice(2);
  const formIdx = args.indexOf('--form');
  let formPath = null;
  if (formIdx >= 0 && args[formIdx + 1]) formPath = path.resolve(args[formIdx + 1]);
  const skipIdx = formIdx >= 0 ? formIdx + 1 : -1;
  const fileArg = args.find((a, i) => i !== skipIdx && !a.startsWith('-'));
  return {
    filePath: fileArg ? path.resolve(fileArg) : null,
    formPath,
    noOpen: args.includes('--no-open'),
    keepServer: args.includes('--keep-server'),
  };
}

/** 尽力打开默认浏览器（失败静默）。 */
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

/** 扫描“下载目录 + 项目临时目录”里最近修改的表格文件作为候选。 */
function findRecentSpreadsheetCandidates() {
  const dirs = [path.join(os.homedir(), 'Downloads'), path.join(process.cwd(), TEMP_DIR_NAME)];
  const now = Date.now();
  const found = [];
  const seen = new Set();

  for (const dir of dirs) {
    let entries;
    try {
      entries = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      const full = path.join(dir, name);
      let st;
      try {
        st = fs.statSync(full);
      } catch {
        continue;
      }
      if (!st.isFile()) continue;
      if (!SUPPORTED.includes(path.extname(name).toLowerCase())) continue;
      if ((now - st.mtimeMs) / 86400000 > LOOKBACK_DAYS) continue;
      if (seen.has(full)) continue;
      seen.add(full);
      found.push({
        name,
        path: full,
        mtime: st.mtime.toISOString().replace('T', ' ').slice(0, 16),
      });
    }
  }

  found.sort((a, b) => (a.mtime < b.mtime ? 1 : -1));
  return found.slice(0, MAX_CANDIDATES);
}

/** 通过 stdin 询问用户选择哪个文件（非交互时读到 EOF 返回 null）。 */
function askChooseFile(candidates) {
  console.log('未指定文件，以下是在下载目录中找到的最近表格文件：');
  candidates.forEach((c, i) => console.log(`  [${i + 1}] ${c.name}  (${c.mtime})`));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.setPrompt('请选择要处理的文件编号: ');
    rl.prompt();
    rl.on('line', (line) => {
      const n = parseInt(line.trim(), 10);
      if (!isNaN(n) && n >= 1 && n <= candidates.length) {
        resolve(candidates[n - 1].path);
        rl.close();
      } else {
        console.log(`请输入 1~${candidates.length} 之间的数字：`);
        rl.prompt();
      }
    });
    rl.on('close', () => resolve(null)); // EOF/中断
  });
}

/** 校验并规范化 Agent 提供的表单定义 JSON。 */
function validateFormDef(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('表单定义必须是 JSON 对象');
  }
  if (!Array.isArray(raw.fields) || !raw.fields.length) {
    throw new Error('表单定义缺少 fields（字段列表不能为空）');
  }
  const fields = raw.fields.map((f, i) => {
    if (!f || typeof f !== 'object' || !f.name) {
      throw new Error(`第 ${i + 1} 个字段缺少 name`);
    }
    const type = String(f.type || 'text').toLowerCase();
    if (!FORM_TYPES.includes(type)) {
      throw new Error(`字段「${f.name}」type 不支持: ${f.type}（支持: ${FORM_TYPES.join('/')}）`);
    }
    if (type === 'dropdown' && (!Array.isArray(f.options) || !f.options.length)) {
      throw new Error(`下拉字段「${f.name}」缺少 options`);
    }
    return {
      name: String(f.name),
      label: f.label !== undefined ? String(f.label) : String(f.name),
      type,
      required: f.required === true,
      width: Number.isFinite(Number(f.width)) ? Number(f.width) : undefined,
      options: Array.isArray(f.options) ? f.options.map((o) => String(o)) : undefined,
    };
  });

  return {
    type: 'form',
    title: String(raw.title || '数据登记表'),
    subtitle: String(raw.subtitle || '请填写，完成后点击右上角「下载表格 (xlsx)」'),
    fields,
    rowCount: Math.max(1, Math.floor(Number(raw.rowCount) || 5)),
  };
}

/** 表单采集模式：Agent 提供表单定义 JSON → 渲染可填写网格 → 回传结构化记录。 */
async function runFormMode(opts) {
  if (!fs.existsSync(opts.formPath)) {
    console.error(`表单定义文件不存在: ${opts.formPath}`);
    process.exit(1);
  }

  // ---------- 1. 读取并校验表单定义 ----------
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(opts.formPath, 'utf8'));
  } catch (e) {
    console.error(`表单定义 JSON 解析失败: ${e.message}`);
    process.exit(1);
  }
  let form;
  try {
    form = validateFormDef(raw);
  } catch (e) {
    console.error(`表单定义校验失败: ${e.message}`);
    process.exit(1);
  }

  console.log(`[1/3] 读取表单定义: ${opts.formPath}`);
  console.log(`  ✓ 表单「${form.title}」, ${form.fields.length} 个字段, 预置 ${form.rowCount} 行空数据`);

  // ---------- 2. 生成临时目录与 index.html ----------
  console.log('[2/3] 生成表单页…');
  const tempDir = path.join(process.cwd(), TEMP_DIR_NAME);
  fs.mkdirSync(tempDir, { recursive: true });

  const pageHtml = buildPageHtml({ mode: 'form', form });
  fs.writeFileSync(path.join(tempDir, 'index.html'), pageHtml, 'utf8');

  // ---------- 3. 启动本地 HTTP 服务 ----------
  const server = await startEditorServer({
    rootDir: tempDir,
    onSave: (payload) => {
      // 收到浏览器提交的结构化记录：落盘 form_records.json 并回传 Agent
      const out = {
        type: 'form',
        title: form.title,
        records: Array.isArray(payload.records) ? payload.records : [],
        rowCount: Array.isArray(payload.records) ? payload.records.length : 0,
        jsonPath: path.join(tempDir, 'form_records.json'),
        savedDir: tempDir,
      };
      if (out.records.length) {
        fs.writeFileSync(out.jsonPath, JSON.stringify(out.records, null, 2), 'utf8');
      }
      // 浏览器同时回传了填好的 xlsx（用户下载的就是这份）：一并落盘，Agent 可拿到文件
      if (payload.base64) {
        out.xlsxPath = path.join(tempDir, 'form_records.xlsx');
        fs.writeFileSync(out.xlsxPath, Buffer.from(payload.base64, 'base64'));
      }
      return out;
    },
  });

  console.log('[3/3] 本地表单服务已启动');
  console.log('');
  console.log('┌──────────────────────────────────────────────────────────────┐');
  console.log(`│  请在浏览器打开: ${server.url}`);
  console.log('│  在 SpreadJS 设计器中填写表格，完成后点击右上角');
  console.log('│  「下载表格 (xlsx)」——下载填好的表格，结构化记录回传给 Agent。');
  console.log('└──────────────────────────────────────────────────────────────┘');
  if (!opts.noOpen) openBrowser(server.url);

  // ---------- 4. 等待用户填写并点击「下载表格 (xlsx)」 ----------
  console.log('[4/4] 正在等待用户提交…');
  const result = await server.waitForSave();

  if (!opts.keepServer) {
    server.server.close(() => {});
  } else {
    console.log('(服务保持运行，可按 Ctrl+C 退出)');
  }

  // 输出结构化结果，供主流程继续执行后续任务（如“汇总收集到的记录”）
  console.log('\n✅ 已收到用户提交的记录。');
  console.log(JSON.stringify(result, null, 2));
}

/** 主流程。 */
async function main() {
  const opts = parseArgs(process.argv);

  // ---------- 0. 表单采集模式（--form） ----------
  if (opts.formPath) {
    return runFormMode(opts);
  }

  // ---------- 1. 确定要处理的文件 ----------
  let filePath = opts.filePath;
  if (!filePath) {
    const candidates = findRecentSpreadsheetCandidates();
    if (!candidates.length) {
      console.error('未指定文件，且最近下载目录中没有找到 xlsx/csv 等表格文件。');
      console.error('用法: node index.js <文件路径> [--no-open] [--keep-server]');
      process.exit(1);
    }
    filePath = await askChooseFile(candidates);
    if (!filePath) {
      console.error('未选择文件，Skill 退出。');
      process.exit(1);
    }
  }

  if (!fs.existsSync(filePath)) {
    console.error(`文件不存在: ${filePath}`);
    process.exit(1);
  }

  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED.includes(ext)) {
    console.error(`暂不支持 ${ext} 格式。支持的格式: ${SUPPORTED.join(', ')}`);
    console.error('提示：SpreadJS 不支持旧的 .xls 格式，请先另存为 .xlsx 或 .csv。');
    process.exit(1);
  }

  const stats = fs.statSync(filePath);
  if (stats.size > MAX_BYTES) {
    console.error(
      `文件过大（${(stats.size / 1024 / 1024).toFixed(1)}MB），超过 ${MAX_BYTES / 1024 / 1024}MB 限制。`
    );
    process.exit(1);
  }

  console.log(`[1/4] 读取文件: ${filePath} (${(stats.size / 1024).toFixed(1)} KB)`);
  const base64 = fs.readFileSync(filePath).toString('base64');

  // ---------- 2. 生成临时目录与 index.html ----------
  console.log('[2/4] 生成在线编辑页…');
  const tempDir = path.join(process.cwd(), TEMP_DIR_NAME);
  fs.mkdirSync(tempDir, { recursive: true });

  const pageHtml = buildPageHtml({
    type: 'file',
    fileName: path.basename(filePath),
    ext: ext === '.csv' ? 'csv' : ext === '.ssjson' ? 'ssjson' : ext === '.sjs' ? 'sjs' : 'excel',
    base64,
  });
  fs.writeFileSync(path.join(tempDir, 'index.html'), pageHtml, 'utf8');

  // ---------- 3. 启动本地 HTTP 服务 ----------
  const server = await startEditorServer({
    rootDir: tempDir,
    onSave: (payload) => {
      // 收到浏览器确认后的编辑结果：导出 xlsx(base64) + 修改摘要
      const out = { type: 'file', summary: payload.summary };
      if (payload.base64) {
        out.xlsxPath = path.join(tempDir, 'edited.xlsx');
        fs.writeFileSync(out.xlsxPath, Buffer.from(payload.base64, 'base64'));
      }
      out.savedDir = tempDir;
      return out;
    },
  });

  console.log('[3/4] 本地编辑服务已启动');
  console.log('');
  console.log('┌──────────────────────────────────────────────────────────────┐');
  console.log(`│  请在浏览器打开: ${server.url}`);
  console.log('│  在 SpreadJS 设计器中编辑表格，完成后点击右上角');
  console.log('│  「下载表格 (xlsx)」——浏览器直接下载，同时回传 Agent。');
  console.log('└──────────────────────────────────────────────────────────────┘');
  if (!opts.noOpen) openBrowser(server.url);

  // ---------- 4. 等待用户编辑并点击「下载表格」 ----------
  console.log('[4/4] 正在等待用户点击「下载表格」…');
  const result = await server.waitForSave();

  if (!opts.keepServer) {
    server.server.close(() => {});
  } else {
    console.log('(服务保持运行，可按 Ctrl+C 退出)');
  }

  // 输出结构化结果，供主流程继续执行后续任务（如“汇总该文件”）
  console.log('\n✅ 已收到编辑后的文件。');
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error('\n❌ Skill 执行失败:', e && e.message ? e.message : e);
  process.exit(1);
});
