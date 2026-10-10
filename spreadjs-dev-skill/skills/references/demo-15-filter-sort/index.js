/**
 * 15 · 行筛选与排序
 * ------------------------------------------------------------------
 * 解决的问题：给数据区加列筛选器；用代码按某列升/降序排序（支持自定义比较函数）。
 *
 * 关键 API：
 *   - new GC.Spread.Sheets.Filter.HideRowFilter(range)
 *   - filter.addFilterItem(col, condition)        增加筛选条件
 *   - rowFilter.filter(col)                       应用筛选（addFilterItem 后必须调用才生效）
 *   - GC.Spread.Sheets.ConditionalFormatting.Condition(...)
 *   - sheet.rowFilter(filter)                     应用筛选器
 *   - sheet.sortRange(row,col,rowCount,colCount, byRows, [{index,ascending,compareFunction?}], sortOption?)
 *
 * 注意事项：
 *   1) 排序范围行号用 -1 表示「到最后一行/列」不适用，这里用实际行数。
 *   2) compareFunction 可实现中文拼音、自定义顺序排序；UI 排序可用 RangeSorting 事件注入。
 *
 * 在线参考：https://demo.grapecity.com.cn/spreadjs/help/docs/features/sort-data/sorting
 */
import { createShell, GC } from '../_shared/shell.js'

const { spread, log } = createShell({
  title: '15 · 行筛选与排序',
  controls: `
    <button id="filter">筛选：数量 > 50</button>
    <button id="sortAsc">按数量升序</button>
    <button id="sortDesc">按数量降序</button>
    <button id="reset">重置</button>
  `
})

const sheet = spread.getActiveSheet()
const data = [
  ['产品', '数量'],
  ['葡萄', 30], ['苹果', 80], ['橙子', 55], ['香蕉', 12], ['梨', 70]
]
sheet.setArray(0, 0, data)
const DATA_ROWS = data.length   // 含表头 6 行
const RANGE = new GC.Spread.Sheets.Range(0, 0, DATA_ROWS, 2)

document.getElementById('filter').onclick = () => {
  const filter = new GC.Spread.Sheets.Filter.HideRowFilter(RANGE)
  const cond = new GC.Spread.Sheets.ConditionalFormatting.Condition(
    GC.Spread.Sheets.ConditionalFormatting.ConditionType.numberCondition,
    { compareType: GC.Spread.Sheets.ConditionalFormatting.GeneralComparisonOperators.greaterThan, expected: 50 })
  sheet.rowFilter(filter)
  filter.addFilterItem(1, cond)   // 第 1 列（数量）条件：> 50
  filter.filter(1)                // 必须调用 filter(col) 才会真正应用筛选
  log('已筛选「数量 > 50」')
}

document.getElementById('sortAsc').onclick = () => {
  sheet.rowFilter(null)
  sheet.sortRange(1, 0, DATA_ROWS - 1, 2, true, [{ index: 1, ascending: true }])
  log('按数量升序排序')
}
document.getElementById('sortDesc').onclick = () => {
  sheet.rowFilter(null)
  sheet.sortRange(1, 0, DATA_ROWS - 1, 2, true, [{ index: 1, ascending: false }])
  log('按数量降序排序')
}
document.getElementById('reset').onclick = () => {
  sheet.rowFilter(null)
  sheet.setArray(0, 0, data)
  log('已重置为原始数据')
}
