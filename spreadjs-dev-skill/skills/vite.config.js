import { defineConfig } from 'vite'

// SpreadJS Skill Demo 工程配置
// 设计要点：所有 demo 共用根目录下的一个 node_modules。
//   - 每个 demo 位于 references/<demo-folder>/，含 index.html + index.js。
//   - demo 里的 bare import（如 '@grapecity-software/spread-sheets'）会被 Vite
//     逐级向上解析到根目录的 node_modules，因此只需安装一次依赖。
//   - 开发：`npm run dev`，浏览器自动打开 demo 总览页，点选任一 demo 进入。
export default defineConfig({
  server: {
    port: 5173,
    open: '/references/'
  },
  // SpreadJS 体积较大，构建时调高分块告警阈值（仅演示工程需要）
  build: {
    chunkSizeWarningLimit: 4000
  }
})
