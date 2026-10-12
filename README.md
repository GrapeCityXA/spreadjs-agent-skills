# GrapeCity SpreadJS · Agent Skills

面向 AI Agent 的葡萄城 SpreadJS 技能集合。本仓库同时扮演两个角色：

- **Codex 插件市场**（marketplace）——Codex 用户从这里安装插件；
- **Skill 仓库**——`npx skills` 及其他支持 Agent Skills 开放标准的工具可直接从这里安装技能。

三个技能都围绕**在浏览器里用 SpreadJS 在线编辑表格**这一件事展开：把表格数据交给用户在一个带完整 Ribbon 工具栏的 Excel 式界面里编辑，比 Agent 直接输出文本或 JSON 更实用。

## 包含的技能

| 技能 | 中文名 | 分类 | 一句话 |
| --- | --- | --- | --- |
| `online-excel-editor` | 在线表格编辑 | 办公 | 在线打开/编辑 Excel、CSV，或生成可填写的网格表单 |
| `web-data-extractor-skill` | 提取网页数据到表格 | 办公 | 把网页数据提取进可在线编辑的表格 |
| `spreadjs-dev-skill` | SpreadJS 开发 Skill | 编码 | 编写、调试、审查 SpreadJS 前端代码 |

### 在线表格编辑 · `online-excel-editor`

处理用户提供的 Excel、CSV 或表格文件（本地路径或附件），生成一个内嵌 SpreadJS 设计器的在线编辑页，用户编辑后回传填好的 xlsx 与修改摘要。

也可以反过来用：按 Agent 给出的表单定义，生成一张**可填写的网格表单**逐行采集结构化记录。字段类型支持文本 / 数字 / 下拉 / 复选框 / 日期，可设必填校验。适合排班值班、活动报名、会议签到、请假考勤、费用报销、物资领用、库存盘点、设备巡检、问卷调研等登记类场景。

### 提取网页数据到表格 · `web-data-extractor-skill`

把网页数据送进同一个在线编辑页。编辑页会自动套用样式（表头、边框、隔行底色、行高列宽自适应、冻结表头），并按数据自动生成一张独立的「图表」工作表；也可以用 `--chart-config` 指定要画哪些列、用哪种图型（柱状 / 条形 / 折线 / 饼图）。

数据来源三选一：

- **内置提取**——自动识别表格 / 列表 / 定义列表 / 重复卡片，可用 `--type`、`--selector` 精确指定；
- **`--data`**——Agent 自行取数后把二维数组交给本技能进入在线编辑；
- **`--cdp`**——连接用户**已登录**的浏览器读取渲染后的页面，登录态、JS 渲染、SPA 一次解决。

### SpreadJS 开发 Skill · `spreadjs-dev-skill`

面向开发者的编码助手：编写、调试、审查 SpreadJS 前端电子表格代码。覆盖工作簿 / 工作表 / 单元格、数据绑定、公式与自定义函数、Excel / CSV / SJS 导入导出、样式与条件格式、图表与形状、筛选排序、打印与 PDF、设计器 Designer，以及 React / Vue / Angular 集成。

附 24 个可运行 Demo，位于 `spreadjs-dev-skill/skills/references/`，覆盖大数据加载、单元格绑定、条件格式、自定义单元格类型、Designer 定制 Ribbon 与右键菜单等高频场景。

## 安装

### 方式一：Codex 命令行

先把本仓库注册为插件市场（只需一次）：

```bash
codex plugin marketplace add https://github.com/GrapeCityXA/spreadjs-agent-skills
```

再从市场里安装需要的插件：

```bash
codex plugin add online-excel-editor@grapecity-spreadjs
codex plugin add web-data-extractor-skill@grapecity-spreadjs
codex plugin add spreadjs-dev-skill@grapecity-spreadjs
```

