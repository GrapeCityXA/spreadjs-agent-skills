'use strict';

/**
 * 零依赖的多类型网页数据提取模块（不依赖 cheerio / 任何第三方包）。
 *
 * 支持的类型（`extractFromHtml(html, { type })` 的 type 取值）：
 *   - table  提取 <table> 表格（智能选最大表 / 自定义选择器）
 *   - list   提取 <ul>/<ol> 列表（每个 <li> 一行；若 li 内部结构稳定则按字段拆多列）
 *   - dl     提取 <dl> 定义列表（<dt>/<dd> 键值对 → 两列）
 *   - blocks 提取重复的兄弟 DOM 结构（卡片/新闻项/产品项，每块一行、按字段签名拆列）
 *   - auto   自动检测：按 table → dl → list → blocks 顺序挑选第一个成功的
 *
 * 统一约定：
 *   - 所有类型产出「首行为表头」的二维数组 rows，直接喂给 SpreadJS 编辑管线；
 *   - 结果对象统一 { rows, title, hint, kind }；
 *   - 全部使用 Node ≥ 18 内置能力，无第三方依赖。
 *
 * 已知局限：
 *   - 只能处理服务端渲染的静态 HTML；JS 动态渲染的内容无法抓取。
 *   - 选择器是简化实现：支持 tag / #id / .class 组合与空格后代选择器；
 *     不支持属性选择器、伪类、子选择器(>) 等复杂写法。
 */

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
  'meta', 'param', 'source', 'track', 'wbr',
]);
// 内容按纯文本处理的标签：其中的 <> 不再当作 HTML 解析
const RAWTEXT_TAGS = new Set(['script', 'style', 'textarea', 'title']);
// 不把 script/style 本身当作 blocks 候选容器
const SKIP_BLOCK_TAGS = new Set(['script', 'style', 'textarea', 'title', 'select', 'option', 'svg', 'table', 'ul', 'ol', 'dl', 'nav', 'head', 'html', 'body']);

// ---------------------------------------------------------------------------
// 1) HTML tokenizer：把 HTML 拆成 text / tag / close 三种 token
// ---------------------------------------------------------------------------

/** 解析一个开始标签，返回 { tag, attrs, end }（end 指向标签结束后的下标）。 */
function parseOpenTag(html, start) {
  let i = start + 1;
  const m = html.slice(i).match(/^[a-zA-Z][a-zA-Z0-9:_-]*/);
  if (!m) return null;
  const tag = m[0].toLowerCase();
  i += m[0].length;
  const attrs = {};
  while (i < html.length) {
    while (i < html.length && /\s/.test(html[i])) i++;
    if (i >= html.length) return null;
    if (html[i] === '>') { i++; break; }
    if (html[i] === '/' && html[i + 1] === '>') { i += 2; break; }
    const nameM = html.slice(i).match(/^[^\s=/>]+/);
    if (!nameM) { i++; continue; }
    const name = nameM[0].toLowerCase();
    i += nameM[0].length;
    while (i < html.length && /\s/.test(html[i])) i++;
    let value = '';
    if (html[i] === '=') {
      i++;
      while (i < html.length && /\s/.test(html[i])) i++;
      if (i < html.length && (html[i] === '"' || html[i] === "'")) {
        const q = html[i++];
        const vs = i;
        while (i < html.length && html[i] !== q) i++;
        value = html.slice(vs, i);
        if (i < html.length) i++; // 跳过闭合引号
      } else {
        const vs = i;
        while (i < html.length && !/\s/.test(html[i]) && html[i] !== '>') i++;
        value = html.slice(vs, i);
      }
    }
    if (!(name in attrs)) attrs[name] = value;
  }
  return { tag, attrs, end: i };
}

