#!/usr/bin/env node
/**
 * 季度数据刷新辅助脚本（零依赖，Node 12+）
 * ─────────────────────────────────────────────────────────
 * 用法：
 *   node tools/refresh-data.js --quarter=2026Q4 --asof=2026-11 --next=2027-03
 *
 * 脚本只负责「版本元数据」的机械更新；具体数值（渗透率、份额、政策等）
 * 需按脚本输出的检查清单人工核对后编辑 data.js。
 *
 * 自动更新的位置：
 *   1. version.json        → dataVersion / dataAsOf / nextScheduledUpdate + 追加 changelog
 *   2. data.js             → 头部注释「数据截至」与 DATA_AS_OF 五语言日期
 *   3. index.html          → 静态资源版本号 ?v=x.x 递增（强制用户拉取新文件）
 */
"use strict";
var fs = require("fs");
var path = require("path");

var ROOT = path.resolve(__dirname, "..");

function parseArgs(argv) {
  var out = {};
  argv.slice(2).forEach(function (a) {
    var m = a.match(/^--([a-zA-Z]+)=(.+)$/);
    if (m) out[m[1]] = m[2];
  });
  return out;
}

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), "utf8"); }
function write(rel, content) { fs.writeFileSync(path.join(ROOT, rel), content, "utf8"); }

function fail(msg) {
  console.error("[refresh-data] " + msg);
  process.exit(1);
}

var args = parseArgs(process.argv);
if (!args.quarter) fail("缺少 --quarter=YYYYQn，例如 --quarter=2026Q4");
if (!args.asof) fail("缺少 --asof=YYYY-MM，例如 --asof=2026-11");

var today = new Date();
var dateStamp = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0");

/* ── 1. version.json ── */
var versionPath = "version.json";
var meta = JSON.parse(read(versionPath));
if (meta.dataVersion === args.quarter) {
  fail("version.json 的 dataVersion 已是 " + args.quarter + "，无需刷新（或确认季度参数）");
}
meta.dataVersion = args.quarter;
meta.dataAsOf = args.asof;
meta.updateCadence = "quarterly";
if (args.next) meta.nextScheduledUpdate = args.next;

var year = parseInt(args.asof.slice(0, 10), 10);
var month = parseInt(args.asof.slice(5, 7), 10);
var dateText = {};
dateText["zh-CN"] = year + "年" + month + "月";
dateText["zh-TW"] = year + "年" + month + "月";
dateText.en = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"][month - 1] + " " + year;
dateText.ja = year + "年" + month + "月";
dateText.ko = year + "년 " + month + "월";

meta.changelog = meta.changelog || [];
meta.changelog.unshift({
  version: args.quarter,
  date: dateStamp,
  items: ["待填写：本季度关键数据变化（政策 / 渗透率 / 中国品牌份额 / 排名变动）"]
});
write(versionPath, JSON.stringify(meta, null, 2) + "\n");
console.log("[1/3] version.json 已更新 → " + args.quarter + " / " + args.asof);

/* ── 2. data.js 的 DATA_AS_OF（仅替换日期部分，保留括注口径说明） ── */
var dataPath = "data.js";
var dataSrc = read(dataPath);
var dataChanged = false;
Object.keys(dateText).forEach(function (lang) {
  // 键名允许带或不带引号（data.js 中 zh-CN/zh-TW 带引号，en/ja/ko 不带）
  var re = new RegExp("([\"']?" + lang + "[\"']?\\s*:\\s*[\"])([^\"]*)([\"])");
  dataSrc = dataSrc.replace(re, function (m, p1, p2, p3) {
    // 只替换日期前缀，原样保留括注口径说明；括号前若原本有空格则保留一个（en/ko 半角括号）
    // 注意 [^（(] 必须非贪婪，否则会把括号前的空格一起吃掉
    var pm = /^[^（(]*?(\s*)([（(][\s\S]*)$/.exec(p2);
    var kept = pm ? ((pm[1] ? " " : "") + pm[2]) : "";
    dataChanged = true;
    return p1 + dateText[lang] + kept + p3;
  });
});
var headerRe = /(数据截至：)(\d{4}-\d{2})/;
if (headerRe.test(dataSrc)) {
  dataSrc = dataSrc.replace(headerRe, "$1" + args.asof);
}
if (dataChanged) write(dataPath, dataSrc);
console.log("[2/3] data.js 的 DATA_AS_OF 日期已同步为 " + dateText.en);

/* ── 3. index.html 缓存版本号递增（v3.9 → v4.0 等，季度刷新走 minor+1） ── */
var htmlPath = "index.html";
var html = read(htmlPath);
var verMatch = html.match(/\?v=(\d+)\.(\d+)/);
if (verMatch) {
  var newMinor = parseInt(verMatch[2], 10) + 1;
  var newVer = verMatch[1] + "." + newMinor;
  html = html.replace(/\?v=\d+\.\d+/g, "?v=" + newVer);
  write(htmlPath, html);
  console.log("[3/3] index.html 资源版本号已递增 → v" + newVer);
} else {
  console.log("[3/3] index.html 未发现 ?v=x.x，跳过版本号递增");
}

console.log("");
console.log("────────── 人工检查清单（逐项核对 data.js 后提交） ──────────");
console.log(" [ ] NEV 渗透率 / 中国品牌份额 / 市场增速（重点 15 国）");
console.log(" [ ] 政策变化：关税、反补贴、本地化要求、补贴退坡");
console.log(" [ ] 排名与综合评分是否需要重算（权重不变时仅数值变化）");
console.log(" [ ] 新增市场是否从长尾层升级为完整 6 维评分");
console.log(" [ ] 数据来源注释与 sources 是否需补充新出处");
console.log(" [ ] version.json changelog 的「待填写」替换为本季真实变化");
console.log(" [ ] 本地双击 index.html 自检后提交 git，GitHub Pages 自动部署");
