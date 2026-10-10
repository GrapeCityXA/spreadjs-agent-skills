# WebDataExtractor · Skill

> 场景1：**网页内容转可编辑表格**
>
> 抓取用户提供的网页 URL → 提取用户可见的结构化数据（表格/列表/定义列表/卡片）→ 生成内嵌 **SpreadJS 设计器**的在线编辑页 → 用户编辑后点击「下载表格 (xlsx)」→ 浏览器**直接下载 xlsx**，同时把编辑结果（二维数组 + xlsx）回传给 Agent 主流程。
>
> 三种数据来源：URL 直接抓取、`--data <json文件>` 接收 Agent 自行整理的数据、`--cdp` 连接用户**已登录**的浏览器读取渲染后页面（登录 / JS 渲染 / SPA 也能拿到）。

## 触发条件

用户说出类似以下指令，且提供了网页 URL：

- “抓取这个网页上的表格/数据/列表”
- “帮我提取这个页面的数据并做成可编辑表格”
- “把 https://xxx 页面里的表/产品卡片整理一下”
- 想「在线编辑/调整网页数据」；或 Agent 已自行取到数据、想把二维数组送入 SpreadJS 让用户编辑（用 `--data`）
- 目标页面**需登录 / JS 渲染 / SPA**，直接抓不到数据（用 `--cdp`，需用户配合启动调试浏览器）

## 支持的提取类型

| `--type` | 提取内容 | 说明 |
| --- | --- | --- |
| `table` | `<table>` 表格 | 智能选最大表；`--selector` 可精确指定 |
| `list` | `<ul>/<ol>` 列表 | 每个 `<li>` 一行；li 内部结构稳定时按字段拆多列 |
| `dl` | `<dl>` 定义列表 | `<dt>/<dd>` 键值对 → 两列 |
| `blocks` | 重复的兄弟 DOM 结构（卡片/新闻项/产品项） | 每块一行、按字段签名对齐拆列，缺字段补空 |
| `auto` | 自动检测 | **默认**。按 table → dl → list → blocks 顺序 |

> **数据来源二：`--data <file.json>`** —— 不抓网页，直接读取 Agent 自行整理的二维数组
> （JSON，首行为表头）进入编辑器，结果 `kind` 为 `data`。适合页面结构特殊、JS 动态渲染等场景。

> **数据来源三：`--cdp`** —— 连接用户本机**已登录**的浏览器读取目标页面**渲染后**的 DOM
> （登录态 / JS 渲染 / SPA 都能拿到），再走同样的提取管线，结果 `kind` 同 URL 入口。
> 需要用户先用调试端口启动 Chrome 并登录目标站点（见下文「--cdp 的浏览器准备」）。

## 环境要求

| 依赖 | 说明 |
| --- | --- |
| Node.js | **≥ 18**（使用内置 `fetch`、`http`；无需额外 HTTP 框架） |
| Node.js（`--cdp` 模式） | **≥ 22**（依赖内置全局 WebSocket） |
| npm | **无需任何第三方包**（表格/列表/卡片提取、CDP 均为内置零依赖实现） |

前端页面通过 CDN 加载 SpreadJS 19.1.1（UMD 版，含设计器与完整 Ribbon 工具栏），**不需要** npm 安装 SpreadJS。

## 安装与使用

```bash
cd web-data-extractor
# 零依赖，无需 npm install，直接运行

# 默认 auto：自动检测页面结构
node index.js https://example.com/scores.html

# 指定类型提取（列表 / 定义列表 / 卡片）
node index.js https://example.com/products.html --type blocks
node index.js https://example.com/faq.html --type dl

# 用 CSS 选择器精确指定区域
node index.js https://example.com/page.html --selector "table#data"
node index.js https://example.com/products.html --type blocks --selector ".grid"

# 需登录 / JS 渲染的页面：连接用户已登录的浏览器读取渲染后的页面
node index.js https://example.com/login-page.html --cdp
node index.js https://example.com/spa-page.html --cdp --cdp-port 9222 --type blocks

# Agent 自由发挥：用自己的方式取数，把二维数组交给本技能进入 SpreadJS 编辑
node index.js --data ./网页数据.json

# 不自动打开浏览器、确认后保持服务运行
node index.js https://example.com/page.html --no-open --keep-server

# 关闭自动样式 / 自动图表（默认开启：样式 + 图表）
node index.js https://example.com/page.html --no-style --no-chart

# AI 自行选择图表：只画选定的列与图型（列用表头名或列号）
node index.js --data ./网页数据.json --chart-config ./chart.json
```

