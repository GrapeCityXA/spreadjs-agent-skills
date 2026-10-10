// Designer Demo 共用外壳：引入 Designer 组件 + Designer 初始化所需的全部 SpreadJS 插件 + 中文资源 + 主题 CSS。
// 与 shell.js（核心 Workbook）不同：这里初始化的是设计器，故单独一个 helper。
//
// 重要：Designer 在初始化时会查找下列插件，缺失会报错，故必须全部在 designer 主包之前按顺序引入：
//   核心 → 插件（shapes→charts→slicers，print→pdf）→ 资源包 → designer 主包。
// 资源包必须先于 designer 主包；电子表格引用必须先于 designer 引用。
import * as GC from '@grapecity-software/spread-sheets'
import '@grapecity-software/spread-sheets/styles/gc.spread.sheets.excel2013white.css'

// —— Designer 必需插件（初始化期）——
import '@grapecity-software/spread-sheets-shapes'        // 形状（charts/slicers 的前置）
import '@grapecity-software/spread-sheets-charts'        // 图表
import '@grapecity-software/spread-sheets-slicers'       // 切片器
import '@grapecity-software/spread-sheets-print'         // 打印（pdf 的前置）
import '@grapecity-software/spread-sheets-pdf'           // PDF
import '@grapecity-software/spread-sheets-barcode'       // 条形码/二维码
import '@grapecity-software/spread-sheets-formula-panel' // 公式面板
import '@grapecity-software/spread-sheets-tablesheet'    // 数据工作表
import '@grapecity-software/spread-sheets-languagepackages' // 本地化公式/函数名
import '@grapecity-software/spread-sheets-io'            // 导入导出（取代已弃用的 excelio）

// —— 常见补充：让 Ribbon 的高级数据工作表标签可用（按需）——
import '@grapecity-software/spread-sheets-pivot-addon'      // 数据透视表
import '@grapecity-software/spread-sheets-ganttsheet'       // 甘特图工作表
import '@grapecity-software/spread-sheets-reportsheet-addon'// 报表工作表
import '@grapecity-software/spread-sheets-datacharts-addon' // 数据图表

// —— 中文资源必须先于 designer 主包引入 ——
import '@grapecity-software/spread-sheets-designer-resources-cn'
import '@grapecity-software/spread-sheets-designer'                 // 启用 GC.Spread.Sheets.Designer.*
import '@grapecity-software/spread-sheets-designer/styles/gc.spread.sheets.designer.min.css'
import './shell.css'

// 上面的 designer import 会把 GC.Spread.Sheets.Designer 挂载到核心命名空间
export { GC }

/**
 * 创建 Designer Demo 外壳：标题栏 + 操作区 + 设计器宿主 + 日志区。
 * 设计器含 Ribbon/公式栏/工作表，宿主需更高，默认 620px。
 * @param {{ title?: string, controls?: string }} [opts]
 * @returns {{ host: HTMLElement, log: (...args: any[]) => void }}
 */
export function createDesignerShell(opts = {}) {
  const { title = 'SpreadJS Designer Demo', controls = '' } = opts
  const app = document.getElementById('app')
  app.innerHTML = `
    <section class="demo">
      <header class="demo__bar"><h1>${title}</h1></header>
      ${controls ? `<div class="demo__controls">${controls}</div>` : ''}
      <div class="demo__host" id="host" style="height:620px"></div>
      <pre class="demo__log" id="log" hidden></pre>
    </section>`

  const host = document.getElementById('host')
  const logEl = document.getElementById('log')
  const log = (...args) => {
    logEl.hidden = false
    logEl.textContent += args
      .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
      .join(' ') + '\n'
  }
  return { host, log }
}
