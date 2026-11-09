/* 小食堂 · 数据层：加载 data/*.json 并建立索引 */
(function () {
  'use strict';

  var DB = {
    canteens: [],        // data/canteens.json
    windows: [],         // data/windows.json
    dishes: [],          // data/dishes.json
    qinghe: [],          // data/qinghe.json
    map: null,           // data/map.json（校园地图图层）
    winById: new Map(),
    dishById: new Map(),
    dishesByWin: new Map(),
    loaded: false,
  };

  function index() {
    DB.winById = new Map(DB.windows.map(function (w) { return [w.i, w]; }));
    DB.dishById = new Map(DB.dishes.map(function (d) { return [d.i, d]; }));
    DB.dishesByWin = new Map();
    DB.dishes.forEach(function (d) {
      if (!DB.dishesByWin.has(d.w)) DB.dishesByWin.set(d.w, []);
      DB.dishesByWin.get(d.w).push(d);
    });
  }

  function fetchJSON(path) {
    return fetch(path, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(path + ' -> ' + r.status);
      return r.json();
    });
  }

  function load() {
    if (DB.loaded) return Promise.resolve(DB);
    return Promise.all([
      fetchJSON('data/canteens.json'),
      fetchJSON('data/windows.json'),
      fetchJSON('data/dishes.json'),
      fetchJSON('data/qinghe.json'),
      fetchJSON('data/map.json'),
    ]).then(function (rs) {
      DB.canteens = rs[0];
      DB.windows = rs[1];
      DB.dishes = rs[2];
      DB.qinghe = rs[3];
      DB.map = rs[4];
      index();
      DB.loaded = true;
      return DB;
    });
  }

  function canteen(id) {
    return DB.canteens.find(function (c) { return c.i === id; }) || null;
  }

  function windowsOf(cid) {
    return DB.windows.filter(function (w) { return w.c === cid; });
  }

  window.DB = DB;
  window.Data = { load: load, canteen: canteen, windowsOf: windowsOf };
})();
