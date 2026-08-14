/**
 * 05 · 打印与 PDF 导出
 * ------------------------------------------------------------------
 * 解决的问题：把工作簿打印或导出为 PDF。
 *
 * 依赖：必须「先 print 再 pdf」引入两个插件：
 *   import '@grapecity-software/spread-sheets-print'
 *   import '@grapecity-software/spread-sheets-pdf'
 *
 * 关键 API：
 *   - spread.print(sheetIndex?, printInfo?)           调起浏览器打印
 *   - spread.savePDF(success(blob), error, options?, sheetIndex?)  导出 PDF
 *   - sheet.printInfo() / new GC.Spread.Sheets.Print.PrintInfo()   页面/打印设置
 *
 * 注意事项：
 *   1) PDF 仅内嵌 14 种标准字体（Courier/Times/Helvetica…）；中文或自定义字体
 *      需用 GC.Spread.Sheets.PDF.PDFFontsManager.registerFont(name, {normal: ArrayBuffer})
 *      注册 .ttf/.otf（不支持 .ttf 之外的 .ttc，需先转换）。fallbackFont 可做字体兜底。
 *   2) printInfo 可设置方向、纸张、边距、是否显示网格线/边框、缩放等。
 *   3) 来源为 URL 的图片不会自动转 base64，导出 PDF 时可能丢失。
 *
 * 在线参考：https://demo.grapecity.com.cn/spreadjs/help/docs/excelimpexp/ExportingToPDF
 */
import { createShell, GC } from '../_shared/shell.js'
import '@grapecity-software/spread-sheets-print'   // 必须先于 pdf
import '@grapecity-software/spread-sheets-pdf'
import { saveAs } from 'file-saver'

const { spread, log } = createShell({
  title: '05 · 打印与 PDF 导出',
  controls: `
    <button id="print">打印</button>
    <button id="pdf">导出 PDF</button>
    <label><input type="checkbox" id="landscape" checked /> 横向</label>
  `
})

const sheet = spread.getActiveSheet()
const chineseFont = { normal: null, bold: null }
const fontReady = fetch('./static/simhei.ttf')
  .then((response) => {
    if (!response.ok) throw new Error(`中文字体加载失败：${response.status}`)
    return response.arrayBuffer()
  })
  .then((fontData) => {
    chineseFont.normal = fontData
    chineseFont.bold = fontData
    GC.Spread.Sheets.PDF.PDFFontsManager.registerFont('SimHei', chineseFont)
    GC.Spread.Sheets.PDF.PDFFontsManager.fallbackFont = () => chineseFont.normal
    const style = new GC.Spread.Sheets.Style()
    style.font = '12px SimHei'
    sheet.getRange(0, 0, 4, 6).setStyle(style)
  })

sheet.setArray(0, 0, [
  ['地区', 'Q1', 'Q2', 'Q3', 'Q4', '合计'],
  ['华北', 120, 150, 170, 200, null],
  ['华东', 220, 260, 300, 340, null],
  ['华南', 180, 210, 240, 280, null]
])
for (let r = 1; r <= 3; r++) sheet.setFormula(r, 5, `=SUM(B${r + 1}:E${r + 1})`)

// 配置打印信息：横向、A4、显示边框，重复显示标题行
const applyPrintInfo = () => {
  const pi = new GC.Spread.Sheets.Print.PrintInfo()
  pi.bestFitColumns(true)
  pi.orientation(document.getElementById('landscape').checked
    ? GC.Spread.Sheets.Print.PrintPageOrientation.landscape
    : GC.Spread.Sheets.Print.PrintPageOrientation.portrait)
  pi.showRowHeader(GC.Spread.Sheets.Print.PrintVisibilityType.hide)
  pi.showColumnHeader(GC.Spread.Sheets.Print.PrintVisibilityType.hide)
  sheet.printInfo(pi)
}
applyPrintInfo()

document.getElementById('print').onclick = () => {
  applyPrintInfo()
  spread.print()   // 调起浏览器打印对话框
  log('已调起打印')
}

document.getElementById('pdf').onclick = () => {
  fontReady.then(() => {
    applyPrintInfo()
    spread.savePDF(
      (blob) => { saveAs(blob, 'spreadjs.pdf'); log('PDF 已导出（已注册 SimHei 中文字体）') },
      (e) => log(`PDF 导出失败：${e?.message || e}`),
      { title: '销售汇总', creator: 'SpreadJS Skill' }
    )
  }).catch((e) => log(`PDF 导出前字体注册失败：${e.message}`))
}
