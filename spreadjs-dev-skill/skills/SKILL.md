---
name: spreadjs-dev-skill
description: 用于编写、调试、审查 SpreadJS（葡萄城表格 / GrapeCity）前端电子表格组件的代码。覆盖工作簿/工作表/单元格、数据绑定、公式与自定义函数、Excel/CSV/SJS 导入导出、样式与条件格式、图表与形状、筛选排序、打印与 PDF、设计器 Designer、以及 React/Vue/Angular 集成。触发关键词：SpreadJS、葡萄城表格、表格控件、电子表格、GC.Spread.Sheets、Workbook、Worksheet、setDataSource、spread-sheets、@grapecity-software/spread-sheets、Designer 表格、表格 IO。
---

# SpreadJS 编码技能

本技能帮助你为 **SpreadJS**（葡萄城前端电子表格组件）编写正确、高性能的代码。SpreadJS 是浏览器端 Excel-like 表格组件，默认对象模型为 `Workbook -> Worksheet -> Range/Cell/Table/Shape`。

> ⚠️ **首要原则**：你既有记忆中关于 SpreadJS 的 API 细节、包名、集成模式**并不可靠**。任何涉及 SpreadJS 的实现前，务必先通过 **SpreadJS MCP** 的 `overview` 建立整体认知，再用 `search` / `fetch` 核实具体 API。除非用户明确要求外部对比，不要用网页搜索替代 MCP。

本技能分两部分：
1. **编码注意事项**（见下文）—— 必读的通用规则与陷阱。
2. **常见问题 Demo**（见 `references/`）—— 20 个高频场景的可运行示例与解题思路。

---

## 第一部分：编码注意事项

### 1. 包依赖与导入顺序
- npm scope 固定为 `@grapecity-software`（核心包 `@grapecity-software/spread-sheets`）。框架封装包为 `-react` / `-vue` / `-angular`。
- **`package.json` 中版本号必须写精确值，不要带 `^` / `~`**。SpreadJS 是一套**同步发布**的套件，所有 `@grapecity-software/*` 包必须使用**完全相同**的版本（本 skill 当前锁定 `19.1.4`）。若写成 `^19.1.4` 这类范围，不同包可能各自解析到不同的小版本/补丁，导致运行时不一致甚至报错；第三方包（如 `file-saver`、`vite`）同样写精确值以保证可复现。升级时先 `npm view @grapecity-software/spread-sheets version` 查最新版，再把所有 `@grapecity-software/*` 的版本号整体替换为同一值。
- **插件有前置依赖**，顺序错误会导致功能不可用：
  - 先导入 `shapes`，再导入 `charts` 和 `slicers`。
  - 先导入 `print`，再导入 `pdf`。
  - 引用数据透视切片器时，顺序为 `shapes` → `slicers` → `pivot-addon`。
- **导入导出插件**：自 v16 起 `gc.spread.sheets.excelIo` 已弃用，统一使用 `@grapecity-software/spread-sheets-io`（提供 `spread.open/save/import/export`）。不要继续推荐旧式 `ExcelIO`。
- CSS 必须引入，例如 `@grapecity-software/spread-sheets/styles/gc.spread.sheets.excel2013white.css`，否则组件显示异常。

#### 1.1 Designer（设计器）是重型集成，需要一整套依赖
仅装 `spread-sheets` + `spread-sheets-designer` **远远不够**——Designer 初始化时会查找下列插件，缺失会报错。本 skill 的 `package.json` 已包含完整集合：

- **必需（初始化期，缺一报错）**：核心 `spread-sheets`，加 `spread-sheets-shapes`、`spread-sheets-charts`、`spread-sheets-print`、`spread-sheets-pdf`、`spread-sheets-barcode`、`spread-sheets-slicers`、`spread-sheets-formula-panel`、`spread-sheets-tablesheet`、`spread-sheets-languagepackages`（本地化公式/函数名）、`spread-sheets-io`，以及 `spread-sheets-designer` + `spread-sheets-designer-resources-cn`（中文资源）。
- **常见补充（让 Ribbon 的高级数据工作表标签可用）**：`spread-sheets-pivot-addon`（透视表）、`spread-sheets-ganttsheet`（甘特）、`spread-sheets-reportsheet-addon`（报表）、`spread-sheets-datacharts-addon`（数据图表）。
- **导入顺序很关键**：核心 → 各插件（`shapes`→`charts`→`slicers`，`print`→`pdf`）→ **资源包先于 designer 主包** → designer 主包。`references/_shared/designerShell.js` 已按此顺序统一引入，designer demo（21–24）直接复用即可，无需各自重复。
- **框架封装包**（`-react`/`-vue`/`-angular`，及 `-designer-react`/`-designer-vue`/`-designer-angular`）仅在使用对应框架时才需要；纯 JS 工程无需安装。已弃用的 `@grapecity-software/spread-excelio` 不要再装，导入导出统一用 `spread-sheets-io`。

