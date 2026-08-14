/**
 * 19 · 形状与图表（Shapes / Charts）
 * ------------------------------------------------------------------
 * 解决的问题：在工作表上添加柱状图、饼图，并配置标题、图例、数据标签。
 *
 * 依赖（顺序很重要）：先 shapes 再 charts
 *   import '@grapecity-software/spread-sheets-shapes'
 *   import '@grapecity-software/spread-sheets-charts'
 *
 * 关键 API：
 *   - sheet.charts.add(name, chartType, x, y, w, h, dataRange, dataOrientation?, colorScheme?)
 *   - GC.Spread.Sheets.Charts.ChartType.{columnClustered, pie, line, ...}
 *   - chart.title() / chart.legend() / chart.dataLabels()
 *
 * 注意事项：
 *   1) charts/slicers 都依赖 shapes，导入顺序：shapes → charts（→ slicers）。
 *   2) dataRange 用 A1 样式字符串，如 "A1:D4"。
 *   3) dataOrientation 指系列按行还是按列。
 *
 * 在线参考：https://demo.grapecity.com.cn/spreadjs/help/docs/features/Charts/ChartTypes/CreatingPieChart
 */
import { createShell, GC } from '../_shared/shell.js'
import '@grapecity-software/spread-sheets-shapes'   // 必须先于 charts
import '@grapecity-software/spread-sheets-charts'

const { spread, log } = createShell({
  title: '19 · 形状与图表',
  controls: `
    <button id="addCol">添加柱状图</button>
    <button id="addPie">添加饼图</button>
  `
})

const sheet = spread.getActiveSheet()
const CT = GC.Spread.Sheets.Charts.ChartType

// 示例数据（含表头），图表数据范围 A1:B5
sheet.setArray(0, 0, [
  ['产品', '销售额'],
  ['葡萄', 1200],
  ['苹果', 980],
  ['橙子', 1530],
  ['香蕉', 760]
])

document.getElementById('addCol').onclick = () => {
  const chart = sheet.charts.add('colChart', CT.columnClustered, 220, 20, 420, 280, 'A1:B5')
  const title = chart.title(); title.text = '各产品销售额（柱状图）'; chart.title(title)
  chart.legend({ position: GC.Spread.Sheets.Charts.LegendPosition.bottom })
  log('已添加柱状图')
}

document.getElementById('addPie').onclick = () => {
  const chart = sheet.charts.add('pieChart', CT.pie, 220, 320, 420, 280, 'A1:B5')
  const title = chart.title(); title.text = '销售额占比（饼图）'; chart.title(title)
  const dl = chart.dataLabels()
  dl.showValue = true; dl.showPercentage = true; dl.format = '0.0%'
  chart.dataLabels(dl)
  chart.legend({ position: GC.Spread.Sheets.Charts.LegendPosition.right })
  log('已添加饼图（显示百分比）')
}
