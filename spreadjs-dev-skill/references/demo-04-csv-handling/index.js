/**
 * 04 · CSV 读写与自定义分隔符
 * ------------------------------------------------------------------
 * 解决的问题：在前端直接把表格区域序列化为 CSV 字符串、或从 CSV 字符串回填，
 *             并支持自定义列/行分隔符与编码。
 *
 * 关键 API（核心包自带，无需 io 插件）：
 *   - sheet.getCsv(row, col, rowCount, colCount, rowDelimiter, columnDelimiter)
 *   - sheet.setCsv(row, col, csvString, rowDelimiter, columnDelimiter)
 *
 * 文件级 CSV（含编码选项）需 io 插件：
 *   - spread.import(file, ok, err, { fileType: csv, encoding, rowDelimiter, columnDelimiter })
 *   - spread.export(ok, err, { fileType: csv, ... })
 *
 * 注意事项：
 *   1) getCsv/setCsv 的分隔符作为字符串传入，如 ',' / ';' / '\t'。
 *   2) 含逗号/换行/引号的单元格，CSV 会自动加双引号转义。
 *   3) 文件级 CSV 支持指定 encoding（默认 UTF-8）；日期/数字格式受区域设置影响。
 *
 * 在线参考：https://demo.grapecity.com.cn/spreadjs/help/docs/excelimpexp/csvimpexp
 */
import { createShell } from '../_shared/shell.js'

const { spread, log } = createShell({
  title: '04 · CSV 读写与分隔符',
  controls: `
    <label>列分隔符
      <select id="delim">
        <option value=",">逗号 ,</option>
        <option value=";">分号 ;</option>
        <option value="\t">制表符 Tab</option>
      </select>
    </label>
    <button id="export">导出为 CSV（到文本框）</button>
    <button id="import">从文本框回填到第 6 行起</button>
    <textarea id="csv" rows="4" style="width:100%" placeholder="此处显示/编辑 CSV 文本"></textarea>
  `
})

const sheet = spread.getActiveSheet()
sheet.setArray(0, 0, [
  ['姓名', '城市', '金额'],
  ['张三', '北京', 1200],
  ['李四', '上海', 980],
  ['王五', '深圳', 1530]
])

const csvEl = document.getElementById('csv')
const delimEl = document.getElementById('delim')

document.getElementById('export').onclick = () => {
  const delim = delimEl.value
  const rcount = sheet.getRowCount()
  const ccount = sheet.getColumnCount()
  // 行分隔符用 \r\n，列分隔符用所选字符
  const csv = sheet.getCsv(0, 0, rcount, ccount, '\r\n', delim)
  csvEl.value = csv
  log(`已导出 ${rcount} 行，列分隔符 = ${JSON.stringify(delim)}`)
}

document.getElementById('import').onclick = () => {
  const delim = delimEl.value
  if (!csvEl.value.trim()) return log('文本框为空')
  // 把 CSV 回填到第 6 行（索引 5）开始
  sheet.setCsv(5, 0, csvEl.value, '\r\n', delim)
  log(`已从 CSV 回填到第 6 行起（列分隔符 = ${JSON.stringify(delim)}）`)
}