> 编辑页默认**自动套用样式**（表头加粗/底色/居中、数据区边框与隔行底色、行高列宽自适应、冻结表头）
> 并据数据**自动生成图表**（识别类别列 + 数值列，画在独立「图表」工作表，不污染回传的二维数组）。
> 网页抓取的数据基本都是字符串——凡**能干净转成数字**的字符串（含千分位/金额符号/百分号/「万」）会先转成
> number 再写入单元格，图表才能正常渲染数值轴，回传给 Agent 的数据也更利于后续分析；
> 日期/时间/带分隔符或前导零的编号（如 "2024-01-01"、"138-0013-8000"、"007"）不会被误转。
> 需要原样数据时可加 `--no-style` / `--no-chart` 关闭。

> **AI 自行选择图表数据**：数据列很多时，自动图表会把所有数值列都画上去（上限 6 个系列），不够精准。
> 技能运行后会在 stdout 打印「列名: …」，Agent 据此判断哪几列适合做图，写配置后用
> `--chart-config` 重跑，编辑页就**只画 AI 选定的列和图型**：
> ```json
> { "type": "line", "category": "产品名称", "series": ["销量", "利润"] }
> ```
> `type` 可选 `column` / `bar` / `line` / `pie`（默认 `column`，饼图只取第一个 series 列）；
> `category` 省略时自动取第一个非数值列；`series` 至少 1 个、只画这些列。

### --cdp 的浏览器准备

1. 关闭当前 Chrome，用调试端口 + **独立 profile** 启动（避免和默认浏览器冲突）：
   ```
   chrome.exe --remote-debugging-port=9222 --user-data-dir="%TEMP%\skill-cdp" --remote-allow-origins=*
   ```
2. 在这个浏览器里**登录目标网站**（登录态保存在该 profile 里）。
3. 运行技能（技能须在**用户本机**、Node ≥ 22）；连接失败时 stderr 会打印同样的引导。

运行后会在**当前工作目录**生成 `./temp_skill_web/`：

```
temp_skill_web/
├── index.html     # 在线编辑页（内嵌 SpreadJS 设计器）
├── data.json      # 用户点击「下载表格」后：编辑结果的二维数组（POST /save 落盘）
└── edited.xlsx    # 同上：导出的 xlsx 文件（与浏览器下载的是同一份内容）
```

## 参数说明

| 参数 | 说明 |
| --- | --- |
| `<URL>` | 抓取入口，要抓取的网页地址（`http://` 或 `https://`）；与 `--data`、`--cdp` 组合使用 |
| `--data <file.json>` | 数据入口，直接读取 JSON 二维数组（首行为表头）进入编辑，不抓网页（结果 `kind=data`） |
| `--cdp` | 数据入口，连接用户本机**已登录**的浏览器读取目标页渲染后 DOM（登录/JS 渲染/SPA 也能拿到），需 `<URL>` |
| `--cdp-port <端口>` | 可选，Chrome 调试端口（默认 `9222`），仅配合 `--cdp` |
| `--type <类型>` | 可选（仅 URL/CDP 入口），`table` / `list` / `dl` / `blocks` / `auto`（默认 `auto`） |
| `--selector <CSS>` | 可选，指定提取区域（table: 区域内表格；list/blocks: 区域作容器） |
| `--no-open` | 可选，不自动打开浏览器（Agent 环境常用） |
| `--keep-server` | 可选，确认后不关闭服务，方便用户再次编辑 |
| `--no-style` | 可选，关闭自动样式（表头/边框/隔行/行高列宽自适应/冻结表头） |
| `--no-chart` | 可选，关闭自动图表（默认据数据生成柱状图到独立「图表」工作表） |
| `--chart-config <文件.json>` | 可选，AI 指定图表：`{"type":"line","category":"产品","series":["销量","利润"]}`，列可用表头名或列号；`type` 取 `column`/`bar`/`line`/`pie`；只画指定的 series 列。适用所有数据入口 |

## Skill 输出（主流程拿到的数据）

