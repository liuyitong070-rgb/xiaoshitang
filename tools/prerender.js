/* 小食堂 · 静态兜底生成器
   把无头浏览器渲染出的 5 个页面内容注入 index.html，
   使 JS 加载失败时（弱网/被墙）页面仍有完整内容，底部标签靠纯 CSS 切换。

   用法：
   1. 先起本地服务：python -m http.server 8788（项目根目录）
   2. 无头浏览器渲染全部页面并 dump：
      msedge --headless --dump-dom "http://127.0.0.1:8788/?prerender" > xs_full.html
      （app.js 检测到 ?prerender 会一次性渲染全部 5 页）
   3. node tools/prerender.js xs_full.html
   4. index.html 中 <!--prerender--> 占位符被替换为真实内容

   注意：每次改动页面结构后重跑一次本脚本，保持静态兜底与最新版一致。 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const dumpPath = process.argv[2] || path.join(ROOT, 'xs_full.html');
const dump = fs.readFileSync(dumpPath, 'utf8');
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* 从 dump 中提取 <section id="page-X">...</section> 的完整内容（支持嵌套 section） */
function extractSection(id) {
  const startRe = new RegExp('<section[^>]*id="page-' + id + '"[^>]*>');
  const m = dump.match(startRe);
  if (!m) throw new Error('dump 中找不到 section: page-' + id);
  let depth = 1;
  const tagRe = /<\/?section\b[^>]*>/g;
  tagRe.lastIndex = m.index + m[0].length;
  let t;
  while ((t = tagRe.exec(dump)) !== null) {
    if (t[0][1] === '/') { depth--; if (depth === 0) return dump.slice(m.index + m[0].length, t.index); }
    else depth++;
  }
  throw new Error('dump 中 section 未闭合: page-' + id);
}

const PAGES = ['home', 'order', 'seat', 'map', 'me'];
const stats = [];
for (const p of PAGES) {
  const content = extractSection(p);
  const old = p === 'home'
    ? '<section class="page active" id="page-home"><!--prerender--></section>'
    : '<section class="page" id="page-' + p + '"><!--prerender--></section>';
  const neu = (p === 'home' ? '<section class="page active" id="page-home">' : '<section class="page" id="page-' + p + '">') +
    content + '</section>';
  if (!html.includes(old)) throw new Error('index.html 中没有找到占位符: ' + p);
  html = html.replace(old, neu);
  stats.push(p + ': ' + content.length + ' 字符');
}

fs.writeFileSync(path.join(ROOT, 'index.html'), html);
console.log('静态兜底注入完成:');
console.log(stats.join(' / '));
console.log('index.html 总大小: ' + html.length + ' 字符');
