---
name: online-excel-editor
description: 当用户要求处理/打开/预览/修改某个 Excel、CSV 或表格文件（提供本地路径或附件），或要求创建/制作/收集一张可填写的表格、表单或登记表（如排班值班、活动报名、会议签到、请假考勤、费用报销、物资领用、库存盘点、设备巡检、安全排查、项目风险登记、问卷调研、周报日报、数据上报、客户线索、候选人登记）时，使用本技能。在浏览器中用 SpreadJS 设计器在线编辑表格并下载填好的 xlsx，或按 Agent 提供的表单定义（字段类型：文本/数字/下拉/复选框/日期，支持必填校验）生成可填写的网格表单，逐行采集结构化记录，回传给 Agent 并落盘 JSON 与填好的 xlsx。触发关键词：制作表格、创建表格、生成表格、做表、建表、在线表格、可填写表格、表单采集、数据填报、登记表、收集排班、填表、报名登记、签到表、请假考勤、费用报销、领用登记、库存盘点、巡检记录、安全排查、问卷调查、周报收集、数据上报、客户线索、候选人登记、处理 Excel、编辑 xlsx、编辑表格文件、打开附件表格、在线预览修改表格、create spreadsheet、make xlsx、build table、generate excel、edit xlsx、preview spreadsheet、open excel attachment、collect form、data entry、fill in form、register、enroll、survey、attendance、inventory。
---

# OnlineExcelEditor（本地/附件表格 → 在线编辑）

接收本地文件路径或附件，生成带完整工具栏的 **SpreadJS 设计器**在线编辑页（前端 `import` 保留原始格式与样式），用户编辑后回传编辑后的 xlsx 文件与修改摘要，供 Agent 继续处理（汇总、分析等）。

## 使用场景（触发条件）

**使用此技能，当：**
- 用户要求“帮我处理这个 Excel 文件”“打开并编辑我的附件表格”“预览并修改这个 xlsx/csv 文件”；
- 用户提供了本地文件路径，或上传/粘贴了附件文件；
- 用户希望先在线编辑文件，再由 AI 基于编辑结果做后续处理；
- **用户要求收集/登记/填报一批结构化数据**——用 `--form` 生成可填写的网格表单（每行一条记录，字段为列）。典型业务举例：
  - 团队排班/值班/轮班表（“帮我收集团队这周的排班”）
  - 活动/会议报名、签到登记（“做个报名表让大家填”）
  - 请假/考勤、费用报销、物资领用登记
  - 设备巡检、安全检查/隐患排查、库存盘点
  - 问卷/调研收集、周报/日报收集、门店数据上报
  - 项目风险登记（“做一个项目风险登记表”）、客户信息/销售线索收集、候选人登记

**不要使用，当：**
- 用户只是询问 Excel 处理的一般性问题，没有具体文件；
- 数据来源是网页 URL（改用 `web-data-extractor`）；
- 文件是旧版 `.xls`（不支持，需先另存为 `.xlsx`/`.csv`）。

## 支持格式

`.xlsx` `.xlsm` `.xltx` `.xltm` `.csv` `.sjs` `.ssjson`（不支持 `.xls`）

## 前置要求

- 运行环境 Node.js ≥ 18（零第三方依赖，无需 npm install）。
- 用户浏览器需能访问 jsdelivr CDN（编辑页从 CDN 加载 SpreadJS 19.1.1）。

## 工作流（Agent 执行步骤）

**A. 文件编辑模式（默认）**

1. **确认文件**：从用户指令解析文件路径或附件。
   - 若用户未提供文件，直接运行 `node index.js`（不带参数），技能会扫描最近下载目录并列出候选，由用户选择。
2. **运行技能**：在技能目录执行：
   ```
   node index.js <文件路径> [--no-open]
   ```
   建议加 `--no-open`；有图形界面时可省略。
3. **展示链接**：把 stdout 中打印的 `http://localhost:<端口>/index.html` 链接展示给用户，并提示：
   “请在浏览器打开，用顶部工具栏编辑表格，完成后点击右上角『下载表格 (xlsx)』。”
4. **等待完成**：进程持续运行，直到用户在浏览器点击「下载表格」后自动退出。点击会**直接下载 xlsx 文件**，
   同时仍通过 `POST /save` 把编辑结果（xlsx base64 + 修改摘要）回传给 Agent——两条路径都会执行，
   用户手里一定有文件，Agent 也能拿到结构化数据。
5. **解析结果**：取 stdout 中**最后一个 JSON 对象**作为结果。
6. **继续原任务**：用结果中的 `xlsxPath` 读取编辑后的文件，继续执行用户原始指令。

**B. 表单采集模式（`--form`，数据填报/收集）**

