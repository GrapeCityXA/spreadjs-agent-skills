/**
 * 18 · 批注（Comments）
 * ------------------------------------------------------------------
 * 解决的问题：给单元格添加批注，设置显示模式（始终显示 / 悬停显示）与外观。
 *
 * 关键 API：
 *   - sheet.comments.add(row, col, text)          快速添加，返回 Comment 对象
 *   - new GC.Spread.Sheets.Comments.Comment()     手动构造
 *     comment.text(...) / backColor(...) / foreColor(...) / displayMode(...) / borderWidth / borderStyle / borderColor
 *   - GC.Spread.Sheets.Comments.DisplayMode.{alwaysShown, hoverShown}
 *   - cell.comment(comment)                       也可通过单元格挂批注
 *
 * 注意事项：
 *   1) hoverShown：鼠标悬停才显示；alwaysShown：始终显示，可拖拽移动/调整大小。
 *   2) 批注支持富文本、@提及（配合协同）等，本例演示基础样式与显示模式。
 *
 * 在线参考：https://demo.grapecity.com.cn/spreadjs/SpreadJSTutorial/features/cells/comments/comment-actions
 */
import { createShell, GC } from '../_shared/shell.js'

const { spread, log } = createShell({
  title: '18 · 批注 Comments',
  controls: `
    <button id="addAlways">给 A1 加「始终显示」批注</button>
    <button id="addHover">给 B1 加「悬停显示」批注</button>
  `
})

const sheet = spread.getActiveSheet()
const DM = GC.Spread.Sheets.Comments.DisplayMode
sheet.setValue(0, 0, '销售额'); sheet.setValue(0, 1, '同比')

const btnA = document.getElementById('addAlways')
const btnB = document.getElementById('addHover')

btnA.onclick = () => {
  const existing = sheet.comments.get(0, 0)
  if (existing) {
    sheet.comments.remove(0, 0)
    btnA.textContent = '给 A1 加「始终显示」批注'
    log('已移除 A1 批注')
  } else {
    const c = sheet.comments.add(0, 0, '该列含汇总公式，请勿直接覆盖。')
    c.displayMode(DM.alwaysShown)
    c.backColor('#fff7ed'); c.foreColor('#9a3412')
    c.borderWidth(1); c.borderStyle('solid'); c.borderColor('#fdba74')
    btnA.textContent = '移除 A1 批注'
    log('已在 A1 添加「始终显示」批注（可拖拽移动/缩放）')
  }
}

btnB.onclick = () => {
  const existing = sheet.getCell(0, 1).comment()
  if (existing) {
    sheet.getCell(0, 1).comment(null)
    btnB.textContent = '给 B1 加「悬停显示」批注'
    log('已移除 B1 批注')
  } else {
    const comment = new GC.Spread.Sheets.Comments.Comment()
    comment.text('悬停才显示的提示：同比为负需关注。')
    comment.backColor('#eff6ff'); comment.foreColor('#1d4ed8')
    comment.displayMode(DM.hoverShown)
    sheet.getCell(0, 1).comment(comment)
    btnB.textContent = '移除 B1 批注'
    log('已在 B1 添加「悬停显示」批注（鼠标移上去才出现）')
  }
}
