/**
 * 07 · 表格（Table）绑定与动态数据源：替换 / 追加
 * ------------------------------------------------------------------
 * 解决的问题：把数组绑定到 Table；之后整体替换数据源或向数组追加记录，
 *             让表格自动扩展行并重算公式列。
 *
 * 关键 API：
 *   - sheet.tables.add(name, row, col, rowCount, colCount, theme)
 *   - table.autoGenerateColumns(false)                 关闭自动生成，手动配列
 *   - new GC.Spread.Sheets.Tables.TableColumn(); col.name(...).dataField(...)
 *   - table.bindColumns([...])                         绑定列
 *   - table.bindingPath('arrKey')                      绑定到数据源中的数组字段
 *   - table.setColumnDataFormula(i, '=[@列1]+[@列2]')  数据行公式（结构化引用）
 *   - table.setColumnFormula(i, '=SUBTOTAL(109,[合计])') 页脚汇总公式
 *   - new GC.Spread.Sheets.Bindings.CellBindingSource(data) + sheet.setDataSource(source)
 *
 * 注意事项：
 *   1) 先 autoGenerateColumns(false) 再 bindColumns，否则会按数据自动建列。
 *   2) 替换/追加数据后，重新调用 table.bindingPath(path) 触发刷新（或重新 setDataSource）。
 *   3) 结构化引用 [@列名] 表示「当前行的该列」。
 *
 * 在线参考：https://demo.grapecity.com.cn/spreadjs/practice/data-binding/change-datasource-append-data
 */
import { createShell, GC } from '../_shared/shell.js'

const { spread, log } = createShell({
  title: '07 · 表格绑定与动态数据源',
  controls: `
    <button id="replace">替换数据源</button>
    <button id="append">追加一行</button>
    <button id="showData">展示当前数据源</button>
  `
})

const sheet = spread.getActiveSheet()
const spreadNS = GC.Spread.Sheets

// 1) 原始数据：arr 字段对应 Table 的 bindingPath
const data = { rows: [
  { c1: 10, c2: 20, c3: 30 },
  { c1: 5, c2: 8, c3: 13 }
]}

// 2) 建立 Table，手动配置列 + 合计公式列 + 页脚汇总
const table = sheet.tables.add('tbl', 1, 1, 2, 4, spreadNS.Tables.TableThemes.medium6)
table.showFooter(true)
table.autoGenerateColumns(false)

const mk = (name, field) => {
  const c = new spreadNS.Tables.TableColumn()
  c.name(name); c.dataField(field); return c
}
const sumCol = new spreadNS.Tables.TableColumn()
sumCol.name('合计'); sumCol.dataField('sum')
table.bindColumns([mk('列1', 'c1'), mk('列2', 'c2'), mk('列3', 'c3'), sumCol])
table.bindingPath('rows')
table.setColumnDataFormula(3, '=[@列1]+[@列2]+[@列3]')   // 每行合计
table.setColumnFormula(3, '=SUBTOTAL(109,[合计])')        // 页脚汇总

// 3) 绑定数据源
const source = new spreadNS.Bindings.CellBindingSource(data)
sheet.setDataSource(source)

document.getElementById('replace').onclick = () => {
  data.rows = [
    { c1: 100, c2: 200, c3: 300 },
    { c1: 1, c2: 2, c3: 3 },
    { c1: 50, c2: 50, c3: 50 }
  ]
  table.bindingPath('rows')   // 重新触发刷新
  log('已替换数据源')
}

document.getElementById('append').onclick = () => {
  data.rows.push({
    c1: Math.floor(Math.random() * 100),
    c2: Math.floor(Math.random() * 100),
    c3: Math.floor(Math.random() * 100)
  })
  table.bindingPath('rows')
  log('已追加一行，当前共', data.rows.length, '行')
}

document.getElementById('showData').onclick = () => {
  log('当前表格绑定数据源：', data.rows)
}
