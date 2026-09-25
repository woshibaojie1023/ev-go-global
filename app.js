/* ══════════════════════════════════════════════════════════════
   新能源车出海市场决策助手 v3 · app.js
   设计系统：DESIGN.md（纸底 #F5F1E8 + 墨蓝 #101D2E + 翡翠玉 #0E8F6C）
   职责：状态 / i18n / 左栏榜单+长尾 / 中栏 Canvas 点阵地图 /
        右栏国家简报（含 SVG 雷达）/ 底部来源与声明 / 导出（打印·CSV·MD）。
   依赖（加载顺序）：landmask.js → data.js → i18n.js → app.js
   零网络请求、零外部依赖；严格对接 index.html 的 id 与 style.css 既有类名。
   ══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ───────────── 0. 工具 ───────────── */
  var $ = function (id) { return document.getElementById(id); };
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ───────────── 1. 状态 ───────────── */
  var state = {
    lang: localStorage.getItem("ev-go-lang") || "zh-CN",
    selectedId: "thailand",
    bloc: "ALL",
    query: "",
    tailOpen: false,
    tailFiltered: [],      // 当前 bloc 下可见的长尾国（供地图 dim）
    hoverId: null,         // 地图悬停 / 键盘焦点节点
    canvasW: 0, canvasH: 0, dpr: 1,
    nodes: [],             // 地图节点（深评+长尾）
    colProgress: 128,      // 签名入场：列点亮进度 0..128
    nodeStart: Infinity,   // 节点浮现起点（时间戳）
    rippleStart: 0,        // 选中脉冲起点
    loaded: false,         // 入场是否已播放（语言切换/resize 不重放）
    compareIds: [],        // 多国对比：深评国 id 列表，上限 COMPARE_MAX
    compareToastAt: 0,     // 上限提示节流时间戳
    chipsExpanded: false   // 左栏 chip「更多」展开状态
  };
  // 对比模式色序（与信号三色同系，按加入顺序分配）
  var COMPARE_COLORS = ["#0E8F6C", "#C88A2B", "#B5482E"];
  var COMPARE_MAX = 3;
  // 功能切片开关：完整版两者皆 true；历史快照中对应切片之前为 false
  // （build-history 按切片翻转，使未实现雷达/导出的阶段真实可运行）
  var HAS_RADAR = true;
  var HAS_EXPORT = true;
  // 作品集署名：填入真实姓名后，打印报告封面自动输出"作者：xxx"；留空则不显示署名行
  var PROFILE = { name: "" };
  // 反馈收件邮箱：配置真实邮箱后自动显示"邮件反馈"入口；占位值时仅显示 Issues 入口
  var FEEDBACK_EMAIL = "854287747@qq.com";
  // 反馈公开路径：GitHub Issues 提单页（主路径，公开透明、状态可追踪）
  var ISSUES_URL = "https://github.com/woshibaojie1023/ev-go-global/issues/new";
  // 线上站点地址：Markdown 报告与打印封面署名区使用
  var SITE_URL = "https://woshibaojie1023.github.io/ev-go-global/";
  // 本包内置数据版本（每次季度刷新与 version.json 同步）
  var BUNDLED_DATA_VERSION = "2026Q3";
  // 探测线上版本时，本地打开 file:// 直接跳过，避免无意义报错
  var IS_HTTP = location.protocol === "http:" || location.protocol === "https:";
  if (!LANGS.some(function (l) { return l.code === state.lang; })) state.lang = "zh-CN";

  /* ───────────── 2. i18n 辅助 ───────────── */
  function t(key) {
    var u = (I18N[state.lang] && I18N[state.lang].ui) || I18N["zh-CN"].ui;
    return u[key] != null ? u[key] : (I18N["zh-CN"].ui[key] != null ? I18N["zh-CN"].ui[key] : key);
  }
  function dict() { return I18N[state.lang] || I18N["zh-CN"]; }
  // 报告模板文案（位于 I18N[lang].report）
  function rt(key) {
    var r = (dict().report) || I18N["zh-CN"].report;
    return r[key] != null ? r[key] : key;
  }
  // {zh,en} 叙事字段：zh-CN/zh-TW → zh；en/ja/ko → en
  function loc(obj) {
    if (!obj) return "";
    var useZh = state.lang === "zh-CN" || state.lang === "zh-TW";
    return (useZh ? obj.zh : null) || obj[state.lang] || obj.en || obj.zh || "";
  }
  function cName(c) { return (dict().countries && dict().countries[c.id]) || c.nameEn; }
  function tailName(x) {
    if (state.lang === "zh-CN" || state.lang === "zh-TW") return x.name;
    if (state.lang === "en") return x.nameEn;
    if (state.lang === "ja") return x.nameJa || x.nameEn;
    if (state.lang === "ko") return x.nameKo || x.nameEn;
    return x.nameEn;
  }
  function blocLabel(key) {
    var b = dict().blocs || {};
    return b[key] != null ? b[key] : key;
  }
  function regionLabel(r) {
    var g = dict().regions || {};
    return g[r] != null ? g[r] : r;
  }

  /* ───────────── 3. 派生数据 ───────────── */
  var ranked = COUNTRIES.map(function (c) {
    return { c: c, score: totalScore(c.scores) };
  }).sort(function (a, b) { return b.score - a.score; });
  // rank 1..15
  ranked.forEach(function (it, i) { it.rank = i + 1; });

  function rankOf(id) {
    for (var i = 0; i < ranked.length; i++) if (ranked[i].c.id === id) return ranked[i].rank;
    return null;
  }
  function byId(id) {
    for (var i = 0; i < COUNTRIES.length; i++) if (COUNTRIES[i].id === id) return COUNTRIES[i];
    for (var j = 0; j < LONGTAIL.length; j++) if (LONGTAIL[j].id === id) return LONGTAIL[j];
    return null;
  }
  function isLongtail(id) { return LONGTAIL.some(function (x) { return x.id === id; }); }
  function scoreOf(id) {
    for (var i = 0; i < ranked.length; i++) if (ranked[i].c.id === id) return ranked[i].score;
    return null;
  }

  /* ── 多国对比：仅深评 15 国可加入，上限 3 ── */
  function compareIndex(id) { return state.compareIds.indexOf(id); }
  function isComparing(id) { return compareIndex(id) >= 0; }
  function compareColor(id) {
    var i = compareIndex(id);
    return i >= 0 ? COMPARE_COLORS[i] : null;
  }
  // 当前雷达/对比条要展示的国家 id 列表：≥2 国为对比模式，否则单国
  function displayIds() {
    return state.compareIds.length >= 2 ? state.compareIds.slice() : [state.selectedId];
  }
  function toggleCompare(id) {
    if (isLongtail(id) || !byId(id)) return;
    if (isComparing(id)) {
      state.compareIds = state.compareIds.filter(function (x) { return x !== id; });
      renderBriefing(); scheduleDraw();
      return;
    }
    if (state.compareIds.length >= COMPARE_MAX) {
      var now = Date.now();
      if (now - state.compareToastAt > 1200) {
        state.compareToastAt = now;
        toast(t("compareLimit"));
      }
      return;
    }
    state.compareIds.push(id);
    toast(t("compareAdd"));
    renderBriefing(); scheduleDraw();
  }
  function clearCompare(silent) {
    if (!state.compareIds.length) return;
    state.compareIds = [];
    if (!silent) toast(t("compareClear"));
    renderBriefing(); scheduleDraw();
  }

  // chip 成员数：COUNTRIES.blocs + LONGTAIL.org 中含该 key 的数量
  function blocCount(key) {
    if (key === "ALL") return COUNTRIES.length + LONGTAIL.length;
    var n = 0;
    COUNTRIES.forEach(function (c) { if (c.blocs.indexOf(key) >= 0) n++; });
    LONGTAIL.forEach(function (x) { if (x.org.indexOf(key) >= 0) n++; });
    return n;
  }
  // 国家是否属于当前 bloc
  function inBloc(o) {
    if (state.bloc === "ALL") return true;
    var arr = o.blocs || o.org || [];
    return arr.indexOf(state.bloc) >= 0;
  }
  // 搜索匹配：本地国名 / nameEn / 中文原名 小写包含
  function matchQuery(nameLocal, o) {
    var q = state.query.trim().toLowerCase();
    if (!q) return true;
    var hay = [nameLocal, o.nameEn, o.name].join(" ").toLowerCase();
    return hay.indexOf(q) >= 0;
  }

  function signalColor(score) {
    if (score >= 75) return "#0E8F6C";
    if (score >= 60) return "#C88A2B";
    return "#B5482E";
  }
  function rankRadius(rank) { // r1 → 11, r15 → 7 线性（收窄半径差，缓解高密度区压盖）
    return 11 - (rank - 1) * (4 / 14);
  }
  // ISO 两字母代码块（映射，避免 id 截断歧义）
  var ISO = {
    thailand: "TH", uae: "AE", australia: "AU", indonesia: "ID", saudi: "SA",
    brazil: "BR", newzealand: "NZ", malaysia: "MY", mexico: "MX", turkey: "TR",
    vietnam: "VN", germany: "DE", korea: "KR", france: "FR", japan: "JP"
  };
  function isoOf(id) { return ISO[id] || id.slice(0, 2).toUpperCase(); }

  /* ───────────── 4. 顶栏 ───────────── */
  function renderTopbar() {
    var ui = dict().ui;
    $("appTitle").textContent = t("appTitle");
    $("dataAsOf").textContent = fmt(t("dataAsOfLabel"), { d: DATA_AS_OF[state.lang] || DATA_AS_OF["zh-CN"] });
    document.title = t("appTitle");
    document.documentElement.lang = state.lang;

    // 语言胶囊
    var ls = $("langSwitch");
    ls.innerHTML = "";
    LANGS.forEach(function (l) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "lang-btn" + (l.code === state.lang ? " is-active" : "");
      b.textContent = l.label;
      b.setAttribute("aria-pressed", l.code === state.lang ? "true" : "false");
      b.addEventListener("click", function () { setLang(l.code); });
      ls.appendChild(b);
    });

    $("btnPrintLabel").textContent = t("exportPdf");
    $("btnCsvLabel").textContent = t("exportCsv");
    $("btnCopyLabel").textContent = t("copyReport");
  }

  function setLang(code) {
    if (code === state.lang) return;
    state.lang = code;
    localStorage.setItem("ev-go-lang", code);
    renderAll();
  }

  /* ───────────── 5. 左栏：搜索 / chip / 榜单 / 长尾 ───────────── */
  function renderLeftRail() {
    // 搜索
    var input = $("searchInput");
    input.placeholder = t("searchPlaceholder");
    input.setAttribute("aria-label", t("searchPlaceholder"));
    $("searchClear").hidden = !state.query;

    // chips：默认仅露 PRIMARY_BLOCS，其余内联收纳进「更多」；宽屏由 CSS 全部展开
    var cr = $("chipRow");
    cr.innerHTML = "";
    var PRIMARY_BLOCS = { ALL: 1, RCEP: 1, EU: 1, ASEAN: 1 };
    BLOCS.forEach(function (bl) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (state.bloc === bl.key ? " is-active" : "") +
                    (PRIMARY_BLOCS[bl.key] ? "" : " chip-extra");
      var label = bl.key === "ALL" ? blocLabel("all") : blocLabel(bl.key);
      b.innerHTML = esc(label) + '<span class="chip-count">' + blocCount(bl.key) + "</span>";
      b.addEventListener("click", function () {
        state.bloc = (state.bloc === bl.key) ? "ALL" : bl.key;
        renderLeftRail();
        scheduleDraw();
        renderBriefing();
      });
      cr.appendChild(b);
    });

    // 更多 / 收起开关
    var hasHiddenActive = BLOCS.some(function (bl) {
      return state.bloc === bl.key && !PRIMARY_BLOCS[bl.key];
    });
    if (hasHiddenActive && !state.chipsExpanded) state.chipsExpanded = true;
    var moreBtn = document.createElement("button");
    moreBtn.type = "button";
    moreBtn.className = "chip chip-more";
    moreBtn.textContent = state.chipsExpanded ? t("chipLess") : t("chipMore");
    moreBtn.setAttribute("aria-expanded", state.chipsExpanded ? "true" : "false");
    moreBtn.addEventListener("click", function () {
      state.chipsExpanded = !state.chipsExpanded;
      renderLeftRail();
    });
    cr.appendChild(moreBtn);
    cr.className = state.chipsExpanded ? "is-expanded" : "";

    // rank label
    $("rankLabel").innerHTML = esc(t("keyTrackTitle")) +
      '<span class="count-note">' + esc(fmt(t("countLabel"), { n: COUNTRIES.length })) + "</span>";

    // rank list
    var list = $("rankList");
    list.innerHTML = "";
    var visible = 0;
    ranked.forEach(function (it) {
      var c = it.c;
      var nm = cName(c);
      var okBloc = inBloc(c);
      var okQ = matchQuery(nm, c);
      var shown = okBloc && okQ;
      if (shown) visible++;
      var row = document.createElement("button");
      row.type = "button";
      row.className = "rank-row" +
        (c.id === state.selectedId ? " is-selected" : "") +
        (shown ? "" : " is-dim");
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", c.id === state.selectedId ? "true" : "false");
      row.style.display = shown ? "" : "none";
      var color = signalColor(it.score);
      row.innerHTML =
        '<span class="rank-num">' + it.rank + "</span>" +
        '<span class="rank-main">' +
          '<span class="rank-name">' + esc(nm) + "</span>" +
          '<span class="rank-bar"><i style="width:' + it.score + '%;background:' + color + '"></i></span>' +
        "</span>" +
        '<span class="rank-score" style="color:' + color + '">' + it.score + "</span>";
      row.addEventListener("click", function () { select(c.id); });
      list.appendChild(row);
    });

    $("noResult").hidden = visible !== 0;
    if (visible === 0) $("noResult").textContent = t("noResult");

    // 长尾
    state.tailFiltered = LONGTAIL.filter(function (x) {
      return inBloc(x) && matchQuery(tailName(x), x);
    });
    var tg = $("tailToggle");
    tg.setAttribute("aria-expanded", state.tailOpen ? "true" : "false");
    $("tailToggleLabel").textContent = t("tailTrackTitle") + " · " + LONGTAIL.length;
    var drawer = $("tailDrawer");
    drawer.hidden = !state.tailOpen;
    if (state.tailOpen) renderTailList();
  }

  function renderTailList() {
    var tl = $("tailList");
    tl.innerHTML = "";
    if (state.tailFiltered.length === 0) {
      tl.innerHTML = '<div class="tail-empty">' + emptyFilterHTML() + "</div>";
      return;
    }
    state.tailFiltered.forEach(function (x) {
      var item = document.createElement("button");
      item.type = "button";
      item.className = "tail-item" + (x.id === state.selectedId ? " is-selected" : "");
      var orgs = x.org.map(function (k) { return blocLabel(k); }).join(" / ");
      var tariff = (dict().tariffLevels && dict().tariffLevels[x.tariff]) || x.tariff;
      var nev = (dict().nevLevels && dict().nevLevels[x.nev]) || x.nev;
      var note = loc({ zh: x.noteZh, en: x.noteEn });
      item.innerHTML =
        '<span class="tail-name">' + esc(tailName(x)) +
          '<span class="en-tag">' + esc(x.nameEn.toUpperCase().slice(0, 2)) + "</span>" +
        "</span>" +
        '<span class="tail-meta">' +
          (orgs ? "<span>" + esc(orgs) + "</span>" : "") +
          "<span>" + esc(t("tariff")) + t("colon") + esc(tariff) + "</span>" +
          "<span>" + esc(t("nevLevel")) + t("colon") + esc(nev) + "</span>" +
        "</span>" +
        '<span class="tail-note">' + esc(note) + "</span>";
      item.addEventListener("click", function () { select(x.id); });
      tl.appendChild(item);
    });
  }

  /* ───────────── 6. 中栏：Canvas 点阵地图 ───────────── */
  var canvas, ctx, mapWrap;

  function project(lon, lat, geo) {
    var x = geo.padX + (lon + 180) / 360 * geo.mapW;
    var y = geo.padY + (LANDMASK.lat0 - lat) / (LANDMASK.lat0 - LANDMASK.lat1) * geo.mapH;
    return { x: x, y: y };
  }

  function mapGeometry() {
    var sp = Math.min(state.canvasW / LANDMASK.cols, state.canvasH / LANDMASK.rows);
    var mapW = sp * LANDMASK.cols;
    var mapH = sp * LANDMASK.rows;
    return {
      sp: sp, mapW: mapW, mapH: mapH,
      padX: (state.canvasW - mapW) / 2,
      padY: (state.canvasH - mapH) / 2
    };
  }

  function buildNodes(geo) {
    var arr = [];
    ranked.forEach(function (it) {
      var p = project(it.c.lon, it.c.lat, geo);
      arr.push({
        id: it.c.id, longtail: false, rank: it.rank, score: it.score,
        x: p.x, y: p.y, ax: p.x, ay: p.y, r: rankRadius(it.rank),
        color: signalColor(it.score), name: cName(it.c), region: regionLabel(it.c.region)
      });
    });
    LONGTAIL.forEach(function (x) {
      var p = project(x.lon, x.lat, geo);
      arr.push({
        id: x.id, longtail: true, rank: null, score: null,
        x: p.x, y: p.y, ax: p.x, ay: p.y, r: 2.5,
        color: "#5A6577", name: tailName(x), region: ""
      });
    });
    state.nodes = arr;
    relaxCollisions(arr);
  }

  // 碰撞松弛（参考 d3-force forceCollide / Mapbox 标注碰撞范式）：
  // 对屏幕距离 < 两半径和 ×0.85 的节点对，沿圆心连线施加斥力；
  // 每轮衰减并回归地理锚点，总位移封顶 8px，保持地理位置可辨识。
  // 近邻查询用空间网格分桶；长尾点半径小，与重点节点的推开按 0.5 权重。
  function relaxCollisions(arr) {
    var deep = arr.filter(function (n) { return !n.longtail; });
    if (deep.length < 2) return;
    var ITERS = 5, MAX_D = 8;
    for (var it = 0; it < ITERS; it++) {
      var decay = 1 - it / ITERS;
      // 空间网格：格子尺寸取最大直径，保证只查邻近格
      var cell = 24, grid = {};
      deep.forEach(function (n, i) {
        var gx = Math.floor(n.x / cell), gy = Math.floor(n.y / cell);
        var key = gx + ":" + gy;
        (grid[key] = grid[key] || []).push(i);
      });
      for (var a = 0; a < deep.length; a++) {
        var n1 = deep[a];
        var gx = Math.floor(n1.x / cell), gy = Math.floor(n1.y / cell);
        for (var dxg = -1; dxg <= 1; dxg++) {
          for (var dyg = -1; dyg <= 1; dyg++) {
            var bucket = grid[(gx + dxg) + ":" + (gy + dyg)];
            if (!bucket) continue;
            for (var bi = 0; bi < bucket.length; bi++) {
              var b = bucket[bi];
              if (b <= a) continue;
              var n2 = deep[b];
              var vx = n2.x - n1.x, vy = n2.y - n1.y;
              var dist = Math.sqrt(vx * vx + vy * vy) || 0.01;
              var minD = (n1.r + n2.r) * 0.85;
              if (dist >= minD) continue;
              var push = (minD - dist) * 0.5 * decay;
              var ux = vx / dist, uy = vy / dist;
              n1.x -= ux * push; n1.y -= uy * push;
              n2.x += ux * push; n2.y += uy * push;
            }
          }
        }
      }
      // 回归锚点的轻拉力 + 位移封顶
      deep.forEach(function (n) {
        n.x += (n.ax - n.x) * 0.25;
        n.y += (n.ay - n.y) * 0.25;
        var ddx = n.x - n.ax, ddy = n.y - n.ay;
        var dd = Math.sqrt(ddx * ddx + ddy * ddy);
        if (dd > MAX_D) {
          n.x = n.ax + ddx / dd * MAX_D;
          n.y = n.ay + ddy / dd * MAX_D;
        }
      });
    }
  }

  function resizeCanvas() {
    if (!mapWrap) return;
    var rect = mapWrap.getBoundingClientRect();
    var w = Math.max(50, rect.width), h = Math.max(50, rect.height);
    state.dpr = window.devicePixelRatio || 1;
    state.canvasW = w; state.canvasH = h;
    canvas.width = Math.round(w * state.dpr);
    canvas.height = Math.round(h * state.dpr);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    var geo = mapGeometry();
    buildNodes(geo);
    drawMap();
  }

  function drawMap() {
    if (!ctx || state.canvasW === 0) return;
    ctx.clearRect(0, 0, state.canvasW, state.canvasH);
    var geo = mapGeometry();
    var sp = geo.sp;
    // 陆地点半径：桌面 sp*0.18（签名视觉不变）；小屏 sp<4 时放大系数，避免点阵亚像素消失
    var r = (sp < 4) ? sp * 0.38 : sp * 0.18;

    // ── 陆地点阵：列进度控制 alpha（签名入场）──
    var baseA = 0.16;
    ctx.fillStyle = "#16233A";
    for (var row = 0; row < LANDMASK.rows; row++) {
      var line = LANDMASK.grid[row];
      for (var col = 0; col < LANDMASK.cols; col++) {
        if (line.charAt(col) !== "1") continue;
        var a;
        if (state.loaded || REDUCED) {
          a = baseA;
        } else {
          // 第 col 列以左渐入
          var d = state.colProgress - col;
          a = baseA * clamp(d / 6, 0, 1);
        }
        if (a <= 0.003) continue;
        ctx.globalAlpha = a;
        var cx = geo.padX + (col + 0.5) * sp;
        var cy = geo.padY + (row + 0.5) * sp;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // ── 节点 ──
    var now = performance.now();
    state.nodes.forEach(function (nd) {
      var active = inBloc(byId(nd.id));
      var isSel = nd.id === state.selectedId;
      var isHov = nd.id === state.hoverId;

      // 节点浮现（入场动画，按排名 stagger 40ms）
      var appear = 1;
      if (!state.loaded && !REDUCED && !nd.longtail) {
        var st = state.nodeStart + (nd.rank - 1) * 40;
        appear = clamp((now - st) / 260, 0, 1);
        appear = appear < 0 ? 0 : 0.5 + 0.5 * Math.sin((appear - 0.5) * Math.PI); // ease
        if (appear <= 0) return;
      }

      ctx.globalAlpha = active ? 1 : 0.18;

      var rr = nd.r * (isHov ? 1.25 : 1) * (nd.longtail ? 1 : appear);
      // 入场早期 appear 为极小正值，rr 会小于内缘描边偏移量；
      // 钳制下限，保证下方 rr - 0.7 的 arc 半径非负（Canvas arc 负半径抛 IndexSizeError）
      rr = Math.max(rr, 0.7);

      // 选中脉冲环（2 次 ripple）
      if (isSel && !nd.longtail) {
        var ringA = 0;
        if (REDUCED) {
          ctx.strokeStyle = "#0E8F6C"; ctx.globalAlpha = active ? 0.9 : 0.2;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(nd.x, nd.y, rr + 6, 0, Math.PI * 2); ctx.stroke();
        } else if (state.rippleStart) {
          var el = now - state.rippleStart;
          for (var k = 0; k < 2; k++) {
            var phase = el - k * 550;
            if (phase >= 0 && phase < 900) {
              var pr = rr + 6 + (phase / 900) * 22;
              ringA = (1 - phase / 900) * 0.6 * (active ? 1 : 0.2);
              ctx.strokeStyle = "#0E8F6C";
              ctx.globalAlpha = ringA;
              ctx.lineWidth = 2;
              ctx.beginPath(); ctx.arc(nd.x, nd.y, pr, 0, Math.PI * 2); ctx.stroke();
            }
          }
        }
      }

      ctx.globalAlpha = active ? 1 : 0.18;
      // 长尾灰点
      if (nd.longtail) {
        ctx.fillStyle = "#5A6577";
        ctx.globalAlpha = active ? 0.5 : 0.12;
        ctx.beginPath(); ctx.arc(nd.x, nd.y, rr, 0, Math.PI * 2); ctx.fill();
        if (isSel) { // 长尾选中：玉色静态高亮环
          ctx.globalAlpha = active ? 0.9 : 0.25;
          ctx.strokeStyle = "#0E8F6C";
          ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.arc(nd.x, nd.y, rr + 5, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        return;
      }
      // 深评实心圆
      ctx.fillStyle = nd.color;
      ctx.beginPath(); ctx.arc(nd.x, nd.y, rr, 0, Math.PI * 2); ctx.fill();
      // 纸底描边：重叠处边界清晰可辨（描在圆内缘，不增大占位）
      ctx.strokeStyle = "#F5F1E8";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(nd.x, nd.y, rr - 0.7, 0, Math.PI * 2); ctx.stroke();
      // 选中玉色外环
      if (isSel) {
        ctx.strokeStyle = "#0A6B51";
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(nd.x, nd.y, rr + 1.6, 0, Math.PI * 2); ctx.stroke();
      }
      // 参与对比：对比色虚线外环（与雷达配色一致）
      var cmpCol = compareColor(nd.id);
      if (cmpCol) {
        ctx.globalAlpha = active ? 0.95 : 0.3;
        ctx.strokeStyle = cmpCol;
        ctx.lineWidth = 1.4;
        ctx.setLineDash([3, 2.4]);
        ctx.beginPath(); ctx.arc(nd.x, nd.y, rr + 4.4, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.globalAlpha = 1;
    });

    // ── 节点标签：默认不显示；top3 常驻，hover/focus/选中显示，短引线归属气泡 ──
    drawNodeLabels();
  }

  // 标签锚点序列 top → bottom → left → right（Mapbox 多变体锚点做法）；
  // 选中标签带纸底框，其余用 3px 纸色描边做光晕保证在点阵上可读。
  function drawNodeLabels() {
    var want = {};
    state.nodes.forEach(function (n) {
      if (n.longtail) return;
      if (n.id === state.selectedId || n.id === state.hoverId ||
        (state.loaded && n.rank <= 3)) {
        want[n.id] = inBloc(byId(n.id));
      }
    });
    ctx.font = "600 11px 'Inter','Noto Sans CJK SC','Microsoft YaHei',sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    var placed = [];
    // 先画选中，保证其优先获得最佳锚点
    var order = state.nodes.filter(function (n) { return want[n.id]; })
      .sort(function (a, b) {
        return (a.id === state.selectedId ? 0 : 1) - (b.id === state.selectedId ? 0 : 1) || a.rank - b.rank;
      });
    order.forEach(function (n) {
      var tw = ctx.measureText(n.name).width;
      var W = tw + 10, H = 17;
      var cands = [
        { rx: n.x - W / 2, ry: n.y - n.r - H - 5, lx: n.x, ly: n.y - n.r, ex: n.x, ey: n.y - n.r - 5 },          // top
        { rx: n.x - W / 2, ry: n.y + n.r + 5, lx: n.x, ly: n.y + n.r, ex: n.x, ey: n.y + n.r + 5 },              // bottom
        { rx: n.x + n.r + 7, ry: n.y - H / 2, lx: n.x + n.r, ly: n.y, ex: n.x + n.r + 7, ey: n.y },              // right
        { rx: n.x - n.r - 7 - W, ry: n.y - H / 2, lx: n.x - n.r, ly: n.y, ex: n.x - n.r - 7, ey: n.y }           // left
      ];
      var pick = null;
      for (var i = 0; i < cands.length; i++) {
        var c = cands[i];
        if (c.rx < 2 || c.ry < 2 || c.rx + W > state.canvasW - 2 || c.ry + H > state.canvasH - 2) continue;
        var ok = true;
        for (var j = 0; j < placed.length; j++) {
          var p = placed[j];
          if (c.rx < p.rx + p.W - 2 && c.rx + W > p.rx + 2 && c.ry < p.ry + p.H - 2 && c.ry + H > p.ry + 2) { ok = false; break; }
        }
        if (ok) { pick = c; break; }
      }
      if (!pick) return;
      placed.push({ rx: pick.rx, ry: pick.ry, W: W, H: H });

      var isSel = n.id === state.selectedId;
      ctx.globalAlpha = 1;
      // 短引线
      ctx.strokeStyle = "rgba(16,29,46,.45)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pick.lx, pick.ly); ctx.lineTo(pick.ex, pick.ey); ctx.stroke();
      // 选中：纸底框；其余：纸色光晕
      var tx = pick.rx + 5, ty = pick.ry + H / 2 + 0.5;
      if (isSel) {
        ctx.fillStyle = "#FCFAF4";
        ctx.fillRect(pick.rx, pick.ry, W, H);
        ctx.strokeStyle = "#D8D0C0";
        ctx.lineWidth = 1;
        ctx.strokeRect(pick.rx + 0.5, pick.ry + 0.5, W - 1, H - 1);
        ctx.fillStyle = "#101D2E";
      } else {
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#F5F1E8";
        ctx.strokeText(n.name, tx, ty);
        ctx.fillStyle = "rgba(22,35,58,.92)";
      }
      ctx.fillText(n.name, tx, ty);
      ctx.globalAlpha = 1;
    });
  }

  // 签名入场时间轴
  function playIntro() {
    if (state.loaded || REDUCED) {
      state.colProgress = 128; state.nodeStart = 0; state.loaded = true;
      drawMap();
      return;
    }
    state.colProgress = 0;
    state.nodeStart = performance.now() + 700; // 点阵点亮约 900ms，节点随后浮现
    var start = performance.now();
    var DUR = 900;
    function tick() {
      var el = performance.now() - start;
      state.colProgress = clamp((el / DUR) * 128, 0, 128);
      drawMap();
      if (el < DUR + 600 + 15 * 40 + 300) {
        requestAnimationFrame(tick);
      } else {
        state.colProgress = 128; state.loaded = true; drawMap();
      }
    }
    requestAnimationFrame(tick);
  }

  // hover / 状态变化时的合并重绘
  var rafPending = false;
  function scheduleDraw() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () { rafPending = false; drawMap(); });
  }

  // 持续脉冲（选中后）——单实例，避免快速连选堆叠 rAF
  var pulseToken = 0;
  function pulseLoop() {
    if (REDUCED) { scheduleDraw(); return; }
    var token = ++pulseToken;
    function frame() {
      if (token !== pulseToken) return; // 已被更新的脉冲取代
      var el = performance.now() - state.rippleStart;
      scheduleDraw();
      if (el < 1500 && state.rippleStart) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // 触屏（手机/平板）用更大的命中半径，手指点小气泡更稳
  var COARSE = (window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  function hitTest(mx, my) {
    var hit = null, best = 1e9;
    var minR = COARSE ? 24 : 16;
    for (var i = 0; i < state.nodes.length; i++) {
      var nd = state.nodes[i];
      var d = Math.hypot(mx - nd.x, my - nd.y);
      var rad = Math.max(nd.r, minR);
      if (d < rad && d < best) { best = d; hit = nd; }
    }
    return hit;
  }

  // hover 出现延迟 ~300ms 防误触（NN/g）；触屏常驻卡片不走延迟
  var hoverTimer = null;
  function hoverNode(nd) {
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
    if (!nd || COARSE) { showTooltip(nd); return; }
    hoverTimer = setTimeout(function () {
      if (state.hoverId === nd.id) showTooltip(nd);
    }, 300);
  }

  function showTooltip(nd) {
    var tip = $("mapTooltip");
    if (!nd) { tip.hidden = true; return; }
    var rankHtml = nd.longtail
      ? '<span class="tt-tail">' + esc(t("basicInfo")) + "</span>"
      : '<span class="tt-score" style="color:#5FD0AE">' + esc(fmt(t("rankPill"), { r: nd.rank })) + " · " + nd.score + "</span>";
    var cmpHtml = (!nd.longtail && isComparing(nd.id))
      ? '<span class="tt-cmp">◈ ' + esc(t("compareStateIn")) + "</span>" : "";
    tip.innerHTML =
      '<span class="tt-name">' + esc(nd.name) + "</span>" +
      rankHtml + cmpHtml +
      (nd.region ? '<span class="tt-region">' + esc(nd.region) + "</span>" : "");
    tip.hidden = false;

    // 边缘钳制：以节点为锚点，默认上方居中；越界按 bottom/right/left 回退，箭头随向翻转
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var wrapW = mapWrap.clientWidth, wrapH = mapWrap.clientHeight;
    var gap = 10;
    var dir = "top";
    var left = nd.x - w / 2, top = nd.y - nd.r - h - gap;
    if (top < 0) { dir = "bottom"; top = nd.y + nd.r + gap; }
    if (top + h > wrapH) { dir = "right"; top = nd.y - h / 2; left = nd.x + nd.r + gap; }
    if (top < 0 || top + h > wrapH) { dir = "left"; top = clamp(nd.y - h / 2, 0, Math.max(0, wrapH - h)); left = nd.x - nd.r - w - gap; }
    left = clamp(left, 4, Math.max(4, wrapW - w - 4));
    top = clamp(top, 4, Math.max(4, wrapH - h - 4));
    tip.style.left = left + "px";
    tip.style.top = top + "px";
    tip.className = "map-tooltip tip-" + dir + (COARSE ? " is-sticky" : "");
  }

  function hideTooltip() {
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
    $("mapTooltip").hidden = true;
  }

  function initMap() {
    canvas = $("dotmap");
    ctx = canvas.getContext("2d");
    mapWrap = $("mapWrap");

    $("mapTitle").textContent = t("secMap");
    $("mapHint").textContent = t("mapHint");

    // 图例
    var lg = $("mapLegend");
    lg.innerHTML =
      '<span class="legend-item"><span class="legend-dot lg" style="background:#0E8F6C"></span>' + esc(t("composite")) + " ≥75</span>" +
      '<span class="legend-item"><span class="legend-dot md" style="background:#C88A2B"></span>60–74</span>' +
      '<span class="legend-item"><span class="legend-dot sm" style="background:#B5482E"></span>&lt;60</span>' +
      '<span class="legend-sep"></span>' +
      '<span class="legend-item"><span class="legend-dot sm" style="background:#5A6577"></span>' + esc(t("kpiTail")) + "</span>" +
      '<span class="legend-sep"></span>' +
      '<span class="legend-item">' + esc(t("rank")) + " 1 → " + esc(t("rank")) + " 15 · ●→•</span>";

    resizeCanvas();
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(function () { resizeCanvas(); }).observe(mapWrap);
    }
    window.addEventListener("resize", resizeCanvas);

    canvas.addEventListener("mousemove", function (e) {
      if (suppressMouseUntil && Date.now() < suppressMouseUntil) return;
      var rect = canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left, my = e.clientY - rect.top;
      var nd = hitTest(mx, my);
      state.hoverId = nd ? nd.id : null;
      canvas.style.cursor = nd ? "pointer" : "crosshair";
      hoverNode(nd);
      scheduleDraw();
    });
    canvas.addEventListener("mouseleave", function () {
      if (COARSE) return;
      state.hoverId = null; hideTooltip(); scheduleDraw();
    });
    canvas.addEventListener("click", function (e) {
      if (suppressMouseUntil && Date.now() < suppressMouseUntil) return;
      var rect = canvas.getBoundingClientRect();
      var nd = hitTest(e.clientX - rect.left, e.clientY - rect.top);
      if (nd) select(nd.id);
    });

    // 触屏（pointer:coarse）：无 hover，点按出常驻卡片；点节点选中，点空白关闭
    var suppressMouseUntil = 0;
    canvas.addEventListener("touchstart", function (e) {
      suppressMouseUntil = Date.now() + 700;
      var t0 = e.touches[0];
      var rect = canvas.getBoundingClientRect();
      var nd = hitTest(t0.clientX - rect.left, t0.clientY - rect.top);
      state.hoverId = nd ? nd.id : null;
      showTooltip(nd);
      scheduleDraw();
    }, { passive: true });
    // 键盘：Enter 选中 hover 节点；方向键在可见节点间移动
    canvas.addEventListener("keydown", function (e) {
      var vis = state.nodes.filter(function (n) { return inBloc(byId(n.id)); });
      if (e.key === "Enter" || e.key === " ") {
        if (state.hoverId) { e.preventDefault(); select(state.hoverId); }
        return;
      }
      if (e.key === "c" || e.key === "C") {
        if (state.hoverId) { e.preventDefault(); toggleCompare(state.hoverId); }
        return;
      }
      var idx = vis.findIndex(function (n) { return n.id === state.hoverId; });
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        idx = (idx + 1) % vis.length; state.hoverId = vis[idx].id;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        idx = (idx <= 0 ? vis.length - 1 : idx - 1); state.hoverId = vis[idx].id;
      } else { return; }
      var nd = vis[idx];
      showTooltip(nd);
      scheduleDraw();
    });
  }

  /* ───────────── 7. 右栏：国家简报 ───────────── */
  // ids：要叠加的国家 id（1 个为单国模式，2–3 个为对比模式）
  /* ───────── 雷达图：SVG 静态渲染 + Object Constancy 切换插值 ───────── */
  var RAD_SIZE = 250, RAD_CX = 125, RAD_CY = 128, RAD_R = 82;
  var radarAnim = null; // {ids, from:{id->[frac]}, to:{id->[frac]}, start, dur}

  function radarPt(i, frac) {
    var ang = -Math.PI / 2 + i * 2 * Math.PI / AXES.length;
    return [RAD_CX + Math.cos(ang) * RAD_R * frac, RAD_CY + Math.sin(ang) * RAD_R * frac];
  }

  function radarFracs(id) {
    return AXES.map(function (a) { return byId(id).scores[a.key] / 100; });
  }

  function weightPct(key) { return Math.round(WEIGHTS[key] * 100) + "%"; }

  // 静态雷达（打印报告/动画帧共用）；fra 传入时按指定弧度渲染（动画用）
  function radarSVG(ids, fra) {
    var n = AXES.length;
    var multi = ids.length >= 2;
    function pt(i, frac) { return radarPt(i, frac); }
    var grid = "";
    for (var layer = 1; layer <= 3; layer++) {
      var gpts = [];
      for (var i = 0; i < n; i++) { var p = pt(i, layer / 3); gpts.push(p[0].toFixed(1) + "," + p[1].toFixed(1)); }
      grid += '<polygon class="radar-grid" points="' + gpts.join(" ") + '"/>';
    }
    var axes = "", labels = "";
    for (var a = 0; a < n; a++) {
      var p0 = pt(a, 0), p1 = pt(a, 1);
      axes += '<line class="radar-axis" x1="' + p0[0].toFixed(1) + '" y1="' + p0[1].toFixed(1) +
              '" x2="' + p1[0].toFixed(1) + '" y2="' + p1[1].toFixed(1) + '"/>';
      // 轴端双行：轴名 + 权重小字（让"加权"视觉可验证）
      var lp = pt(a, 1.24);
      labels += '<text class="radar-label" x="' + lp[0].toFixed(1) + '" y="' + lp[1].toFixed(1) +
                '" text-anchor="middle">' +
                '<tspan x="' + lp[0].toFixed(1) + '" dy="-0.45em">' + esc(dict().axes[AXES[a].key]) + "</tspan>" +
                '<tspan class="radar-weight" x="' + lp[0].toFixed(1) + '" dy="1.35em">' +
                weightPct(AXES[a].key) + "</tspan></text>";
    }

    // 每个国家一个 polygon：对比模式按加入顺序取色；统一弱填充（~18%）
    var polys = "", dots = "";
    ids.forEach(function (id, ci) {
      var c = byId(id);
      if (!c) return;
      var col = multi ? COMPARE_COLORS[ci] : COMPARE_COLORS[0];
      var ff = fra && fra[id] ? fra[id] : null;
      var dpts = [];
      for (var d = 0; d < n; d++) {
        var frac = ff ? ff[d] : c.scores[AXES[d].key] / 100;
        var dp = pt(d, frac);
        dpts.push(dp[0].toFixed(1) + "," + dp[1].toFixed(1));
        dots += '<circle class="radar-dot" cx="' + dp[0].toFixed(1) +
                '" cy="' + dp[1].toFixed(1) + '" r="' + (multi ? 2.2 : 2.8) + '" fill="' + col + '"/>';
      }
      polys += '<polygon class="radar-poly' + (multi ? " is-multi" : "") +
               '" points="' + dpts.join(" ") + '" ' +
               'fill="' + col + "2E" + '" stroke="' + col + '"/>';
    });

    // 单国模式在顶点旁标注分值；对比模式数值由分项条/对比表承载
    if (!multi) {
      var c0 = byId(ids[0]);
      var ff0 = fra && fra[ids[0]] ? fra[ids[0]] : null;
      for (var k = 0; k < n; k++) {
        var fracv = ff0 ? ff0[k] : c0.scores[AXES[k].key] / 100;
        var vp = pt(k, fracv);
        labels += '<text class="radar-val" x="' + vp[0].toFixed(1) + '" y="' + (vp[1] - 6).toFixed(1) +
                  '" text-anchor="middle">' + c0.scores[AXES[k].key] + "</text>";
      }
    }
    return '<svg class="radar-svg" viewBox="0 0 ' + RAD_SIZE + " " + RAD_SIZE + '" role="img" aria-label="radar">' +
      grid + axes + polys + dots + labels +
      "</svg>";
  }

  // 分项得分条：弥补雷达读值不精确；单国一条/对比多国分段
  function scoreBarsHTML(ids) {
    var multi = ids.length >= 2;
    var rows = AXES.map(function (ax) {
      var segs = ids.map(function (id, ci) {
        var c = byId(id);
        var v = c.scores[ax.key];
        var col = multi ? COMPARE_COLORS[ci] : COMPARE_COLORS[0];
        return '<div class="sb-seg" title="' + esc(cName(c)) + " · " + v + " · " + weightPct(ax.key) + '">' +
               '<span class="sb-fill" style="width:' + v + "%;background:" + col + '"></span>' +
               '<span class="sb-num">' + v + "</span></div>";
      }).join("");
      return '<div class="sb-row"><span class="sb-name">' + esc(dict().axes[ax.key]) + "</span>" +
             '<span class="sb-tracks">' + segs + "</span></div>";
    }).join("");
    return '<div class="score-bars' + (multi ? " is-multi" : "") + '">' + rows + "</div>";
  }

  // 挂载实时雷达：同 id 顶点从当前位置插值变形；新加入 id 从中心长出
  function mountRadar(ids) {
    var host = $("liveRadar");
    if (!host) return;
    if (REDUCED) {
      host.innerHTML = radarSVG(ids);
      radarAnim = null;
      return;
    }
    var prev = radarAnim;
    var now = Date.now();
    var prog = prev ? clamp((now - prev.start) / prev.dur, 0, 1) : 1;
    var easeP = 1 - Math.pow(1 - prog, 3);
    var from = {};
    ids.forEach(function (id) {
      if (prev && prev.to[id]) {
        from[id] = prev.to[id].map(function (t, i) {
          return prev.from[id] ? prev.from[id][i] + (t - prev.from[id][i]) * easeP : t;
        });
      } else {
        from[id] = AXES.map(function () { return 0; });
      }
    });
    radarAnim = { ids: ids.slice(), from: from, to: {}, start: now, dur: 330 };
    ids.forEach(function (id) { radarAnim.to[id] = radarFracs(id); });
    host.innerHTML = radarSVG(ids, from);
    requestAnimationFrame(radarTick);
  }

  function radarTick() {
    if (!radarAnim) return;
    var host = $("liveRadar");
    var p = clamp((Date.now() - radarAnim.start) / radarAnim.dur, 0, 1);
    var e = 1 - Math.pow(1 - p, 3); // ease-out cubic，300–350ms
    var cur = {};
    radarAnim.ids.forEach(function (id) {
      cur[id] = radarAnim.to[id].map(function (t, i) {
        return radarAnim.from[id][i] + (t - radarAnim.from[id][i]) * e;
      });
    });
    if (host) host.innerHTML = radarSVG(radarAnim.ids, cur);
    if (p < 1) requestAnimationFrame(radarTick);
  }

  function renderBriefing() {
    var box = $("briefing");
    var o = byId(state.selectedId);
    if (!o) { box.innerHTML = emptyBrief(); return; }

    if (isLongtail(state.selectedId)) {
      // 长尾简版：基础信息，无评分无雷达
      var x = o;
      var orgs = x.org.map(function (k) { return blocLabel(k); });
      var tariff = (dict().tariffLevels && dict().tariffLevels[x.tariff]) || x.tariff;
      var nev = (dict().nevLevels && dict().nevLevels[x.nev]) || x.nev;
      var note = loc({ zh: x.noteZh, en: x.noteEn });
      box.innerHTML =
        '<div class="brief-card">' +
          '<div class="brief-head">' +
            '<span class="iso-block">' + esc(isoOf(x.id)) + "</span>" +
            '<div class="brief-headtext">' +
              '<div class="brief-name">' + esc(tailName(x)) + "</div>" +
              '<div class="brief-tags">' +
                (orgs.length ? orgs.map(function (g) { return '<span class="mini-tag">' + esc(g) + "</span>"; }).join("") : "") +
              "</div>" +
            "</div>" +
          "</div>" +
          '<span class="tail-brief-badge">' + esc(t("basicInfo")) + "</span>" +
          '<div class="tail-fact-row">' +
            '<div class="tail-fact"><div class="tf-label">' + esc(t("tariff")) + '</div><div class="tf-val">' + esc(tariff) + "</div></div>" +
            '<div class="tail-fact"><div class="tf-label">' + esc(t("nevLevel")) + '</div><div class="tf-val">' + esc(nev) + "</div></div>" +
          "</div>" +
          '<div class="decision-section"><div class="decision-h">' + esc(t("note")) + "</div>" +
            '<p class="decision-p">' + esc(note) + "</p></div>" +
        "</div>";
      return;
    }

    // 深评国完整简报
    var c = o;
    var rank = rankOf(c.id);
    var score = scoreOf(c.id);
    var color = signalColor(score);
    var blocChips = c.blocs.map(function (k) {
      return '<span class="mini-tag">' + esc(blocLabel(k)) + "</span>";
    }).join("");

    // 加入对比 toggle（仅深评国）
    var inCompare = isComparing(c.id);
    var compareBtn =
      '<button type="button" class="compare-toggle' + (inCompare ? " is-on" : "") + '" data-compare="' + c.id + '"' +
      ' aria-pressed="' + (inCompare ? "true" : "false") + '">' +
      (inCompare ? "✓ " : "＋ ") + esc(t(inCompare ? "compareRemove" : "compareAdd")) + "</button>";

    // 对比条：只要有已选对比国就展示（单国时提示可继续添加），≥2 国雷达才叠加
    var compareBar = "";
    var dIds = displayIds();
    if (state.compareIds.length >= 1) {
      var chipsHtml = state.compareIds.map(function (id, ci) {
        var cc = byId(id);
        return '<span class="cmp-chip" data-compare-jump="' + id + '" role="button" tabindex="0" title="' + esc(t("compareJump")) + '">' +
          '<span class="cmp-dot" style="background:' + COMPARE_COLORS[ci] + '"></span>' +
          esc(cName(cc)) + '<span class="cmp-score">' + scoreOf(id) + "</span>" +
          '<span class="cmp-x" data-compare="' + id + '" role="button" aria-label="' + esc(t("compareRemove")) + '">×</span>' +
        "</span>";
      }).join("");
      compareBar =
        '<div class="compare-bar">' +
          '<div class="compare-bar-h"><span>' + esc(t("secCompare")) + "</span>" +
            '<button type="button" class="compare-clear" data-compare-clear="1">' + esc(t("compareClear")) + "</button>" +
          "</div>" +
          '<div class="compare-chips">' + chipsHtml + "</div>" +
          '<div class="compare-hint">' + esc(t("compareHint")) + "</div>" +
        "</div>";
    }

    var metrics = [
      ["penetration", loc(c.metrics.penetration)],
      ["chinaShare", loc(c.metrics.chinaShare)],
      ["growth", loc(c.metrics.growth)],
      ["keyFact", loc(c.metrics.keyFact)]
    ].map(function (m) {
      return '<div class="metric"><div class="m-label">' + esc(t(m[0])) + '</div>' +
             '<div class="m-val">' + esc(m[1]) + "</div></div>";
    }).join("");

    var sections = [
      ["policyEnv", loc(c.policy), ""],
      ["competition", loc(c.competition), ""],
      ["consumer", loc(c.consumer), ""],
      ["strategy", loc(c.strategy), ""],
      ["risk", loc(c.risk), " risk"]
    ].map(function (s) {
      return '<div class="decision-section' + s[2] + '"><div class="decision-h">' + esc(t(s[0])) + "</div>" +
             '<p class="decision-p">' + esc(s[1]) + "</p></div>";
    }).join("");

    var sources = c.sources.map(function (s, i) {
      return '<div class="source-item"><span class="source-num">' + (i + 1) + ".</span>" +
             '<span class="source-name">' + esc(loc(s)) + "</span></div>";
    }).join("");

    var isMulti = dIds.length >= 2;
    box.innerHTML =
      '<div class="brief-card">' +
        '<div class="brief-head">' +
          '<span class="iso-block">' + esc(isoOf(c.id)) + "</span>" +
          '<div class="brief-headtext">' +
            '<div class="brief-name">' + esc(cName(c)) + "</div>" +
            '<div class="brief-tags">' +
              '<span class="mini-tag region-tag">' + esc(regionLabel(c.region)) + "</span>" +
              blocChips +
            "</div>" +
          "</div>" +
          compareBtn +
        "</div>" +
        '<div class="score-seal">' +
          '<span class="seal-num" style="color:' + color + '">' + score + '<small>/100</small></span>' +
          '<span class="seal-side">' +
            '<span class="rank-pill">' + esc(fmt(t("rankPill"), { r: rank })) + "</span>" +
            '<span class="seal-caption">' + esc(t("composite")) + "</span>" +
          "</span>" +
        "</div>" +
        compareBar +
        '<p class="brief-summary">' + esc(loc(c.summary)) + "</p>" +
        '<div class="metrics-grid">' + metrics + "</div>" +
        (HAS_RADAR
          ? '<div class="radar-block"><div class="radar-title">' +
            esc(isMulti ? t("compareRadar") : t("radarOf")) + "</div>" +
            '<div class="radar-sub">' + esc(t("secRadar")) + "</div>" +
            '<div id="liveRadar"></div>' +
            scoreBarsHTML(dIds) + "</div>"
          : "") +
        sections +
        '<div class="sources-block"><div class="sources-h">' + esc(t("sources")) + "</div>" + sources + "</div>" +
      "</div>";

    // 雷达以国家 id 绑定顶点：切换时插值变形而非整体闪白
    if (HAS_RADAR) mountRadar(dIds);
  }

  // 筛选空态四要素：说明文案 + 轻量 SVG 标记 + 主动作 CTA（§4.6）
  function emptyFilterHTML() {
    return '<svg class="ef-mark" viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">' +
      '<circle cx="20" cy="20" r="15" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".45"/>' +
      '<path d="M14 20h12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity=".45"/>' +
      "</svg>" +
      '<div class="ef-text">' + esc(t("noResult")) + "</div>" +
      '<button type="button" class="ef-cta" data-clear-filters="1">' + esc(t("clearFilters")) + "</button>";
  }

  // CTA：清空搜索词与经济组织筛选，回到全量榜单
  function clearFilters() {
    state.query = "";
    state.bloc = "ALL";
    var input = $("searchInput");
    if (input) input.value = "";
    renderLeftRail();
    scheduleDraw();
    if (input) input.focus();
  }

  function emptyBrief() {
    return '<div class="brief-empty">' +
      '<div class="empty-mark">◎</div>' +
      '<div class="empty-title">' + esc(t("secDetail")) + "</div>" +
      '<div class="empty-hint">' + esc(t("mapHint")) + "</div>" +
      '<div class="empty-steps">' +
        "<b>1.</b> " + esc(t("keyTrackTitle")) + "<br>" +
        "<b>2.</b> " + esc(t("secMap")) + "<br>" +
        "<b>3.</b> " + esc(t("tailTrackTitle")).replace(/·.*$/, "") +
      "</div></div>";
  }

  /* ───────────── 8. 底部：来源 / 反馈 / 声明 / 可行性 ───────────── */
  function renderFooter() {
    // 来源汇总（去重）
    var seen = {}, list = [];
    COUNTRIES.forEach(function (c) {
      c.sources.forEach(function (s) {
        var name = loc(s);
        if (!seen[name]) { seen[name] = true; list.push(name); }
      });
    });
    var fs = $("footerSources");
    $("sourcesTitle").textContent = t("secSources");
    fs.innerHTML = esc(t("sourcesIntro")) + "<br><br>" +
      list.map(function (n, i) { return "<span class=\"src-item\">" + (i + 1) + ". " + esc(n) + "</span>"; }).join("");

    // 诚实声明
    $("honestTitle").textContent = t("honestTitle");
    $("honestBody").textContent = t("honestBody");
    var fn = $("fallbackNote");
    var fnText = t("fallbackNote");
    fn.textContent = fnText || "";
    fn.style.display = fnText ? "" : "none";

    // 反馈入口：主路径为 GitHub Issues（公开、可追踪），次路径为邮件（需配置真实邮箱）
    $("feedbackTitle").textContent = t("feedbackTitle");
    $("feedbackBody").textContent = t("feedbackBody");
    var fbBtn = $("feedbackBtn");
    fbBtn.textContent = t("feedbackBtn");
    var issueQuery = "title=" + encodeURIComponent(t("feedbackMailSubject")) +
                     "&body=" + encodeURIComponent(t("feedbackMailBody"));
    fbBtn.href = ISSUES_URL + "?" + issueQuery;

    var fbMail = $("feedbackMail");
    var emailConfigured = FEEDBACK_EMAIL && FEEDBACK_EMAIL.indexOf("@example.com") === -1;
    if (emailConfigured) {
      fbMail.textContent = fmt(t("feedbackMailFmt"), { e: FEEDBACK_EMAIL });
      var mailQuery = "subject=" + encodeURIComponent(t("feedbackMailSubject")) +
                      "&body=" + encodeURIComponent(t("feedbackMailBody"));
      fbMail.href = "mailto:" + FEEDBACK_EMAIL + "?" + mailQuery;
      fbMail.style.display = "";
    } else {
      fbMail.style.display = "none";
    }
  }

  /* ───────────── 9. 移动 Tab ───────────── */
  function syncMobileTabs() {
    var tabs = { rank: $("tabRank"), brief: $("tabBrief") };
    tabs.rank.textContent = t("keyTrackTitle").replace(/·.*$/, "").trim();
    tabs.brief.textContent = t("secDetail");
    var isBrief = document.body.getAttribute("data-tab") === "brief";
    tabs.rank.classList.toggle("is-active", !isBrief);
    tabs.brief.classList.toggle("is-active", isBrief);
  }
  function initMobileTabs() {
    $("tabRank").addEventListener("click", function () {
      document.body.setAttribute("data-tab", "rank"); syncMobileTabs();
    });
    $("tabBrief").addEventListener("click", function () {
      document.body.setAttribute("data-tab", "brief"); syncMobileTabs();
    });
    syncMobileTabs();
  }

  /* ───────────── 10. 选择 / hash / live region ───────────── */
  function select(id) {
    if (state.selectedId === id) {
      // 仍触发脉冲
      state.rippleStart = performance.now();
      scheduleDraw(); pulseLoop();
      return;
    }
    state.selectedId = id;
    state.rippleStart = performance.now();
    // hash 深链
    try { history.replaceState(null, "", "#country=" + id); } catch (e) {}
    // live region 播报
    var o = byId(id);
    $("liveRegion").textContent = o ? (cName(o) || tailName(o)) : "";
    renderLeftRail();
    renderBriefing();
    // 窄屏（<1024px，平板竖屏/折叠屏内屏/手机单列模式）选国后自动切到简报 Tab
    if (window.matchMedia && window.matchMedia("(max-width: 1023px)").matches) {
      document.body.setAttribute("data-tab", "brief");
      syncMobileTabs();
    }
    scheduleDraw(); pulseLoop();
  }

  function initHash() {
    var m = /[#&]country=([\w-]+)/.exec(location.hash || "");
    if (m && byId(m[1])) state.selectedId = m[1];
    window.addEventListener("hashchange", function () {
      var mm = /[#&]country=([\w-]+)/.exec(location.hash || "");
      if (mm && byId(mm[1]) && mm[1] !== state.selectedId) select(mm[1]);
    });
  }

  /* ───────────── 11. Toast ───────────── */
  var toastTimer = null;
  function toast(msg) {
    var el = $("toast");
    el.textContent = msg;
    el.classList.add("is-show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("is-show"); }, 2000);
  }

  /* ───────────── 12. 导出：CSV / Markdown / 打印 ───────────── */
  function exportCSV() {
    var head = ["rank", "country", "region", "composite"].concat(AXES.map(function (a) { return a.key; }));
    var lines = [head.join(",")];
    ranked.forEach(function (it) {
      var c = it.c;
      var row = [it.rank, cName(c), regionLabel(c.region), it.score].concat(
        AXES.map(function (a) { return c.scores[a.key]; })
      );
      lines.push(row.join(","));
    });
    // 权重注释行（Excel 中作为独立行可见，便于读者复核加权口径）
    var weightNote = "# weights: " + AXES.map(function (a) {
      return a.key + "=" + Math.round(WEIGHTS[a.key] * 100) + "%";
    }).join(", ");
    var blob = new Blob(["\uFEFF" + lines.join("\r\n") + "\r\n" + weightNote + "\r\n"], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "ev-go-global-ranking-" + dateStamp() + ".csv";
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 200);
  }

  function buildMarkdown() {
    var o = byId(state.selectedId);
    var L = [];
    L.push("# " + rt("title"));
    L.push("");
    if (PROFILE.name) L.push("- " + t("coverAuthorNameFmt").replace("{n}", PROFILE.name));
    L.push("- " + rt("generated") + ": " + new Date().toISOString().slice(0, 10));
    L.push("- " + t("dataAsOfLabel").replace("{d}", DATA_AS_OF[state.lang] || DATA_AS_OF["zh-CN"]));
    L.push("- " + SITE_URL);
    L.push("");
    if (o && !isLongtail(state.selectedId)) {
      var c = o, rank = rankOf(c.id), score = scoreOf(c.id);
      L.push("## " + cName(c) + "  (" + fmt(t("rankPill"), { r: rank }) + " · " + score + ")");
      L.push("");
      L.push("**" + t("marketOverview") + "** " + loc(c.summary));
      L.push("");
      L.push("**" + rt("scores") + "**");
      AXES.forEach(function (a) {
        L.push("- " + dict().axes[a.key] + ": " + c.scores[a.key]);
      });
      L.push("");
      L.push("### " + t("policyEnv")); L.push(loc(c.policy)); L.push("");
      L.push("### " + t("competition")); L.push(loc(c.competition)); L.push("");
      L.push("### " + t("consumer")); L.push(loc(c.consumer)); L.push("");
      L.push("### " + t("strategy")); L.push(loc(c.strategy)); L.push("");
      L.push("### " + t("risk")); L.push(loc(c.risk)); L.push("");
      L.push("### " + t("sources"));
      c.sources.forEach(function (s, i) { L.push((i + 1) + ". " + loc(s)); });
      L.push("");
    } else if (o) {
      L.push("## " + tailName(o) + " · " + t("basicInfo"));
      L.push("");
      L.push("- " + t("org") + ": " + o.org.map(blocLabel).join(" / "));
      L.push("- " + t("tariff") + ": " + ((dict().tariffLevels || {})[o.tariff] || o.tariff));
      L.push("- " + t("nevLevel") + ": " + ((dict().nevLevels || {})[o.nev] || o.nev));
      L.push("- " + t("note") + ": " + loc({ zh: o.noteZh, en: o.noteEn }));
      L.push("");
    }
    L.push("## " + rt("allSummary"));
    L.push("");
    L.push("| " + t("rank") + " | " + t("country") + " | " + t("composite") + " |");
    L.push("|---|---|---|");
    ranked.forEach(function (it) {
      L.push("| " + it.rank + " | " + cName(it.c) + " | " + it.score + " |");
    });
    return L.join("\n");
  }

  function copyMarkdown() {
    var text = buildMarkdown();
    function ok() { toast(t("copyOk")); }
    function fail() { toast(t("copyFail")); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok, function () {
        fallbackCopy(text) ? ok() : fail();
      });
    } else {
      fallbackCopy(text) ? ok() : fail();
    }
  }
  function fallbackCopy(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      var done = document.execCommand("copy");
      ta.remove();
      return done;
    } catch (e) { return false; }
  }

  function buildPrintReport() {
    var o = byId(state.selectedId);
    var today = new Date().toISOString().slice(0, 10);
    var html = "";
    // 封面（署名仅在 PROFILE.name 配置后才输出，避免出现 "[ 你的名字 ]" 占位符）
    var metaParts = [];
    if (PROFILE.name) metaParts.push(esc(t("coverAuthorNameFmt").indexOf("{") >= 0
      ? fmt(t("coverAuthorNameFmt"), { n: PROFILE.name }) : PROFILE.name));
    metaParts.push(esc(fmt(t("coverDate"), { d: today })));
    metaParts.push(esc(fmt(t("dataAsOfLabel"), { d: DATA_AS_OF[state.lang] || DATA_AS_OF["zh-CN"] })));
    metaParts.push(esc(SITE_URL));
    html += '<div class="pr-cover"><h1>' + esc(rt("title")) + "</h1>" +
      '<div class="pr-sub">' + esc(t("appSubtitle")) + "</div>" +
      '<div class="pr-meta">' + metaParts.join("<br>") + "</div></div>";

    // 多国对比（雷达 + 六维对比表）
    if (state.compareIds.length >= 2) {
      html += '<div class="pr-section"><h2>' + esc(t("secCompare")) + "</h2>";
      html += '<div class="pr-radar">' + radarSVG(state.compareIds.slice()) + "</div>";
      html += '<table class="pr-table pr-cmp-table"><thead><tr><th>' + esc(t("country")) +
        "</th><th>" + esc(t("composite")) + "</th>";
      AXES.forEach(function (a) { html += "<th>" + esc(dict().axes[a.key]) + "</th>"; });
      html += "</tr></thead><tbody>";
      state.compareIds.forEach(function (id) {
        var cc = byId(id);
        html += "<tr><td>" + esc(cName(cc)) + "</td><td><b>" + scoreOf(id) + "</b></td>";
        AXES.forEach(function (a) { html += "<td>" + cc.scores[a.key] + "</td>"; });
        html += "</tr>";
      });
      html += "</tbody></table></div>";
    }

    // 选中国简报
    if (o && !isLongtail(state.selectedId)) {
      var c = o, rank = rankOf(c.id), score = scoreOf(c.id);
      html += '<div class="pr-section"><h2>' + esc(cName(c)) + " · " + esc(fmt(t("rankPill"), { r: rank })) + " · " + score + "</h2>";
      html += "<p><b>" + esc(t("marketOverview")) + "</b> " + esc(loc(c.summary)) + "</p>";
      html += '<div class="pr-radar">' + radarSVG([c.id]) + "</div>";
      [["policyEnv", c.policy], ["competition", c.competition], ["consumer", c.consumer],
       ["strategy", c.strategy], ["risk", c.risk]].forEach(function (s) {
        html += "<h3>" + esc(t(s[0])) + "</h3><p>" + esc(loc(s[1])) + "</p>";
      });
      html += "<h3>" + esc(t("sources")) + "</h3><p class='pr-sources'>" +
        c.sources.map(function (s, i) { return (i + 1) + ". " + esc(loc(s)); }).join("<br>") + "</p>";
      html += "</div>";
    }

    // 排名表
    html += '<div class="pr-section pr-pagebreak"><h2>' + esc(rt("allSummary")) + "</h2>";
    html += '<table class="pr-table"><thead><tr><th>' + esc(t("rank")) + "</th><th>" + esc(t("country")) +
      "</th><th>" + esc(t("region")) + "</th><th>" + esc(t("composite")) + "</th>";
    AXES.forEach(function (a) { html += "<th>" + esc(dict().axes[a.key]) + "</th>"; });
    html += "</tr></thead><tbody>";
    ranked.forEach(function (it) {
      html += "<tr><td>" + it.rank + "</td><td>" + esc(cName(it.c)) + "</td><td>" + esc(regionLabel(it.c.region)) +
        "</td><td>" + it.score + "</td>";
      AXES.forEach(function (a) { html += "<td>" + it.c.scores[a.key] + "</td>"; });
      html += "</tr>";
    });
    html += "</tbody></table></div>";

    // 来源 + 诚实声明
    var seen = {}, sl = [];
    COUNTRIES.forEach(function (c) { c.sources.forEach(function (s) { var n = loc(s); if (!seen[n]) { seen[n] = 1; sl.push(n); } }); });
    html += '<div class="pr-section"><h2>' + esc(t("sourcesTitle")) + "</h2>" +
      '<p class="pr-sources">' + sl.map(function (n, i) { return (i + 1) + ". " + esc(n); }).join("<br>") + "</p>" +
      "<p><b>" + esc(t("honestTitle")) + "</b><br>" + esc(t("honestBody")) + "</p></div>";

    $("printReport").innerHTML = html;
    $("printReport").setAttribute("aria-hidden", "false");
  }

  function doPrint() {
    buildPrintReport();
    window.print();
  }

  /* ───────────── 13. 事件绑定 & 初始化 ───────────── */
  function bindEvents() {
    $("searchInput").addEventListener("input", function (e) {
      state.query = e.target.value || "";
      renderLeftRail();
      scheduleDraw();
    });
    $("searchClear").addEventListener("click", function () {
      state.query = "";
      $("searchInput").value = "";
      renderLeftRail();
      scheduleDraw();
      $("searchInput").focus();
    });
    $("tailToggle").addEventListener("click", function () {
      state.tailOpen = !state.tailOpen;
      renderLeftRail();
    });
    // 空态 CTA（榜单无结果 / 长尾无结果共用，事件委托）
    $("railLeft").addEventListener("click", function (e) {
      if (e.target.getAttribute && e.target.getAttribute("data-clear-filters")) clearFilters();
    });
    if ($("btnPrint")) $("btnPrint").addEventListener("click", doPrint);
    if ($("btnCsv")) $("btnCsv").addEventListener("click", exportCSV);
    if ($("btnCopy")) $("btnCopy").addEventListener("click", copyMarkdown);

    // 简报内对比控件（事件委托；chip 本身与 × 各自独立动作）
    $("briefing").addEventListener("click", function (e) {
      var xEl = e.target.closest ? e.target.closest("[data-compare]") : null;
      if (xEl) { e.stopPropagation(); toggleCompare(xEl.getAttribute("data-compare")); return; }
      if (e.target.getAttribute && e.target.getAttribute("data-compare-clear")) {
        clearCompare(); return;
      }
      var jEl = e.target.closest ? e.target.closest("[data-compare-jump]") : null;
      if (jEl) select(jEl.getAttribute("data-compare-jump"));
    });
    $("briefing").addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var tgt = e.target;
      if (tgt.getAttribute && tgt.getAttribute("data-compare-jump")) {
        e.preventDefault();
        select(tgt.getAttribute("data-compare-jump"));
      }
    });
  }

  function renderAll() {
    renderTopbar();
    renderLeftRail();
    renderBriefing();
    renderFooter();
    syncMobileTabs();
    // 地图标题/图例文案随语言刷新；重绘不重放入场
    $("mapTitle").textContent = t("secMap");
    var mh2 = $("mapHint");
    mh2.textContent = t("mapHint");
    mh2.title = t("mapHintFull");
    mh2.setAttribute("aria-label", t("mapHintFull"));
    rebuildLegend();
    resizeCanvas();
  }

  function rebuildLegend() {
    var lg = $("mapLegend");
    if (!lg) return;
    lg.innerHTML =
      '<span class="legend-item"><span class="legend-dot lg" style="background:#0E8F6C"></span>' + esc(t("composite")) + " ≥75</span>" +
      '<span class="legend-item"><span class="legend-dot md" style="background:#C88A2B"></span>60–74</span>' +
      '<span class="legend-item"><span class="legend-dot sm" style="background:#B5482E"></span>&lt;60</span>' +
      '<span class="legend-sep"></span>' +
      '<span class="legend-item"><span class="legend-dot sm" style="background:#5A6577"></span>' + esc(t("kpiTail")) + "</span>" +
      '<span class="legend-sep"></span>' +
      '<span class="legend-item">' + esc(t("rank")) + " 1 → 15 · ●→•</span>";
  }

  // 版本序号："2026Q3" → 2026*4+3，便于比较新旧
  function versionOrdinal(v) {
    var m = /^(\d{4})Q([1-4])$/.exec(v || "");
    return m ? parseInt(m[1], 10) * 4 + parseInt(m[2], 10) : 0;
  }

  // 探测线上 version.json：若线上数据比本包新，提示用户刷新页面获取最新季度数据
  function checkRemoteVersion() {
    if (!IS_HTTP || typeof fetch !== "function") return;
    var shown = sessionStorage.getItem("versionNotice");
    if (shown) return;
    fetch("version.json?probe=" + Date.now(), { cache: "no-store" })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (meta) {
        if (!meta || !meta.dataVersion) return;
        if (versionOrdinal(meta.dataVersion) > versionOrdinal(BUNDLED_DATA_VERSION)) {
          sessionStorage.setItem("versionNotice", meta.dataVersion);
          toast(fmt(t("dataUpdateNotice"), { v: meta.dataVersion, d: meta.dataAsOf || "" }));
        }
      })
      .catch(function () { /* 离线或拦截时静默，不影响主功能 */ });
  }

  function init() {
    initHash();
    renderTopbar();
    renderLeftRail();
    renderBriefing();
    renderFooter();
    initMobileTabs();
    initMap();
    bindEvents();
    setTimeout(checkRemoteVersion, 1500);
    // 选中脉冲 & 播报
    $("liveRegion").textContent = (function () { var o = byId(state.selectedId); return o ? (cName(o) || tailName(o)) : ""; })();
    state.rippleStart = performance.now();
    // 签名入场
    requestAnimationFrame(function () { playIntro(); pulseLoop(); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
