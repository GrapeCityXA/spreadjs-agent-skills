/**
 * 24 · Designer 自定义命令（含撤销/重做）
 * ------------------------------------------------------------------
 * 解决的问题：定义一个支持撤销/重做的自定义命令，挂到 Ribbon，并让撤销列表显示中文名。
 *
 * 关键 API：
 *   - config.commandMap[name] = { text, commandName, execute(ctx){...} }            顶层 Ribbon 命令
 *   - spread.commandManager().register('innerCmd', { canUndo:true, execute(spread,options,isUndo){...} })
 *   - GC.Spread.Sheets.Commands.startTransaction / endTransaction / undoTransaction
 *   - GC.Spread.Sheets.Designer.getCommand(CommandNames.UndoList/RedoList)          配置撤销/重做显示名
 *
 * 注意事项：
 *   1) 用 startTransaction/endTransaction 包裹操作，命令才进入历史栈，支持 Ctrl+Z / Ctrl+Y。
 *   2) Ribbon 命令在 execute 内通过 commandManager.execute({cmd, sheetName, ...}) 调用「可撤销的底层命令」。
 *   3) 先构建完整 config 初始化设计器，再在 workbook 上 register 底层命令（点击时命令已就绪）。
 *
 * 在线参考：https://demo.grapecity.com.cn/spreadjs/practice/designer/designer-customize-command
 */
import { createDesignerShell, GC } from '../_shared/designerShell.js'

const { host, log } = createDesignerShell({ title: '24 · Designer 自定义命令（可撤销）' })

const D = GC.Spread.Sheets.Designer
const Commands = GC.Spread.Sheets.Commands
const config = JSON.parse(JSON.stringify(D.DefaultConfig))

// 1) 撤销/重做列表的中文显示名（静态，初始化前即可配置）
const UndoList = D.getCommand(D.CommandNames.UndoList)
const RedoList = D.getCommand(D.CommandNames.RedoList)
UndoList.commandMap['paintCells'] = '改变颜色'
RedoList.commandMap['paintCells'] = '改变颜色'

// 2) 注册顶层 Ribbon 命令：收集选区 → 执行可撤销的底层命令
config.commandMap = Object.assign(config.commandMap || {}, {
  [D.CommandNames.UndoList]: UndoList,
  [D.CommandNames.RedoList]: RedoList,
  cmdPaintGreen: {
    text: '选中变绿', commandName: 'cmdPaintGreen',
    iconClass: 'ribbon-button-fill-color',
    bigButton: true,
    execute: (ctx) => {
      const s = ctx.getWorkbook(), sheet = s.getActiveSheet()
      s.commandManager().execute({
        cmd: 'paintCells', sheetName: sheet.name(),
        selections: sheet.getSelections(), color: 'rgb(130,188,0)'
      })
      log('执行：选中单元格变绿（可 Ctrl+Z 撤销）')
    }
  }
})

// 3) 在「开始」选项卡插入按钮组
config.ribbon[0].buttonGroups.unshift({
  label: '我的工具', commandGroup: { children: [{ commands: ['cmdPaintGreen'] }] }
})

// 4) 用完整 config 初始化设计器，再在 workbook 上注册底层命令
const designer = new D.Designer(host, config)
const spread = designer.getWorkbook()

spread.commandManager().register('paintCells', {
  canUndo: true,
  execute: (s, options, isUndo) => {
    const sheet = s.getSheetFromName(options.sheetName)
    if (isUndo) { Commands.undoTransaction(s, options); return true }
    Commands.startTransaction(s, options)
    s.suspendPaint()
    options.selections.forEach((sel) =>
      sheet.getRange(sel.row, sel.col, sel.rowCount, sel.colCount).backColor(options.color))
    s.resumePaint()
    Commands.endTransaction(s, options)
    return true
  }
})

log('选中若干单元格 → 点击「开始」选项卡的「选中变绿」→ Ctrl+Z 可撤销（撤销列表显示「改变颜色」）')
