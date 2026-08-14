/**
 * 10 · 条件格式
 * ------------------------------------------------------------------
 * 解决的问题：按单元格值或公式结果，自动改变样式（如标红、图标集、数据条）。
 *
 * 关键 API（均在 sheet.conditionalFormats 上）：
 *   - addCellValueRule(operator, v1, v2, style, ranges)
 *   - addFormulaRule(formula, style, ranges)
 *   - addIconSetRule(iconSetType, ranges)
 *   - add2ScaleRule / add3ScaleRule / addDataBarRule …
 *
 * 注意事项：
 *   1) 样式用 GC.Spread.Sheets.Style；ranges 是 Range[]。
 *   2) 运算符用 GC.Spread.Sheets.ConditionalFormatting.ComparisonOperators
 *      （between / greaterThan / lessThan …）。
 *   3) 公式规则的公式以 = 开头，返回 true 时应用样式。
 *
 * 在线参考：https://demo.grapecity.com.cn/spreadjs/help/docs/features/condformat/formularule
 */
import { createShell, GC } from '../_shared/shell.js'

const { spread, log } = createShell({
  title: '10 · 条件格式',
  controls: `<span class="d">B 列根据相对数字大小显示箭头；BC 列 > 80 标红；D列 > 150 标蓝；</span>`
})

const sheet = spread.getActiveSheet()
const CF = GC.Spread.Sheets.ConditionalFormatting
const Cmp = CF.ComparisonOperators

// 示例数据
sheet.setArray(0, 0, [
  ['地区', 'Q1', 'Q2', '合计'],
  ['华北', 60, 90, null],
  ['华东', 70, 85, null],
  ['华南', 40, 55, null]
])
for (let r = 1; r <= 3; r++) sheet.setFormula(r, 3, `=B${r + 1}+C${r + 1}`)

// 1) 单元格值规则：数值区 B2:C4 中 > 80 标红
const red = new GC.Spread.Sheets.Style()
red.backColor = '#fee2e2'; red.foreColor = '#b91c1c'
sheet.conditionalFormats.addCellValueRule(
  Cmp.greaterThan, 80, null, red,
  [new GC.Spread.Sheets.Range(1, 1, 3, 2)]
)

// 2) 公式规则：合计列 >= 150 标蓝
const blue = new GC.Spread.Sheets.Style()
blue.backColor = '#dbeafe'; blue.foreColor = '#1d4ed8'; blue.font = 'bold 12px Segoe UI'
sheet.conditionalFormats.addFormulaRule(
  '=D2>=150', blue,
  [new GC.Spread.Sheets.Range(1, 3, 3, 1)]
)

// 3) 图标集规则：Q1 列加红绿灯
sheet.conditionalFormats.addIconSetRule(
  CF.IconSetType.threeTrafficLights1,
  [new GC.Spread.Sheets.Range(1, 1, 3, 1)]
)
