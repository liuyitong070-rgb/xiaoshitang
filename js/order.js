/* 小食堂 · 点餐页
   ------------------------------------------------------------
   档口浏览 → 菜品列表（辣/素/减脂筛选）→ 收藏 / 一键加购
   → 购物车栏 → 预约取餐下单（订单存 localStorage）
   ------------------------------------------------------------ */
(function () {
  'use strict';

  /* 筛选启发式规则（基于菜名关键词） */
  function isSpicy(name) { return name.indexOf('辣') !== -1; }

  var MEAT_WORDS = ['肉', '鸡', '鸭', '鹅', '鱼', '虾', '蟹', '牛', '猪', '羊', '鳗',
    '蛙', '骨', '排', '肠', '腿', '翅', '肘', '肚', '肝', '堡', '培根', '火腿',
    '肉松', '鱿鱼', '贝', '蛤', '鲍', '螺', '海鲜', '馄饨', '饺'];
  function isVeg(name) {
    return !MEAT_WORDS.some(function (k) { return name.indexOf(k) !== -1; });
  }

  var LIGHT_WORDS = ['减脂', '轻食', '低卡', '轻卡', '水煮', '鸡胸', '沙拉',
    '糙米', '杂粮', '蒸', '荞麦', '全麦', '藜麦', '燕麦', '酸奶'];
  function isFatloss(name) {
    return LIGHT_WORDS.some(function (k) { return name.indexOf(k) !== -1; });
  }

  var state = {
    ready: false,
    winSel: 'all',          // 'all' 或窗口 id
    filters: { spicy: false, veg: false, fatloss: false },
    pickupMin: 0,           // 预约取餐：0/15/30/60 分钟
  };

  var MAX_ALL_ROWS = 150;

  function matchFilters(name) {
    var f = state.filters;
    if (f.spicy && !isSpicy(name)) return false;
    if (f.veg && !isVeg(name)) return false;
    if (f.fatloss && !isFatloss(name)) return false;
    return true;
  }

  /* 浏览列表不含加料（condiment 为另加小料，不单独成菜） */
  function dishesOfWin(winId) {
    return (DB.dishesByWin.get(winId) || []).filter(function (d) { return d.c !== 'condiment'; });
  }

  function chipsHTML() {
    var out = '<div class="chips" role="tablist" aria-label="选择食堂">';
    DB.canteens.forEach(function (c) {
      out += '<button class="chip' + (c.i === STATE.canteenId ? ' active' : '') + '" data-cid="' + c.i + '">' +
        U.esc(c.n) + '</button>';
    });
    return out + '</div>';
  }

  function filterHTML() {
    var f = state.filters;
    var mk = function (key, on, label) {
      return '<button class="fchip' + (on ? ' active' : '') + '" data-f="' + key + '">' + label + '</button>';
    };
    return '<div class="filter-row" aria-label="口味筛选">' +
      mk('spicy', f.spicy, '🌶 辣') + mk('veg', f.veg, '🥬 素食') + mk('fatloss', f.fatloss, '🥗 减脂') +
      (f.spicy || f.veg || f.fatloss
        ? '<button class="fchip fchip-clear" data-f="clear">清除筛选</button>' : '') +
    '</div>';
  }

  function winPillsHTML() {
    var wins = Data.windowsOf(STATE.canteenId);
    var out = '<div class="win-row">' +
      '<button class="win-pill' + (state.winSel === 'all' ? ' active' : '') + '" data-win="all">全部</button>';
    wins.forEach(function (w) {
      var active = state.winSel === w.i;
      var initial = U.esc(w.n.charAt(0));
      out += '<button class="win-pill' + (active ? ' active' : '') + '" data-win="' + w.i + '" title="' + U.esc(w.n) + '">' +
        '<span class="win-avatar">' +
        (w.img ? '<img src="' + U.esc(w.img) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">' : '') +
        '<i>' + initial + '</i></span>' +
        '<span class="win-name">' + U.esc(w.n) + '</span></button>';
    });
    return out + '</div>';
  }

  function rowHTML(d, showWin) {
    var v = U.dishVisual(d.n, d.c);
    var fav = Favs.has(d.i);
    var meta = U.esc(d.p) + (d.ra ? ' · <span class="dish-star">' + U.icon('star') +
      '<span class="num">' + d.ra.toFixed(1) + '</span></span>' : '');
    return '<div class="dish-row" data-id="' + d.i + '">' +
      '<div class="dish-tile xs" style="--tint1:' + v.t1 + ';--tint2:' + v.t2 + '"><span>' + v.emoji + '</span></div>' +
      '<div class="dish-info">' +
        '<p class="dish-name">' + U.esc(d.n) + '</p>' +
        '<p class="dish-meta">' + (showWin ? U.esc(DB.winById.get(d.w).n) + ' · ' : '') + meta + '</p>' +
      '</div>' +
      '<button class="row-btn fav' + (fav ? ' on' : '') + '" data-fav="' + d.i + '" aria-label="收藏">' + U.icon('heart') + '</button>' +
      '<button class="row-btn add" data-add="' + d.i + '" aria-label="加入购物车">' + U.icon('plus') + '</button>' +
    '</div>';
  }

  function listHTML() {
    var out = '';
    if (state.winSel === 'all') {
      var wins = Data.windowsOf(STATE.canteenId);
      var shown = 0;
      var capped = false;
      for (var i = 0; i < wins.length && shown < MAX_ALL_ROWS; i++) {
        var ds = dishesOfWin(wins[i].i).filter(function (d) { return matchFilters(d.n); });
        if (!ds.length) continue;
        out += '<div class="win-head">' + U.esc(wins[i].n) +
          '<span class="num">' + ds.length + ' 道</span></div>';
        for (var j = 0; j < ds.length && shown < MAX_ALL_ROWS; j++, shown++) {
          out += rowHTML(ds[j], false);
        }
        if (shown >= MAX_ALL_ROWS) { capped = true; break; }
      }
      if (capped) {
        out += '<p class="list-cap">已显示前 ' + MAX_ALL_ROWS + ' 道，选择档口或筛选项可缩小范围</p>';
      }
      if (!shown) out = emptyHTML();
    } else {
      var ds2 = dishesOfWin(state.winSel).filter(function (d) { return matchFilters(d.n); });
      if (!ds2.length) { out = emptyHTML(); }
      else {
        out += '<div class="win-head">' + U.esc(DB.winById.get(state.winSel).n) +
          '<span class="num">' + ds2.length + ' 道</span></div>';
        ds2.forEach(function (d) { out += rowHTML(d, false); });
      }
    }
    return '<div class="dish-list">' + out + '</div>';
  }

  function emptyHTML() {
    return '<div class="list-empty"><div class="empty-emoji">🔍</div>' +
      '<p>没有符合条件的菜品</p><button class="btn-primary" data-f="clear">清除筛选</button></div>';
  }

  function render() {
    var page = U.$('#page-order');
    page.innerHTML = chipsHTML() + filterHTML() + winPillsHTML() + listHTML();
    page.classList.remove('page-enter');
    void page.offsetWidth;
    page.classList.add('page-enter');
  }

  /* ---------------- 购物车栏与预约取餐面板 ---------------- */
  function cartBarHTML() {
    var n = Cart.count();
    if (!n) return '';
    return '<div class="cartbar">' +
      '<div class="cart-info"><b><span class="num">' + n + '</span> 件</b>' +
      '<span>合计 <b class="num">¥' + Cart.total().toFixed(1) + '</b></span></div>' +
      '<button class="btn-primary" id="cartGo">去下单</button>' +
    '</div>';
  }

  function updateCartBar() {
    var old = U.$('#cartbar');
    if (old) old.remove();
    var page = U.$('#page-order');
    if (page && page.classList.contains('active')) {
      page.insertAdjacentHTML('beforeend', cartBarHTML());
    }
  }

  function timeSlotHTML() {
    var now = new Date();
    var slots = [0, 15, 30, 60];
    var labels = ['现在取餐', '15 分钟后', '30 分钟后', '1 小时后'];
    return slots.map(function (m, i) {
      var t = new Date(now.getTime() + m * 60000);
      var hh = U.pad2(t.getHours()), mm = U.pad2(t.getMinutes());
      return '<button class="slot' + (state.pickupMin === m ? ' active' : '') + '" data-slot="' + m + '">' +
        labels[i] + '<span class="num">' + hh + ':' + mm + '</span></button>';
    }).join('');
  }

  function openSheet() {
    var rows = Cart.rows();
    if (!rows.length) { U.toast('购物车是空的'); return; }
    var items = rows.map(function (r) {
      return '<div class="sheet-item">' +
        '<div class="sheet-item-info"><p>' + U.esc(r.name) + '</p>' +
        '<p class="dish-meta">' + U.esc(r.window) + ' · ' + U.esc(r.price) + '</p></div>' +
        '<div class="stepper">' +
          '<button data-step="-' + r.dishId + '" aria-label="减少">' + U.icon('minus') + '</button>' +
          '<b class="num">' + r.qty + '</b>' +
          '<button data-step="+' + r.dishId + '" aria-label="增加">' + U.icon('plus') + '</button>' +
        '</div></div>';
    }).join('');

    var sheet = document.createElement('div');
    sheet.className = 'sheet-overlay';
    sheet.id = 'sheet';
    sheet.innerHTML =
      '<div class="sheet">' +
        '<div class="sheet-head"><h3>预约取餐</h3>' +
          '<button class="icon-btn" data-close aria-label="关闭">' + U.icon('x') + '</button></div>' +
        '<p class="sheet-sub">取餐食堂：' + U.esc(Data.canteen(STATE.canteenId).n) + '</p>' +
        '<div class="sheet-slots">' + timeSlotHTML() + '</div>' +
        '<div class="sheet-items">' + items + '</div>' +
        '<div class="sheet-foot">' +
          '<div>合计 <b class="num">¥' + Cart.total().toFixed(1) + '</b></div>' +
          '<button class="btn-primary" id="sheetSubmit">确认预约</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(sheet);
    document.body.style.overflow = 'hidden';
  }

  function closeSheet() {
    var s = U.$('#sheet');
    if (s) s.remove();
    document.body.style.overflow = '';
  }

  function refreshSheetItems() {
    var box = U.$('#sheet .sheet-items');
    if (!box) return;
    var rows = Cart.rows();
    if (!rows.length) { closeSheet(); U.toast('购物车已清空'); return; }
    box.innerHTML = rows.map(function (r) {
      return '<div class="sheet-item">' +
        '<div class="sheet-item-info"><p>' + U.esc(r.name) + '</p>' +
        '<p class="dish-meta">' + U.esc(r.window) + ' · ' + U.esc(r.price) + '</p></div>' +
        '<div class="stepper">' +
          '<button data-step="-' + r.dishId + '" aria-label="减少">' + U.icon('minus') + '</button>' +
          '<b class="num">' + r.qty + '</b>' +
          '<button data-step="+' + r.dishId + '" aria-label="增加">' + U.icon('plus') + '</button>' +
        '</div></div>';
    }).join('');
    U.$('#sheet .sheet-foot div').innerHTML =
      '合计 <b class="num">¥' + Cart.total().toFixed(1) + '</b>';
  }

  function submitOrder() {
    var rows = Cart.rows();
    if (!rows.length) return;
    var now = new Date(Date.now() + state.pickupMin * 60000);
    var pickup = U.pad2(now.getHours()) + ':' + U.pad2(now.getMinutes());
    Orders.create({
      canteenId: STATE.canteenId, pickup: pickup,
      rows: rows.map(function (r) { return { name: r.name, price: r.price, num: r.num, qty: r.qty, window: r.window }; }),
      total: Cart.total(),
    });
    Cart.clear();
    closeSheet();
    updateCartBar();
    U.toast('预约成功，请按时到店取餐');
  }

  function bind() {
    var page = U.$('#page-order');
    page.addEventListener('click', function (ev) {
      var fchip = ev.target.closest('.fchip');
      if (fchip) {
        var key = fchip.dataset.f;
        if (key === 'clear') state.filters = { spicy: false, veg: false, fatloss: false };
        else state.filters[key] = !state.filters[key];
        render();
        return;
      }
      var wp = ev.target.closest('.win-pill');
      if (wp) {
        state.winSel = wp.dataset.win === 'all' ? 'all' : Number(wp.dataset.win);
        render();
        return;
      }
      var add = ev.target.closest('[data-add]');
      if (add) {
        Cart.add(Number(add.dataset.add));
        updateCartBar();
        U.toast('已加入购物车');
        return;
      }
      var fav = ev.target.closest('[data-fav]');
      if (fav) {
        var added = Favs.toggle(Number(fav.dataset.fav));
        fav.classList.toggle('on', added);
        U.toast(added ? '已收藏，可在「我的」页查看' : '已取消收藏');
        return;
      }
      var go = ev.target.closest('#cartGo');
      if (go) { openSheet(); return; }
      var slot = ev.target.closest('.slot');
      if (slot) {
        state.pickupMin = Number(slot.dataset.slot);
        U.$$('#sheet .slot').forEach(function (s) {
          s.classList.toggle('active', s === slot);
        });
        return;
      }
      var step = ev.target.closest('[data-step]');
      if (step) {
        var id = Number(step.dataset.step.slice(1));
        var delta = step.dataset.step.charAt(0) === '+' ? 1 : -1;
        Cart.setQty(id, Cart.qty(id) + delta);
        refreshSheetItems();
        return;
      }
      var submit = ev.target.closest('#sheetSubmit');
      if (submit) { submitOrder(); return; }
      var close = ev.target.closest('[data-close]');
      if (close) { closeSheet(); return; }
      if (ev.target.classList.contains('sheet-overlay')) closeSheet();
    });
  }

  function init() {
    if (state.ready) { refresh(); return; }
    state.ready = true;
    bind();
    render();
    updateCartBar();
  }

  function refresh() {
    if (!state.ready) return;
    render();
    updateCartBar();
  }

  window.Order = { init: init, refresh: refresh, updateCartBar: updateCartBar };
  /* 供冒烟测试 */
  window.OrderFns = { isSpicy: isSpicy, isVeg: isVeg, isFatloss: isFatloss };
})();