> **注意**：`@` 后面是**市场名**，取自 `.agents/plugins/marketplace.json` 的 `name` 字段，即 `grapecity-spreadjs`，**不是**仓库名 `spreadjs-agent-skills`。

安装完成后技能会在下一轮对话生效。在 Codex 里输入 `/skills` 可以查看当前可用的技能列表。

已安装的插件可以用以下命令查看和管理：

```bash
codex plugin list
codex plugin remove online-excel-editor@grapecity-spreadjs
codex plugin marketplace upgrade      # 刷新市场快照，获取仓库更新
```

### 方式二：Codex 桌面应用（图形界面）

如果你用的是 Codex 桌面应用，全程点鼠标即可，不必敲命令：

1. 打开 Codex 桌面应用，进入 **Plugins → Manage**
2. 切到 **Marketplace** 标签页，点 **Add**
3. 在 **Add plugin marketplace** 对话框里填写：
   - **Source**：`GrapeCityXA/spreadjs-agent-skills`
   - **Git ref**：留空（用默认分支 `master`）
   - **Sparse paths**：留空
4. 点 **Add marketplace** 提交
5. 切到 **Plugins** 标签页，找到 `在线表格编辑`、`提取网页数据到表格`、`SpreadJS 开发 Skill`，逐个点 **Install plugin**
6. 安装完成后，技能会出现在 **Skills** 标签页的 **My Skills** 分区里

> **Source** 一栏接受 `owner/repo` 简写、完整 Git URL 或本地文件夹路径。上面这些界面文案取自应用内置的多语言字符串表，不同版本的措辞可能略有出入。

### 方式三：npx skills

不经市场，直接从本仓库安装全部三个技能：

```bash
npx skills add https://github.com/GrapeCityXA/spreadjs-agent-skills
```

只装其中一个：

```bash
npx skills add https://github.com/GrapeCityXA/spreadjs-agent-skills --skill online-excel-editor
```

先看看仓库里有哪些技能（不安装）：

```bash
npx skills add https://github.com/GrapeCityXA/spreadjs-agent-skills -l
```

`npx skills` 是递归扫描 `SKILL.md` 的，本仓库的技能位于 `skills/` 子目录下，会被正常识别。它会根据环境把技能装到对应 Agent 的技能目录（Codex、Claude Code、Cursor 等多种 Agent 一并支持）。

## 仓库结构

```
spreadjs-agent-skills/                    # 仓库根 = Codex 插件市场根
├── README.md
├── .agents/plugins/marketplace.json      # 市场清单：声明有哪些插件、各自从哪来
├── online-excel-editor/                  # 一个插件（= 一个 Codex 插件）
│   ├── .codex-plugin/plugin.json         # 插件清单，声明技能目录
│   └── skills/                           # 技能内容（SKILL.md、脚本、模板等）
├── web-data-extractor-skill/
│   ├── .codex-plugin/plugin.json
│   └── skills/
└── spreadjs-dev-skill/
    ├── .codex-plugin/plugin.json
    └── skills/                           # 含 references/ —— 24 个 Demo
```

## 相关概念

Codex 的插件体系是三层，与其他 Agent 略有不同：

| 层 | 作用 | 文件 |
| --- | --- | --- |
| 市场 marketplace | 「有哪些插件、从哪来」 | `.agents/plugins/marketplace.json` |
| 插件 plugin | 「这个插件是什么」 | `<插件>/.codex-plugin/plugin.json` |
| 技能 skill | 「具体怎么工作」 | `<插件>/skills/SKILL.md` |

也就是说，**Codex 里插件是安装单位，技能是插件的产物**。一个插件可以包含多个技能，也可以包含 MCP server（`.mcp.json`）、hooks 等成分——本仓库三个插件都只包含技能。

而 `npx skills` 没有市场和插件这两层，直接从仓库里扫描 `SKILL.md`，**技能就是安装单位**。

## 许可

各技能目录内如无特别说明，代码与文档版权归 GrapeCity 所有。
