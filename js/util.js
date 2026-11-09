/* 小食堂 · 工具函数 */
(function () {
  'use strict';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  /* 磷光图标渲染：<svg viewBox><path> */
  function icon(name, cls) {
    var ic = window.ICONS && window.ICONS[name];
    if (!ic) return '';
    return '<svg viewBox="' + ic.vb + '" fill="currentColor" class="' + (cls || '') + '" aria-hidden="true">' +
      '<path d="' + ic.d + '"/></svg>';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* 字符串哈希 + mulberry32 伪随机（确定性模拟的核心） */
  function hashSeed(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rng(key) { return mulberry32(hashSeed(key)); }

  /* 洗牌（带种子，保证同日同结果） */
  function shuffle(arr, seedKey) {
    var r = rng(seedKey);
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* Toast 轻提示 */
  var toastTimer = null;
  function toast(msg) {
    var el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  /* 菜品视觉：按名称关键词映射 emoji + 双色渐变底 */
  var FOOD_RULES = [
    ['鸡排', '🍗'], ['鸡', '🍗'], ['鸭', '🍗'], ['鱼', '🐟'], ['虾', '🦐'], ['蟹', '🦀'],
    ['鳗', '🐟'], ['牛', '🥩'], ['猪', '🥓'], ['羊', '🍖'], ['肉', '🍖'], ['排骨', '🍖'],
    ['米线', '🍜'], ['螺蛳', '🍜'], ['面', '🍜'], ['粉', '🍜'],
    ['饭', '🍚'], ['饼', '🫓'], ['馍', '🫓'], ['包', '🥟'], ['饺', '🥟'], ['馄饨', '🥟'],
    ['粥', '🥣'], ['汤', '🍲'], ['锅', '🍲'], ['麻辣', '🍲'], ['冒菜', '🍲'], ['香锅', '🍲'],
    ['蛋', '🍳'], ['豆腐', '🍢'], ['豆皮', '🍢'], ['腐竹', '🍢'],
    ['沙拉', '🥗'], ['蔬', '🥗'], ['菜', '🥗'], ['菌', '🍄'], ['菇', '🍄'],
    ['薯', '🍟'], ['炸', '🍤'], ['奶茶', '🧋'], ['奶', '🧋'], ['咖啡', '☕'], ['茶', '🍵'],
    ['果汁', '🧃'], ['饮料', '🥤'], ['可乐', '🥤'], ['水', '🥤'],
    ['蛋糕', '🍰'], ['甜品', '🍰'], ['糖', '🍭'], ['葫芦', '🍡'], ['面包', '🍞'], ['烘焙', '🥐'],
  ];

  var FOOD_TINT = {
    '🍗': ['#F9DED8', '#EFC0B4'], '🥩': ['#F9DED8', '#EFC0B4'], '🥓': ['#F9DED8', '#EFC0B4'],
    '🍖': ['#F9DED8', '#EFC0B4'], '🐟': ['#FDE3D5', '#F6C3AB'], '🦐': ['#FDE3D5', '#F6C3AB'],
    '🦀': ['#FDE3D5', '#F6C3AB'], '🍤': ['#FDE3D5', '#F6C3AB'],
    '🍚': ['#FBEBD3', '#F3D9B8'], '🍜': ['#F7E7C9', '#EED3A8'],
    '🫓': ['#F3E8D8', '#E5D2B8'], '🥟': ['#F3E8D8', '#E5D2B8'], '🍞': ['#F3E8D8', '#E5D2B8'],
    '🥐': ['#F3E8D8', '#E5D2B8'], '🥣': ['#F7E7C9', '#EED3A8'], '🍲': ['#FBEAE0', '#F4CDBB'],
    '🍳': ['#FBEAE0', '#F4CDBB'], '🍢': ['#F3E8D8', '#E5D2B8'],
    '🥗': ['#E4F0DC', '#CDE3BD'], '🍄': ['#E4F0DC', '#CDE3BD'],
    '🍟': ['#FBEAE0', '#F4CDBB'], '🧋': ['#DFF0EC', '#C3E0D8'], '☕': ['#DFF0EC', '#C3E0D8'],
    '🍵': ['#DFF0EC', '#C3E0D8'], '🧃': ['#DFF0EC', '#C3E0D8'], '🥤': ['#DFF0EC', '#C3E0D8'],
    '🍰': ['#F4E3EE', '#E7C8DE'], '🍭': ['#F4E3EE', '#E7C8DE'], '🍡': ['#F4E3EE', '#E7C8DE'],
  };

  function dishVisual(name, category) {
    var e = (category === 'drink') ? '🥤' : (category === 'condiment') ? '🧂' : '🍱';
    var n = String(name || '');
    for (var i = 0; i < FOOD_RULES.length; i++) {
      if (n.indexOf(FOOD_RULES[i][0]) !== -1) { e = FOOD_RULES[i][1]; break; }
    }
    var t = FOOD_TINT[e] || ['#FBE9DE', '#F6D9C9'];
    return { emoji: e, t1: t[0], t2: t[1] };
  }

  /* 日期工具 */
  function ymd(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function cnDate(d) {
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  /* 饮食偏好（忌口/目标），首页推荐与今日菜单据此过滤 */
  var KEY_PREFS = 'xs-prefs-v1';

  function prefs() {
    try {
      var v = localStorage.getItem(KEY_PREFS);
      var p = v ? JSON.parse(v) : {};
      return { avoid: p.avoid || [], goal: p.goal || '' };
    } catch (e) { return { avoid: [], goal: '' }; }
  }

  function setPrefs(p) {
    try { localStorage.setItem(KEY_PREFS, JSON.stringify(p)); } catch (e) { /* 静默 */ }
  }

  window.U = { $: $, $$: $$, icon: icon, esc: esc, hashSeed: hashSeed, rng: rng,
    shuffle: shuffle, toast: toast, dishVisual: dishVisual, ymd: ymd, cnDate: cnDate,
    pad2: pad2, prefs: prefs, setPrefs: setPrefs };
})();
