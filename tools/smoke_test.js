/* 小食堂 · 逻辑冒烟测试（node，无浏览器）
   用法：先起本地服务 python -m http.server 8787，再 node tools/smoke_test.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'http://127.0.0.1:8787/';

const sandbox = {
  console,
  fetch: (u) => fetch(BASE + u),
  document: { querySelector: () => null, addEventListener: () => {}, createElement: () => ({}) },
  localStorage: { getItem: () => null, setItem: () => {} },
  setInterval: () => 0,
  clearTimeout: () => {},
  window: null,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

for (const f of ['js/icons.js', 'js/util.js', 'js/data.js', 'js/store.js', 'js/sim.js', 'js/order.js', 'js/home.js', 'js/seat.js', 'js/map.js', 'js/me.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
}

(async () => {
  await sandbox.Data.load();
  console.log('数据:', sandbox.DB.canteens.length, '食堂 /', sandbox.DB.windows.length, '档口 /', sandbox.DB.dishes.length, '菜品 /', '地图图层', sandbox.DB.map ? Object.keys(sandbox.DB.map).join('+') : '缺失');

  for (let cid = 1; cid <= 6; cid++) {
    const c = sandbox.Sim.crowd(cid);
    console.log(`  食堂${cid} [${c.level.label}] 约${c.people}人 | ${c.tip.slice(0, 16)}`);
  }

  /* 首页：今日菜单 + 热门（偏好过滤） */
  const menu = sandbox.Home.menuItems(1);
  console.log('今日菜单(惠馨苑):', menu.length, '道 |', menu.slice(0, 3).map((x) => x.name).join(' / '));

  sandbox.localStorage.getItem = (k) => (k === 'xs-prefs-v1' ? JSON.stringify({ avoid: ['辣'], goal: '减脂' }) : null);
  const menu2 = sandbox.Home.menuItems(1);
  const hot2 = sandbox.Home.hotItems();
  const hasSpicy = menu2.some((x) => x.name.indexOf('辣') !== -1);
  console.log('忌口过滤后: 今日菜单', menu2.length, '道 / 含辣', hasSpicy, '/ 热门优先轻食', hot2.slice(0, 2).map((x) => x.name + (sandbox.OrderFns.isFatloss(x.name) ? '(轻)' : '')).join(' / '));
  sandbox.localStorage.getItem = () => null;

  /* 导航页：SVG 渲染（无 DOM 依赖的纯字符串生成） */
  sandbox.App = { getState: () => ({ canteenId: 1 }) };
  const mapHtml = sandbox.MapPage.render();
  console.log('导航页 HTML:', mapHtml.length, '字符 | 含SVG', mapHtml.includes('<svg'), '| 含惠馨苑', mapHtml.includes('惠馨苑'), '| 含1953街区', mapHtml.includes('1953街区'), '| 含茶饮水果', mapHtml.includes('茶饮水果'));
  sandbox.App = { getState: () => ({ canteenId: 5 }) };
  const mapHtml5 = sandbox.MapPage.render();
  console.log('导航页(北苑): 含未收录提示', mapHtml5.includes('未收录'), '| 无北苑轮廓', !mapHtml5.includes('class="m-canteen" data-map-cid="5"'), '| 档口数', mapHtml5.includes('<b>8</b>'));

  /* 个人中心：渲染 + 打卡逻辑 */
  const meHtml = sandbox.MePage.render();
  console.log('个人中心 HTML:', meHtml.length, '字符 | 含偏好', meHtml.includes('饮食偏好'), '| 含打卡', meHtml.includes('打卡'), '| 含反馈', meHtml.includes('反馈'));

  /* 点餐筛选规则 + 购物车 */
  const names = sandbox.DB.dishes.map((x) => x.n);
  const spicy = names.filter((n) => sandbox.OrderFns.isSpicy(n));
  const veg = names.filter((n) => sandbox.OrderFns.isVeg(n));
  const light = names.filter((n) => sandbox.OrderFns.isFatloss(n));
  console.log(`筛选: 辣 ${spicy.length} / 素 ${veg.length} / 减脂 ${light.length}（共 ${names.length} 道）`);

  const sampleDish = sandbox.DB.dishes[0];
  sandbox.Cart.add(sampleDish.i);
  sandbox.Cart.add(sampleDish.i);
  console.log('购物车:', JSON.stringify(sandbox.Cart.rows()[0]).slice(0, 80), '总价', sandbox.Cart.total());
  sandbox.Cart.clear();
  console.log('购物车清空后件数:', sandbox.Cart.count());

  /* 座位布局稳定性 */
  console.log('座位布局确定性:', sandbox.Seat._stable ? sandbox.Seat._stable() : '(跳过)');

  console.log('OK 全部通过');
})().catch((e) => { console.error('FAIL:', e); process.exit(1); });
