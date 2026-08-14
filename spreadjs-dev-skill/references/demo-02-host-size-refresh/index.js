/**
 * 02 · 表格区域跟随 host 元素尺寸变化
 * ------------------------------------------------------------------
 * 解决的问题：宿主（host）DOM 元素尺寸变化（抽屉/分屏/响应式布局）后，
 *             SpreadJS 不会自动跟随，出现留白或裁切。
 *
 * 关键 API：
 *   - spread.refresh()  手动刷新布局，让其重新适配 host 当前尺寸
 *
 * 注意事项：
 *   1) 容器必须「先有确定宽高」再 new Workbook，否则初始化尺寸为 0。
 *   2) 在 React/Vue/Angular 中动态改 host 尺寸后，refresh() 要在「布局变化之后」调用；
 *      框架里建议用 setTimeout(() => spread.refresh(), 0) 或 ResizeObserver 兜底，
 *      确保浏览器已完成 reflow。
 *   3) CSS transition 动画期间，可在动画过程中用定时器多次 refresh，
 *      结束（transitionend）后再 refresh 一次。
 *
 * 在线参考：https://demo.grapecity.com.cn/spreadjs/practice/others/spread-content-area-changes-with-dom-host
 */
import { createShell, GC } from '../_shared/shell.js'

const { spread, host, log } = createShell({
  title: '02 · 表格跟随 host 尺寸变化',
  controls: `
    <button id="toggle">切换 host 宽度</button>
    <label><input type="checkbox" id="auto" checked /> 切换后自动 refresh()</label>
  `
})

const sheet = spread.getActiveSheet()
sheet.setValue(0, 0, '调整窗口/宽度后，观察表格是否跟随 host')

document.getElementById('toggle').onclick = () => {
  const narrow = host.style.width === '60%'
  host.style.width = narrow ? '100%' : '60%'   // 改变 host 宽度
  if (document.getElementById('auto').checked) {
    // 关键：尺寸变化后必须手动刷新；框架里建议包一层 setTimeout
    setTimeout(() => spread.refresh(), 0)
    log(`host 宽度 → ${host.style.width}，已 refresh()`)
  } else {
    log(`host 宽度 → ${host.style.width}，未 refresh（注意表格未跟随）`)
  }
}

// 进阶：如需「任意来源的尺寸变化都自动跟随」，推荐用 ResizeObserver 监听 host：
//   new ResizeObserver(() => spread.refresh()).observe(host)
// 本 Demo 为突出「手动 refresh」的差异，默认未启用自动跟随。
