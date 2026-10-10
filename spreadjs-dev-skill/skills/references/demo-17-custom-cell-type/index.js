/**
 * 17 · 自定义单元格类型（CellType）
 * ------------------------------------------------------------------
 * 解决的问题：在单元格里画非文本内容（如五角星评分），并响应点击切换状态。
 *
 * 关键 API：
 *   - 继承 GC.Spread.Sheets.CellTypes.Base
 *   - 重写 paint(ctx, value, x, y, w, h, style, context)        自定义绘制
 *   - 重写 getHitInfo(...) / processMouseUp(hitInfo)            命中测试与点击
 *   - getRange(row,col,rowCount,colCount).cellType(new XxxCellType())  应用类型
 *
 * 注意事项：
 *   1) 编辑器用 createEditorElement + setEditorValue + getEditorValue 自定义（本例仅展示+点击）。
 *   2) 通过 commandManager().execute({cmd:'editCell',...}) 改值，才能纳入撤销栈。
 *
 * 在线参考：https://demo.grapecity.com.cn/spreadjs/help/docs/features/cells/celltypes/cellcustom
 */
import { createShell, GC } from '../_shared/shell.js'

const { spread, log } = createShell({
  title: '17 · 自定义单元格类型（点击五角星切换）'
})

// 定义「五角星」单元格类型
function StarCellType() { this.size = 12; this.onColor = '#f59e0b'; this.offColor = '#cbd5e1' }
StarCellType.prototype = new GC.Spread.Sheets.CellTypes.Base()

StarCellType.prototype.paint = function (ctx, value, x, y, w, h, style, context) {
  if (!ctx) return
  ctx.save()
  ctx.rect(x, y, w, h); ctx.clip()
  ctx.fillStyle = value ? this.onColor : this.offColor
  const cx = x + w / 2, cy = y + h / 2, size = this.size, dig = Math.PI / 5 * 4
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    ctx.lineTo(cx + Math.sin(i * dig) * size, cy - Math.cos(i * dig) * size)
  }
  ctx.closePath(); ctx.fill()
  ctx.restore()
}

// 命中：点击落在星星范围内
StarCellType.prototype.getHitInfo = function (x, y, cellStyle, cellRect, context) {
  const cx = cellRect.x + cellRect.width / 2, cy = cellRect.y + cellRect.height / 2, size = this.size + 6
  const info = { x, y, row: context.row, col: context.col, cellRect, sheetArea: context.sheetArea, isReservedLocation: false }
  if (cx - size <= x && x <= cx + size && cy - size <= y && y <= cy + size) info.isReservedLocation = true
  return info
}

// 点击切换 true/false
StarCellType.prototype.processMouseUp = function (hitInfo) {
  const sheet = hitInfo.sheet
  if (sheet && hitInfo.isReservedLocation) {
    const cur = sheet.getValue(hitInfo.row, hitInfo.col, hitInfo.sheetArea)
    sheet.getParent().commandManager().execute({
      cmd: 'editCell', sheetName: sheet.name(),
      row: hitInfo.row, col: hitInfo.col, newValue: !cur
    })
    log(`切换 (${hitInfo.row},${hitInfo.col}) → ${!cur}`)
    return true
  }
  return false
}

// 应用到 A1:A5，行高调大便于点击
const sheet = spread.getActiveSheet()
sheet.getRange(0, 0, 5, 1).cellType(new StarCellType())
sheet.getRange(0, 0, 5, 1).value(false)
for (let r = 0; r < 5; r++) sheet.setRowHeight(r, 40)
sheet.setColumnWidth(0, 80)
log('点击 A1:A5 中的五角星可切换开/关状态')
