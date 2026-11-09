/* 小食堂 · 首页 */
(function () {
  'use strict';

  /* 演示消息（静态托管无后端，消息为占位示例） */
  var NOTICES = [
    { title: '多数档口营业至 21:00', sub: '食堂营业安排' },
    { title: '轻禾轻食上新：烟熏琵琶腿肉饭', sub: '新品推荐' },
    { title: '用餐高峰请保管好随身物品', sub: '温馨提示' },
  ];

  function skeleton() {
    return '<div class="sk-card skeleton"></div>' +
      '<div class="sec"><div class="skeleton" style="height:20px;width:120px;margin-bottom:12px"></div>' +
      '<div class="sk-row skeleton"></div></div>';
  }

  function errorState() {
    return '<div class="card" style="text-align:center;padding:40px 16px">' +
      '<div style="font-size:40px;margin-bottom:10px">😢</div>' +
      '<h2 style="font-size:16px;font-weight:700">数据加载失败</h2>' +
      '<p style="font-size:13px;color:var(--text-2);margin:6px 0 16px">请检查网络后重试</p>' +
      '<button class="btn-primary" onclick="location.reload()">重新加载</button></div>';
  }

  /* 忌口过滤：菜名含忌口关键词即剔除 */
  function passAvoid(name, avoid) {
    for (var i = 0; i < avoid.length; i++) {
      if (name.indexOf(avoid[i]) !== -1) return false;
    }
    return true;
  }

  function chipsHTML(state) {
    var out = '<div class="chips" role="tablist" aria-label="选择食堂">';
    DB.canteens.forEach(function (c) {
      var cr = Sim.crowd(c.i);
      out += '<button class="chip' + (c.i === state.canteenId ? ' active' : '') + '" ' +
        'role="tab" aria-selected="' + (c.i === state.canteenId) + '" data-cid="' + c.i + '">' +
        '<span class="dot ' + cr.level.key + '"></span>' + U.esc(c.n) + '</button>';
    });
    return out + '</div>';
  }

  function crowdCardHTML(cid) {
    var c = Sim.crowd(cid);
    var bars = '';
    var nowHour = Math.floor(c.hour);
    c.curve.forEach(function (p) {
      var h = Math.round((p.ratio) * 100);
      var cls = (p.hour === nowHour) ? 'now' : ((p.ratio > 0.7) ? 'peak' : '');
      bars += '<i class="' + cls + '" style="height:' + Math.max(4, h) + '%" title="' +
        p.hour + '点 ' + p.key + '"></i>';
    });
    return '<section class="card">' +
      '<div class="crowd-head">' +
        '<div><p class="card-label">当前人流量</p>' +
          '<p class="crowd-status"><span class="dot ' + c.level.key + '"></span>' + c.level.label + '</p></div>' +
        '<div class="crowd-num"><b><span class="num">' + c.people + '</span><em>人</em></b>' +
          '<span class="sim-tag">前端模拟</span></div>' +
      '</div>' +
      '<div class="crowd-chart" aria-hidden="true">' + bars + '</div>' +
      '<div class="crowd-chart-labels"><span>6:00</span><span>12:00</span><span>18:00</span><span>21:00</span></div>' +
      '<p class="crowd-tip">' + U.icon('clock-countdown') + '<span>' + U.esc(c.tip) + '</span></p>' +
    '</section>';
  }

  function bannerHTML() {
    var b = Sim.peakBanner();
    if (!b.show || localStorage.getItem(Sim.peakDismissKey(b))) return '';
    return '<div class="banner" id="peakBanner">' +
      U.icon('clock-countdown', 'banner-ic') +
      '<div class="banner-body"><b>' + U.esc(b.title) + '</b><p>' + U.esc(b.text) + '</p></div>' +
      '<button class="icon-btn" id="peakDismiss" aria-label="关闭提醒">' + U.icon('x') + '</button>' +
    '</div>';
  }

  /* 今日菜单（按忌口过滤；采样 16 道保证过滤后仍有 8 道） */
  function menuItems(cid) {
    var p = U.prefs();
    return Sim.todayMenu(cid, null, 16).filter(function (d) {
      return passAvoid(d.name, p.avoid);
    }).slice(0, 8);
  }

  function menuHTML(cid) {
    var p = U.prefs();
    var cards = menuItems(cid).map(function (d) {
      return '<article class="dish-card" role="button" tabindex="0" data-dish="' + d.dishId + '">' +
        '<div class="dish-tile" style="--tint1:' + d.visual.t1 + ';--tint2:' + d.visual.t2 + '">' +
          '<span>' + d.visual.emoji + '</span></div>' +
        '<p class="dish-name">' + U.esc(d.name) + '</p>' +
        '<p class="dish-meta">' + U.esc(d.price) + ' · ' + U.esc(d.window) + '</p>' +
      '</article>';
    }).join('');
    var sub = U.cnDate(new Date()) + ' · ' + U.esc(Data.canteen(cid).n) +
      (p.avoid.length ? ' · 已避开你的忌口' : '');
    return '<section class="sec"><div class="sec-head">' +
      '<h2>今日菜单</h2><span class="sec-sub">' + sub + '</span></div>' +
      '<div class="hscroll">' + cards + '</div></section>';
  }

  /* 热门推荐（按忌口过滤；减脂目标优先轻食） */
  function hotItems() {
    var p = U.prefs();
    var items = Sim.hotDishes(12).filter(function (d) {
      return passAvoid(d.name, p.avoid);
    });
    if (p.goal === '减脂') {
      items.sort(function (a, b) {
        var fa = OrderFns.isFatloss(a.name) ? 1 : 0;
        var fb = OrderFns.isFatloss(b.name) ? 1 : 0;
        return fb - fa;
      });
    }
    return items.slice(0, 5);
  }

  function hotHTML() {
    var rows = hotItems().map(function (d, i) {
      var rate = d.rating > 0
        ? '<span class="hot-rating">' + U.icon('star') + '<span class="num">' + d.rating.toFixed(1) + '</span></span>'
        : '<span class="hot-rating" style="color:var(--text-3)">' + U.icon('star') + '<span>暂无</span></span>';
      return '<li class="hot-item" role="button" tabindex="0">' +
        '<span class="hot-rank num">' + (i + 1) + '</span>' +
        '<div class="dish-tile sm" style="--tint1:' + d.visual.t1 + ';--tint2:' + d.visual.t2 + '">' +
          '<span>' + d.visual.emoji + '</span></div>' +
        '<div class="hot-info"><p>' + U.esc(d.name) + '</p>' +
          '<p class="dish-meta">' + U.esc(d.window) + ' · ' + U.esc(d.price) +
          (d.rc ? ' · ' + d.rc + '人评' : '') + '</p></div>' + rate +
      '</li>';
    }).join('');
    var sub = U.icon('flame') + ' 同学都在吃' + (U.prefs().goal === '减脂' ? ' · 已优先轻食' : '');
    return '<section class="sec"><div class="sec-head">' +
      '<h2>热门推荐</h2><span class="sec-sub">' + sub + '</span></div>' +
      '<ol class="hot-list">' + rows + '</ol></section>';
  }

  /* 轻禾轻食专区（真实档口文案，无价格图片 → 自绘占位） */
  function qingheHTML() {
    var qs = DB.qinghe || [];
    if (!qs.length) return '';
    var cards = qs.map(function (q) {
      var v = U.dishVisual(q.name, 'dish');
      var tags = (q.from || []).slice(0, 3).map(function (t) {
        return '<span class="qh-tag">' + U.esc(t) + '</span>';
      }).join('');
      return '<article class="qh-card" role="button" tabindex="0">' +
        '<div class="dish-tile" style="--tint1:#E9F3E4;--tint2:#D3E7C7"><span>' + v.emoji + '</span></div>' +
        '<p class="dish-name">' + U.esc(q.name) + '</p>' +
        '<div class="qh-tags">' + tags + '</div>' +
        '<p class="qh-desc">' + U.esc((q.desc || [''])[0]) + '</p>' +
      '</article>';
    }).join('');
    return '<section class="sec"><div class="sec-head">' +
      '<h2>轻禾轻食</h2><span class="sec-sub">' + U.icon('flame') + ' 减脂餐专区 · 档口文案</span></div>' +
      '<div class="hscroll">' + cards + '</div></section>';
  }

  function noticesHTML() {
    var rows = NOTICES.map(function (n) {
      return '<div class="notice-item"><span class="notice-ic">' + U.icon('bell') + '</span>' +
        '<div class="notice-body"><p>' + U.esc(n.title) + '</p><p>' + U.esc(n.sub) + '</p></div>' +
        U.icon('caret-right') + '</div>';
    }).join('');
    return '<section class="sec" id="notices"><div class="sec-head">' +
      '<h2>食堂消息</h2><span class="sec-sub">演示示例</span></div>' + rows + '</section>';
  }

  function footerHTML() {
    return '<footer class="site-footer">' +
      '数据来源：<a href="https://map.hgu.life/" target="_blank" rel="noopener noreferrer">河地大几何地图</a> 公开接口 · 菜品价格与线下档口一致<br>' +
      '人流、空座、消息为前端模拟演示数据 · 仅供课程项目展示' +
    '</footer>';
  }

  function render(state) {
    var page = U.$('#page-home');
    var cid = state.canteenId;
    page.innerHTML =
      chipsHTML(state) + crowdCardHTML(cid) + bannerHTML() +
      menuHTML(cid) + hotHTML() + qingheHTML() + noticesHTML() + footerHTML();

    page.classList.remove('page-enter');
    void page.offsetWidth;
    page.classList.add('page-enter');
  }

  /* 拥挤度每分钟刷新一次（不动菜单等确定性内容） */
  function refreshCrowd(state) {
    var chips = U.$('#page-home .chips');
    if (chips) chips.outerHTML = chipsHTML(state);
    var first = U.$('#page-home .card');
    if (first) first.outerHTML = crowdCardHTML(state.canteenId);
  }

  window.Home = {
    render: render, refreshCrowd: refreshCrowd, skeleton: skeleton, errorState: errorState,
    menuItems: menuItems, hotItems: hotItems,
  };
})();
