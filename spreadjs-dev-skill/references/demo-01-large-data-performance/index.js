/**
 * 01 · 大数据加载与性能优化
 * ------------------------------------------------------------------
 * 解决的问题：向表格写入上万行数据时页面卡顿甚至崩溃。
 *
 * 关键 API：
 *   - spread.suspendPaint() / resumePaint()  暂停/恢复绘制（批量操作必备）
 *   - spread.suspendEvent() / resumeEvent()  暂停/恢复事件（避免海量 CellChanged）
 *   - sheet.setArray(row, col, 二维数组)      批量写值，远快于逐单元格 setValue
 *   - new GC.Spread.Sheets.Filter.HideRowFilter(range) + sheet.rowFilter()  行筛选
 *
 * 注意事项：
 *   1) suspend/resume 必须成对、平衡；顺序为 先 suspendPaint+suspendEvent，
 *      操作完成后 先 resumeEvent 再 resumePaint（一次性重绘）。
 *   2) 批量设样式时，对整列/整区设一次样式，不要在循环里逐单元格设。
 *   3) 对照按钮用「逐单元格 setValue 且不挂起」演示性能差异（行数已缩小，避免卡死）。
 *
 * 在线参考：https://demo.grapecity.com.cn/spreadjs/practice/data-binding/big-amount-data-load
 */
import { createShell, GC } from '../_shared/shell.js'

const { spread, log } = createShell({
  title: '01 · 大数据加载与性能优化',
  controls: `
    <button id="good">优化加载 5 万行（suspendPaint）</button>
    <button id="bad">逐单元格写 1 百行（对照）</button>
    <button id="clear">清空</button>
  `
})

const sheet = spread.getActiveSheet()

document.getElementById('good').onclick = () => {
  const rows = 50000, cols = 8
  const data = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => r * cols + c))

  const t0 = performance.now()
  spread.suspendPaint()
  spread.suspendEvent()
  sheet.setArray(0, 0, data)                       // 批量写值
  sheet.getRange(-1, 0, -1, cols).formatter('0')   // 整区设一次格式
  sheet.rowFilter(new GC.Spread.Sheets.Filter.HideRowFilter(
    new GC.Spread.Sheets.Range(-1, 0, -1, cols)))  // 行筛选
  spread.resumeEvent()
  spread.resumePaint()
  log(`✅ 优化方式加载 ${rows} 行 × ${cols} 列，耗时 ${(performance.now() - t0).toFixed(0)} ms`)
}

document.getElementById('bad').onclick = () => {
  const rows = 100, cols = 8
  const t0 = performance.now()
  // ❌ 反例：不挂起绘制/事件，且逐单元格写入，每次都触发重绘
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      sheet.setValue(r, c, r * cols + c)
    }
  }
  log(`⚠️  逐单元格写入 ${rows} 行 × ${cols} 列，耗时 ${(performance.now() - t0).toFixed(0)} ms（明显更慢）`)
}

document.getElementById('clear').onclick = () => {
  spread.suspendPaint()
  const rows = sheet.getRowCount(), cols = sheet.getColumnCount()
  sheet.setArray(0, 0,
    Array.from({ length: rows }, () => Array.from({ length: cols }, () => '')))
  sheet.rowFilter(null)
  spread.resumePaint()
  log('已清空')
}
