/**
 * 12 · 数据验证
 * ------------------------------------------------------------------
 * 解决的问题：限制单元格只能输入特定范围的数、下拉项或满足公式的值。
 *
 * 关键 API：
 *   - GC.Spread.Sheets.DataValidation.createListValidator("A,B,C")
 *   - createNumberValidator(operator, v1, v2?, isInteger?)
 *   - createTextLengthValidator / createDateValidator / createFormulaValidator
 *   - validator.showInputMessage(b) / inputMessage(s) / inputTitle(s)
 *   - validator.showErrorMessage(b) / errorMessage(s)
 *   - sheet.setDataValidator(row, col, rowCount, colCount, validator)
 *   - spread.options.highlightInvalidData = true   无效数据红色标记
 *
 * 注意事项：
 *   1) 列表项用逗号分隔的字符串，也可用单元格区域引用（如 "=A1:A5"）。
 *   2) 运算符用 GC.Spread.Sheets.ConditionalFormatting.ComparisonOperators。
 *   3) 也可用 cell.validator(dv) 给单个单元格设置（设样式时会复制对象，注意引用）。
 *
 * 在线参考：https://demo.grapecity.com.cn/spreadjs/help/api/modules/GC.Spread.Sheets.DataValidation
 */
import { createShell, GC } from '../_shared/shell.js'

const { spread, log } = createShell({
  title: '12 · 数据验证',
  controls: `<span class="d">B3 下拉选择；C3 限定 1~100 整数（试输入 0 或 999 会标红）</span>`
})

const sheet = spread.getActiveSheet()
const DV = GC.Spread.Sheets.DataValidation
const Cmp = GC.Spread.Sheets.ConditionalFormatting.ComparisonOperators

spread.options.highlightInvalidData = true   // 无效数据红色高亮

sheet.setValue(1, 1, '类别'); sheet.setValue(1, 2, '数量')
sheet.setColumnWidth(1, 90); sheet.setColumnWidth(2, 90)

// 1) 列表（下拉）验证
const listDv = DV.createListValidator('水果,蔬菜,饮料')
listDv.showInputMessage(true); listDv.inputTitle('提示'); listDv.inputMessage('请从下拉选择')
listDv.showErrorMessage(true); listDv.errorMessage('只能选择：水果/蔬菜/饮料')
sheet.setDataValidator(2, 1, 4, 1, listDv)

// 2) 数字验证：1~100 的整数
const numDv = DV.createNumberValidator(Cmp.between, 1, 100, true)
numDv.showInputMessage(true); numDv.inputTitle('数量')
numDv.inputMessage('请输入 1~100 的整数')
numDv.errorMessage('必须是 1~100 的整数')
sheet.setDataValidator(2, 2, 4, 1, numDv)

// 故意放一个无效值演示高亮
sheet.setValue(2, 2, 999)

log('B3:B5 下拉验证；C3:C5 数值 1~100 验证（C3=999 已标红）')