1. **生成表单定义**：根据用户要收集的数据，写一个表单定义 JSON 到临时文件，例如 `./排班表.json`：
   ```json
   {
     "type": "form",
     "title": "团队排班登记",
     "subtitle": "请为每位成员填写，完成后点击右上角「下载表格 (xlsx)」",
     "fields": [
       { "name": "姓名", "label": "姓名", "type": "text", "required": true, "width": 120 },
       { "name": "值班星期", "label": "值班星期", "type": "dropdown", "options": ["周一","周二","周三","周四","周五"], "required": true, "width": 110 },
       { "name": "开始日期", "label": "开始日期", "type": "date", "width": 150 },
       { "name": "是否出差", "label": "是否出差", "type": "checkbox", "width": 100 }
     ],
     "rowCount": 5
   }
   ```
   - `type` 支持：`text` / `number` / `dropdown`（需 `options`）/ `checkbox` / `date`。
   - `dropdown` 用「数据验证 → 序列」实现（Excel 原生下拉，导出 xlsx 后仍可下拉，不会像 ComboBox 那样丢失）。
   - `required: true` → 表头加 `*`，提交时校验必填（空行自动跳过）。
2. **运行技能**：
   ```
   node index.js --form ./排班表.json [--no-open]
   ```
3. **展示链接**：把链接展示给用户，提示：“请在浏览器打开，用顶部工具栏填写表格，完成后点击右上角『下载表格 (xlsx)』。”
   （每行一条记录；可用工具栏增删行。点击会**下载填好的 xlsx**，同时把填写的记录静默回传给 Agent。）
4. **等待完成**：用户在浏览器点击「下载表格 (xlsx)」后进程退出，回传结构化记录。
5. **解析结果**：取 stdout 中**最后一个 JSON 对象**作为结果。
6. **继续原任务**：用结果中的 `records`（或 `jsonPath` 读取 `form_records.json`）继续处理。

## 输出协议（Agent 解析）

文件编辑模式：

```json
{
  "type": "file",
  "xlsxPath": "<技能运行目录>/temp_skill_xlsx/edited.xlsx",
  "savedDir": "<技能运行目录>/temp_skill_xlsx",
  "summary": {
    "rowCount": 51,
    "colCount": 8,
    "rowsDelta": -2,
    "colsDelta": 1,
    "cellsChanged": 14,
    "text": "删除了 2 行，增加了 1 列，修改了 14 个单元格"
  }
}
```

- `xlsxPath`：编辑后的文件路径，主流程读取该文件做后续分析。
- `summary.text`：中文修改摘要，可向用户复述改动内容。

表单采集模式（`--form`）：

```json
{
  "type": "form",
  "title": "团队排班登记",
  "records": [
    { "姓名": "张三", "值班星期": "周一", "开始日期": "2026-08-10", "是否出差": true }
  ],
  "rowCount": 1,
  "jsonPath": "<技能运行目录>/temp_skill_xlsx/form_records.json",
  "xlsxPath": "<技能运行目录>/temp_skill_xlsx/form_records.xlsx",
  "savedDir": "<技能运行目录>/temp_skill_xlsx"
}
```

- `records`：用户填写的结构化记录（数组 of 对象），key 为字段 `name`；checkbox 为布尔、date 为 `yyyy-mm-dd` 字符串、空数字为 `null`。
- `jsonPath`：记录已落盘路径，主流程可直接读取。
- `xlsxPath`：用户下载的填好 xlsx 的同一份拷贝，主流程可直接读取（与用户手里的文件一致）。

## 权限与安全

- 启动本地 HTTP 服务、读写文件、打开浏览器属敏感操作：执行前向用户说明并获取允许。
- 只读取用户指定的文件；未指定时仅扫描用户自己的下载目录候选。
- 涉及敏感文件时提醒用户确认处理范围。

## 已知限制

- CSV 编码：非 UTF-8（如 GBK）可能乱码，建议先转存 UTF-8。
- 修改摘要对比范围限活动工作表前 500 行 × 200 列（防止超大表卡死浏览器）。
- 表单采集（`--form`）：下拉字段未选时回传空字符串；checkbox 未勾选回传 `false`；必填校验只针对**非空行**（整行为空的记录自动跳过）。
- SpreadJS 未配置 LicenseKey 时页面带试用水印，不影响功能。

## 平台集成（可选）

若平台支持内嵌 iframe 而非启动本地服务：用 `lib/html-template.js` 的 `buildPageHtml(payload)` 生成页面，
并把页面的回传从 `fetch /save` 改为 `window.parent.postMessage(result, '*')`（「下载表格」下载仍可用）；
主流程监听 `message` 事件即可。
