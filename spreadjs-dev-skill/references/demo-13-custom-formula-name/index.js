/**
 * 13 · 自定义公式与自定义名称
 * ------------------------------------------------------------------
 * 解决的问题：用「自定义名称」给单元格/区域取有意义的名字，在公式中引用，
 *             提升可读性与可维护性；注册自定义计算函数（自定义公式）。
 *
 * 关键 API：
 *   - sheet.addCustomName(name, formula, baseRow, baseCol, comment?)  自定义名称
 *   - spread.addCustomName(name, formula, ...)                       工作簿级自定义名称
 *   - new GC.Spread.CalcEngine.Functions.Function()                  创建自定义函数基类
 *   - sheet.addCustomFunction(fn)                                    注册自定义函数
 *   - new GC.Spread.CalcEngine.CalcArray(data)                       返回数组结果（动态数组溢出）
 *   - spread.options.allowDynamicArray = true                        开启动态数组公式
 *
 * 命名规则：不能以数字开头、不含空格/特殊符号、不与单元格地址或内置函数同名、≤255 字符。
 *
 * 在线参考：https://demo.grapecity.com.cn/spreadjs/SpreadJSTutorial/features/calculation/add-custom-name
 */
import { createShell, GC } from '../_shared/shell.js'

const { spread, log } = createShell({
  title: '13 · 自定义公式与名称',
  controls: "<span>A2、B2、C2 用的是自定义名称的公式；D2 则是一个自定义的动态数组公式"
})

// 开启动态数组公式
spread.options.allowDynamicArray = true

const sheet1 = spread.getActiveSheet()
sheet1.name('结果')
spread.addSheet(1, new GC.Spread.Sheets.Worksheet("数据"))
const sheet2 = spread.getSheetFromName("数据")
// ——————————————————————————————————————————————
// 1) 在 Sheet2 放置源数据
// ——————————————————————————————————————————————
sheet2.setArray(0, 0, [
  ['产品', '单价', '数量'],
  ['葡萄', 12.5, 30],
  ['苹果', 8.8,  50],
  ['橙子', 6.0,  80]
])

// ——————————————————————————————————————————————
// 2) 定义自定义名称（引用 Sheet2 的数据区域）
// ——————————————————————————————————————————————
sheet1.addCustomName('产品列表', "='数据'!$A$2:$A$4", 0, 0, '数据表中的产品名')
sheet1.addCustomName('单价',     "='数据'!$B$2:$B$4", 0, 0, '数据表中的单价区域')
sheet1.addCustomName('数量',     "='数据'!$C$2:$C$4", 0, 0, '数据表中的数量区域')

// ——————————————————————————————————————————————
// 3) 注册自定义公式 TOTALPRICE（返回数组，支持动态溢出）
// ——————————————————————————————————————————————
function TotalPriceFunction () {
  this.name = 'TOTALPRICE'
  this.maxArgs = 2   // (单价区域, 数量区域)
  this.minArgs = 2
}
TotalPriceFunction.prototype = new GC.Spread.CalcEngine.Functions.Function()
TotalPriceFunction.prototype.evaluate = function (prices, quantities) {
  // prices / quantities 是数字
  return Number(prices) * Number(quantities)
}

sheet1.addCustomFunction(new TotalPriceFunction())

// ——————————————————————————————————————————————
// 4) 在 Sheet1 用自定义名称 + 自定义公式展示结果
// ——————————————————————————————————————————————
// 表头
sheet1.setArray(0, 0, [['产品', '单价', '数量', '金额']])

// 动态数组公式：引用自定义名称，结果自动溢出到下方行
sheet1.setFormula(1, 0, '=产品列表')                 // A2:A4
sheet1.setFormula(1, 1, '=单价')                     // B2:B4
sheet1.setFormula(1, 2, '=数量')                     // C2:C4
sheet1.setFormula(1, 3, '=TOTALPRICE(单价, 数量)')   // D2:D4（自定义公式）

// 合计行：使用自定义名称
sheet1.setValue(5, 0, '合计')
sheet1.setFormula(5, 1, '=SUM(单价)')
sheet1.setFormula(5, 2, '=SUM(数量)')
sheet1.setFormula(5, 3, '=SUMPRODUCT(单价, 数量)')

// 列出当前所有自定义名称
const names = sheet1.getCustomNames() || []
log('Sheet1 自定义名称：', names.map(n => n.getName()).join('、'))
log('自定义公式：TOTALPRICE(单价, 数量) → 逐行计算单价×数量，返回动态数组')
log('动态数组：=产品列表 / =单价 / =数量 / =TOTALPRICE() 结果自动溢出到下方单元格')
log('合计金额 =SUMPRODUCT(单价, 数量) =', sheet1.getValue(5, 3))
