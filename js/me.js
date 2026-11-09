/* 小食堂 · 个人中心
   订单/收藏/偏好存 localStorage（本机）；就餐统计与打卡为演示模拟，页面已如实标注。 */
(function () {
  'use strict';

  var K = { prefs: 'xs-prefs-v1', checkin: 'xs-checkin-v1', feedback: 'xs-feedback-v1', nick: 'xs-nick-v1' };
  var AVOID = ['辣', '香菜', '葱花', '蒜', '海鲜', '花生', '牛羊肉'];
  var GOALS = [{ k: '', n: '无目标' }, { k: '减脂', n: '减脂' }, { k: '增肌', n: '增肌' }];

  function read(key, fb) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; }
    catch (e) { return fb; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* 静默 */ }
  }
  function nick() { return (localStorage.getItem(K.nick) || '').slice(0, 12) || '同学'; }

  function today() { return U.ymd(new Date()); }
  function yesterday() {
    var d = new Date(Date.now() - 86400000);
    return U.ymd(d);
  }

  /* ---------------- 页面片段 ---------------- */

  function headHTML() {
    var n = nick();
    return '<div class="me-head">' +
      '<div class="me-avatar">' + U.esc(n.charAt(0)) + '</div>' +
      '<div class="me-id">' +
        '<div class="me-nick"><span id="meNick">' + U.esc(n) + '</span>' +
          '<button class="me-edit" id="meEdit" aria-label="编辑昵称">' + U.icon('plus') + '</button></div>' +
        '<p class="me-sub">河北地质大学 · 数据仅保存在本机浏览器</p>' +
      '</div>' +
    '</div>';
  }

  function statsHTML() {
    var weekKey = Math.floor(Date.now() / (86400000 * 7));
    var weekMeals = 4 + Math.floor(U.rng('me-week-' + weekKey)() * 9);   // 4-12 次
    var orders = Orders.list.length;
    var ci = read(K.checkin, null);
    var streak = (ci && ci.d === today()) ? ci.n : 0;
    return '<div class="me-stats">' +
      '<div class="me-stat"><b>' + weekMeals + '<em>次</em></b><p>本周就餐(模拟)</p></div>' +
      '<div class="me-stat"><b>' + orders + '<em>单</em></b><p>本机订单</p></div>' +
      '<div class="me-stat"><b>' + streak + '<em>天</em></b><p>连续打卡</p></div>' +
    '</div>';
  }

  function checkinHTML() {
    var ci = read(K.checkin, null);
    var done = ci && ci.d === today();
    var n = done ? ci.n : (ci && ci.d === yesterday() ? ci.n : 0);
    return '<section class="sec"><div class="card checkin-card">' +
      '<div class="checkin-body">' +
        '<div class="checkin-ic">🍚</div>' +
        '<div class="checkin-info"><b>' + (done ? '今日已打卡' : '今天还没打卡哦') + '</b>' +
          '<p>' + (done ? '已连续打卡 ' + n + ' 天，明天继续！' : '坚持打卡记录你的每一餐') + '</p></div>' +
        (done ? '<button class="btn-ghost" id="ciBtn" disabled>已打卡</button>'
              : '<button class="btn-primary" id="ciBtn">打卡</button>') +
      '</div>' +
    '</div></section>';
  }

  function prefsHTML() {
    var p = U.prefs();
    var chips = AVOID.map(function (a) {
      return '<button class="pf-chip' + (p.avoid.indexOf(a) !== -1 ? ' on' : '') + '" data-avoid="' + U.esc(a) + '">' + U.esc(a) + '</button>';
    }).join('');
    var goals = GOALS.map(function (g) {
      return '<button class="' + (p.goal === g.k ? 'on' : '') + '" data-goal="' + g.k + '">' + g.n + '</button>';
    }).join('');
    return '<section class="sec"><div class="sec-head"><h2>饮食偏好</h2>' +
      '<span class="sec-sub">影响首页推荐</span></div><div class="card">' +
      '<div class="pf-row"><p class="pf-label">忌口（点选后首页自动避开）</p>' +
        '<div class="pf-chips">' + chips + '</div></div>' +
      '<div class="pf-row"><p class="pf-label">用餐目标</p>' +
        '<div class="pf-goal">' + goals + '</div></div>' +
      '<p class="pf-hint">筛选基于菜名关键词启发式判断，可能有误判</p>' +
    '</div></section>';
  }

  function orderRowHTML(o) {
    var first = o.items && o.items[0];
    var more = o.items ? o.items.length - 1 : 0;
    var c = Data.canteen(o.canteenId);
    var main = first ? first.name : '（菜品已失效）';
    var ts = new Date(o.ts);
    return '<div class="order-row" data-oid="' + o.id + '">' +
      '<div class="or-top"><span class="or-id">' + U.esc(o.id) + ' · ' + U.cnDate(ts) + '</span>' +
        '<span class="or-status ' + o.status + '">' + (o.status === 'done' ? '已完成' : '待取餐') + '</span></div>' +
      '<p class="or-main">' + U.esc(main) + (more ? ' 等 ' + (more + 1) + ' 件' : '') + '</p>' +
      '<p class="or-meta">' + U.esc(c ? c.n : '') + ' · ' + U.esc(o.pickup || '') + '</p>' +
      '<div class="or-foot"><span class="or-total">¥' + o.total.toFixed(1) + '</span>' +
        (o.status === 'pending'
          ? '<button class="or-btn" data-fin="' + o.id + '">完成取餐</button>'
          : '<button class="or-btn" data-del="' + o.id + '">删除</button>') +
      '</div>' +
    '</div>';
  }

  function ordersHTML() {
    var rows = Orders.list.slice(0, 8).map(orderRowHTML).join('');
    return '<section class="sec"><div class="sec-head"><h2>我的订单</h2>' +
      '<span class="sec-sub">本机记录</span></div>' +
      (rows
        ? '<div class="card">' + rows + '</div>'
        : '<div class="card list-empty">还没有订单，去点餐页预约一份吧</div>') +
    '</section>';
  }

  function favsHTML() {
    var ids = Favs.ids.slice(0, 9);
    var cells = ids.map(function (id) {
      var d = DB.dishById.get(id);
      if (!d) return '';
      var v = U.dishVisual(d.n, d.c);
      var w = DB.winById.get(d.w);
      return '<div class="fav-item" data-fav="' + id + '">' +
        '<button class="fav-x" data-fav-x="' + id + '" aria-label="取消收藏">' + U.icon('x') + '</button>' +
        '<div class="dish-tile" style="--tint1:' + v.t1 + ';--tint2:' + v.t2 + '"><span>' + v.emoji + '</span></div>' +
        '<p class="dish-name">' + U.esc(d.n) + '</p>' +
        '<p class="dish-meta">' + U.esc(d.p) + (w ? ' · ' + U.esc(w.n) : '') + '</p>' +
      '</div>';
    }).join('');
    return '<section class="sec"><div class="sec-head"><h2>我的收藏</h2>' +
      '<span class="sec-sub">' + (ids.length ? ids.length + ' 道菜' : '点亮爱心收藏常吃的菜') + '</span></div>' +
      (cells
        ? '<div class="fav-grid">' + cells + '</div>'
        : '<div class="card list-empty">点餐页点 ♥ 收藏的菜品会出现在这里</div>') +
    '</section>';
  }

  function feedbackHTML() {
    var n = read(K.feedback, []).length;
    return '<section class="sec"><div class="sec-head"><h2>反馈与建议</h2>' +
      '<span class="sec-sub">' + (n ? '已提交 ' + n + ' 条(本机)' : '帮助我们做得更好') + '</span></div>' +
      '<div class="card"><div class="fb-form">' +
        '<select class="fb-select" id="fbType" aria-label="反馈类型">' +
          '<option value="菜品建议">菜品建议</option>' +
          '<option value="服务建议">服务建议</option>' +
          '<option value="功能建议">功能建议</option>' +
          '<option value="其他">其他</option>' +
        '</select>' +
        '<textarea class="fb-area" id="fbText" maxlength="200" placeholder="写下你的想法（200 字以内），仅保存在本机"></textarea>' +
        '<button class="btn-primary" id="fbSend">提交</button>' +
      '</div></div></section>';
  }

  function render() {
    return '<div class="me-wrap">' + headHTML() + statsHTML() + checkinHTML() +
      prefsHTML() + ordersHTML() + favsHTML() + feedbackHTML() +
      '<footer class="site-footer">订单与收藏仅存本机浏览器 · 就餐统计为课程演示模拟数据</footer>' +
    '</div>';
  }

  function init() {
    U.$('#page-me').innerHTML = render();
  }

  function refresh() {
    var page = U.$('#page-me');
    if (!page || !page.querySelector('.me-wrap')) return;
    page.innerHTML = render();
  }

  /* ---------------- 事件 ---------------- */

  document.addEventListener('click', function (ev) {
    /* 编辑昵称 */
    var edit = ev.target.closest('#meEdit');
    if (edit) {
      var span = U.$('#meNick');
      var input = document.createElement('input');
      input.value = nick();
      input.maxLength = 12;
      input.setAttribute('aria-label', '昵称');
      span.replaceWith(input);
      input.focus();
      var save = function () {
        var v = input.value.trim().slice(0, 12) || '同学';
        localStorage.setItem(K.nick, v);
        MePage.refresh();
      };
      input.addEventListener('blur', save);
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') input.blur(); });
      return;
    }

    /* 打卡 */
    if (ev.target.closest('#ciBtn')) {
      var ci = read(K.checkin, null);
      var n = (ci && ci.d === yesterday()) ? ci.n + 1 : 1;
      write(K.checkin, { d: today(), n: n });
      U.toast('打卡成功，已连续 ' + n + ' 天 🍚');
      refresh();
      return;
    }

    /* 忌口 / 目标 */
    var chip = ev.target.closest('.pf-chip[data-avoid]');
    if (chip) {
      var p = U.prefs();
      var a = chip.dataset.avoid;
      var i = p.avoid.indexOf(a);
      if (i === -1) p.avoid.push(a); else p.avoid.splice(i, 1);
      U.setPrefs(p);
      chip.classList.toggle('on', i === -1);
      if (window.Home) Home.render(App.getState());
      return;
    }
    var goal = ev.target.closest('.pf-goal button[data-goal]');
    if (goal) {
      var pg = U.prefs();
      pg.goal = goal.dataset.goal;
      U.setPrefs(pg);
      U.$$('.pf-goal button').forEach(function (b) { b.classList.toggle('on', b === goal); });
      if (window.Home) Home.render(App.getState());
      return;
    }

    /* 订单操作 */
    var fin = ev.target.closest('.or-btn[data-fin]');
    if (fin) {
      Orders.finish(fin.dataset.fin);
      U.toast('已标记完成，祝你用餐愉快');
      refresh();
      return;
    }
    var del = ev.target.closest('.or-btn[data-del]');
    if (del) {
      Orders.list = Orders.list.filter(function (o) { return o.id !== del.dataset.del; });
      write('xs-orders-v1', Orders.list);
      refresh();
      return;
    }

    /* 收藏 */
    var fx = ev.target.closest('.fav-x[data-fav-x]');
    if (fx) {
      Favs.toggle(Number(fx.dataset.favX));
      if (window.Order) Order.refresh();
      refresh();
      return;
    }
    var fav = ev.target.closest('.fav-item[data-fav]');
    if (fav && !ev.target.closest('.fav-x')) App.switchPage('order');

    /* 反馈提交 */
    if (ev.target.closest('#fbSend')) {
      var text = U.$('#fbText');
      var val = text.value.trim();
      if (val.length < 4) { U.toast('再写详细一点吧（至少 4 个字）'); return; }
      var list = read(K.feedback, []);
      list.unshift({ ts: Date.now(), type: U.$('#fbType').value, text: val });
      write(K.feedback, list);
      text.value = '';
      U.toast('反馈已保存到本机（演示环境模拟提交）');
      refresh();
    }
  });

  window.MePage = { init: init, refresh: refresh, render: render };
})();