### 2. 默认走核心 Worksheet 路线
- 普通的表格编辑、样式、事件、导入导出、图表、筛选分析，**优先用核心 `Worksheet`**。
- 不要默认引入 `TableSheet` / `GanttSheet` / `ReportSheet`（它们面向特定大数据/报表场景，行为与 `Worksheet` 不同）。
- 不要把 `Designer` 当普通插件顺手引入——只有在「让终端用户可视化编辑模板/布局」时才需要。是否需要某个能力仍取决于运行时是否补齐对应插件。

### 3. 批量操作必须用 suspend / resume
任何循环写值、批量设样式、设置大量行列时，**务必**用 `suspendPaint` + `suspendEvent` 包裹，否则每次操作都触发重绘与事件，性能急剧下降。

```js
spread.suspendPaint();   // 暂停绘制
spread.suspendEvent();   // 暂停事件，避免级联 CellChanged
// ... 批量操作：setArray / setDataSource / 设样式 / 建筛选 ...
spread.resumeEvent();    // 必须成对恢复（先恢复事件）
spread.resumePaint();    // 再恢复绘制（一次性重绘）
```
- 调用**必须成对**：`suspendPaint` / `resumePaint`、`suspendEvent` / `resumeEvent` 各自成对，嵌套时也要平衡，否则界面卡在「不刷新」状态。
- 批量数据优先用 `sheet.setArray(row, col, 二维数组)` 或 `sheet.setDataSource(...)`，**不要**逐单元格 `setValue`。

### 4. 合并单元格只有左上角存值
- `addSpan(row, col, rowCount, colCount)` 合并后，**仅左上角单元格存储值**，其余位置 `getValue()` 返回 `null`。
- 取值前用 `sheet.getSpan(row, col)` 判断是否落在合并区，命中则取左上角 (`spanInfo.row/col`) 的值。

### 5. 框架集成与生命周期（React/Vue/Angular）
- **容器必须先有确定宽高，再初始化 Workbook**，否则渲染尺寸为 0。
- host 元素尺寸变化（抽屉/分屏/CSS 动画）后，表格不会自动跟随，需调用 `spread.refresh()`；在框架里建议放在布局变化之后，必要时 `setTimeout(() => spread.refresh(), delay)` 兜底。
- 组件卸载时**必须销毁**实例（`spread.destroy()` / 设计器 `designer.destroy()`），避免内存与事件泄漏。
- 原生 JS、React、Vue3、Angular 封装在 API、props、初始化流程上**差异明显**，不要把原生写法直接套到框架组件上；接入前先查框架总览页（标准 query：`Using SpreadJS with React` / `Using SpreadJS with Vue` / `add SpreadJS to Angular CLI app`）。

### 6. Excel / 文件导入导出
- 需引入 io 插件。客户端导出的 Excel 因来源互联网会被 Excel 标记锁定（首次打开有警告），属正常现象。
- **宏不会被保留**：导出/保存为 `.xlsx`、`.sjs`、`.ssjson` 时宏丢失，且 SpreadJS 无法查看/编辑/执行宏。
- 超大文件优先用 `.sjs` 格式：加载更快、内存更省、重存体积更小。
- 导入时用 `{ fileType: GC.Spread.Sheets.FileType.excel }` 明确类型；`open` 对应 SJS，`import` 对应 xlsx/ssjson/csv。

### 7. 搜索 API 时带宿主类型
SpreadJS 存在大量同名能力，查 API 时**务必带宿主类型**：
- ✅ 正确：`addRow Worksheet`、`tables add`、`conditionalFormats addRule`
- ❌ 错误：只搜 `addRow`、`add`
- 查 Designer 相关能力时显式带 `designer`。

### 8. 事件与命令
- 短时间内大量 `setValue` 会触发海量 `CellChanged`，应配合 `suspendEvent`。
- 许多事件参数对象含 `cancel: true` 可中止默认行为（如 `ClipboardPasting`、`RowChanging`）。
- 需要可撤销的程序化操作时，走 `spread.commandManager().execute({cmd, ...})` 而非直接改数据。

