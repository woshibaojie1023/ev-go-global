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
    loaded: false          // 入场是否已播放（语言切换/resize 不重放）
  };
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
  function rankRadius(rank) { // r1 → 13, r15 → 6 线性
    return 13 - (rank - 1) * (7 / 14);
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
    $("appSubtitle").textContent = t("appSubtitle");
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

    // chips
    var cr = $("chipRow");
    cr.innerHTML = "";
    BLOCS.forEach(function (bl) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (state.bloc === bl.key ? " is-active" : "");
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
      tl.innerHTML = '<div class="tail-empty">' + esc(t("noResult")) + "</div>";
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
        x: p.x, y: p.y, r: rankRadius(it.rank),
        color: signalColor(it.score), name: cName(it.c), region: regionLabel(it.c.region)
      });
    });
    LONGTAIL.forEach(function (x) {
      var p = project(x.lon, x.lat, geo);
      arr.push({
        id: x.id, longtail: true, rank: null, score: null,
        x: p.x, y: p.y, r: 2.5,
        color: "#5A6577", name: tailName(x), region: ""
      });
    });
    state.nodes = arr;
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
      // 选中玉色描边
      if (isSel) {
        ctx.strokeStyle = "#0A6B51";
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(nd.x, nd.y, rr + 0.7, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });

    // ── 选中标签（衬线 + 半透明纸底）──
    var sel = state.nodes.filter(function (n) { return n.id === state.selectedId; })[0];
    if (sel) {
      var label = sel.name;
      ctx.font = "700 12px 'Noto Serif SC','Source Han Serif SC','Songti SC',Georgia,serif";
      var tw = ctx.measureText(label).width;
      var lx = clamp(sel.x - tw / 2 - 7, 4, state.canvasW - tw - 18);
      var ly = sel.y - sel.r - 24;
      if (ly < 4) ly = sel.y + sel.r + 10;
      ctx.globalAlpha = 0.86;
      ctx.fillStyle = "#FCFAF4";
      ctx.fillRect(lx, ly, tw + 14, 18);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#D8D0C0";
      ctx.lineWidth = 1;
      ctx.strokeRect(lx + 0.5, ly + 0.5, tw + 13, 17);
      ctx.fillStyle = "#16233A";
      ctx.textBaseline = "middle";
      ctx.fillText(label, lx + 7, ly + 9.5);
    }
    ctx.globalAlpha = 1;
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

  function showTooltip(nd, mx, my) {
    var tip = $("mapTooltip");
    if (!nd) { tip.hidden = true; return; }
    var rankHtml = nd.longtail
      ? '<span class="tt-tail">' + esc(t("basicInfo")) + "</span>"
      : '<span class="tt-score" style="color:#5FD0AE">' + esc(fmt(t("rankPill"), { r: nd.rank })) + " · " + nd.score + "</span>";
    tip.innerHTML =
      '<span class="tt-name">' + esc(nd.name) + "</span>" +
      rankHtml +
      (nd.region ? '<span class="tt-region">' + esc(nd.region) + "</span>" : "");
    tip.hidden = false;
    var wrapRect = mapWrap.getBoundingClientRect();
    tip.style.left = (nd.x) + "px";
    tip.style.top = (nd.y - nd.r) + "px";
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
      var rect = canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left, my = e.clientY - rect.top;
      var nd = hitTest(mx, my);
      state.hoverId = nd ? nd.id : null;
      canvas.style.cursor = nd ? "pointer" : "crosshair";
      showTooltip(nd, mx, my);
      scheduleDraw();
    });
    canvas.addEventListener("mouseleave", function () {
      state.hoverId = null; $("mapTooltip").hidden = true; scheduleDraw();
    });
    canvas.addEventListener("click", function (e) {
      var rect = canvas.getBoundingClientRect();
      var nd = hitTest(e.clientX - rect.left, e.clientY - rect.top);
      if (nd) select(nd.id);
    });
    // 键盘：Enter 选中 hover 节点；方向键在可见节点间移动
    canvas.addEventListener("keydown", function (e) {
      var vis = state.nodes.filter(function (n) { return inBloc(byId(n.id)); });
      if (e.key === "Enter" || e.key === " ") {
        if (state.hoverId) { e.preventDefault(); select(state.hoverId); }
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
      showTooltip(nd, nd.x, nd.y);
      scheduleDraw();
    });
  }

  /* ───────────── 7. 右栏：国家简报 ───────────── */
  function radarSVG(c) {
    var size = 240, cx = size / 2, cy = size / 2 + 6, R = 78;
    var n = AXES.length;
    function pt(i, frac) {
      var ang = -Math.PI / 2 + i * 2 * Math.PI / n;
      return [cx + Math.cos(ang) * R * frac, cy + Math.sin(ang) * R * frac];
    }
    var grid = "";
    for (var layer = 1; layer <= 3; layer++) {
      var pts = [];
      for (var i = 0; i < n; i++) { var p = pt(i, layer / 3); pts.push(p[0].toFixed(1) + "," + p[1].toFixed(1)); }
      grid += '<polygon class="radar-grid" points="' + pts.join(" ") + '"/>';
    }
    var axes = "", labels = "";
    for (var a = 0; a < n; a++) {
      var p0 = pt(a, 0), p1 = pt(a, 1);
      axes += '<line class="radar-axis" x1="' + p0[0].toFixed(1) + '" y1="' + p0[1].toFixed(1) +
              '" x2="' + p1[0].toFixed(1) + '" y2="' + p1[1].toFixed(1) + '"/>';
      var lp = pt(a, 1.22);
      var val = c.scores[AXES[a].key];
      var vp = pt(a, val / 100);
      labels += '<text class="radar-label" x="' + lp[0].toFixed(1) + '" y="' + lp[1].toFixed(1) +
                '" text-anchor="middle" dominant-baseline="middle">' + esc(dict().axes[AXES[a].key]) + "</text>";
      labels += '<text class="radar-val" x="' + (vp[0]).toFixed(1) + '" y="' + (vp[1] - 6).toFixed(1) +
                '" text-anchor="middle">' + val + "</text>";
    }
    var dpts = [];
    for (var d = 0; d < n; d++) {
      var v = c.scores[AXES[d].key] / 100;
      var dp = pt(d, v);
      dpts.push(dp[0].toFixed(1) + "," + dp[1].toFixed(1));
    }
    var dots = "";
    for (var k = 0; k < n; k++) {
      var dv = c.scores[AXES[k].key] / 100;
      var dpp = pt(k, dv);
      dots += '<circle class="radar-dot" cx="' + dpp[0].toFixed(1) + '" cy="' + dpp[1].toFixed(1) + '" r="2.6"/>';
    }
    return '<svg class="radar-svg" viewBox="0 0 ' + size + " " + size + '" role="img" aria-label="radar">' +
      grid + axes +
      '<polygon class="radar-poly" points="' + dpts.join(" ") + '"/>' +
      dots + labels +
      "</svg>";
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
        "</div>" +
        '<div class="score-seal">' +
          '<span class="seal-num" style="color:' + color + '">' + score + '<small>/100</small></span>' +
          '<span class="seal-side">' +
            '<span class="rank-pill">' + esc(fmt(t("rankPill"), { r: rank })) + "</span>" +
            '<span class="seal-caption">' + esc(t("composite")) + "</span>" +
          "</span>" +
        "</div>" +
        '<p class="brief-summary">' + esc(loc(c.summary)) + "</p>" +
        '<div class="metrics-grid">' + metrics + "</div>" +
        '<div class="radar-block"><div class="radar-title">' + esc(t("radarOf")) + "</div>" + radarSVG(c) + "</div>" +
        sections +
        '<div class="sources-block"><div class="sources-h">' + esc(t("sources")) + "</div>" + sources + "</div>" +
      "</div>";
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
    var blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "ev-go-global-v3.csv";
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 200);
  }

  function buildMarkdown() {
    var o = byId(state.selectedId);
    var L = [];
    L.push("# " + rt("title"));
    L.push("");
    L.push("- " + rt("generated") + ": " + new Date().toISOString().slice(0, 10));
    L.push("- " + t("dataAsOfLabel").replace("{d}", DATA_AS_OF[state.lang] || DATA_AS_OF["zh-CN"]));
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
    // 封面
    html += '<div class="pr-cover"><h1>' + esc(rt("title")) + "</h1>" +
      '<div class="pr-sub">' + esc(t("appSubtitle")) + "</div>" +
      '<div class="pr-meta">' + esc(t("coverAuthor")) + "<br>" +
      esc(fmt(t("coverDate"), { d: today })) + "<br>" +
      esc(fmt(t("dataAsOfLabel"), { d: DATA_AS_OF[state.lang] || DATA_AS_OF["zh-CN"] })) +
      "</div></div>";

    // 选中国简报
    if (o && !isLongtail(state.selectedId)) {
      var c = o, rank = rankOf(c.id), score = scoreOf(c.id);
      html += '<div class="pr-section"><h2>' + esc(cName(c)) + " · " + esc(fmt(t("rankPill"), { r: rank })) + " · " + score + "</h2>";
      html += "<p><b>" + esc(t("marketOverview")) + "</b> " + esc(loc(c.summary)) + "</p>";
      html += '<div class="pr-radar">' + radarSVG(c) + "</div>";
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
    $("btnPrint").addEventListener("click", doPrint);
    $("btnCsv").addEventListener("click", exportCSV);
    $("btnCopy").addEventListener("click", copyMarkdown);
  }

  function renderAll() {
    renderTopbar();
    renderLeftRail();
    renderBriefing();
    renderFooter();
    syncMobileTabs();
    // 地图标题/图例文案随语言刷新；重绘不重放入场
    $("mapTitle").textContent = t("secMap");
    $("mapHint").textContent = t("mapHint");
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

  function init() {
    initHash();
    renderTopbar();
    renderLeftRail();
    renderBriefing();
    renderFooter();
    initMobileTabs();
    initMap();
    bindEvents();
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
