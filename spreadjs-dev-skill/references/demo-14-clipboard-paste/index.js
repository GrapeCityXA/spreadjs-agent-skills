/**
 * 14 · 剪贴板复制粘贴：命令式复制 + 粘贴拦截
 * ------------------------------------------------------------------
 * 解决的问题：1) 用代码把一个区域复制/剪切到另一区域（可撤销）；
 *             2) 在用户粘贴时校验或改写粘贴内容（如只粘贴值、禁止粘贴到保护区）。
 *
 * 关键 API：
 *   - spread.commandManager().execute({ cmd:'clipboardPaste', sheetName,
 *       fromSheet, fromRanges:[Range], pastedRanges:[Range],
 *       isCutting:false, clipboardText:'', pasteOption })
 *   - GC.Spread.Sheets.ClipboardPasteOptions.{all,values,formatting,formulas,...}
 *   - sheet.bind(GC.Spread.Sheets.Events.ClipboardPasting, (e,args)=>{ args.cancel=true })
 *
 * 注意事项：
 *   1) 走 commandManager 的复制粘贴才是「可撤销」的，直接改值不可撤销。
 *   2) ClipboardPasting 事件参数含 cellRange/pasteOption/cancel；
 *      把 cancel 置 true 可阻止本次粘贴。
 *
 * 在线参考：https://demo.grapecity.com.cn/spreadjs/help/docs/features/workbook/clipboard
 */
import { createShell, GC } from '../_shared/shell.js'

const { spread, log } = createShell({
  title: '14 · 剪贴板复制粘贴',
  controls: `
    <button id="copy">用命令把 A1:B3 复制到 D1</button>
    <label><input type="checkbox" id="block" /> 拦截用户粘贴到 D 列</label>
  `
})

const sheet = spread.getActiveSheet()
sheet.setArray(0, 0, [['姓名', '城市'], ['张三', '北京'], ['李四', '上海']])

document.getElementById('copy').onclick = () => {
  spread.commandManager().execute({
    cmd: 'clipboardPaste',
    sheetName: sheet.name(),
    fromSheet: sheet,
    fromRanges: [new GC.Spread.Sheets.Range(0, 0, 3, 2)],   // A1:B3
    pastedRanges: [new GC.Spread.Sheets.Range(0, 3, 3, 2)],  // D1:E3
    isCutting: false,
    clipboardText: '',
    pasteOption: GC.Spread.Sheets.ClipboardPasteOptions.all
  })
  log('已用 clipboardPaste 命令复制 A1:B3 → D1:E3（可 Ctrl+Z 撤销）')
}

// 拦截：用户粘贴时若目标在 A 列则取消
sheet.bind(GC.Spread.Sheets.Events.ClipboardPasting, (e, args) => {
  if (!document.getElementById('block').checked) return
  if (args.cellRange && args.cellRange.col === 3) {
    args.cancel = true
    alert("已拦截：禁止粘贴到 D 列")
    log('已拦截：禁止粘贴到 D 列')
  }
})
