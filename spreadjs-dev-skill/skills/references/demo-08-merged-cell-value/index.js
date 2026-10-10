/**
 * 08 · 合并单元格取值
 * ------------------------------------------------------------------
 * 解决的问题：合并单元格区域中只有「左上角」存储值，直接 getValue() 访问区域内的
 *             其它单元格会得到 null。
 *
 * 关键 API：
 *   - sheet.addSpan(row, col, rowCount, colCount)   合并
 *   - sheet.getSpan(row, col)                       命中合并区则返回 {row,col,rowCount,colCount}，否则 null
 *   - sheet.getValue(row, col)
 *
 * 注意事项：
 *   1) 合并后值只在左上角；遍历/导出时要先用 getSpan 判断，命中则取左上角。
 *   2) addSpans([...]) 可一次性合并多个区域。
 *
 * 在线参考：https://demo.grapecity.com.cn/spreadjs/practice/format-style/get-merged-cell-value
 */
import { createShell } from '../_shared/shell.js'

const { spread, log } = createShell({
  title: '08 · 合并单元格取值',
  controls: `
    <label>行 <input id="row" type="number" value="2" style="width:60px" /></label>
    <label>列 <input id="col" type="number" value="3" style="width:60px" /></label>
    <button id="get">取该单元格实际值</button>
  `
})

const sheet = spread.getActiveSheet()
sheet.addSpan(0, 0, 5, 5)      // 合并区 1：左上角 (0,0)
sheet.setText(0, 0, 'grapecity')
sheet.getCell(0, 0).backColor('#dbeafe')
sheet.addSpan(7, 7, 2, 2)      // 合并区 2：左上角 (7,7)
sheet.setText(7, 7, 'spreadjs')
sheet.getCell(7, 7).backColor('#fef9c3')

// 通用取值：自动处理合并区域
function getMergedValue(sheet, row, col) {
  const span = sheet.getSpan(row, col)
  return span ? sheet.getValue(span.row, span.col) : sheet.getValue(row, col)
}

document.getElementById('get').onclick = () => {
  const row = Number(document.getElementById('row').value)
  const col = Number(document.getElementById('col').value)
  const span = sheet.getSpan(row, col)
  const v = getMergedValue(sheet, row, col)
  log(`(${row}, ${col}) ${span ? `在合并区内，左上角 (${span.row},${span.col})` : '非合并区'} → 值 = ${v}`)
}
