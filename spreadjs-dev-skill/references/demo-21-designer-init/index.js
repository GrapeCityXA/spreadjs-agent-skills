/**
 * 21 · Designer 初始化与取 Workbook（基础）
 * ------------------------------------------------------------------
 * 解决的问题：创建 SpreadJS Designer（设计器）实例，获取其内部 Workbook 写入数据，
 *             了解中文资源、setConfig、findControl、refresh、destroy 等生命周期。
 *
 * 关键 API：
 *   - new GC.Spread.Sheets.Designer.Designer(host, config?, spread?)   创建设计器
 *   - designer.getWorkbook()                                           获取内部 Workbook
 *   - GC.Spread.Sheets.Designer.DefaultConfig                          默认配置
 *   - GC.Spread.Sheets.Designer.findControl(host)                      由 DOM 反查实例
 *   - designer.setConfig(config) / designer.refresh() / designer.destroy()
 *
 * 注意事项：
 *   1) Designer 是独立组件（非普通插件），仅在「让终端用户可视化编辑模板」时引入。
 *   2) Designer 能否使用某项能力，仍取决于运行时是否引入了对应插件（charts/shapes 等）。
 *   3) 中文资源由 designerShell 里 import '...-resources-cn' 全局生效，无需手动 setResources。
 *
 * 在线参考：https://demo.grapecity.com.cn/spreadjs/help/docs/spreadjs-designer-component
 */
import { createDesignerShell, GC } from '../_shared/designerShell.js'

const { host, log } = createDesignerShell({
  title: '21 · Designer 初始化与取 Workbook',
  controls: `
    <button id="write">向活动表写值</button>
    <button id="reload">切换到工具栏模式</button>
  `
})

const D = GC.Spread.Sheets.Designer
const designer = new D.Designer(host, D.DefaultConfig)   // 用默认配置初始化
const spread = designer.getWorkbook()
spread.getActiveSheet().setValue(0, 0, 'Designer 已就绪')
log('designer.getWorkbook() 类型：', typeof spread)

document.getElementById('write').onclick = () => {
  const sheet = designer.getWorkbook().getActiveSheet()
  sheet.setArray(1, 0, [['产品', '销售额'], ['葡萄', 1200], ['苹果', 980]])
  log('已向活动表写入示例数据')
}

let isToolbarMode = false
const reloadBtn = document.getElementById('reload')
reloadBtn.onclick = () => {
  isToolbarMode = !isToolbarMode
  const cfg = isToolbarMode ? D.ToolBarModeConfig : D.DefaultConfig
  designer.setConfig(JSON.parse(JSON.stringify(cfg)))
  reloadBtn.textContent = isToolbarMode ? '切换到功能区模式' : '切换到工具栏模式'
  log(isToolbarMode ? '已切换到工具栏模式（ToolBarModeConfig）' : '已切换到功能区模式（DefaultConfig）')
}

// 生命周期：页面关闭时由 DOM 反查并销毁（模拟组件卸载）
window.addEventListener('beforeunload', () => {
  const d = D.findControl(host)
  if (d) d.destroy()
})
