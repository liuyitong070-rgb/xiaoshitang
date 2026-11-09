/* 小食堂 · 食堂导航页（真实坐标 SVG 校园简图）
   图层来自河地大几何地图（data/map.json），坐标 WGS84 经纬度，
   等距圆柱投影（y 取反）直接画 SVG；食堂高亮用 data/canteens.json 的轮廓。 */
(function () {
  'use strict';

  var DIRS = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
  var FEAT_TINT = { 水体: 'water', 操场: 'sport', 球场: 'sport', 操场看台: 'sport' };
  var SKIP_LABELS = { 惠馨苑: 1, 南苑餐厅: 1, 风味苑: 1, '1953青春街区': 1, 教一楼: 1, 服务楼: 1 };
  var CNAME = { 4: '1953街区', 6: '茶饮水果' };
  var LAT_FIX = 0.787; // cos(38.1°)，经度一度换算成与纬度一度等长的距离修正

  var sel = null;

  function bbox() { return DB.map.b; }

  function fmt(n) { return Math.round(n * 1e6) / 1e6; }
  function X(p) { return p[0]; }
  function Y(p) { return -p[1]; }

  function pathOf(poly) {
    return poly.map(function (p, i) {
      return (i ? 'L' : 'M') + fmt(X(p)) + ' ' + fmt(Y(p));
    }).join(' ') + 'Z';
  }

  function bearing(c) {
    var b = bbox();
    var mc = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
    var dx = (c[0] - mc[0]) * LAT_FIX;
    var dy = c[1] - mc[1];
    if (Math.abs(dx) < 1e-7 && Math.abs(dy) < 1e-7) return '中心';
    var ang = Math.atan2(dx, dy) * 180 / Math.PI; // 0 = 北，顺时针
    if (ang < 0) ang += 360;
    return DIRS[Math.round(ang / 45) % 8];
  }

  function distM(c) {
    var b = bbox();
    var mc = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
    var dx = (c[0] - mc[0]) * LAT_FIX * 111320;
    var dy = (c[1] - mc[1]) * 111320;
    return Math.round(Math.sqrt(dx * dx + dy * dy) / 10) * 10;
  }

  function mapName(c) { return CNAME[c.i] || c.n; }

  /* ---------------- 页面片段 ---------------- */

  function chipsHTML() {
    return DB.canteens.map(function (c) {
      var cr = Sim.crowd(c.i);
      return '<button class="chip map-chip' + (sel === c.i ? ' active' : '') + '" data-map-cid="' + c.i +
        '" aria-pressed="' + (sel === c.i) + '">' +
        '<span class="dot ' + cr.level.key + '"></span>' + U.esc(c.n) + '</button>';
    }).join('');
  }

  function svgHTML() {
    var M = DB.map;
    var b = bbox();
    var pad = (b[3] - b[1]) * 0.05;
    var vb = [b[0] - pad, -(b[3] + pad), (b[2] - b[0]) + pad * 2, (b[3] - b[1]) + pad * 2];
    var fs = (b[2] - b[0]) / 30; // 主字号：约为屏宽 1/30
    var out = [];

    out.push('<svg viewBox="' + vb.map(fmt).join(' ') + '" role="img" aria-label="河北地质大学校园简图">');
    M.land.forEach(function (p) { out.push('<path class="m-land" d="' + pathOf(p) + '"/>'); });
    M.border.forEach(function (p) { out.push('<path class="m-border" d="' + pathOf(p) + '"/>'); });
    M.roads.forEach(function (p) { out.push('<path class="m-road" d="' + pathOf(p) + '"/>'); });
    M.features.forEach(function (f) {
      out.push('<path class="m-feat m-' + (FEAT_TINT[f.t] || 'plain') + '" d="' + pathOf(f.p) + '"/>');
    });
    M.buildings.forEach(function (b) {
      if (!b.canteen) out.push('<path class="m-bld" d="' + pathOf(b.p) + '"/>');
    });
    M.labels.forEach(function (l) {
      if (SKIP_LABELS[l.n]) return;
      var n = l.n.replace(/\\n/g, '·');
      out.push('<text class="m-label' + (l.main ? ' m-main' : '') + '" x="' + fmt(X(l.p)) +
        '" y="' + fmt(Y(l.p)) + '" text-anchor="middle" style="font-size:' +
        fmt(fs * (l.main ? 1.1 : 0.78)) + 'px">' + U.esc(n) + '</text>');
    });

    /* 食堂高亮（建筑轮廓 / 点位），画在最上层 */
    DB.canteens.forEach(function (c) {
      var cls = 'm-canteen' + (sel === c.i ? ' sel' : '');
      var label = U.esc(c.full);
      if (c.poly) {
        out.push('<path class="' + cls + '" data-map-cid="' + c.i + '" d="' + pathOf(c.poly) +
          '" tabindex="0" role="button" aria-label="' + label + '"/>');
      }
      if (c.pts) {
        c.pts.forEach(function (p) {
          out.push('<circle class="' + cls + '" data-map-cid="' + c.i + '" cx="' + fmt(X(p)) +
            '" cy="' + fmt(Y(p)) + '" r="' + fmt(fs * 0.72) + '" tabindex="0" role="button" aria-label="' + label + '"/>');
        });
      }
    });

    /* 食堂名称（点按轮廓即可选中，文字不可点，避免误触） */
    DB.canteens.forEach(function (c) {
      if (!c.center || c.i === 5) return;
      var dy = c.poly ? -fs * 1.5 : -fs * 1.8;
      out.push('<text class="m-cname' + (sel === c.i ? ' sel' : '') + '" x="' + fmt(X(c.center)) +
        '" y="' + fmt(Y(c.center) + dy) + '" text-anchor="middle" style="font-size:' +
        fmt(fs * 1.05) + 'px">' + U.esc(mapName(c)) + '</text>');
    });

    out.push('</svg>');
    return out.join('');
  }

  function infoHTML(cid) {
    var c = Data.canteen(cid);
    if (!c) return '';
    var cr = Sim.crowd(cid);
    var onMap = !!(c.poly || (c.pts && c.pts.length));

    var desc;
    if (onMap) {
      desc = '位于校园' + bearing(c.center) + '方位 · 距校园中心约 ' + distM(c.center) + ' 米（直线）';
    } else {
      desc = '该食堂暂未收录在地图数据中（参考站无轮廓），以下信息仅作介绍';
    }

    var floors = c.floors && c.floors.length ? c.floors.join('/') : '—';

    return '<section class="card map-info">' +
      '<div class="mi-top"><b class="mi-name">' + U.esc(c.full) + '</b>' +
        '<span class="mi-crowd"><span class="dot ' + cr.level.key + '"></span>' + cr.level.label + '</span></div>' +
      '<p class="mi-desc">' + U.esc(desc) + '</p>' +
      '<div class="mi-meta">' +
        '<div><b>' + c.wins + '</b><p>档口</p></div>' +
        '<div><b>' + U.esc(floors) + '</b><p>楼层</p></div>' +
        '<div><b>' + Sim.CAPACITY[cid] + '</b><p>容量(模拟)</p></div>' +
      '</div>' +
      '<p class="mi-tip">' + U.icon('clock-countdown') + '<span>' + U.esc(cr.tip) + '</span></p>' +
      '<div class="mi-actions">' +
        '<button class="btn-primary" data-mi="order">去点餐</button>' +
        '<button class="btn-ghost" data-mi="seat">看座位</button>' +
      '</div>' +
    '</section>';
  }

  function render() {
    sel = (window.App ? App.getState().canteenId : sel) || 1;
    return '<div class="map-wrap">' +
      '<div class="chips map-chips" id="mapChips">' + chipsHTML() + '</div>' +
      '<p class="map-hint">校园简图 · 数据来自河地大几何地图，点按红色食堂查看详情</p>' +
      '<div class="map-canvas" id="mapCanvas">' + svgHTML() + '</div>' +
      '<div class="map-legend">' +
        '<span><i class="lg lg-c"></i>食堂</span>' +
        '<span><i class="lg lg-w"></i>水体</span>' +
        '<span><i class="lg lg-s"></i>运动场</span>' +
        '<span class="lg-note">人流为前端模拟，实况以现场为准</span>' +
      '</div>' +
      '<div id="mapInfo">' + infoHTML(sel) + '</div>' +
    '</div>';
  }

  function init() {
    if (!DB.map) return;
    U.$('#page-map').innerHTML = render();
  }

  /* 全量刷新（切换食堂/进入页面） */
  function refresh() {
    var chips = U.$('#mapChips');
    if (!chips) return;
    sel = App.getState().canteenId;
    chips.innerHTML = chipsHTML();
    U.$('#mapCanvas').innerHTML = svgHTML();
    U.$('#mapInfo').innerHTML = infoHTML(sel);
  }

  /* 轻量刷新：只更新拥挤度相关的芯片和详情卡（每分钟） */
  function refreshCrowd() {
    var chips = U.$('#mapChips');
    if (!chips) return;
    chips.innerHTML = chipsHTML();
    U.$('#mapInfo').innerHTML = infoHTML(sel);
  }

  function select(cid) {
    if (!Data.canteen(cid)) return;
    sel = cid;
    App.setCanteen(cid); // 同步全局状态（首页/点餐/座位/本页都会刷新）
  }

  document.addEventListener('click', function (ev) {
    var chip = ev.target.closest('.map-chip[data-map-cid]');
    if (chip) { select(Number(chip.dataset.mapCid)); return; }
    var shape = ev.target.closest('.m-canteen[data-map-cid]');
    if (shape) { select(Number(shape.dataset.mapCid)); return; }
    var act = ev.target.closest('[data-mi]');
    if (act) App.switchPage(act.dataset.mi);
  });

  window.MapPage = { init: init, refresh: refresh, refreshCrowd: refreshCrowd, select: select, render: render };
})();
