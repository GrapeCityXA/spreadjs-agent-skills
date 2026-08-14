/**
 * 22 · Designer 自定义 Ribbon（添加菜单）
 * ------------------------------------------------------------------
 * 解决的问题：在顶部功能区添加「一级菜单」（选项卡）与「二级按钮组」，并绑定自定义命令。
 *
 * 关键 API：
 *   - config = JSON.parse(JSON.stringify(GC.Spread.Sheets.Designer.DefaultConfig))   深拷贝默认配置
 *   - config.ribbon.push({ id, text, buttonGroups:[...] })                            新增一级菜单
 *   - config.ribbon[0].buttonGroups.unshift({ label, commandGroup:{children:[{commands:[...]}]} })  在已有选项卡插按钮组
 *   - config.commandMap = { 命令名:{ text, commandName, execute(ctx) } }
 *
 * 注意事项：
 *   1) 务必深拷贝 DefaultConfig 再改，避免污染全局默认配置。
 *   2) execute 的 context：context.getWorkbook() 取工作簿，context.getDesigner() 取设计器。
 *   3) 内置命令名（如 'fontFamily'、'insertTable'、'formulaAutoSum'）可直接放进 commands 数组复用。
 *   4) 此处未设 iconClass，按钮为纯文本；如需图标，定义对应 CSS 类并通过 iconClass 指定。
 *
 * 在线参考：https://demo.grapecity.com.cn/spreadjs/practice/designer/designer-add-top-menu
 */
import { createDesignerShell, GC } from '../_shared/designerShell.js'

const { host, log } = createDesignerShell({ title: '22 · Designer 自定义 Ribbon（添加菜单）' })

const D = GC.Spread.Sheets.Designer
const config = JSON.parse(JSON.stringify(D.DefaultConfig))

// 1) 注册自定义命令（commandMap）
config.commandMap = Object.assign(config.commandMap || {}, {
  cmdLoadSample: {
    text: '加载示例', commandName: 'cmdLoadSample',
    iconClass: 'ribbon-button-import-data',
    bigButton: true,
    execute: async (ctx) => {
      const sh = ctx.getWorkbook().getActiveSheet()
      sh.setArray(0, 0, [['地区', 'Q1', 'Q2'], ['华北', 60, 90], ['华东', 70, 85]])
      log('执行：加载示例数据')
    }
  },
  cmdClearSelection: {
    text: '清空选区', commandName: 'cmdClearSelection',
    iconClass: 'ribbon-button-clear',
    bigButton: true,
    execute: async (ctx) => {
      const sheet = ctx.getWorkbook().getActiveSheet(), sel = sheet.getSelections()[0]
      sheet.suspendPaint()
      if (sel) sheet.getRange(sel.row, sel.col, sel.rowCount, sel.colCount).value('')
      sheet.resumePaint()
      log('执行：清空当前选区')
    }
  }
})

// 2) 新增「一级菜单」（Ribbon 选项卡）
config.ribbon.push({
  id: 'myOperate',
  text: '我的操作',
  buttonGroups: [
    {
      label: '数据',
      commandGroup: { children: [{ direction: 'horizental', commands: ['cmdLoadSample', 'cmdClearSelection'] }] }
    }
  ]
})

// 3) 在默认「开始」选项卡（ribbon[0]）最前插入一个「二级按钮组」，复用上面命令
config.ribbon[0].buttonGroups.unshift({
  label: '快捷',
  commandGroup: { children: [{ commands: ['cmdLoadSample'] }] }
})

// 4) 用自定义配置初始化
const designer = new D.Designer(host, config)
log('已新增「我的操作」选项卡，并在「开始」选项卡插入「快捷」按钮组')
