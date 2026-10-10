/**
 * 11 · 冻结行列与冻结线
 * ------------------------------------------------------------------
 * 解决的问题：滚动时让表头行/列或尾部行/列保持可见。
 *
 * 关键 API：
 *   - sheet.frozenRowCount(n) / frozenColumnCount(n)            顶部行 / 左侧列
 *   - sheet.frozenTrailingRowCount(n, stickToEdge?)             底部行
 *   - sheet.frozenTrailingColumnCount(n, stickToEdge?)          右侧列
 *   - sheet.options.frozenlineColor = 'rgb(...)'                冻结线颜色
 *
 * 注意事项：
 *   1) frozenRowCount 第二参数 topRow 可指定冻结起始行（默认第 0 行）。
 *   2) stickToEdge：true（默认）尾部冻结行始终贴边；false 滚动时可留白。
 *
 * 在线参考：https://demo.grapecity.com.cn/spreadjs/SpreadJSTutorial/features/worksheet/frozenline-viewport
 */
import { createShell } from '../_shared/shell.js'

const { spread, log } = createShell({
  title: '11 · 冻结行列与冻结线',
  controls: `
    <button id="freeze">冻结：顶 1 行 + 左 1 列 + 尾 1 行</button>
    <button id="clear">取消冻结</button>
  `
})

const sheet = spread.getActiveSheet()
sheet.options.gridline = { showVerticalGridline: true, showHorizontalGridline: true }

// 填充示例数据，便于观察滚动效果（使用 setArray + suspendPaint 提升性能）
spread.suspendPaint()
const data = []
for (let r = 0; r < 40; r++) {
  const row = []
  for (let c = 0; c < 12; c++) row.push(`R${r}C${c}`)
  data.push(row)
}
data[0][0] = '标题'
sheet.setArray(0, 0, data)
spread.resumePaint()

document.getElementById('freeze').onclick = () => {
  sheet.frozenRowCount(1)                       // 冻结顶部 1 行（表头）
  sheet.frozenColumnCount(1)                    // 冻结左侧 1 列
  sheet.frozenTrailingRowCount(1, false)        // 冻结底部 1 行（不贴边）
  sheet.frozenTrailingColumnCount(1, false)     // 冻结右侧 1 列
  sheet.options.frozenlineColor = 'rgb(51, 27, 208)'
  log('已冻结顶1行/左1列/尾1行/尾1列，冻结线蓝色')
}

document.getElementById('clear').onclick = () => {
  sheet.frozenRowCount(0); sheet.frozenColumnCount(0)
  sheet.frozenTrailingRowCount(0); sheet.frozenTrailingColumnCount(0)
  log('已取消全部冻结')
}
