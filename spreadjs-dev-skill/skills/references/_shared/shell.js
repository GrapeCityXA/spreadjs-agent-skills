// 各 Demo 共用的页面外壳与 SpreadJS 初始化。
// 只引入「核心包 + 默认主题 CSS」；需要插件（io/print/pdf/shapes/charts）的 demo
// 在各自 index.js 里再按需 side-effect import。
import * as GC from '@grapecity-software/spread-sheets'
import '@grapecity-software/spread-sheets/styles/gc.spread.sheets.excel2013white.css'
import './shell.css'

// 如已购买授权，取消下一行注释并填入 LicenseKey，可移除评估水印
// GC.Spread.Sheets.LicenseKey = ''

export { GC }

/**
 * 创建一个通用的 Demo 外壳：标题栏 + 操作区 + 表格宿主 + 日志区。
 * @param {{ title?: string, controls?: string, hostStyle?: string }} [opts]
 * @returns {{ spread: GC.Spread.Sheets.Workbook, host: HTMLElement, log: (...args: any[]) => void }}
 */
export function createShell(opts = {}) {
  const { title = 'SpreadJS Demo', controls = '', hostStyle = '' } = opts
  const app = document.getElementById('app')
  app.innerHTML = `
    <section class="demo">
      <header class="demo__bar"><h1>${title}</h1></header>
      ${controls ? `<div class="demo__controls">${controls}</div>` : ''}
      <div class="demo__host" id="host" style="${hostStyle}"></div>
      <pre class="demo__log" id="log" hidden></pre>
    </section>`

  const host = document.getElementById('host')
  const spread = new GC.Spread.Sheets.Workbook(host, { sheetCount: 1 })

  const logEl = document.getElementById('log')
  const log = (...args) => {
    logEl.hidden = false
    logEl.textContent += args
      .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
      .join(' ') + '\n'
  }
  return { spread, host, log }
}
