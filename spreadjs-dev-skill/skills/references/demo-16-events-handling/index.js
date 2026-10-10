/**
 * 16 · 事件处理与批量监听
 * ------------------------------------------------------------------
 * 解决的问题：监听单元格/选区变化并响应；避免在批量写值时事件风暴拖慢性能。
 *
 * 关键 API：
 *   - sheet.bind(GC.Spread.Sheets.Events.CellChanged, (sender, args) => {...})
 *   - sheet.bind(GC.Spread.Sheets.Events.SelectionChanged, (sender, args) => {...})
 *   - spread.suspendEvent() / resumeEvent()   批量操作时暂停事件
 *
 * 常见事件参数：CellChanged 的 args 含 row/col/propertyName/newValue/oldValue。
 *
 * 注意事项：
 *   1) 短时间大量 setValue 会触发海量 CellChanged；批量时用 suspendEvent 包裹。
 *   2) 许多事件参数对象有 cancel 属性，置 true 可阻止默认行为。
 *
 * 在线参考：https://demo.grapecity.com.cn/spreadjs/help/docs/BestPractices/UsingsuspendEventandresumeEvent
 */
import { createShell, GC } from '../_shared/shell.js'

const { spread, log } = createShell({
  title: '16 · 事件处理与批量监听',
  controls: `
    <button id="writeGood">批量写 200 格（挂起事件）</button>
    <button id="writeBad">批量写 200 格（不挂起，事件风暴）</button>
  `
})

const sheet = spread.getActiveSheet()
const Events = GC.Spread.Sheets.Events
let firedCount = 0

// 监听单元格变化（在 Workbook 级别绑定，与官方示例一致）
spread.bind(Events.CellChanged, (s, args) => {
  log(`CellChanged [${args.row},${args.col}] propertyName=${args.propertyName}`)
  firedCount++
})
sheet.bind(Events.SelectionChanged, (s, args) => {
  const p = args.newSelections?.[0]
  if (p) log(`SelectionChanged → 行${p.row} 列${p.col} (${p.rowCount}×${p.colCount})`)
})

document.getElementById('writeGood').onclick = () => {
  firedCount = 0
  const t0 = performance.now()
  spread.suspendPaint(); spread.suspendEvent()
  for (let r = 0; r < 20; r++) for (let c = 0; c < 10; c++) sheet.setValue(r, c, r * 10 + c)
  spread.resumeEvent(); spread.resumePaint()
  log(`✅ 挂起事件：写 200 格，触发 CellChanged ${firedCount} 次，耗时 ${(performance.now() - t0).toFixed(0)}ms`)
}

document.getElementById('writeBad').onclick = () => {
  firedCount = 0
  const t0 = performance.now()
  for (let r = 0; r < 20; r++) for (let c = 0; c < 10; c++) sheet.setValue(r, c, r * 10 + c)
  log(`⚠️  不挂起：写 200 格，触发 CellChanged ${firedCount} 次，耗时 ${(performance.now() - t0).toFixed(0)}ms`)
}
