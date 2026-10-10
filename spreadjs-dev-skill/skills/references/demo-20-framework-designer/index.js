/**
 * 20 · 框架集成与生命周期（refresh / destroy）
 * ------------------------------------------------------------------
 * 解决的问题：在 SPA/组件化场景里正确初始化、刷新与销毁 SpreadJS（以及 Designer）实例，
 *             避免内存泄漏与「尺寸不跟随」「重复初始化」等问题。
 *
 * 关键 API：
 *   - spread.refresh()            宿主尺寸变化后手动刷新
 *   - spread.destroy()            销毁实例、解绑事件、释放内存
 *   - GC.Spread.Sheets.findControl(host)   通过 DOM 反查 Workbook 实例
 *   - （Designer）GC.Spread.Sheets.Designer.findControl(host) / designer.refresh() / designer.destroy()
 *
 * 注意事项：
 *   1) 容器必须先有确定宽高再初始化；框架里在 onMounted/挂载后创建实例。
 *   2) 路由切换/组件卸载时务必 destroy()，否则事件与 DOM 会泄漏。
 *   3) React/Vue/Angular 封装包（-react/-vue/-angular）的 props 与初始化流程与原生不同，
 *      接入前先查框架总览页（query: Using SpreadJS with React / Vue / add SpreadJS to Angular CLI app）。
 *   4) Designer：用 findControl(host) 取实例；容器动画变化时用 designer.refresh() 刷新。
 *
 * 在线参考：https://demo.grapecity.com.cn/spreadjs/practice/format-style/resize-animation
 */
import { createShell, GC } from '../_shared/shell.js'

const { spread, host, log } = createShell({
  title: '20 · 框架集成与生命周期',
  controls: `
    <button id="refresh">refresh() 刷新</button>
    <button id="destroy">destroy() 销毁</button>
    <button id="recreate">重新创建实例</button>
  `
})

let wb = spread
wb.getActiveSheet().setValue(0, 0, '点击「销毁」会释放实例；「重新创建」演示重建流程')

const ensureAlive = () => {
  if (!GC.Spread.Sheets.findControl(host)) {
    log('⚠️ 实例已销毁，请先「重新创建」')
    return false
  }
  return true
}

document.getElementById('refresh').onclick = () => {
  if (!ensureAlive()) return
  wb.refresh()
  log('已 refresh()（尺寸变化后调用）')
}

document.getElementById('destroy').onclick = () => {
  if (!GC.Spread.Sheets.findControl(host)) return log('实例不存在')
  wb.destroy()
  wb = null
  log('✅ 已 destroy()：事件解绑、内存释放（模拟组件卸载）')
}

document.getElementById('recreate').onclick = () => {
  if (GC.Spread.Sheets.findControl(host)) return log('实例已存在，无需重建')
  // 框架里这一步对应「组件挂载后初始化」；host 必须已有宽高
  wb = new GC.Spread.Sheets.Workbook(host, { sheetCount: 1 })
  wb.getActiveSheet().setValue(0, 0, '已重新创建实例')
  log('✅ 已重新创建 Workbook 实例')
}

// 模拟组件卸载：页面关闭时销毁（避免泄漏）
window.addEventListener('beforeunload', () => wb && wb.destroy())
