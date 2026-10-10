'use strict';

/**
 * 读取 public/index.template.html 模板，注入初始数据，生成自包含的 index.html。
 *
 * 注入安全：
 *   - 使用 JSON.stringify 序列化数据；
 *   - 将 '<' 转义为 <，防止数据中夹带的 </script> 破坏页面结构。
 */

const fs = require('fs');
const path = require('path');

const TEMPLATE = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'index.template.html'),
  'utf8'
);

/**
 * 生成最终 index.html。
 *
 * @param {object} payload 注入到 window.__INITIAL_DATA__ 的数据对象
 *                         （包含 fileName / ext / base64）
 * @returns {string} HTML 全文
 */
function buildPageHtml(payload) {
  const safeJson = JSON.stringify(payload).replace(/</g, '\\u003c');
  return TEMPLATE.replace('__INITIAL_DATA_JSON__', safeJson);
}

module.exports = { buildPageHtml };
