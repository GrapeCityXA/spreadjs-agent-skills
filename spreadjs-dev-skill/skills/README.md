# SpreadJS Dev Skill · Demo 工程

本目录是 SpreadJS「常见问题」Demo 集合，配合 `SKILL.md` 使用。所有 demo **共用一个 `node_modules`**（位于本目录根），不存在每个 demo 各装一份依赖的情况。

## 目录结构

```
spreadjs-skill/
├── SKILL.md                      # 技能说明：编码注意事项 + Demo 索引
├── package.json                  # 共享依赖（SpreadJS 全家桶 + vite + file-saver）
├── vite.config.js                # Vite 配置：bare import 向上解析到根 node_modules
├── references/
│   ├── index.html                # Demo 总览页（npm run dev 后自动打开）
│   ├── _shared/                  # 各 demo 共用的页面外壳与样式
│   │   ├── shell.js
│   │   └── shell.css
│   └── demo-01-large-data-performance/
│       ├── index.html
│       └── index.js
│   └── ...（共 20 个 demo）
```

## 运行方式

```bash
cd spreadjs-skill
npm install        # 只需一次，所有 demo 共享该 node_modules
npm run dev        # 启动 Vite，自动打开 http://localhost:5173/references/
```

在总览页点选任一 demo 进入；也可直接访问 `http://localhost:5173/references/<demo-folder>/`。

## 依赖与版本

- npm scope 固定为 `@grapecity-software`。
- 核心 demo（01–20）按需引入插件：只有相关 demo 才会 `import '@grapecity-software/spread-sheets-io'` 等；核心包由 `references/_shared/shell.js` 统一引入。
- **Designer demo（21–24）是重型集成**：`references/_shared/designerShell.js` 会一次性引入 Designer 初始化所需的全部插件（shapes/charts/print/pdf/barcode/slicers/formula-panel/tablesheet/languagepackages/io 等）+ 中文资源 + designer 主包，并按正确顺序排列。因此 `package.json` 的依赖是「完整 Designer 可用」的全集，而非最小集。详见 `SKILL.md` 第 1.1 节。
- `package.json` 中所有依赖锁定为**精确版本**（不带 `^` / `~`）：SpreadJS 全套当前为 `19.1.4`，第三方包 `file-saver@2.0.5`、`vite@8.2.0`。升级时先 `npm view @grapecity-software/spread-sheets version` 查最新版，再把所有 `@grapecity-software/*` 的版本号整体替换为同一值（必须保持一致）。原因见 `SKILL.md` 第 1 节。
- 若已购买授权，在 `references/_shared/shell.js` 中设置 `GC.Spread.Sheets.LicenseKey`（Designer 还需 `GC.Spread.Sheets.Designer.LicenseKey`）可移除评估水印。
- 图表/形状 demo 需要 `shapes`（先）+ `charts`（后）两个插件；PDF demo 需要 `print`（先）+ `pdf`（后）。

## 单个 demo 的代码约定

每个 `index.js` 顶部注释包含：**解决的问题 / 关键 API / 注意事项 / 在线参考**，便于脱离文档单独阅读。
