/* 小食堂 · 模拟引擎
   ------------------------------------------------------------
   静态托管无后端，人流/空座/今日菜单/推荐均在此确定性模拟：
   - 拥挤度 = 用餐时段基准曲线 + 按「食堂+日期+小时」种子的噪声
   - 今日菜单 = 以日期为种子从各档口抽菜，同一天内稳定
   - 热门推荐 = 真实评分优先，不足部分用稳定种子补齐
   ------------------------------------------------------------ */
(function () {
  'use strict';

  /* 用餐时段基准曲线：横轴为小时（支持小数），纵轴为占用率 0-1 */
  var CURVE = [
    [6, 0.08], [7, 0.25], [8, 0.34], [9, 0.20], [10, 0.10], [11, 0.30],
    [12, 0.72], [12.5, 0.95], [13, 0.36], [14, 0.10], [15, 0.08], [16, 0.13],
    [17, 0.36], [18, 0.80], [19, 0.40], [20, 0.16], [21, 0.10],
  ];

  /* 各食堂容纳量（模拟参数，非官方数据） */
  var CAPACITY = { 1: 900, 2: 750, 3: 650, 4: 450, 5: 260, 6: 120 };

  var LEVELS = [
    { key: 'ok', max: 0.35, label: '空闲', desc: '现在去正好，基本不用排队' },
    { key: 'warn', max: 0.60, label: '适中', desc: '人不多，等位一般不超过 5 分钟' },
    { key: 'hot', max: 0.80, label: '较挤', desc: '人比较多，预计排队 10 到 15 分钟' },
    { key: 'danger', max: 1.01, label: '爆满', desc: '正在用餐高峰，建议错峰前往' },
  ];

  function baseRatio(hour) {
    var h = Math.max(CURVE[0][0], Math.min(CURVE[CURVE.length - 1][0], hour));
    for (var i = 1; i < CURVE.length; i++) {
      if (h <= CURVE[i][0]) {
        var a = CURVE[i - 1], b = CURVE[i];
        var t = (h - a[0]) / (b[0] - a[0]);
        return a[1] + t * (b[1] - a[1]);
      }
    }
    return CURVE[CURVE.length - 1][1];
  }

  function noise(cid, hour) {
    var now = new Date();
    var seed = U.hashSeed('crowd:' + cid + ':' + U.ymd(now) + ':' + Math.floor(hour));
    return (seed % 1000) / 1000 * 0.16 - 0.08;
  }

  function hourOf(date) {
    return date.getHours() + date.getMinutes() / 60;
  }

  function levelOf(ratio) {
    for (var i = 0; i < LEVELS.length; i++) {
      if (ratio < LEVELS[i].max) return LEVELS[i];
    }
    return LEVELS[LEVELS.length - 1];
  }

  function crowd(cid, date) {
    var d = date || new Date();
    var h = hourOf(d);
    var ratio = Math.max(0.02, Math.min(0.99, baseRatio(h) + noise(cid, Math.floor(h))));
    var lv = levelOf(ratio);
    var cap = CAPACITY[cid] || 400;
    var people = Math.max(10, Math.round((ratio * cap) / 10) * 10);

    /* 错峰建议 */
    var tip = lv.desc;
    if (lv.key === 'hot' || lv.key === 'danger') {
      if (h >= 11 && h < 13.5) tip += '，午间高峰一般持续到 13:00 左右';
      else if (h >= 17 && h < 19.5) tip += '，晚间高峰一般持续到 19:00 左右';
    }

    /* 当日曲线（供图表渲染） */
    var curve = [];
    for (var t = 6; t <= 21; t++) {
      var r = Math.max(0.02, Math.min(0.99, baseRatio(t) + noise(cid, t)));
      curve.push({ hour: t, ratio: r, key: levelOf(r).key });
    }

    return { ratio: ratio, level: lv, people: people, tip: tip, curve: curve, hour: h };
  }

  /* 今日菜单：以「日期+食堂」为种子，从该食堂档口各抽 1 道菜 */
  function todayMenu(cid, date, n) {
    var d = date || new Date();
    var seedKey = 'menu:' + cid + ':' + U.ymd(d);
    var wins = U.shuffle(Data.windowsOf(cid), seedKey);
    var picks = [];
    for (var i = 0; i < wins.length && picks.length < (n || 8); i++) {
      var ds = (DB.dishesByWin.get(wins[i].i) || [])
        .filter(function (x) { return x.c === 'dish'; });
      if (!ds.length) continue;
      var pick = ds[Math.floor(U.rng(seedKey + ':w' + wins[i].i)() * ds.length)];
      picks.push({
        name: pick.n, price: pick.p, window: wins[i].n,
        visual: U.dishVisual(pick.n, pick.c), dishId: pick.i,
      });
    }
    return picks;
  }

  /* 热门推荐：真实评分优先，不足用稳定种子补齐 */
  function hotDishes(n) {
    var rated = DB.dishes.filter(function (x) { return x.rc > 0 && x.ra > 0; })
      .sort(function (a, b) {
        var sa = a.ra * Math.log(a.rc + 1), sb = b.ra * Math.log(b.rc + 1);
        return sb - sa;
      });
    var out = rated.slice(0, n).map(function (d) {
      var w = DB.winById.get(d.w);
      return {
        name: d.n, price: d.p, window: w ? w.n : '', canteenId: w ? w.c : 0,
        rating: Math.round(d.ra * 10) / 10, rc: d.rc,
        visual: U.dishVisual(d.n, d.c),
      };
    });
    if (out.length < n) {
      var rest = U.shuffle(DB.dishes.filter(function (x) { return x.c === 'dish'; }), 'hot-fill');
      for (var i = 0; i < rest.length && out.length < n; i++) {
        if (out.some(function (o) { return o.name === rest[i].n; })) continue;
        var w2 = DB.winById.get(rest[i].w);
        out.push({
          name: rest[i].n, price: rest[i].p, window: w2 ? w2.n : '',
          canteenId: w2 ? w2.c : 0, rating: 0, rc: 0,
          visual: U.dishVisual(rest[i].n, rest[i].c),
        });
      }
    }
    return out.slice(0, n);
  }

  /* 高峰提醒（可关闭，同日同时段只提示一次） */
  function peakBanner(date) {
    var d = date || new Date();
    var min = d.getHours() * 60 + d.getMinutes();
    var meals = [
      { key: 'lunch', name: '午间', start: 11 * 60 + 30, end: 12 * 60 + 45, lead: 30 },
      { key: 'dinner', name: '晚间', start: 17 * 60 + 30, end: 18 * 60 + 45, lead: 30 },
    ];
    for (var i = 0; i < meals.length; i++) {
      var m = meals[i];
      if (min >= m.start && min <= m.end) {
        return { show: true, key: m.key + '-on', title: m.name + '高峰进行中',
          text: '现在是用餐高峰，排队时间较长，建议错峰前往' };
      }
      if (min >= m.start - m.lead && min < m.start) {
        return { show: true, key: m.key + '-pre', title: m.name + '高峰即将到来',
          text: '预计 ' + U.pad2(Math.floor(m.start / 60)) + ':' + U.pad2(m.start % 60) + ' 起人流明显增加，现在去正好' };
      }
    }
    return { show: false };
  }

  function peakDismissKey(b) {
    return 'peak-dismiss:' + U.ymd(new Date()) + ':' + b.key;
  }

  /* 空座占用率（座位页用）：基于拥挤度 + 区域种子 */
  function seatRatio(cid, zoneSeed) {
    var c = crowd(cid);
    var r = U.rng('seat:' + cid + ':' + U.ymd(new Date()) + ':' + zoneSeed)();
    return Math.max(0.05, Math.min(0.98, c.ratio * 0.92 + r * 0.2 - 0.05));
  }

  window.Sim = { crowd: crowd, todayMenu: todayMenu, hotDishes: hotDishes,
    peakBanner: peakBanner, peakDismissKey: peakDismissKey, seatRatio: seatRatio,
    CAPACITY: CAPACITY };
})();
