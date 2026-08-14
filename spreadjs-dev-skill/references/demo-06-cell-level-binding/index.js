/**
 * 06 · 单元格级别数据绑定
 * ------------------------------------------------------------------
 * 解决的问题：把 JS 对象（含嵌套字段）绑定到指定单元格，实现数据↔单元格双向同步。
 *
 * 关键 API：
 *   - new GC.Spread.Sheets.Bindings.CellBindingSource(data)  包装数据源
 *   - sheet.setBindingPath(row, col, path)                   设置绑定路径（支持 "a.b.c" 嵌套）
 *   - sheet.setDataSource(source)                            应用数据源
 *   - sheet.getBindingPath(row, col)                         读取绑定路径
 *
 * 注意事项：
 *   1) 单元格级绑定必须用 CellBindingSource 包装，再 setDataSource。
 *   2) 路径支持嵌套，如 "address.postcode"。
 *   3) 双向：改单元格会回写到数据对象；改对象后需 sheet.repaint() 刷新显示。
 *
 * 在线参考：https://demo.grapecity.com.cn/spreadjs/SpreadJSTutorial/features/data-binding/cell-level-binding
 */
import { createShell, GC } from '../_shared/shell.js'

const { spread, log } = createShell({
  title: '06 · 单元格级别数据绑定',
  controls: `
    <label>姓名 <input id="name" type="text" /></label>
    <label>年龄 <input id="age" type="number" /></label>
    <label>邮编 <input id="postcode" type="text" /></label>
    <button id="update">从输入框更新数据源并刷新</button>
    <button id="showData">展示当前绑定数据</button>
  `
})

const sheet = spread.getActiveSheet()

// 1) 准备含嵌套字段的数据
const person = { name: '王峰', age: 25, sex: '男', address: { postcode: '710075' } }
const source = new GC.Spread.Sheets.Bindings.CellBindingSource(person)

// 2) 设置单元格绑定路径（含嵌套 address.postcode）
sheet.setValue(1, 1, '姓名'); sheet.setBindingPath(1, 2, 'name')
sheet.setValue(2, 1, '年龄'); sheet.setBindingPath(2, 2, 'age')
sheet.setValue(3, 1, '性别'); sheet.setBindingPath(3, 2, 'sex')
sheet.setValue(4, 1, '邮编'); sheet.setBindingPath(4, 2, 'address.postcode')
sheet.setColumnWidth(1, 80); sheet.setColumnWidth(2, 160)

// 3) 应用数据源
sheet.setDataSource(source)

// 同步：表格 → 输入框
const syncToInputs = () => {
  document.getElementById('name').value = person.name
  document.getElementById('age').value = person.age
  document.getElementById('postcode').value = person.address.postcode
}
syncToInputs()

// 单元格被编辑时，回写已自动发生；这里同步到输入框
sheet.bind(GC.Spread.Sheets.Events.CellChanged, () => syncToInputs())

// 输入框 → 数据源 → 刷新表格
document.getElementById('update').onclick = () => {
  person.name = document.getElementById('name').value
  person.age = Number(document.getElementById('age').value)
  person.address.postcode = document.getElementById('postcode').value
  sheet.repaint()   // 改对象后需刷新显示
  log('已更新数据源并 repaint()，当前对象：', person)
}

document.getElementById('showData').onclick = () => {
  log('当前绑定数据：', person)
}
