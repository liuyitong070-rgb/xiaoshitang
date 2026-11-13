/* 小食堂 · 应用启动与页面路由 */
(function () {
  'use strict';

  var STATE = { canteenId: 1, page: 'home' };

  var TABS = [
    { page: 'home', icon: 'house', label: '首页' },
    { page: 'order', icon: 'fork-knife', label: '点餐' },
    { page: 'seat', icon: 'chair', label: '座位' },
    { page: 'map', icon: 'map-trifold', label: '导航' },
    { page: 'me', icon: 'user-circle', label: '我的' },
  ];

  function icon(name) { return U.icon(name); }

  function initTabbar() {
    var bar = U.$('#tabbar');
    bar.innerHTML = TABS.map(function (t) {
      return '<button class="tab' + (t.page === STATE.page ? ' active' : '') + '" data-page="' + t.page +
        '" aria-label="' + t.label + '">' + icon(t.icon) + '<span>' + t.label + '</span></button>';
    }).join('');
  }

  function switchPage(page) {
    STATE.page = page;
    U.$$('.tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.page === page);
    });
    U.$$('.page').forEach(function (p) {
      p.classList.toggle('active', p.id === 'page-' + page);
      if (p.id === 'page-' + page) {
        p.classList.remove('page-enter');
        void p.offsetWidth;
        p.classList.add('page-enter');
      }
    });
    /* 同步无 JS 兜底的 radio（纯 CSS 切换显示） */
    var rd = document.getElementById('rd-' + page);
    if (rd) rd.checked = true;
    if (page === 'order') Order.init();          // 点餐页懒加载
    if (page === 'order') Order.updateCartBar();
    if (page === 'seat') Seat.init();            // 座位页懒加载
    if (page === 'map') MapPage.init();          // 导航页懒加载
    if (page === 'me') MePage.init();            // 个人中心懒加载
    if (page === 'me') MePage.refresh();         // 数据可能已变（订单/收藏）
    window.scrollTo({ top: 0 });
  }

  /* 切换食堂：同步首页/点餐/座位/导航 */
  function setCanteen(id) {
    if (!window.DB || !DB.canteens) return;
    STATE.canteenId = Number(id);
    Home.render(STATE);
    if (window.Order && typeof Order.refresh === 'function') Order.refresh();
    if (window.Seat && typeof Seat.refresh === 'function') Seat.refresh();
    if (window.MapPage && typeof MapPage.refresh === 'function') MapPage.refresh();
  }

  function bindEvents() {
    U.$('#tabbar').addEventListener('click', function (ev) {
      var tab = ev.target.closest('.tab');
      if (tab) switchPage(tab.dataset.page);
    });

    document.addEventListener('click', function (ev) {
      var chip = ev.target.closest('.chip[data-cid]');
      if (chip) {
        setCanteen(Number(chip.dataset.cid));
        return;
      }
      var dismiss = ev.target.closest('#peakDismiss');
      if (dismiss) {
        var b = Sim.peakBanner();
        if (b.show) localStorage.setItem(Sim.peakDismissKey(b), '1');
        dismiss.closest('.banner').remove();
      }
      var bell = ev.target.closest('#bellBtn');
      if (bell) {
        var n = U.$('#notices');
        if (n) n.scrollIntoView({ behavior: 'smooth' });
        else U.toast('暂无新消息');
      }
      var dish = ev.target.closest('.dish-card, .hot-item, .qh-card');
      if (dish) switchPage('order');
    });
  }

  function boot() {
    initTabbar();
    bindEvents();

    var home = U.$('#page-home');
    /* 静态兜底：页面里已有预渲染内容时不要用骨架屏覆盖 */
    if (!home.innerHTML.trim()) home.innerHTML = Home.skeleton();

    Data.load().then(function () {
      Home.render(STATE);
      /* 预渲染模式：一次性渲染全部页面（tools/prerender.js 用它生成静态兜底） */
      if (location.search.indexOf('prerender') !== -1) {
        try { Order.init(); } catch (e) { console.error('prerender order:', e); }
        try { Seat.init(); } catch (e) { console.error('prerender seat:', e); }
        try { MapPage.init(); } catch (e) { console.error('prerender map:', e); }
        try { MePage.init(); MePage.refresh(); } catch (e) { console.error('prerender me:', e); }
      }
      setInterval(function () {
        Home.refreshCrowd(STATE);
        if (STATE.page === 'seat' && Seat) Seat.refresh();
        if (STATE.page === 'map' && MapPage) MapPage.refreshCrowd();
      }, 60 * 1000);
    }).catch(function () {
      if (!home.innerHTML.trim()) home.innerHTML = Home.errorState();
    });

    /* 顶栏消息铃铛图标 */
    U.$('#bellBtn').innerHTML = icon('bell');
  }

  window.App = { switchPage: switchPage, setCanteen: setCanteen, getState: function () { return STATE; } };
  /* 点餐/座位模块直接读取的全局状态（共享同一对象引用，setCanteen 改动即时可见） */
  window.STATE = STATE;

  document.addEventListener('DOMContentLoaded', boot);
})();
