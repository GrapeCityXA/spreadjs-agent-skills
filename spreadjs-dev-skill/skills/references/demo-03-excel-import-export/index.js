/**
 * 03 · Excel / SJS 导入导出
 * ------------------------------------------------------------------
 * 解决的问题：在浏览器端把工作簿导出为 xlsx/sjs，或导入 xlsx/sjs/ssjson。
 *
 * 关键 API（需引入 io 插件）：
 *   - spread.import(file, success, error, { fileType })   导入 xlsx/ssjson/csv
 *   - spread.export(success(blob), error, { fileType })   导出 xlsx/ssjson/csv
 *   - spread.open(file, success, error)                   打开 SJS 文件
 *   - spread.save(success(blob), error)                   保存为 SJS 文件
 *   - GC.Spread.Sheets.FileType.{excel, ssjson, csv}
 *
 * 注意事项：
 *   1) 自 v16 起 io 插件取代了旧版 excelIo；统一用 spread.import/export/open/save。
 *   2) 客户端导出的 xlsx 来自互联网，首次用 Excel 打开会提示「受保护视图」，属正常。
 *   3) 宏不会被保留：导出 xlsx/sjs/ssjson 时宏丢失，且无法在 SpreadJS 中执行宏。
 *   4) 超大文件优先用 SJS：加载更快、内存更省、体积更小。
 *
 * 在线参考：https://demo.grapecity.com.cn/spreadjs/help/docs/excelimpexp/excelclient
 */
import { createShell, GC } from '../_shared/shell.js'
import '@grapecity-software/spread-sheets-io'   // 启用 import/export/open/save
import { saveAs } from 'file-saver'

const { spread, log } = createShell({
  title: '03 · Excel / SJS 导入导出',
  controls: `
    <label>导入文件 <input type="file" id="file" accept=".xlsx,.xlsm,.ssjson,.sjs,.csv" /></label>
    <button id="imp">导入</button>
    <button id="expXlsx">导出 xlsx</button>
    <button id="expSjs">保存为 sjs</button>
  `
})

// 预置一些数据，方便直接测试导出
const sheet = spread.getActiveSheet()
sheet.setArray(0, 0, [
  ['产品', '季度', '销售额'],
  ['葡萄', 'Q1', 1200],
  ['苹果', 'Q1', 980],
  ['橙子', 'Q1', 1530]
])
sheet.setFormula(3, 2, '=SUM(C2:C4)')

const fileInput = document.getElementById('file')

document.getElementById('imp').onclick = () => {
  const file = fileInput.files[0]
  if (!file) return log('请先选择文件')
  const ext = file.name.split('.').pop().toLowerCase()

  const ok = () => log(`✅ 已导入 ${file.name}`)
  const err = (e) => log(`❌ 导入失败：${e?.message || e}`)

  if (ext === 'sjs') {
    spread.open(file, ok, err)                       // SJS 用 open
  } else if (ext === 'xlsx' || ext === 'xlsm') {
    spread.import(file, ok, err, { fileType: GC.Spread.Sheets.FileType.excel })
  } else if (ext === 'ssjson') {
    spread.import(file, ok, err, { fileType: GC.Spread.Sheets.FileType.ssjson })
  } else if (ext === 'csv') {
    spread.import(file, ok, err, { fileType: GC.Spread.Sheets.FileType.csv })
  } else {
    log('不支持的格式')
  }
}

document.getElementById('expXlsx').onclick = () => {
  spread.export(
    (blob) => { saveAs(blob, 'export.xlsx'); log('✅ 已导出 export.xlsx') },
    (e) => log(`❌ 导出失败：${e?.message || e}`),
    { fileType: GC.Spread.Sheets.FileType.excel }
  )
}

document.getElementById('expSjs').onclick = () => {
  spread.save(
    (blob) => { saveAs(blob, 'export.sjs'); log('✅ 已保存 export.sjs（SJS 体积更小、加载更快）') },
    (e) => log(`❌ 保存失败：${e?.message || e}`)
  )
}
