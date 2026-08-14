/**
 * 23 · Designer 自定义右键菜单（Context Menu）
 * ------------------------------------------------------------------
 * 解决的问题：在 Designer 右键菜单中添加自定义项，含子菜单、分隔符，并控制「何时显示」。
 *
 * 关键 API：
 *   - config.contextMenu.unshift('cmdName')     将命令挂到右键菜单顶部
 *   - config.commandMap = { cmdName:{ text, commandName, visibleContext, subCommands:[...], execute } }
 *   - visibleContext: 'ClickViewport'（仅右键单元格区）/'ClickRowHeader'（仅右键行头）
 *   - subCommands 内可用字符串 'separator' 插入分隔符
 *   - designer.setData(key, bool) + designer.refresh()   动态控制自定义显示条件
 *
 * 注意事项：
 *   1) 三级及以上菜单，除 config 外还需 register 到 spread.commandManager() 并设 spread.contextMenu.menuData。
 *   2) visibleContext 支持表达式（&&、!、自定义变量），常配合 SelectionChanged 事件动态刷新。
 *
 * 在线参考：https://demo.grapecity.com.cn/spreadjs/practice/menu/add-designer-multi-level-context-menu
 */
import { createDesignerShell, GC } from '../_shared/designerShell.js'

const { host, log } = createDesignerShell({
  title: '23 · Designer 自定义右键菜单（右键单元格试试）'
})

const D = GC.Spread.Sheets.Designer
const config = JSON.parse(JSON.stringify(D.DefaultConfig))

// 子命令（二级菜单项）
const subA = {
  text: '标黄选区', commandName: 'ctxMarkYellow',
  iconClass: 'ribbon-button-fill-color',
  execute: async (ctx) => {
    const sh = ctx.getWorkbook().getActiveSheet(), sel = sh.getSelections()[0]
    if (sel) sh.getRange(sel.row, sel.col, sel.rowCount, sel.colCount).backColor('#fde68a')
    log('右键菜单：标黄选区')
  }
}
const subB = {
  text: '清空选区', commandName: 'ctxClear',
  iconClass: 'ribbon-button-clear',
  execute: async (ctx) => {
    const sh = ctx.getWorkbook().getActiveSheet(), sel = sh.getSelections()[0]
    if (sel) sh.getRange(sel.row, sel.col, sel.rowCount, sel.colCount).value('')
    log('右键菜单：清空选区')
  }
}

// 主菜单项：visibleContext 限定「仅右键单元格视口时」显示
const mainItem = {
  text: '自定义操作', commandName: 'ctxMain',
  visibleContext: 'ClickViewport',
  subCommands: [subA, subB]
}

config.commandMap = { ctxMain: mainItem, ctxMarkYellow: subA, ctxClear: subB }
config.contextMenu.unshift('ctxMain')

const designer = new D.Designer(host, config)
log('右键任意单元格 → 可见「自定义操作」及其子菜单')
log('提示：右键行头不会显示该项（因 visibleContext=ClickViewport）')
