/**
 * 09 · 单元格样式 / 边框 / 数字格式
 * ------------------------------------------------------------------
 * 解决的问题：批量、一致地设置背景色、字体、对齐、边框与数字/日期格式。
 *
 * 关键 API：
 *   - new GC.Spread.Sheets.Style()                    创建可复用的样式对象
 *     style.backColor / foreColor / font / hAlign / vAlign
 *     style.borderLeft = new GC.Spread.Sheets.LineBorder(color, lineStyle)
 *   - sheet.setStyle(row, col, style) / sheet.setStyleName(row,col,name)
 *   - sheet.getRange(...).formatter('¥#,##0.00')      数字/日期格式
 *
 * 注意事项：
 *   1) 复用同一个 Style 对象批量 setStyle，性能远好于每格 new 一个。
 *   2) 大批量设样式务必在 suspendPaint/resumePaint 之间进行。
 *   3) 数字格式符与 Excel 自定义格式一致：#,##0.00 / 0.00% / yyyy-mm-dd 等。
 *
 * 在线参考：https://demo.grapecity.com.cn/spreadjs/help/docs/features/cells/cellspan
 */
import { createShell, GC } from '../_shared/shell.js'

const { spread, log } = createShell({
  title: '09 · 单元格样式与数字格式'
})

const sheet = spread.getActiveSheet()
spread.suspendPaint()

// 1) 表头样式（复用对象）
const headerStyle = new GC.Spread.Sheets.Style()
headerStyle.backColor = '#4f46e5'
headerStyle.foreColor = '#ffffff'
headerStyle.font = 'bold 13px Segoe UI'
headerStyle.hAlign = GC.Spread.Sheets.HorizontalAlign.center
headerStyle.vAlign = GC.Spread.Sheets.VerticalAlign.center

// 2) 带边框的数据样式
const bd = new GC.Spread.Sheets.LineBorder('#006aff', GC.Spread.Sheets.LineStyle.thin)
const cellStyle = new GC.Spread.Sheets.Style()
cellStyle.borderLeft = bd; cellStyle.borderRight = bd
cellStyle.borderTop = bd; cellStyle.borderBottom = bd

// 3) 金额样式（继承边框 + 数字格式）
const moneyStyle = new GC.Spread.Sheets.Style()
moneyStyle.formatter = '¥#,##0.00'
moneyStyle.hAlign = GC.Spread.Sheets.HorizontalAlign.right
moneyStyle.borderLeft = bd; moneyStyle.borderRight = bd
moneyStyle.borderTop = bd; moneyStyle.borderBottom = bd

const headers = ['产品', '单价', '数量', '金额']
const rows = [
  ['葡萄', 12.5, 30],
  ['苹果', 8.8, 50],
  ['橙子', 6.0, 80]
]

sheet.setArray(0, 0, [headers])
sheet.getRange(0, 0, 1, headers.length).setStyle(headerStyle)

rows.forEach((r, i) => {
  const row = i + 1
  sheet.setValue(row, 0, r[0])
  sheet.setValue(row, 1, r[1])
  sheet.setValue(row, 2, r[2])
  sheet.setFormula(row, 3, `=B${row + 1}*C${row + 1}`)
})

// 先对整个数据区应用边框，再对金额列叠加数字格式样式
sheet.getRange(0, 0, rows.length + 1, headers.length).setStyle(cellStyle)
sheet.getRange(1, 1, rows.length, 1).setStyle(moneyStyle)
sheet.getRange(1, 3, rows.length, 1).setStyle(moneyStyle)
sheet.setColumnWidth(0, 120)
spread.resumePaint()
log('已设置表头、金额格式（¥#,##0.00）、公式列与边框')