### 9. 协同（Collaboration）是完整方案
协同**不是单包功能**：需 client 与 server 两套包配套（`js-collaboration-*` + `spread-sheets-collaboration-*`），并涉及 OT、presence、存储适配。直接改嵌套对象通常不会同步，需重设整个对象；自定义单元格类型与自定义函数需在所有客户端注册。协同不支持 DataChart/GanttSheet/TableSheet/ReportSheet 等 DataManager 相关能力。

---

## 第二部分：常见问题 Demo 索引

以下 24 个 Demo 位于 `references/` 目录，每个对应一个高频问题，含可运行代码与解题思路。所有 Demo **共用根目录的一个 `node_modules`**，运行方式：

```bash
cd spreadjs-skill
npm install      # 一次性安装共享依赖
npm run dev      # 打开 http://localhost:5173/references/ ，点选任一 Demo
```

表中「在线参考」为 SpreadJS 官方 Demo/文档，用于核实细节。

### 性能与生命周期
| # | Demo（链接） | 解决的问题 | 在线参考 |
|---|---|---|---|
| 1 | [大数据加载与性能优化](references/demo-01-large-data-performance/) | 万行/十万行数据卡顿；`suspendPaint` / `setArray` / 虚拟滚动 | [大数据加载](https://demo.grapecity.com.cn/spreadjs/practice/data-binding/big-amount-data-load) |
| 2 | [表格区域跟随 host 元素变化](references/demo-02-host-size-refresh/) | host 尺寸变化后表格不跟随；`spread.refresh()` 与 `setTimeout` | [host 元素变化](https://demo.grapecity.com.cn/spreadjs/practice/others/spread-content-area-changes-with-dom-host) |

### 导入导出与文件
| # | Demo（链接） | 解决的问题 | 在线参考 |
|---|---|---|---|
| 3 | [Excel / SJS 导入导出](references/demo-03-excel-import-export/) | `import`/`export`/`open`/`save` 用法、`FileType`、SJS 优势 | [Excel 导入导出](https://demo.grapecity.com.cn/spreadjs/help/docs/excelimpexp/excelclient) |
| 4 | [CSV 导入导出与分隔符](references/demo-04-csv-handling/) | CSV 解析、自定义分隔符、编码与日期格式 | — |
| 5 | [打印与 PDF 导出](references/demo-05-print-pdf/) | print/pdf 插件引入、打印设置、PDF 字体 | — |

### 数据绑定
| # | Demo（链接） | 解决的问题 | 在线参考 |
|---|---|---|---|
| 6 | [单元格级别数据绑定](references/demo-06-cell-level-binding/) | `CellBindingSource` + `setBindingPath`，含嵌套路径、双向同步 | [单元格绑定](https://demo.grapecity.com.cn/spreadjs/SpreadJSTutorial/features/data-binding/cell-level-binding) |
| 7 | [表格绑定与动态数据源](references/demo-07-table-binding-datasource/) | Table 绑定、替换/追加数据源、绑定列与公式列 | [更换/追加数据源](https://demo.grapecity.com.cn/spreadjs/practice/data-binding/change-datasource-append-data) |

### 单元格与样式
| # | Demo（链接） | 解决的问题 | 在线参考 |
|---|---|---|---|
| 8 | [合并单元格取值](references/demo-08-merged-cell-value/) | 合并区仅左上角存值；`getSpan` 取值封装 | [合并单元格取值](https://demo.grapecity.com.cn/spreadjs/practice/format-style/get-merged-cell-value) |
| 9 | [单元格样式 / 边框 / 数字格式](references/demo-09-styles-format/) | `Style` 复用、`formatter`、`LineBorder`、批量设样式 | — |
| 10 | [条件格式](references/demo-10-conditional-formatting/) | `addCellValueRule` / `addFormulaRule` / 图标集规则 | [Formula 规则](https://demo.grapecity.com.cn/spreadjs/help/docs/features/condformat/formularule) |
| 11 | [冻结行列与冻结线](references/demo-11-frozen-rows-cols/) | `frozenRowCount/ColumnCount`、尾部冻结、冻结线颜色 | [冻结行列](https://demo.grapecity.com.cn/spreadjs/SpreadJSTutorial/features/worksheet/frozenline-viewport) |
| 12 | [数据验证](references/demo-12-data-validation/) | 下拉/数值/公式验证、`DataValidation`、提示与警告 | — |

### 公式与计算
| # | Demo（链接） | 解决的问题 | 在线参考 |
|---|---|---|---|
| 13 | [自定义公式与自定义名称](references/demo-13-custom-formula-name/) | `addCustomName`、命名规则、`LAMBDA`、动态数组 | [自定义名称](https://demo.grapecity.com.cn/spreadjs/SpreadJSTutorial/features/calculation/add-custom-name) |

### 交互与事件
| # | Demo（链接） | 解决的问题 | 在线参考 |
|---|---|---|---|
| 14 | [剪贴板复制粘贴与拦截](references/demo-14-clipboard-paste/) | `clipboardPaste` 命令、`ClipboardPasting` 拦截/`cancel`、粘贴选项 | [剪贴板操作](https://demo.grapecity.com.cn/spreadjs/help/docs/features/workbook/clipboard) |
| 15 | [行筛选与排序](references/demo-15-filter-sort/) | `HideRowFilter`、`rowFilter`、筛选条件与排序 | — |
| 16 | [事件处理与批量监听](references/demo-16-events-handling/) | 常用事件、事件参数、`suspendEvent` 控制性能 | — |

### 高级与扩展
| # | Demo（链接） | 解决的问题 | 在线参考 |
|---|---|---|---|
| 17 | [自定义单元格类型](references/demo-17-custom-cell-type/) | 继承 `CellType`、`paint` / `createEditorElement` / 取值 | — |
| 18 | [批注 Comments](references/demo-18-comments/) | 添加/编辑批注、批注样式与交互 | — |
| 19 | [形状与图表 Shapes/Charts](references/demo-19-shapes-charts/) | shapes 前置依赖、添加图表、形状操作 | — |

### 框架与设计器
| # | Demo（链接） | 解决的问题 | 在线参考 |
|---|---|---|---|
| 20 | [React/Vue/Angular 集成与 Designer](references/demo-20-framework-designer/) | 框架封装组件、`refresh`/`destroy` 生命周期、`Designer.findControl` | [Resize 动画](https://demo.grapecity.com.cn/spreadjs/practice/format-style/resize-animation) |

### 设计器 Designer（菜单与右键）
> 这些 demo 依赖 `@grapecity-software/spread-sheets-designer`（已在共享 `package.json` 中），由 `references/_shared/designerShell.js` 统一引入核心包 + 中文资源 + 主题 CSS。Designer 是独立组件，仅在「让终端用户可视化编辑模板」时引入。

| # | Demo（链接） | 解决的问题 | 在线参考 |
|---|---|---|---|
| 21 | [Designer 初始化与取 Workbook](references/demo-21-designer-init/) | `new Designer` / `getWorkbook` / 中文资源 / `setConfig`/`findControl`/`destroy` | [Designer 组件文档](https://demo.grapecity.com.cn/spreadjs/help/docs/spreadjs-designer-component) |
| 22 | [自定义 Ribbon（添加菜单）](references/demo-22-designer-ribbon-menu/) | 新增一级菜单选项卡 + 二级按钮组 + `commandMap` 自定义命令 | [新增一级菜单](https://demo.grapecity.com.cn/spreadjs/practice/designer/designer-add-top-menu) |
| 23 | [自定义右键菜单](references/demo-23-designer-context-menu/) | `contextMenu` + `visibleContext` + `subCommands`（含分隔符） | [右键多层级菜单](https://demo.grapecity.com.cn/spreadjs/practice/menu/add-designer-multi-level-context-menu) |
| 24 | [自定义命令（可撤销）](references/demo-24-designer-command-undo/) | 注册可撤销命令 + `startTransaction`/`endTransaction` + 撤销列表中文名 | [自定义命令](https://demo.grapecity.com.cn/spreadjs/practice/designer/designer-customize-command) |

---

## 如何使用本技能
1. **先查后写**：动手前用 SpreadJS MCP `search` / `fetch` 核实 API 签名与版本差异。
2. **套注意事项**：批量操作套 suspend/resume；取合并单元格值先 `getSpan`；框架里记得 `refresh` / `destroy`。
3. **查 Demo**：遇到下表中的高频问题，先读对应 `references/demo-xx-*/index.js` 顶部注释与可运行骨架，再按需求改造。
4. **核实在线参考**：Demo 里的「在线参考」指向官方实现，细节存疑时以官方为准。
