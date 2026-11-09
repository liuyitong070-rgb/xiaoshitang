/* 小食堂 · 本地存储（购物车 / 收藏 / 订单）
   静态托管无后端，用户数据存 localStorage，仅本机可见。 */
(function () {
  'use strict';

  var KEY_CART = 'xs-cart-v1';
  var KEY_FAVS = 'xs-favs-v1';
  var KEY_ORDERS = 'xs-orders-v1';

  function read(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) { return fallback; }
  }

  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* 隐私模式等场景静默降级 */ }
  }

  /* ---------------- 购物车 ---------------- */
  var Cart = {
    items: read(KEY_CART, {}),   // { dishId: qty }

    count: function () {
      return Object.values(this.items).reduce(function (s, q) { return s + q; }, 0);
    },

    add: function (dishId) {
      this.items[dishId] = (this.items[dishId] || 0) + 1;
      write(KEY_CART, this.items);
    },

    setQty: function (dishId, qty) {
      if (qty <= 0) delete this.items[dishId];
      else this.items[dishId] = qty;
      write(KEY_CART, this.items);
    },

    clear: function () {
      this.items = {};
      write(KEY_CART, this.items);
    },

    qty: function (dishId) { return this.items[dishId] || 0; },

    /* 总价：解析价格字符串中的首个数字（"¥6" / "1.5元" / "12.8"），无法解析计 0 */
    total: function () {
      var self = this;
      var sum = 0;
      Object.keys(this.items).forEach(function (id) {
        var d = self.dish(Number(id));
        sum += (d ? d._num : 0) * self.items[id];
      });
      return Math.round(sum * 10) / 10;
    },

    dish: function (dishId) {
      var d = DB.dishes.find(function (x) { return x.i === dishId; });
      if (!d) return null;
      var m = String(d.p).match(/[\d.]+/);
      return { name: d.n, price: d.p, _num: m ? parseFloat(m[0]) : 0, winId: d.w };
    },

    rows: function () {
      var self = this;
      return Object.keys(this.items).map(function (id) {
        var d = self.dish(Number(id));
        var w = d ? DB.winById.get(d.winId) : null;
        return {
          dishId: Number(id), qty: self.items[id],
          name: d ? d.name : '未知菜品', price: d ? d.price : '-', num: d ? d._num : 0,
          window: w ? w.n : '',
        };
      }).filter(function (r) { return r.name !== '未知菜品'; });
    },
  };

  /* ---------------- 收藏 ---------------- */
  var Favs = {
    ids: read(KEY_FAVS, []),

    has: function (dishId) { return this.ids.indexOf(dishId) !== -1; },

    toggle: function (dishId) {
      var i = this.ids.indexOf(dishId);
      if (i === -1) this.ids.push(dishId);
      else this.ids.splice(i, 1);
      write(KEY_FAVS, this.ids);
      return i === -1;
    },
  };

  /* ---------------- 订单 ---------------- */
  var Orders = {
    list: read(KEY_ORDERS, []),

    create: function (payload) {
      var o = {
        id: 'D' + Date.now().toString(36).toUpperCase(),
        ts: Date.now(),
        canteenId: payload.canteenId,
        pickup: payload.pickup,          // 预约取餐时段文案
        items: payload.rows,
        total: payload.total,
        status: 'pending',               // pending 待取餐
      };
      this.list.unshift(o);
      write(KEY_ORDERS, this.list);
      return o;
    },

    finish: function (id) {
      var o = this.list.find(function (x) { return x.id === id; });
      if (o) { o.status = 'done'; write(KEY_ORDERS, this.list); }
    },
  };

  window.Cart = Cart;
  window.Favs = Favs;
  window.Orders = Orders;
})();