function tokenizeHtml(html) {
  const tokens = [];
  let i = 0;
  const n = html.length;
  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      const text = html.slice(i);
      if (text) tokens.push({ type: 'text', text });
      break;
    }
    if (lt > i) tokens.push({ type: 'text', text: html.slice(i, lt) });

    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      i = end === -1 ? n : end + 3;
      continue;
    }
    if (html[lt + 1] === '!') {
      // <!DOCTYPE ...> 等声明，整段跳过
      const end = html.indexOf('>', lt);
      i = end === -1 ? n : end + 1;
      continue;
    }
    if (html[lt + 1] === '/') {
      const m = html.slice(lt).match(/^<\/([a-zA-Z][a-zA-Z0-9]*)\s*>/);
      if (m) tokens.push({ type: 'close', tag: m[1].toLowerCase() });
      i = lt + (m ? m[0].length : 2);
      continue;
    }
    const open = parseOpenTag(html, lt);
    if (!open) {
      // 不是合法标签，把 '<' 当作文本字面量继续
      tokens.push({ type: 'text', text: '<' });
      i = lt + 1;
      continue;
    }
    tokens.push({ type: 'tag', tag: open.tag, attrs: open.attrs });
    i = open.end;
    if (RAWTEXT_TAGS.has(open.tag)) {
      // 纯文本内容区：直接找对应闭合标签，中间内容不再解析
      const close = html.indexOf('</' + open.tag, i);
      const text = html.slice(i, close === -1 ? n : close);
      if (text) tokens.push({ type: 'text', text });
      if (close !== -1) {
        const cm = html.slice(close).match(/^<\/[a-zA-Z][a-zA-Z0-9]*\s*>/);
        tokens.push({ type: 'close', tag: open.tag });
        i = close + (cm ? cm[0].length : open.tag.length + 3);
      } else i = n;
    }
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// 2) 轻量 DOM 树：节点 { tag, attrs, children }，文本节点 { tag:'#text', text }
// ---------------------------------------------------------------------------

function buildTree(tokens) {
  const root = { tag: '#root', attrs: {}, children: [] };
  const stack = [root];
  for (const tok of tokens) {
    if (tok.type === 'text') {
      stack[stack.length - 1].children.push({ tag: '#text', text: tok.text });
    } else if (tok.type === 'tag') {
      const el = { tag: tok.tag, attrs: tok.attrs, children: [] };
      stack[stack.length - 1].children.push(el);
      if (!VOID_TAGS.has(tok.tag)) stack.push(el);
    } else {
      // 闭合标签：弹出到匹配的开始标签为止（不匹配则忽略，容忍残缺 HTML）
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k].tag === tok.tag) { stack.length = k; break; }
      }
    }
  }
  return root;
}

/** 深度优先遍历所有元素节点（不含根、不含文本节点）。 */
function forEachEl(el, fn) {
  for (const c of el.children) {
    if (c.tag === '#text') continue;
    fn(c);
    forEachEl(c, fn);
  }
}

/** 找出 el 内所有指定标签的后代元素。 */
function findAll(el, tag) {
  const out = [];
  forEachEl(el, (c) => {
    if (c.tag === tag) out.push(c);
  });
  return out;
}

/** 元素的直接元素子节点（过滤文本）。 */
function elementChildren(el) {
  return el.children.filter((c) => c.tag !== '#text');
}

/** 排序后的 class 列表。 */
function elClasses(el) {
  return (el.attrs.class || '').split(/\s+/).filter(Boolean).sort();
}

// ---------------------------------------------------------------------------
// 3) 文本提取：实体解码 + 空白规整
// ---------------------------------------------------------------------------

const ENTITY_MAP = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  nbsp: ' ', copy: '©', reg: '®', trade: '™',
  ndash: '–', mdash: '—', hellip: '…', middot: '·',
  deg: '°', plusmn: '±', times: '×', divide: '÷',
};

/** 解码常见 HTML 实体（&amp;/&lt;/&#xNN;/&#NN; 等），保持与浏览器一致。 */
function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
      try { return String.fromCodePoint(parseInt(h, 16)); } catch { return '�'; }
    })
    .replace(/&#([0-9]+);/g, (_, d) => {
      try { return String.fromCodePoint(parseInt(d, 10)); } catch { return '�'; }
    })
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, name) => ENTITY_MAP[name] ?? m);
}

/** 取元素（含后代）的文本，解码实体后把连续空白压缩为单个空格并 trim。 */
function getText(el) {
  let s = '';
  const walk = (e) => {
    if (e.tag === '#text') { s += e.text; return; }
    for (const c of e.children) walk(c);
  };
  walk(el);
  return decodeEntities(s).replace(/\s+/g, ' ').trim();
}

/** 读取页面 <title> 作为标题候选。 */
function titleOf(root) {
  const titles = findAll(root, 'title');
  return titles.length ? getText(titles[0]) : '';
}

