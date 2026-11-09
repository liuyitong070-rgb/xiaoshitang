/* 小食堂 · 座位查询页
   ------------------------------------------------------------
   模拟食堂平面图：按楼层分 A/B 两个就餐区，每区若干 4 人桌。
   座位占用 = 拥挤度驱动的确定性模拟，10 分钟一个稳定时段
   （同一时段内座位状态不变，更符合真实观感），每分钟刷新一次。
   ------------------------------------------------------------ */
(function () {
  'use strict';

  var state = { ready: false, floorIdx: 0 };

  /* 各区桌数（按食堂规模） */
  var TABLES = { 1: 12, 2: 11, 3: 11, 4: 9, 5: 6, 6: 4 };

  var BUCKET_MS = 10 * 60 * 1000;   // 10 分钟稳定时段
  var SEATS_PER_TABLE = 4;

  function floorsOf(cid) {
    var f = Data.canteen(cid).floors;
    return f.length ? f : ['1F'];
  }

  /* 纯布局计算（可测）：返回各区每桌每座占用布尔值 */
  function layout(cid, bucket) {
    var floors = floorsOf(cid);
    var tablesPerZone = TABLES[cid] || 8;
    var zones = [];
    floors.forEach(function (fl) {
      ['A', 'B'].forEach(function (z) {
        var key = cid + ':' + fl + ':' + z + ':' + bucket;
        var ratio = Sim.seatRatio(cid, key);
        var tables = [];
        for (var t = 0; t < tablesPerZone; t++) {
          var seats = [];
          for (var s = 0; s < SEATS_PER_TABLE; s++) {
            var r = U.rng('seat:' + key + ':t' + t + ':s' + s)();
            seats.push(r < ratio);      // true = 已占用
          }
          tables.push(seats);
        }
        zones.push({ floor: fl, zone: z, tables: tables });
      });
    });
    return zones;
  }

  function stats(zones) {
    var free = 0, total = 0;
    zones.forEach(function (z) {
      z.tables.forEach(function (t) {
        t.forEach(function (occ) { if (!occ) free++; total++; });
      });
    });
    return { free: free, total: total, occ: total - free };
  }

  function chipsHTML() {
    var out = '<div class="chips" role="tablist" aria-label="选择食堂">';
    DB.canteens.forEach(function (c) {
      out += '<button class="chip' + (c.i === STATE.canteenId ? ' active' : '') + '" data-cid="' + c.i + '">' +
        U.esc(c.n) + '</button>';
    });
    return out + '</div>';
  }

  function floorPillsHTML(floors) {
    if (floors.length < 2) return '';
    if (state.floorIdx >= floors.length) state.floorIdx = 0;
    var out = '<div class="win-row" aria-label="选择楼层">';
    floors.forEach(function (f, i) {
      out += '<button class="win-pill' + (state.floorIdx === i ? ' active' : '') + '" data-floor="' + i + '">' +
        '<span class="win-avatar"><i>' + U.esc(f.replace('F', '')) + '</i></span>' +
        '<span class="win-name">' + U.esc(f) + '</span></button>';
    });
    return out + '</div>';
  }

  /* 窗口区条带：取该食堂（当前楼层）前 8 个真实档口名 */
  function winStripHTML(cid, floor) {
    var wins = Data.windowsOf(cid).filter(function (w) {
      return !w.f || w.f === floor || floorsOf(cid).length === 1;
    }).slice(0, 8);
    if (!wins.length) wins = Data.windowsOf(cid).slice(0, 8);
    var pills = wins.map(function (w) {
      return '<span class="win-tag">' + U.esc(w.n) + '</span>';
    }).join('');
    return '<div class="win-strip">' +
      '<span class="win-strip-label">窗口区</span><div class="win-strip-tags">' + pills + '</div></div>';
  }

  function zoneHTML(z) {
    var free = 0;
    z.tables.forEach(function (t) { t.forEach(function (o) { if (!o) free++; }); });
    var tables = z.tables.map(function (t, ti) {
      var seats = t.map(function (occ, si) {
        return '<span class="seat ' + (occ ? 'occ' : 'free') + '" title="' +
          (occ ? '已占用' : '空闲') + '"></span>';
      }).join('');
      return '<div class="table">' + seats + '</div>';
    }).join('');
    return '<section class="hall-zone">' +
      '<div class="hall-head"><b>' + U.esc(z.zone) + '区</b>' +
      '<span>空闲 <b class="num ok-text">' + free + '</b> / ' + (z.tables.length * 4) + ' 座</span></div>' +
      '<div class="table-grid">' + tables + '</div>' +
    '</section>';
  }

  function render() {
    var page = U.$('#page-seat');
    var cid = STATE.canteenId;
    var floors = floorsOf(cid);
    var floor = floors[state.floorIdx] || floors[0];
    var bucket = Math.floor(Date.now() / BUCKET_MS);
    var zones = layout(cid, bucket).filter(function (z) { return z.floor === floor; });
    var st = stats(zones);
    var now = new Date();

    page.innerHTML = chipsHTML() + floorPillsHTML(floors) +
      '<section class="card seat-stats">' +
        '<div><b class="num ok-text">' + st.free + '</b><span>空闲座位</span></div>' +
        '<div><b class="num">' + st.occ + '</b><span>已占用</span></div>' +
        '<div><b class="num">' + st.total + '</b><span>总座位</span></div>' +
        '<div class="seat-update"><span class="num">' + U.pad2(now.getHours()) + ':' + U.pad2(now.getMinutes()) + '</span><span>更新 · 模拟</span></div>' +
      '</section>' +
      winStripHTML(cid, floor) +
      zones.map(zoneHTML).join('') +
      '<div class="seat-legend">' +
        '<span><i class="seat free"></i> 空闲</span>' +
        '<span><i class="seat occ"></i> 已占用</span>' +
        '<span>每 10 分钟更新 · 前端模拟数据</span>' +
      '</div>';

    page.classList.remove('page-enter');
    void page.offsetWidth;
    page.classList.add('page-enter');
  }

  function bind() {
    var page = U.$('#page-seat');
    page.addEventListener('click', function (ev) {
      var fp = ev.target.closest('.win-pill[data-floor]');
      if (fp) {
        state.floorIdx = Number(fp.dataset.floor);
        render();
      }
    });
  }

  function init() {
    if (state.ready) { refresh(); return; }
    state.ready = true;
    bind();
    render();
  }

  function refresh() {
    if (!state.ready) return;
    render();
  }

  window.Seat = { init: init, refresh: refresh, layout: layout, stats: stats };
})();