`waitForSave()` 返回的对象（JSON 打印到 stdout）：

```json
{
  "type": "list",
  "kind": "list",
  "table": [["a", "span"], ["手机", "¥4999"]],
  "jsonPath": "D:/.../temp_skill_web/data.json",
  "xlsxPath": "D:/.../temp_skill_web/edited.xlsx",
  "summary": { "rowCount": 4, "colCount": 2 },
  "extractionHint": "从 3 个列表项中提取了 3 行 × 2 列",
  "savedDir": "D:/.../temp_skill_web"
}
```

- `type` / `kind`：数据来源（`table`/`list`/`dl`/`blocks`；用 `--data` 时为 `data`；`--cdp` 是读取方式，`kind` 同 URL 入口）。
- `table`：编辑后的**二维数组**（首行为表头），主流程可直接用于汇总/生成报告。
- `xlsxPath`：前端导出的 xlsx 文件，需要保留原文件时可读取它。

> 若 Agent 以子进程方式调用本 Skill，请解析 stdout 中最后一个 JSON 对象作为结果。

## 与 WorkBuddy / TRAE Work 集成

1. 将本文件夹作为一个 Skill 注册到平台（脚本入口 `index.js`）。
2. 平台读取用户指令 → 取到 URL 则 `node index.js <URL> [--type ...]`；若 Agent 自行取数，写二维数组到临时 JSON 后 `node index.js --data ./data.json`。
3. 捕获 stdout 的 JSON 结果 → 继续执行用户原始后续任务（如“汇总后生成报告”）。

### 平台有更简单的可视化方式时

若平台支持**内嵌 iframe** 或**视图组件**，可跳过“启动本地 HTTP 服务”这一步：

- 直接用 `buildPageHtml(payload)`（`lib/html-template.js`）生成 HTML；
- 把 HTML 放入 iframe，并让页面内的回传从 `fetch /save` 改为 `window.parent.postMessage(result, '*')`（「下载表格」下载仍可用）；
- 主流程监听 `message` 事件即可拿到数据，无需 `/save` 接口。

## 已知限制与注意事项

- **直接抓取只处理服务端渲染的静态 HTML**。SPA/JS 动态渲染、需登录的页面→优先 `--cdp`（读渲染后 DOM），不便走 CDP 时用 Agent 自己取数 + `--data` 入口绕过。
- **`--cdp` 需要用户配合**：先以调试端口 + 独立 profile 启动 Chrome 并登录，技能须运行在用户本机、Node ≥ 22。
- **选择器**为简化实现：支持 tag / #id / .class 组合与空格后代；不支持属性选择器、伪类、子选择器(>)。
- **`blocks` 可能误选导航**：auto 下 `list` 先于 `blocks` 截胡，评分含富字段加成；必要时用 `--selector` 精确指向容器。
- 合并单元格（colspan/rowspan）会被**简单处理**（值重复计入），不会保留合并效果。
- 网页可能有反爬/验证码，`User-Agent` 已设置，但部分站点仍会拒绝。
- **授权问题**：启动本地服务、写文件、打开浏览器需要用户允许（Agent 平台应在 Skill 开头提示权限）。
- **试用水印**：未配置 LicenseKey 时，SpreadJS 会显示试用水印，不影响功能；正式商用请填写
  `GC.Spread.Sheets.LicenseKey` 与 `GC.Spread.Sheets.Designer.LicenseKey`（见模板注释）。
- 页面通过 CDN 加载，用户浏览器需能访问 jsdelivr；离线/内网环境请改用私有 CDN 或本地资源。

## 目录结构

```
web-data-extractor/
├── SKILL.md                    # 技能定义（Agent Skills 开放标准：name + description）
├── index.js                    # 主入口：抓取 → 多类型提取 → 生成页面 → 起服务 → 等待回传
├── package.json
├── lib/
│   ├── server.js               # 零依赖 HTTP 服务：静态资源 + POST /save
│   ├── extract.js              # 零依赖多类型提取（table/list/dl/blocks/auto）
│   ├── cdp.js                  # --cdp：连接用户浏览器（CDP）读取渲染后 DOM
│   └── html-template.js        # 模板读取 + 数据注入（防 </script> 注入）
├── public/
│   └── index.template.html     # SpreadJS 设计器页面模板
└── README.md
```