// ---------------------------------------------------------------------------
// 4) 简化 CSS 选择器：支持 tag / #id / .class 组合与空格后代
// ---------------------------------------------------------------------------

/** 把选择器拆成「后代链」：每个环节 { tag, ids, classes }。解析失败返回 null。 */
function parseSelector(sel) {
  const raw = sel.trim();
  if (!raw) return null;
  const chain = [];
  for (const part of raw.split(/\s+/)) {
    if (!part) continue;
    const simple = { tag: null, ids: [], classes: [] };
    const tagM = part.match(/^[a-zA-Z][a-zA-Z0-9_-]*/);
    if (tagM) simple.tag = tagM[0].toLowerCase();
    for (const im of part.matchAll(/#([a-zA-Z0-9_-]+)/g)) simple.ids.push(im[1]);
    for (const cm of part.matchAll(/\.([a-zA-Z0-9_-]+)/g)) simple.classes.push(cm[1]);
    if (!simple.tag && !simple.ids.length && !simple.classes.length) return null;
    chain.push(simple);
  }
  return chain.length ? chain : null;
}

function matchSimple(el, s) {
  if (s.tag && el.tag !== s.tag) return false;
  if (s.ids.length && !s.ids.every((id) => el.attrs.id === id)) return false;
  if (s.classes.length) {
    const cls = (el.attrs.class || '').split(/\s+/).filter(Boolean);
    if (!s.classes.every((c) => cls.includes(c))) return false;
  }
  return true;
}

/** 后代选择器匹配：返回所有「满足整条链」的最末级元素。 */
function selectDesc(root, parts) {
  const last = parts.length - 1;
  const results = [];
  const walk = (el, pos) => {
    let matched = -1;
    if (pos < parts.length && matchSimple(el, parts[pos])) matched = pos;
    if (matched === last) { results.push(el); return; }
    const childPos = matched >= 0 ? matched + 1 : pos;
    for (const c of el.children) {
      if (c.tag === '#text') continue;
      walk(c, childPos);
    }
  };
  for (const c of root.children) {
    if (c.tag !== '#text') walk(c, 0);
  }
  return results;
}

// ---------------------------------------------------------------------------
// 5) 表格提取（table 类型）
// ---------------------------------------------------------------------------

/** 把单个 <table> 元素转换为二维数组，跳过全空行。 */
function tableTo2D(tableEl) {
  const rows = [];
  for (const tr of findAll(tableEl, 'tr')) {
    const row = [];
    for (const cell of tr.children) {
      if (cell.tag === '#text') continue;
      if (cell.tag === 'th' || cell.tag === 'td') row.push(getText(cell));
    }
    if (row.some((c) => c !== '')) rows.push(row);
  }
  return rows;
}

/** 把所有行规整成等宽二维数组（按最大列数补齐）。 */
function normalizeRows(rows) {
  let maxCols = 0;
  rows.forEach((r) => {
    if (r.length > maxCols) maxCols = r.length;
  });
  return {
    rows: rows.map((r) => {
      const out = r.slice(0);
      while (out.length < maxCols) out.push('');
      return out;
    }),
    maxCols,
  };
}

/** 基于已构建的 root 提取表格（智能选最大表 / 自定义选择器）。 */
function extractTableFromRoot(root, selector) {
  const title = titleOf(root);
  let tables = [];
  if (selector) {
    const parts = parseSelector(selector);
    if (!parts) {
      return { rows: [], title, hint: `无法解析选择器: ${selector}`, tableCount: 0, kind: 'table' };
    }
    const seen = new Set();
    for (const el of selectDesc(root, parts)) {
      // 命中元素本身是 table 就用它，否则取其内部的 table
      const candidates = el.tag === 'table' ? [el] : findAll(el, 'table');
      for (const t of candidates) {
        if (!seen.has(t)) { seen.add(t); tables.push(t); }
      }
    }
  } else {
    tables = findAll(root, 'table');
  }

  const tableCount = tables.length;
  if (!tableCount) {
    return { rows: [], title, hint: '页面中未找到任何 <table>', tableCount: 0, kind: 'table' };
  }

  // 智能选表：评分 = 行数 * 10000 + 单元格总数
  let best = [];
  let bestScore = -1;
  tables.forEach((t) => {
    const rows = tableTo2D(t);
    let cells = 0;
    rows.forEach((r) => (cells += r.length));
    const score = rows.length * 10000 + cells;
    if (score > bestScore) {
      bestScore = score;
      best = rows;
    }
  });

  const { rows, maxCols } = normalizeRows(best);
  return {
    rows,
    title,
    hint: `从页面 ${tableCount} 个表格中提取了 ${rows.length} 行 × ${maxCols} 列`,
    tableCount,
    kind: 'table',
  };
}

/** 兼容入口：从 HTML 字符串提取表格（与旧版行为一致）。 */
function extractTableFromHtml(html, selector) {
  return extractTableFromRoot(buildTree(tokenizeHtml(html)), selector);
}

// ---------------------------------------------------------------------------
// 6) list / blocks 共享：重复结构 → 二维数组
// ---------------------------------------------------------------------------

/**
 * 收集块内所有「原子文本叶子」，每个叶子带路径签名（用于跨块对齐）。
 * 签名形如 div.card>div.body>h3 或 span.price:2（:n 为同 tag 兄弟位置锚定）。
 */
function leaves(block) {
  const out = [];
  const walk = (e, path) => {
    // 直接文本（非空白）
    for (const c of e.children) {
      if (c.tag === '#text' && c.text.trim()) {
        out.push({ sig: [...path, '#text'].join('>'), text: c.text.trim() });
      }
    }
    const elems = elementChildren(e);
    // 同 tag 兄弟计数，作为位置锚定
    const byTag = new Map();
    for (const c of elems) byTag.set(c.tag, (byTag.get(c.tag) || 0) + 1);
    const seen = new Map();
    for (const c of elems) {
      const n = seen.get(c.tag) || 0;
      seen.set(c.tag, n + 1);
      const cls = elClasses(c);
      const seg = c.tag + (cls.length ? '.' + cls.join('.') : '') + (byTag.get(c.tag) > 1 ? ':' + n + 1 : '');
      const p = [...path, seg];
      const hasEl = c.children.some((x) => x.tag !== '#text');
      const txt = getText(c);
      if (hasEl) walk(c, p);
      else if (txt !== '') out.push({ sig: p.join('>'), text: txt });
    }
  };
  walk(block, []);
  return out;
}

/** 从叶子签名推导可读列名。 */
function fieldLabel(sig) {
  const seg = sig.split('>').pop();
  const noN = seg.replace(/:\d+$/, '');
  if (noN === '#text') return '值';
  const tagM = noN.match(/^[a-zA-Z][a-zA-Z0-9_-]*/);
  const rest = noN.slice(tagM ? tagM[0].length : 0);
  const classes = rest.split('.').filter(Boolean);
  return classes.length ? classes.join('.') : (tagM ? tagM[0] : noN);
}

/**
 * 按「叶子签名众数」对齐一组块 → 列定义。
 * 列 = 出现频次 ≥ threshold 的签名（排序后截断前 20 列）；个别块缺该签名则补 ''。
 */
function alignBySignature(blocks, minFreq) {
  const all = [];
  blocks.forEach((b) => all.push(...leaves(b)));
  if (!all.length) return null;
  const freq = new Map();
  const firstPos = new Map();
  all.forEach((l, i) => {
    freq.set(l.sig, (freq.get(l.sig) || 0) + 1);
    if (!firstPos.has(l.sig)) firstPos.set(l.sig, i);
  });
  const threshold = Math.max(2, Math.ceil(blocks.length * minFreq));
  const sigs = [...freq.keys()]
    .filter((s) => freq.get(s) >= threshold)
    .sort((a, b) => (freq.get(b) - freq.get(a)) || (firstPos.get(a) - firstPos.get(b)))
    .slice(0, 20);
  if (!sigs.length) return null;
  return {
    names: sigs.map(fieldLabel),
    extract: (block) => {
      const m = new Map(leaves(block).map((l) => [l.sig, l.text]));
      return sigs.map((s) => m.get(s) || '');
    },
  };
}

/** 块的形态签名（预序遍历 tag+class），用于廉价同构检查。 */
function shapeSignature(el) {
  const parts = [];
  const walk = (e) => {
    const cls = elClasses(e);
    parts.push(e.tag + (cls.length ? '.' + cls.join('.') : ''));
    for (const c of e.children) if (c.tag !== '#text') walk(c);
  };
  walk(el);
  return parts.join(',');
}

/** 找 blocks 候选容器：直接子节点数 ∈ [3,500]、排除 html/body 等太泛/无关容器，按廉价同构分取 top 8。 */
function findCandidateContainers(root) {
  const candidates = [];
  forEachEl(root, (el) => {
    if (SKIP_BLOCK_TAGS.has(el.tag)) return;
    const kids = elementChildren(el);
    if (kids.length < 3 || kids.length > 500) return;
    if (kids.every((k) => getText(k) === '')) return;
    // 廉价同构：直接子 tag+class 签名
    const sigs = kids.map((k) => k.tag + '.' + elClasses(k).join('.'));
    const freq = new Map();
    sigs.forEach((s) => freq.set(s, (freq.get(s) || 0) + 1));
    const hom = Math.max(...freq.values()) / kids.length;
    const score = kids.length * 100 + Math.round(hom * 500);
    candidates.push({ el, score });
  });
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, 8).map((c) => c.el);
}

/** 重复结构提取：对每个候选容器做完整字段签名对齐，取评分最优。 */
function extractBlocks(root, selector, title) {
  let containers = [];
  if (selector) {
    const parts = parseSelector(selector);
    if (!parts) return { rows: [], title, hint: `无法解析选择器: ${selector}`, kind: 'blocks' };
    containers = selectDesc(root, parts);
    if (!containers.length) return { rows: [], title, hint: `选择器 ${selector} 未命中任何元素`, kind: 'blocks' };
  } else {
    containers = findCandidateContainers(root);
  }

  let best = null;
  for (const P of containers) {
    const blocks = elementChildren(P);
    if (blocks.length < 3 || blocks.length > 500) continue;
    if (blocks.every((b) => getText(b) === '')) continue;
    // 深形态同构率
    const shapes = blocks.map((b) => shapeSignature(b));
    const freq = new Map();
    shapes.forEach((s) => freq.set(s, (freq.get(s) || 0) + 1));
    const homogeneity = Math.max(...freq.values()) / blocks.length;
    const minHom = selector ? 0.4 : 0.6;
    if (homogeneity < minHom) continue;

    const cols = alignBySignature(blocks, selector ? 0.4 : 0.6);
    if (!cols) continue;
    const rows = blocks.map((b) => cols.extract(b));
    const score = blocks.length * 1000 + cols.names.length * 100 + Math.round(homogeneity * 500) + cols.names.length * 50;
    if (!best || score > best.score) best = { rows, count: blocks.length, header: cols.names, score };
  }

  if (!best) {
    return { rows: [], title, hint: '未发现重复的卡片/块状结构（需要 ≥3 个同构兄弟块）', kind: 'blocks' };
  }
  return {
    rows: [best.header, ...best.rows],
    title,
    hint: `从 ${best.count} 个块中提取了 ${best.rows.length} 行 × ${best.header.length} 列`,
    kind: 'blocks',
  };
}

// ---------------------------------------------------------------------------
// 7) 列表提取（list 类型）：<ul>/<ol> → 每行一个 <li>
// ---------------------------------------------------------------------------

function extractList(root, selector, title) {
  let lists = [];
  if (selector) {
    const parts = parseSelector(selector);
    if (!parts) return { rows: [], title, hint: `无法解析选择器: ${selector}`, kind: 'list' };
    for (const el of selectDesc(root, parts)) {
      if (el.tag === 'ul' || el.tag === 'ol') lists.push(el);
      else lists.push(...findAll(el, 'ul'), ...findAll(el, 'ol'));
    }
  } else {
    lists = [...findAll(root, 'ul'), ...findAll(root, 'ol')];
  }
  const seen = new Set();
  lists = lists.filter((l) => {
    if (seen.has(l)) return false;
    seen.add(l);
    return true;
  });

  let best = null;
  for (const l of lists) {
    const items = elementChildren(l).filter((c) => c.tag === 'li');
    if (items.length < 3) continue;
    const cols = alignBySignature(items, 0.6);
    let header;
    let rows;
    if (cols) {
      header = cols.names;
      rows = items.map((b) => cols.extract(b));
    } else {
      header = ['值'];
      rows = items.map((b) => [getText(b)]);
    }
    const score = items.length;
    if (!best || score > best.score) best = { rows, header, count: items.length, score };
  }

  if (!best) return { rows: [], title, hint: '未找到 <ul>/<ol> 列表（或 li 项少于 3 个）', kind: 'list' };
  return {
    rows: [best.header, ...best.rows],
    title,
    hint: `从 ${best.count} 个列表项中提取了 ${best.rows.length} 行 × ${best.header.length} 列`,
    kind: 'list',
  };
}

// ---------------------------------------------------------------------------
// 8) 定义列表提取（dl 类型）：<dl><dt>/<dd> 键值对 → 两列
// ---------------------------------------------------------------------------

function extractDl(root, selector, title) {
  let dls = [];
  if (selector) {
    const parts = parseSelector(selector);
    if (!parts) return { rows: [], title, hint: `无法解析选择器: ${selector}`, kind: 'dl' };
    for (const el of selectDesc(root, parts)) {
      if (el.tag === 'dl') dls.push(el);
      else dls.push(...findAll(el, 'dl'));
    }
  } else {
    dls = findAll(root, 'dl');
  }
  const seen = new Set();
  dls = dls.filter((d) => {
    if (seen.has(d)) return false;
    seen.add(d);
    return true;
  });

  let best = null;
  for (const dl of dls) {
    const pairs = [];
    let currentDt = '';
    for (const c of elementChildren(dl)) {
      if (c.tag === 'dt') {
        if (currentDt !== '') pairs.push([currentDt, '']);
        currentDt = getText(c);
      } else if (c.tag === 'dd') {
        if (currentDt === '') pairs.push(['', getText(c)]);
        else { pairs.push([currentDt, getText(c)]); currentDt = ''; }
      }
    }
    if (currentDt !== '') pairs.push([currentDt, '']);
    const filled = pairs.filter((r) => r[0] !== '' || r[1] !== '');
    if (filled.length < 2) continue;
    const score = filled.length;
    if (!best || score > best.score) best = { rows: filled, score };
  }

  if (!best) return { rows: [], title, hint: '未找到 <dl> 键值列表（或 dt/dd 对少于 2 组）', kind: 'dl' };
  return {
    rows: [['键', '值'], ...best.rows],
    title,
    hint: `从 <dl> 中提取了 ${best.rows.length} 行 × 2 列`,
    kind: 'dl',
  };
}

// ---------------------------------------------------------------------------
// 9) 自动检测：table → dl → list → blocks
// ---------------------------------------------------------------------------

function extractAuto(root, selector, title) {
  const attempts = [];

  const t = extractTableFromRoot(root, selector);
  if (t.rows.length) return t;
  attempts.push('table(无表)');

  const d = extractDl(root, selector, title);
  if (d.rows.length) return d;
  attempts.push('dl(对<2)');

  const l = extractList(root, selector, title);
  if (l.rows.length) return l;
  attempts.push('list(li<3)');

  const b = extractBlocks(root, selector, title);
  if (b.rows.length) return b;
  attempts.push('blocks(块<3)');

  return {
    rows: [],
    title,
    hint: `未检测到可提取数据。已尝试: ${attempts.join(' → ')}。`,
    kind: 'auto',
  };
}

// ---------------------------------------------------------------------------
// 10) 统一入口
// ---------------------------------------------------------------------------

const VALID_TYPES = new Set(['table', 'list', 'dl', 'blocks', 'auto']);

/**
 * 从 HTML 提取网页数据（多类型）。
 *
 * @param {string} html  网页 HTML 全文
 * @param {{type?: string, selector?: string}} [opts]
 * @returns {{rows: string[][], title: string, hint: string, kind: string, tableCount?: number}}
 */
function extractFromHtml(html, opts) {
  const { type = 'auto', selector } = opts || {};
  if (!VALID_TYPES.has(type)) {
    return {
      rows: [],
      title: '',
      hint: `未知提取类型: ${type}（可选: ${[...VALID_TYPES].join(', ')}）`,
      kind: 'auto',
    };
  }
  const root = buildTree(tokenizeHtml(html));
  const title = titleOf(root);
  switch (type) {
    case 'table': return extractTableFromRoot(root, selector);
    case 'list': return extractList(root, selector, title);
    case 'dl': return extractDl(root, selector, title);
    case 'blocks': return extractBlocks(root, selector, title);
    default: return extractAuto(root, selector, title);
  }
}

module.exports = { extractTableFromHtml, extractFromHtml };
