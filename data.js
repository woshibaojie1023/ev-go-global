// 新能源车出海市场决策助手 - 数据层（国家级 v2 / 重构版）
// ─────────────────────────────────────────────────────────────
// 数据截至：2026-08（公开数据覆盖 2024 全年 ~ 2026 H1，各国口径不一，已在指标中注明）
// 数据来源：乘联会、海关总署、欧盟委员会反补贴终裁(2024.10)、东盟/海湾/拉美各国汽车工业协会、
//           罗兰贝格、JATO Dynamics、Dataforce、KBA、FCAI、Gaikindo、ABVE 等公开资料。
// 评分模型：综合吸引力评分（0-100，越高越优）= 加权求和，权重见 WEIGHTS。
//           该评分为本项目构建的「示例性评估模型」，用于产品演示，非投资建议。
// 语言：国家级叙事字段以 { zh, en } 双语存储；zh-CN/zh-TW 取 zh，en/ja/ko 取 en（小语种回退 EN，详见 i18n.js）。
// ─────────────────────────────────────────────────────────────

const DATA_AS_OF = {
  "zh-CN": "2026年8月（公开数据覆盖 2024 全年 ~ 2026 H1）",
  "zh-TW": "2026年8月（公開數據覆蓋 2024 全年 ~ 2026 H1）",
  en: "August 2026 (public data covers full-year 2024 ~ 2026 H1)",
  ja: "2026年8月（公開データは2024年通年〜2026年H1）",
  ko: "2026년 8월 (공개 데이터 범위 2024년 전체 ~ 2026년 H1)"
};

// 经济组织 / 贸易协定（label 由 i18n 提供，按 key 过滤成员国）
const BLOCS = [
  { key: "ALL", labelKey: "all" },
  { key: "RCEP", labelKey: "RCEP" },
  { key: "BRI", labelKey: "BRI" },
  { key: "EU", labelKey: "EU" },
  { key: "ASEAN", labelKey: "ASEAN" },
  { key: "GCC", labelKey: "GCC" },
  { key: "LATAM", labelKey: "LATAM" },
  { key: "Mercosur", labelKey: "Mercosur" },
  { key: "CPTPP", labelKey: "CPTPP" },
  { key: "USMCA", labelKey: "USMCA" }
];

// 雷达 6 维（label 由 i18n 提供）
const AXES = [
  { key: "marketSize", labelKey: "marketSize" },
  { key: "policy", labelKey: "policy" },
  { key: "competition", labelKey: "competition" },
  { key: "acceptance", labelKey: "acceptance" },
  { key: "localization", labelKey: "localization" },
  { key: "riskControl", labelKey: "riskControl" }
];

const WEIGHTS = { marketSize: 0.25, policy: 0.20, competition: 0.20, acceptance: 0.15, localization: 0.10, riskControl: 0.10 };

function totalScore(scores) {
  let s = 0;
  for (const k in WEIGHTS) s += scores[k] * WEIGHTS[k];
  return Math.round(s);
}

// ── 重点 15 国（完整 6 维评分 + 五段式决策结论）─────────────────
const COUNTRIES = [
  {
    id: "thailand", name: "泰国", nameEn: "Thailand", flag: "🇹🇭",
    region: "sea", blocs: ["RCEP", "ASEAN", "BRI"], color: "#0f6e56",
    lat: 15.0, lon: 101.0,
    summary: { zh: "东盟最大、最成熟的 EV 市场，中国品牌在纯电近乎碾压", en: "Largest and most mature EV market in ASEAN; Chinese brands dominate pure BEV" },
    metrics: {
      penetration: { zh: "约 14%（2025 EV 销量 >12 万辆，+80% YoY）", en: "~14% (2025 EV sales >120k, +80% YoY)" },
      chinaShare: { zh: "纯电约 90% 为中国品牌；中国品牌总份额 ~22%", en: "~90% of BEV from Chinese brands; Chinese brands ~22% total" },
      growth: { zh: "EV 销量 +80% YoY（2025）", en: "EV sales +80% YoY (2025)" },
      keyFact: { zh: "BYD 罗勇工厂 2024.7 投产，年产能 15 万辆（首个海外独资厂）", en: "BYD Rayong plant started production Jul 2024, 150k units/yr (first wholly-owned overseas plant)" }
    },
    scores: { marketSize: 85, policy: 80, competition: 95, acceptance: 85, localization: 85, riskControl: 75 },
    policy: { zh: "每辆 EV 最高 15 万泰铢补贴 + 企业所得税减免，并要求本地建厂；整体对中国品牌友好。", en: "Up to ฿150k subsidy per EV + corporate tax cuts, with local manufacturing requirement; generally friendly to Chinese brands." },
    competition: { zh: "日系（丰田/本田）轻型车份额从 92%(2010) 降至 71%(2025H1)；中国品牌在纯电细分近乎碾压。", en: "Japanese (Toyota/Honda) light-vehicle share fell from 92% (2010) to 71% (2025H1); Chinese brands nearly dominate BEV." },
    consumer: { zh: "购车以「物优价美」为主，年轻一代更重产品本身；充电基建仍是瓶颈。", en: "Buyers prioritize value; younger buyers focus on the product itself; charging infrastructure remains a bottleneck." },
    strategy: { zh: "整车出口→本地 CKD/建厂（泰国、印尼）拿补贴；绑定电池/充电供应链共建生态。", en: "CBU export → local CKD/plant (Thailand, Indonesia) for subsidies; bind battery/charging supply chain to build ecosystem." },
    risk: { zh: "补贴退坡与产能过剩；日系反扑与本地保护；基建制约渗透。", en: "Subsidy phase-out and overcapacity; Japanese pushback and local protection; infrastructure constraints." },
    sources: [
      { zh: "泰国汽车协会 2024-2025", en: "Thai Automotive Assoc 2024-2025" },
      { zh: "JustChinaCars 2026.03", en: "JustChinaCars 2026.03" },
      { zh: "银河证券 2026", en: "Galaxy Securities 2026" }
    ]
  },
  {
    id: "uae", name: "阿联酋", nameEn: "UAE", flag: "🇦🇪",
    region: "mena", blocs: ["GCC", "BRI"], color: "#b45309",
    lat: 24.0, lon: 54.0,
    summary: { zh: "海湾高端化桥头堡，政策宽松、中国品牌份额快速攀升", en: "Gulf premium beachhead; loose policy, Chinese-brand share rising fast" },
    metrics: {
      penetration: { zh: "约 13%（2025 新车渗透）", en: "~13% (2025 new-car penetration)" },
      chinaShare: { zh: "中国品牌整体 >20%，核心市场 >25%；沙特+阿联酋核心突破 25%", en: "Chinese brands >20% overall, >25% in core markets" },
      growth: { zh: "中东自华 EV 进口 +92% YoY（2025）", en: "Middle East EV imports from China +92% YoY (2025)" },
      keyFact: { zh: "2025 自华进口 EV 35 亿美元，全球最大目的地之一", en: "2025 EV imports from China $3.5B, among the world's largest destinations" }
    },
    scores: { marketSize: 70, policy: 85, competition: 88, acceptance: 82, localization: 85, riskControl: 78 },
    policy: { zh: "联邦 EV 政策(2023) + 自贸区（杰贝阿里）关税与营商友好，本地化要求低。", en: "Federal EV policy (2023) + free zones (Jebel Ali) with low tariffs and business-friendly rules; low localization requirement." },
    competition: { zh: "日韩有基础但新能源格局未定；蔚来/比亚迪/小鹏/极氪等 20+ 中国品牌进入全部 6 个海湾国。", en: "Japanese/Korean bases exist but NEV landscape unsettled; 20+ Chinese brands (NIO/BYD/XPeng/Zeekr) entered all 6 Gulf states." },
    consumer: { zh: "高端与豪华需求并存，对新技术接受度高；电车每公里成本仅油车 1/6，忠诚度高（阿联酋 94%）。", en: "Premium & luxury demand coexist; high acceptance of new tech; EV cost ~1/6 of ICE per km, high loyalty (UAE 94%)." },
    strategy: { zh: "以高端/旗舰树立品牌，借自贸区设中转与售后中心，轻资产切入。", en: "Build brand with premium/flagship models; use free zones for transit & service hubs; light-asset entry." },
    risk: { zh: "地缘政治与汇率波动；高端市场竞争；依赖出口无本土产能。", en: "Geopolitics & FX volatility; premium-segment competition; export-dependent with no local capacity." },
    sources: [
      { zh: "Middle East Briefing 2026.03", en: "Middle East Briefing 2026.03" },
      { zh: "乘联会崔东树 2025.11", en: "CPCA Cui Dongshu 2025.11" },
      { zh: "罗兰贝格 2025 GCC 充电指数", en: "Roland Berger 2025 GCC Charging Index" }
    ]
  },
  {
    id: "australia", name: "澳大利亚", nameEn: "Australia", flag: "🇦🇺",
    region: "oce", blocs: ["RCEP", "CPTPP"], color: "#0e7490",
    lat: -25.0, lon: 133.0,
    summary: { zh: "零关税开放市场，中国制造车已成第二大来源国", en: "Zero-tariff open market; China-made cars are the 2nd largest source" },
    metrics: {
      penetration: { zh: "13.1%（2025 EV 份额，+38.7% YoY）", en: "13.1% (2025 EV share, +38.7% YoY)" },
      chinaShare: { zh: "中国品牌占澳 BEV 进口 65–77%；中国制造车占澳 18–20%", en: "Chinese brands 65–77% of AU BEV imports; China-made cars 18–20% of AU market" },
      growth: { zh: "BYD 澳销量 +156% 至 5.2 万辆（2025）", en: "BYD AU sales +156% to 52k units (2025)" },
      keyFact: { zh: "中澳自贸协定 → 中国车进口 0 关税", en: "China-Australia FTA → 0 tariff on Chinese cars" }
    },
    scores: { marketSize: 78, policy: 82, competition: 85, acceptance: 80, localization: 80, riskControl: 82 },
    policy: { zh: "NVES(2025) 碳排放积分机制利好 NEV；中澳自贸协定下中国车 0 关税，无反补贴壁垒。", en: "NVES (2025) emissions-credit mechanism favors NEV; under the FTA Chinese cars face 0 tariff, no anti-subsidy barrier." },
    competition: { zh: "日系根基深，但 BYD 已成澳 NEV 销冠（24% BEV 份额），长城/名爵/奇瑞进前十。", en: "Japanese roots run deep, but BYD is now AU's NEV champion (24% BEV share); GWM/MG/Chery in top 10." },
    consumer: { zh: "价值敏感、偏好 SUV；智能化与续航受称赞，Shark 6 皮卡爆款。", en: "Value-sensitive, SUV-preferring; praised for intelligence & range; Shark 6 ute a hit." },
    strategy: { zh: "借右舵市场经验与 0 关税红利快速铺量；以品牌+渠道合作降低进入成本。", en: "Leverage right-hand-drive experience and 0-tariff dividend for rapid volume; brand + channel partnerships lower entry cost." },
    risk: { zh: "市场体量有限（年 ~120 万辆）；政策与审查趋严。", en: "Limited volume (~1.2M/yr); policy & scrutiny tightening." },
    sources: [
      { zh: "FCAI / zecar 2025 回顾", en: "FCAI / zecar 2025 review" },
      { zh: "广州市贸促会 2026.02", en: "Guangzhou CCPIT 2026.02" },
      { zh: "hupu 2026.01", en: "Hupu 2026.01" }
    ]
  },
  {
    id: "indonesia", name: "印度尼西亚", nameEn: "Indonesia", flag: "🇮🇩",
    region: "sea", blocs: ["RCEP", "ASEAN", "BRI"], color: "#7c3aed",
    lat: -2.5, lon: 118.0,
    summary: { zh: "镍矿红利 + 庞大人口，中国品牌垄断纯电", en: "Nickel dividend + huge population; Chinese brands monopolize BEV" },
    metrics: {
      penetration: { zh: "约 5%（2025H1 BEV 35,749 辆，+267%）", en: "~5% (2025H1 BEV 35,749, +267%)" },
      chinaShare: { zh: "纯电约 90%+ 中国品牌", en: "90%+ of BEV from Chinese brands" },
      growth: { zh: "BEV +267% YoY（2025H1）", en: "BEV +267% YoY (2025H1)" },
      keyFact: { zh: "镍产量占全球 70%，电池全产业链本土化", en: "70% of world nickel output; full local battery supply chain" }
    },
    scores: { marketSize: 82, policy: 78, competition: 92, acceptance: 80, localization: 80, riskControl: 70 },
    policy: { zh: "本地组装激励 + 电池增值税 11%→1%；但设本地含量要求，倒逼产业链投资。", en: "Local-assembly incentives + battery VAT 11%→1%; but local-content rules force supply-chain investment." },
    competition: { zh: "日系燃油仍主导，但新能源被中国品牌主导（BYD/五菱/奇瑞）。", en: "Japanese ICE still dominant, but NEV led by Chinese brands (BYD/Wuling/Chery)." },
    consumer: { zh: "性价比驱动，五菱/比亚迪口碑好；里程焦虑弱（出行半径小）。", en: "Value-driven; Wuling/BYD well regarded; weak range anxiety (short trip radius)." },
    strategy: { zh: "绑定镍矿—电池—整车产业链；BYD/吉利/奇瑞本地建厂辐射东盟。", en: "Bind nickel–battery–vehicle chain; BYD/Geely/Chery local plants radiate across ASEAN." },
    risk: { zh: "汇率波动与购买力；政策转向；镍 ESG 与 LFP 替代削弱镍战略地位。", en: "FX & purchasing power; policy shifts; nickel ESG and LFP substitution undercut nickel's strategic value." },
    sources: [
      { zh: "央广网 2025.07", en: "CNR 2025.07" },
      { zh: "Katadata / Gaikindo", en: "Katadata / Gaikindo" },
      { zh: "国际日报 2025", en: "International Daily 2025" }
    ]
  },
  {
    id: "saudi", name: "沙特阿拉伯", nameEn: "Saudi Arabia", flag: "🇸🇦",
    region: "mena", blocs: ["GCC", "BRI"], color: "#be123c",
    lat: 24.0, lon: 45.0,
    summary: { zh: "海湾第一大单一市场，2030 愿景驱动电动化", en: "Largest single Gulf market; 2030 Vision drives electrification" },
    metrics: {
      penetration: { zh: "低基数高增速（2024 EV ×10 至 1.1 万辆）", en: "Low base, high growth (2024 EV ×10 to 11k)" },
      chinaShare: { zh: "中国品牌在沙上牌 >26 万、份额近 20%；NEV 中中国占 >50%", en: "Chinese brands >260k registrations, ~20% share; >50% of NEV" },
      growth: { zh: "对中东出口 +36%（2025 前 11 月）", en: "Exports to Middle East +36% (first 11 mo 2025)" },
      keyFact: { zh: "BYD 与 PIF 合资建厂（2027 投产，15 万辆）", en: "BYD–PIF JV plant (2027, 150k units)" }
    },
    scores: { marketSize: 72, policy: 80, competition: 85, acceptance: 80, localization: 78, riskControl: 76 },
    policy: { zh: "2030 愿景 + 主权基金（PIF）合资模式；Ceer 本土厂 2026Q4 投产，鼓励本地化。", en: "Vision 2030 + sovereign fund (PIF) JV model; Ceer local plant from 2026Q4 encourages localization." },
    competition: { zh: "比亚迪/奇瑞/长安居中国品牌前三，在沙新能源合计占比 >70%。", en: "BYD/Chery/Changan lead Chinese brands; together >70% of Saudi NEV." },
    consumer: { zh: "油价补贴下电车仍省 83% 成本；忠诚度 91%；炎热气候催生空调刚需。", en: "Even with fuel subsidies EVs save 83% cost; loyalty 91%; heat drives A/C demand." },
    strategy: { zh: "借 PIF/主权基金合资进入；高端化 + 本土建厂双重布局。", en: "Enter via PIF/sovereign-fund JVs; premium positioning + local plant." },
    risk: { zh: "依赖出口、本土产能未起；长期油补与政策不确定性。", en: "Export-dependent, local capacity unbuilt; long-term fuel-subsidy & policy uncertainty." },
    sources: [
      { zh: "Middle East Briefing 2026.03", en: "Middle East Briefing 2026.03" },
      { zh: "腾讯出海 2026.03", en: "Tencent Global 2026.03" },
      { zh: "今日头条 2025", en: "Toutiao 2025" }
    ]
  },
  {
    id: "brazil", name: "巴西", nameEn: "Brazil", flag: "🇧🇷",
    region: "latam", blocs: ["LATAM", "BRI", "Mercosur"], color: "#15803d",
    lat: -10.0, lon: -55.0,
    summary: { zh: "拉美最大汽车市场，中国品牌 NEV 压倒性领先", en: "Largest LatAm auto market; Chinese brands dominate NEV" },
    metrics: {
      penetration: { zh: "低（2024 NEV 17.7 万辆，+90%）", en: "Low (2024 NEV 177k, +90%)" },
      chinaShare: { zh: "BYD 拉美 NEV 份额 60%→77%；巴西 BEV 5 月 >80%", en: "BYD LatAm NEV share 60%→77%; Brazil BEV >80% in May" },
      growth: { zh: "EV +90% YoY（2024）", en: "EV +90% YoY (2024)" },
      keyFact: { zh: "全球第 6 大汽车市场，BYD 2025 在巴 ~11.3 万辆", en: "6th largest auto market; BYD ~113k in Brazil 2025" }
    },
    scores: { marketSize: 88, policy: 55, competition: 90, acceptance: 82, localization: 70, riskControl: 65 },
    policy: { zh: "电动车进口税 0→25%(BEV, 2026.7)→35%(2027)；绿色出行计划鼓励本地制造。", en: "EV import tax 0→25% (BEV, Jul 2026)→35% (2027); green-mobility plan encourages local manufacturing." },
    competition: { zh: "美欧日韩系主导轻型车但集中度降；新能源细分中国品牌压倒性领先。", en: "US/EU/JK brands lead light vehicles but concentration falls; NEV segment dominated by Chinese brands." },
    consumer: { zh: "性价比敏感，EV 满意度高（墨西哥 92% / 巴西 100%）。", en: "Price-sensitive; high EV satisfaction (Mexico 92% / Brazil 100%)." },
    strategy: { zh: "本地建厂（BYD 巴伊亚 / GWM / GAC）对冲进口税；高性价比走量 + 金融下沉。", en: "Local plants (BYD Bahia / GWM / GAC) hedge import tax; value volume + financial penetration." },
    risk: { zh: "贸易政策波动（阶梯加税）；基建不足；汇率与劳工风险。", en: "Trade-policy swings (step tariffs); weak infrastructure; FX & labor risk." },
    sources: [
      { zh: "ABVE / KrASIA 2025", en: "ABVE / KrASIA 2025" },
      { zh: "江苏网 2025.10", en: "JS China 2025.10" },
      { zh: "Latam Mobility 2025", en: "Latam Mobility 2025" }
    ]
  },
  {
    id: "newzealand", name: "新西兰", nameEn: "New Zealand", flag: "🇳🇿",
    region: "oce", blocs: ["RCEP", "CPTPP"], color: "#0369a1",
    lat: -41.0, lon: 174.0,
    summary: { zh: "开放小市场，BYD 重点右舵试验田", en: "Open small market; BYD's right-hand-drive testbed" },
    metrics: {
      penetration: { zh: "高（政策鼓励，无进口关税）", en: "High (pro-EV policy, no import tariff)" },
      chinaShare: { zh: "BYD 强势增长，居中国品牌前列", en: "BYD growing strongly, top Chinese brand" },
      growth: { zh: "跟随澳洲趋势稳步上量", en: "Following Australia's trend, steady uptake" },
      keyFact: { zh: "无整车进口关税，BYD ANZ 目标进前三", en: "No vehicle import tariff; BYD ANZ targets top 3" }
    },
    scores: { marketSize: 50, policy: 80, competition: 75, acceptance: 72, localization: 75, riskControl: 80 },
    policy: { zh: "无进口关税、历史 EV 补贴友好；与澳洲同属右舵市场，可协同。", en: "No import tariff, historically EV-subsidy friendly; right-hand-drive synergy with Australia." },
    competition: { zh: "日系根基深，但 BYD 等以 NEV 快速切入。", en: "Japanese roots deep, but BYD etc. enter fast via NEV." },
    consumer: { zh: "环保意识强、政策鼓励，NEV 接受度高。", en: "Strong eco-awareness, pro-EV policy, high NEV acceptance." },
    strategy: { zh: "作为右舵市场试验田与澳洲协同铺量；品牌+渠道合作。", en: "Use as RHD testbed and volume with Australia; brand + channel partnerships." },
    risk: { zh: "市场体量小；政策与审查趋严。", en: "Small volume; policy & scrutiny tightening." },
    sources: [
      { zh: "BYD ANZ 公开表态 2025-2026", en: "BYD ANZ statements 2025-2026" },
      { zh: "Fleet Auto News", en: "Fleet Auto News" }
    ]
  },
  {
    id: "malaysia", name: "马来西亚", nameEn: "Malaysia", flag: "🇲🇾",
    region: "sea", blocs: ["RCEP", "ASEAN"], color: "#ca8a04",
    lat: 4.2, lon: 101.9,
    summary: { zh: "本土品牌护城河深，借宝腾渠道渗透", en: "Deep local-brand moat; penetrate via Proton channels" },
    metrics: {
      penetration: { zh: "约 4–5%（EV 低基数）", en: "~4–5% (EV low base)" },
      chinaShare: { zh: "纯电约 35% 中国品牌（2025H1）", en: "~35% of BEV from Chinese brands (2025H1)" },
      growth: { zh: "中国品牌 +50% YoY（2025）", en: "Chinese brands +50% YoY (2025)" },
      keyFact: { zh: "吉利持股宝腾 49.9%，渠道复用", en: "Geely holds 49.9% of Proton; channel reuse" }
    },
    scores: { marketSize: 62, policy: 70, competition: 72, acceptance: 70, localization: 72, riskControl: 72 },
    policy: { zh: "本土品牌保护（Perodua/Proton）与 AP 准入；但吉利-宝腾模式打开合资通道。", en: "Local-brand protection (Perodua/Proton) & AP entry rules; but Geely–Proton opens JV channel." },
    competition: { zh: "本土双雄主导，中国品牌以 EV 细分突破（Chery 增长快）。", en: "Local duo dominates; Chinese brands break through in EV (Chery fast-growing)." },
    consumer: { zh: "价格与品牌并存，对新能源接受度中等。", en: "Price and brand both matter; moderate NEV acceptance." },
    strategy: { zh: "借吉利-宝腾合资渠道；以 EV 差异化车型切入。", en: "Use Geely–Proton JV channel; enter with differentiated EV models." },
    risk: { zh: "本土保护与文化壁垒；需求规模有限。", en: "Local protection & cultural barriers; limited demand scale." },
    sources: [
      { zh: "JustChinaCars 2026.03", en: "JustChinaCars 2026.03" },
      { zh: "银河证券 2026", en: "Galaxy Securities 2026" }
    ]
  },
  {
    id: "mexico", name: "墨西哥", nameEn: "Mexico", flag: "🇲🇽",
    region: "latam", blocs: ["LATAM", "BRI", "USMCA"], color: "#c2410c",
    lat: 23.6, lon: -102.5,
    summary: { zh: "中国第一大单一出口市场，但关税与美压风险高", en: "China's largest single export market, but high tariff & US-pressure risk" },
    metrics: {
      penetration: { zh: "低基数高增速", en: "Low base, high growth" },
      chinaShare: { zh: "BYD ~70% 墨 EV 市场（2025）；中国车占墨 20%", en: "BYD ~70% of Mexico EV market (2025); Chinese cars 20% of Mexico" },
      growth: { zh: "中国对墨出口 +30.7%（2025H1）", en: "China-to-Mexico exports +30.7% (2025H1)" },
      keyFact: { zh: "中国第一大单一出口市场；关税 20%→50%", en: "China's largest single export market; tariff 20%→50%" }
    },
    scores: { marketSize: 75, policy: 45, competition: 80, acceptance: 78, localization: 50, riskControl: 50 },
    policy: { zh: "对无自贸国车辆关税 20%→50%（主要指向中国，受美 pressure）；USMCA 原产地限制。", en: "Tariff on non-FTA vehicles 20%→50% (mainly China, under US pressure); USMCA rules of origin." },
    competition: { zh: "BYD 主导 EV、MG 强势；中国品牌借墨辐射拉美。", en: "BYD leads EV, MG strong; Chinese brands use Mexico to radiate across LatAm." },
    consumer: { zh: "性价比敏感，Dolphin Mini 成爆款（年 5.3 万辆）。", en: "Price-sensitive; Dolphin Mini a hit (53k/yr)." },
    strategy: { zh: "以墨为拉美枢纽；但建厂受美压不确定，需灵活产能布局。", en: "Use Mexico as LatAm hub; but US-pressure makes plants uncertain—flexible capacity needed." },
    risk: { zh: "美国政治/关税风险极高；本地化承诺落地不确定。", en: "Very high US political/tariff risk; local-commitment execution uncertain." },
    sources: [
      { zh: "江苏网 2025.10", en: "JS China 2025.10" },
      { zh: "Latam Mobility 2025", en: "Latam Mobility 2025" },
      { zh: "青年网 2026.08", en: "China Youth 2026.08" }
    ]
  },
  {
    id: "turkey", name: "土耳其", nameEn: "Türkiye", flag: "🇹🇷",
    region: "eurasia", blocs: ["BRI"], color: "#6d28d9",
    lat: 39.0, lon: 35.2,
    summary: { zh: "借欧盟关税同盟「曲线入欧」的制造跳板", en: "Manufacturing springboard to 'indirectly enter Europe' via EU customs union" },
    metrics: {
      penetration: { zh: "约 30%（EV+HEV，2025 预测）", en: "~30% (EV+HEV, 2025 est.)" },
      chinaShare: { zh: "中国车 7.1%（2024），BYD/Chery 领先", en: "Chinese cars 7.1% (2024), BYD/Chery lead" },
      growth: { zh: "中国车在土 +49% YoY（2024）", en: "Chinese cars in Turkey +49% YoY (2024)" },
      keyFact: { zh: "BYD 投资 10 亿美元建厂（2026 投产，15 万辆）", en: "BYD $1B plant (2026, 150k units)" }
    },
    scores: { marketSize: 68, policy: 50, competition: 70, acceptance: 65, localization: 65, riskControl: 50 },
    policy: { zh: "对华车加征 40% 附加税，但「投资设厂即免」降至 10%；借欧盟关税同盟曲线入欧。", en: "40% surtax on Chinese cars, but 'invest-and-build' cuts it to 10%; EU customs union enables indirect Europe access." },
    competition: { zh: "本土 TOGG + 外资巨头；BYD/Chery 以投资换市场。", en: "Local TOGG + foreign giants; BYD/Chery trade investment for market." },
    consumer: { zh: "对新科技接受快，EV 占比快速攀升。", en: "Fast adopters of new tech; EV share rising quickly." },
    strategy: { zh: "以本地建厂换取零关税入欧；作为辐射欧/中东/北非的制造跳板。", en: "Local plant for tariff-free Europe access; manufacturing hub for Europe/Middle East/North Africa." },
    risk: { zh: "政策波动大（关税反复）；汇率与政治风险；本土保护。", en: "High policy volatility (tariff flip-flops); FX & political risk; local protection." },
    sources: [
      { zh: "JETRO 2025", en: "JETRO 2025" },
      { zh: "虎嗅 2024", en: "Huxiu 2024" },
      { zh: "第一财经 2024", en: "Yicai 2024" }
    ]
  },
  {
    id: "vietnam", name: "越南", nameEn: "Vietnam", flag: "🇻🇳",
    region: "sea", blocs: ["RCEP", "ASEAN", "BRI"], color: "#0d9488",
    lat: 14.0, lon: 108.0,
    summary: { zh: "VinFast 本土保护强，中国品牌份额低", en: "Strong VinFast local protection; low Chinese-brand share" },
    metrics: {
      penetration: { zh: "约 2–3%", en: "~2–3%" },
      chinaShare: { zh: "中国品牌约 5–8%（VinFast 主导）", en: "Chinese brands ~5–8% (VinFast-led)" },
      growth: { zh: "VinFast 快速起量，份额 ~6%", en: "VinFast ramping fast, ~6% share" },
      keyFact: { zh: "VinFast 本土保护强，BYD 拟进入", en: "Strong VinFast protection; BYD plans entry" }
    },
    scores: { marketSize: 58, policy: 60, competition: 50, acceptance: 65, localization: 58, riskControl: 65 },
    policy: { zh: "扶持本土 VinFast，对外资设门槛；中国品牌进入受限。", en: "Supports local VinFast, barriers to foreign entrants; Chinese brands restricted." },
    competition: { zh: "VinFast 占据主导，日系仍强；中国品牌近乎缺席。", en: "VinFast dominates, Japanese still strong; Chinese brands nearly absent." },
    consumer: { zh: "民族主义与本土品牌偏好明显。", en: "Marked nationalism and local-brand preference." },
    strategy: { zh: "暂不优先；可先技术/零部件合作或高端小众切入。", en: "Not a priority; start with tech/components JV or premium-niche entry." },
    risk: { zh: "本土保护与文化壁垒；需求错配。", en: "Local protection & cultural barriers; demand mismatch." },
    sources: [
      { zh: "JustChinaCars 2026.03", en: "JustChinaCars 2026.03" },
      { zh: "银河证券 2026", en: "Galaxy Securities 2026" }
    ]
  },
  {
    id: "germany", name: "德国", nameEn: "Germany", flag: "🇩🇪",
    region: "eur", blocs: ["EU"], color: "#1d4ed8",
    lat: 51.2, lon: 10.4,
    summary: { zh: "欧盟最大市场，关税壁垒高需本地化破局", en: "Largest EU market; high tariff wall needs localization" },
    metrics: {
      penetration: { zh: "19.1%（2025 EV 54.5 万辆，+43%）", en: "19.1% (2025 EV 545k, +43%)" },
      chinaShare: { zh: "BYD 德国 +700% 至 2.3 万辆，份额仍 <1%", en: "BYD Germany +700% to 23k, share still <1%" },
      growth: { zh: "中国品牌在欧 +93%（1–10 月）", en: "Chinese brands in EU +93% (Jan–Oct)" },
      keyFact: { zh: "欧盟反补贴税综合最高 45.3%", en: "EU anti-subsidy duty up to 45.3% combined" }
    },
    scores: { marketSize: 80, policy: 35, competition: 45, acceptance: 70, localization: 45, riskControl: 60 },
    policy: { zh: "2024.10 终裁：10% 基础税上叠加反补贴税（BYD 17% / 吉利 18.8% / 上汽 35.3% / 其他 20.7%），综合最高 45.3%，为期 5 年。", en: "Oct 2024 final ruling: 10% base duty + anti-subsidy (BYD 17% / Geely 18.8% / SAIC 35.3% / others 20.7%), up to 45.3% combined, for 5 years." },
    competition: { zh: "大众/Stellantis/雷诺与特斯拉强势；中国品牌从低基数快速提升。", en: "VW/Stellantis/Renault & Tesla strong; Chinese brands rising from low base." },
    consumer: { zh: "环保意识强、补能完善；被中国车约 1/2 均价吸引。", en: "Eco-conscious, mature charging; attracted by ~half-price Chinese cars." },
    strategy: { zh: "本地建厂/合资（BYD 匈牙利、上汽西班牙）规避关税；PHEV/混动+高端切入。", en: "Local plants/JVs (BYD Hungary, SAIC Spain) dodge tariffs; PHEV/hybrid + premium entry." },
    risk: { zh: "关税与地缘政治；CBAM 碳边境税；本地化合规成本高。", en: "Tariffs & geopolitics; CBAM carbon border tax; high localization compliance cost." },
    sources: [
      { zh: "欧盟委员会反补贴终裁 2024.10", en: "EU Commission anti-subsidy ruling 2024.10" },
      { zh: "Dataforce / 中国汽车报 2025.12", en: "Dataforce / China Auto News 2025.12" },
      { zh: "KBA 2025", en: "KBA 2025" }
    ]
  },
  {
    id: "korea", name: "韩国", nameEn: "South Korea", flag: "🇰🇷",
    region: "easia", blocs: ["RCEP"], color: "#db2777",
    lat: 36.5, lon: 127.8,
    summary: { zh: "本土现代/起亚护城河深，进入壁垒高", en: "Deep Hyundai/Kia moat; high entry barrier" },
    metrics: {
      penetration: { zh: "约 9.5%（2024 NEV）", en: "~9.5% (2024 NEV)" },
      chinaShare: { zh: "本土现代/起亚主导，中国品牌极低", en: "Local Hyundai/Kia dominate; Chinese brands very low" },
      growth: { zh: "稳步但本土强势", en: "Steady but locally dominant" },
      keyFact: { zh: "本土巨头护城河深", en: "Deep local-giant moat" }
    },
    scores: { marketSize: 45, policy: 50, competition: 42, acceptance: 48, localization: 50, riskControl: 68 },
    policy: { zh: "市场开放但本土保护强，消费者偏好本土品牌。", en: "Open market but strong local protection; consumers prefer local brands." },
    competition: { zh: "现代/起亚双雄主导，中国品牌近乎缺席。", en: "Hyundai/Kia duopoly; Chinese brands nearly absent." },
    consumer: { zh: "对本土品牌忠诚度高，对纯电与新品牌接受度中等。", en: "High local-brand loyalty; moderate acceptance of BEV and new brands." },
    strategy: { zh: "暂不优先；可先以技术/零部件合作或高端小众切入。", en: "Not a priority; start with tech/components JV or premium-niche entry." },
    risk: { zh: "本土保护与文化壁垒；需求错配。", en: "Local protection & cultural barriers; demand mismatch." },
    sources: [
      { zh: "乘联会 / 行业研究 2024", en: "CPCA / industry research 2024" }
    ]
  },
  {
    id: "france", name: "法国", nameEn: "France", flag: "🇫🇷",
    region: "eur", blocs: ["EU"], color: "#4338ca",
    lat: 46.2, lon: 2.2,
    summary: { zh: "欧盟核心但补贴收紧，关税双重压制", en: "Core EU but tightening subsidies, double tariff pressure" },
    metrics: {
      penetration: { zh: "BEV 约 24%（2025，稳定）", en: "BEV ~24% (2025, stable)" },
      chinaShare: { zh: "中国 EV 份额低（关税+补贴本地化要求）", en: "Low Chinese EV share (tariff + subsidy localization)" },
      growth: { zh: "BEV 稳定，PHEV 下滑", en: "BEV stable, PHEV declining" },
      keyFact: { zh: "欧盟关税 + 法国补贴本地化要求", en: "EU tariff + French subsidy localization requirement" }
    },
    scores: { marketSize: 62, policy: 33, competition: 40, acceptance: 62, localization: 40, riskControl: 58 },
    policy: { zh: "欧盟关税 + 法国收紧补贴申领标准（偏袒本土/欧洲产），双重压制中国车。", en: "EU tariff + France tightening subsidy eligibility (favoring local/EU-made), double pressure on Chinese cars." },
    competition: { zh: "雷诺/标致本土强势；中国品牌份额低。", en: "Renault/Peugeot strong locally; Chinese brands low share." },
    consumer: { zh: "环保意识强，但受政策与本土偏好影响。", en: "Eco-conscious but shaped by policy and local preference." },
    strategy: { zh: "以欧洲本地化产能（如借土耳其/匈牙利）间接进入；高端小众切入。", en: "Indirect entry via EU-local capacity (e.g. Turkey/Hungary); premium-niche." },
    risk: { zh: "政策与地缘政治；本土保护。", en: "Policy & geopolitics; local protection." },
    sources: [
      { zh: "CAM / BatteryIndustry 2025", en: "CAM / BatteryIndustry 2025" },
      { zh: "欧盟委员会 2024.10", en: "EU Commission 2024.10" }
    ]
  },
  {
    id: "japan", name: "日本", nameEn: "Japan", flag: "🇯🇵",
    region: "easia", blocs: ["RCEP"], color: "#475569",
    lat: 36.2, lon: 138.2,
    summary: { zh: "发达国家中电动化最低，混动偏好强", en: "Lowest electrification among developed nations; strong HEV preference" },
    metrics: {
      penetration: { zh: "约 2%（2024 EV 5.97 万辆，-33%）", en: "~2% (2024 EV 59.7k, -33%)" },
      chinaShare: { zh: "BYD 日本 +54% 至 2,223 辆", en: "BYD Japan +54% to 2,223 units" },
      growth: { zh: "EV 销量 -33% YoY（2024）", en: "EV sales -33% YoY (2024)" },
      keyFact: { zh: "发达国家中电动化最低", en: "Lowest electrification among developed nations" }
    },
    scores: { marketSize: 40, policy: 45, competition: 45, acceptance: 40, localization: 50, riskControl: 70 },
    policy: { zh: "无针对性限制但市场本身对 EV 冷淡，混动/轻自动车主导。", en: "No targeted limits but market itself is cool on EVs; HEV/kei cars dominate." },
    competition: { zh: "日产/丰田本土巨头主导，中国品牌近乎缺席。", en: "Nissan/Toyota local giants dominate; Chinese brands nearly absent." },
    consumer: { zh: "对纯电接受度低，偏好混动与本土品牌。", en: "Low BEV acceptance; prefer HEV and local brands." },
    strategy: { zh: "暂不优先；可先以技术/零部件合作或高端小众切入。", en: "Not a priority; start with tech/components JV or premium-niche." },
    risk: { zh: "需求错配（混动 vs 纯电）；文化壁垒。", en: "Demand mismatch (HEV vs BEV); cultural barriers." },
    sources: [
      { zh: "日经 / 新华 2024", en: "Nikkei / Xinhua 2024" },
      { zh: "乘联会 2024", en: "CPCA 2024" }
    ]
  }
];

// ── 长尾市场（仅基础信息，无评分）─────────────────────────────
// 字段：name(zh) / nameEn / flag / org(经济组织key数组) / tariff(低/中/高) /
//       nev(NEV渗透率级别 低/中/高) / lat / lon / noteZh / noteEn
// 说明：长尾市场只提供「基础信息」，不编造评分；ja/ko 现已提供本地化国名(nameJa/nameKo)，长文备注(note)仍回退英文。
const LONGTAIL = [
  { id: "poland", name: "波兰", nameEn: "Poland", nameJa: "ポーランド", nameKo: "폴란드", flag: "🇵🇱", org: ["EU"], tariff: "high", nev: "mid", lat: 52.0, lon: 19.0, noteZh: "欧盟成员国，适用反补贴税；本土产能稀缺，中国车经西欧转口。", noteEn: "EU member, anti-subsidy duty applies; thin local capacity, re-export via W. Europe." },
  { id: "hungary", name: "匈牙利", nameEn: "Hungary", nameJa: "ハンガリー", nameKo: "헝가리", flag: "🇭🇺", org: ["EU"], tariff: "high", nev: "mid", lat: 47.0, lon: 19.0, noteZh: "欧盟成员国；BYD 欧洲首厂落地，具本地化跳板意义。", noteEn: "EU member; site of BYD's first European plant, a localization springboard." },
  { id: "italy", name: "意大利", nameEn: "Italy", nameJa: "イタリア", nameKo: "이탈리아", flag: "🇮🇹", org: ["EU"], tariff: "high", nev: "mid", lat: 42.0, lon: 12.0, noteZh: "欧盟核心市场，本土品牌（FCA/Stellantis）护城河深。", noteEn: "Core EU market; deep local-brand (FCA/Stellantis) moat." },
  { id: "spain", name: "西班牙", nameEn: "Spain", nameJa: "スペイン", nameKo: "스페인", flag: "🇪🇸", org: ["EU"], tariff: "high", nev: "mid", lat: 40.0, lon: -3.0, noteZh: "欧盟成员国；上汽/奇瑞拟本地建厂规避关税。", noteEn: "EU member; SAIC/Chery plan local plants to dodge tariffs." },
  { id: "sweden", name: "瑞典", nameEn: "Sweden", nameJa: "スウェーデン", nameKo: "스웨덴", flag: "🇸🇪", org: ["EU"], tariff: "high", nev: "high", lat: 62.0, lon: 15.0, noteZh: "欧盟高渗透市场，消费者偏好纯电。", noteEn: "EU high-penetration market; consumers favor BEV." },
  { id: "netherlands", name: "荷兰", nameEn: "Netherlands", nameJa: "オランダ", nameKo: "네덜란드", flag: "🇳🇱", org: ["EU"], tariff: "high", nev: "high", lat: 52.0, lon: 5.0, noteZh: "欧盟高渗透市场，进口枢纽，补能完善。", noteEn: "EU high-penetration market, import hub, mature charging." },
  { id: "belgium", name: "比利时", nameEn: "Belgium", nameJa: "ベルギー", nameKo: "벨기에", flag: "🇧🇪", org: ["EU"], tariff: "high", nev: "mid", lat: 50.5, lon: 4.5, noteZh: "欧盟成员国，欧洲分销与中转枢纽。", noteEn: "EU member; European distribution & transit hub." },
  { id: "czechia", name: "捷克", nameEn: "Czechia", nameJa: "チェコ", nameKo: "체코", flag: "🇨🇿", org: ["EU"], tariff: "high", nev: "mid", lat: 49.8, lon: 15.5, noteZh: "欧盟成员国，汽车制造强国，本土供应链强。", noteEn: "EU member, auto-manufacturing powerhouse with strong local supply chain." },
  { id: "romania", name: "罗马尼亚", nameEn: "Romania", nameJa: "ルーマニア", nameKo: "루마니아", flag: "🇷🇴", org: ["EU"], tariff: "high", nev: "low", lat: 46.0, lon: 25.0, noteZh: "欧盟成员国，低价市场，渗透率偏低。", noteEn: "EU member, price-sensitive market, low penetration." },
  { id: "austria", name: "奥地利", nameEn: "Austria", nameJa: "オーストリア", nameKo: "오스트리아", flag: "🇦🇹", org: ["EU"], tariff: "high", nev: "mid", lat: 47.5, lon: 14.0, noteZh: "欧盟成员国，阿尔卑斯邻国，偏好 premium。", noteEn: "EU member, Alpine neighbor, premium preference." },
  { id: "portugal", name: "葡萄牙", nameEn: "Portugal", nameJa: "ポルトガル", nameKo: "포르투갈", flag: "🇵🇹", org: ["EU"], tariff: "high", nev: "mid", lat: 39.5, lon: -8.0, noteZh: "欧盟成员国，补贴驱动型市场。", noteEn: "EU member, subsidy-driven market." },
  { id: "greece", name: "希腊", nameEn: "Greece", nameJa: "ギリシャ", nameKo: "그리스", flag: "🇬🇷", org: ["EU"], tariff: "high", nev: "low", lat: 39.0, lon: 22.0, noteZh: "欧盟成员国，南欧小市场，渗透率低。", noteEn: "EU member, small Southern market, low penetration." },
  { id: "denmark", name: "丹麦", nameEn: "Denmark", nameJa: "デンマーク", nameKo: "덴마크", flag: "🇩🇰", org: ["EU"], tariff: "high", nev: "high", lat: 56.0, lon: 10.0, noteZh: "欧盟高渗透市场，税收政策利好纯电。", noteEn: "EU high-penetration market; tax policy favors BEV." },
  { id: "finland", name: "芬兰", nameEn: "Finland", nameJa: "フィンランド", nameKo: "핀란드", flag: "🇫🇮", org: ["EU"], tariff: "high", nev: "high", lat: 64.0, lon: 26.0, noteZh: "欧盟高渗透市场，严寒气候考验电池。", noteEn: "EU high-penetration market; cold climate tests batteries." },
  { id: "ireland", name: "爱尔兰", nameEn: "Ireland", nameJa: "アイルランド", nameKo: "아일랜드", flag: "🇮🇪", org: ["EU"], tariff: "high", nev: "mid", lat: 53.0, lon: -8.0, noteZh: "欧盟成员国，右舵市场，进口依赖。", noteEn: "EU member, right-hand-drive, import-dependent." },
  { id: "philippines", name: "菲律宾", nameEn: "Philippines", nameJa: "フィリピン", nameKo: "필리핀", flag: "🇵🇭", org: ["ASEAN", "RCEP"], tariff: "mid", nev: "low", lat: 13.0, lon: 122.0, noteZh: "东盟成员国，右舵市场，电动化起步阶段。", noteEn: "ASEAN member, RHD market, early electrification stage." },
  { id: "myanmar", name: "缅甸", nameEn: "Myanmar", nameJa: "ミャンマー", nameKo: "미얀마", flag: "🇲🇲", org: ["ASEAN", "BRI"], tariff: "mid", nev: "low", lat: 21.0, lon: 96.0, noteZh: "东盟成员国，一带一路沿线，市场动荡。", noteEn: "ASEAN member, along BRI, volatile market." },
  { id: "cambodia", name: "柬埔寨", nameEn: "Cambodia", nameJa: "カンボジア", nameKo: "캄보디아", flag: "🇰🇭", org: ["ASEAN", "BRI"], tariff: "low", nev: "low", lat: 12.0, lon: 105.0, noteZh: "东盟成员国，低关税，微型车需求为主。", noteEn: "ASEAN member, low tariff, micro-car demand." },
  { id: "laos", name: "老挝", nameEn: "Laos", nameJa: "ラオス", nameKo: "라오스", flag: "🇱🇦", org: ["ASEAN", "BRI"], tariff: "low", nev: "low", lat: 18.0, lon: 103.0, noteZh: "东盟成员国，一带一路沿线，体量极小。", noteEn: "ASEAN member, along BRI, very small volume." },
  { id: "brunei", name: "文莱", nameEn: "Brunei", nameJa: "ブルネイ", nameKo: "브루나이", flag: "🇧🇳", org: ["ASEAN", "RCEP"], tariff: "low", nev: "low", lat: 4.5, lon: 114.5, noteZh: "东盟成员国，高人均收入，油车依赖。", noteEn: "ASEAN member, high per-capita income, ICE-dependent." },
  { id: "singapore", name: "新加坡", nameEn: "Singapore", nameJa: "シンガポール", nameKo: "싱가포르", flag: "🇸🇬", org: ["ASEAN", "RCEP", "CPTPP"], tariff: "low", nev: "mid", lat: 1.3, lon: 103.8, noteZh: "东盟成员国，拥车成本高，政策驱动高端化。", noteEn: "ASEAN member, high car-ownership cost, policy-driven premium." },
  { id: "kazakhstan", name: "哈萨克斯坦", nameEn: "Kazakhstan", nameJa: "カザフスタン", nameKo: "카자흐스탄", flag: "🇰🇿", org: ["BRI"], tariff: "mid", nev: "low", lat: 48.0, lon: 67.0, noteZh: "一带一路沿线，中俄之间中转市场。", noteEn: "Along BRI, transit market between China & Russia." },
  { id: "egypt", name: "埃及", nameEn: "Egypt", nameJa: "エジプト", nameKo: "이집트", flag: "🇪🇬", org: ["BRI"], tariff: "mid", nev: "low", lat: 26.0, lon: 30.0, noteZh: "一带一路沿线，北非最大市场，本地组装初兴。", noteEn: "Along BRI, largest N. African market, local assembly emerging." },
  { id: "pakistan", name: "巴基斯坦", nameEn: "Pakistan", nameJa: "パキスタン", nameKo: "파키스탄", flag: "🇵🇰", org: ["BRI"], tariff: "mid", nev: "low", lat: 30.0, lon: 70.0, noteZh: "一带一路沿线，右舵市场，购买力受限。", noteEn: "Along BRI, RHD market, limited purchasing power." },
  { id: "serbia", name: "塞尔维亚", nameEn: "Serbia", nameJa: "セルビア", nameKo: "세르비아", flag: "🇷🇸", org: ["BRI"], tariff: "mid", nev: "low", lat: 44.0, lon: 21.0, noteZh: "一带一路沿线，欧洲门口的非欧盟市场。", noteEn: "Along BRI, non-EU market at Europe's doorstep." },
  { id: "bangladesh", name: "孟加拉国", nameEn: "Bangladesh", nameJa: "バングラデシュ", nameKo: "방글라데시", flag: "🇧🇩", org: ["BRI"], tariff: "mid", nev: "low", lat: 23.7, lon: 90.4, noteZh: "一带一路沿线，人口大国，电动化极早期。", noteEn: "Along BRI, populous, very early electrification." },
  { id: "srilanka", name: "斯里兰卡", nameEn: "Sri Lanka", nameJa: "スリランカ", nameKo: "스리랑카", flag: "🇱🇰", org: ["BRI"], tariff: "mid", nev: "low", lat: 7.9, lon: 81.0, noteZh: "一带一路沿线，岛国，进口受限。", noteEn: "Along BRI, island state, import-constrained." },
  { id: "azerbaijan", name: "阿塞拜疆", nameEn: "Azerbaijan", nameJa: "アゼルバイジャン", nameKo: "아제르바이잔", flag: "🇦🇿", org: ["BRI"], tariff: "mid", nev: "low", lat: 40.4, lon: 49.9, noteZh: "一带一路沿线，油气富国，油车主导。", noteEn: "Along BRI, oil-rich, ICE-dominated." },
  { id: "belarus", name: "白俄罗斯", nameEn: "Belarus", nameJa: "ベラルーシ", nameKo: "벨라루스", flag: "🇧🇾", org: ["BRI"], tariff: "mid", nev: "low", lat: 53.9, lon: 27.6, noteZh: "一带一路沿线，东欧市场，体量小。", noteEn: "Along BRI, East European market, small volume." },
  { id: "ukraine", name: "乌克兰", nameEn: "Ukraine", nameJa: "ウクライナ", nameKo: "우크라이나", flag: "🇺🇦", org: ["BRI"], tariff: "mid", nev: "low", lat: 49.0, lon: 32.0, noteZh: "一带一路沿线，战事影响，市场暂停。", noteEn: "Along BRI, war-affected, market paused." },
  { id: "kenya", name: "肯尼亚", nameEn: "Kenya", nameJa: "ケニア", nameKo: "케냐", flag: "🇰🇪", org: ["BRI"], tariff: "mid", nev: "low", lat: -1.0, lon: 37.0, noteZh: "一带一路沿线，东非枢纽，电动巴士先行。", noteEn: "Along BRI, East African hub, e-buses lead." },
  { id: "morocco", name: "摩洛哥", nameEn: "Morocco", nameJa: "モロッコ", nameKo: "모로코", flag: "🇲🇦", org: ["BRI"], tariff: "mid", nev: "low", lat: 32.0, lon: -6.0, noteZh: "一带一路沿线，近欧、电池材料与造车新兴地。", noteEn: "Along BRI, near Europe, emerging battery & EV manufacturing." },
  { id: "algeria", name: "阿尔及利亚", nameEn: "Algeria", nameJa: "アルジェリア", nameKo: "알제리", flag: "🇩🇿", org: ["BRI"], tariff: "mid", nev: "low", lat: 28.0, lon: 2.0, noteZh: "一带一路沿线，北非油气国，进口管制。", noteEn: "Along BRI, N. African oil-gas state, import controls." },
  { id: "ethiopia", name: "埃塞俄比亚", nameEn: "Ethiopia", nameJa: "エチオピア", nameKo: "에티오피아", flag: "🇪🇹", org: ["BRI"], tariff: "mid", nev: "low", lat: 9.0, lon: 39.0, noteZh: "一带一路沿线，禁止燃油车进口，电动车政策友好。", noteEn: "Along BRI, bans ICE imports, EV-friendly policy." },
  { id: "angola", name: "安哥拉", nameEn: "Angola", nameJa: "アンゴラ", nameKo: "앙골라", flag: "🇦🇴", org: ["BRI"], tariff: "mid", nev: "low", lat: -12.0, lon: 17.0, noteZh: "一带一路沿线，葡语非洲市场，石油经济。", noteEn: "Along BRI, Lusophone African market, oil economy." },
  { id: "nigeria", name: "尼日利亚", nameEn: "Nigeria", nameJa: "ナイジェリア", nameKo: "나이지리아", flag: "🇳🇬", org: [], tariff: "mid", nev: "low", lat: 9.0, lon: 8.0, noteZh: "非洲人口第一大国，电力不稳，电动化极早期。", noteEn: "Africa's most populous country, unstable power, very early EV." },
  { id: "oman", name: "阿曼", nameEn: "Oman", nameJa: "オマーン", nameKo: "오만", flag: "🇴🇲", org: ["GCC"], tariff: "low", nev: "low", lat: 21.0, lon: 57.0, noteZh: "海湾 GCC 成员国，小市场，政策宽松。", noteEn: "GCC member, small market, loose policy." },
  { id: "qatar", name: "卡塔尔", nameEn: "Qatar", nameJa: "カタール", nameKo: "카타르", flag: "🇶🇦", org: ["GCC"], tariff: "low", nev: "low", lat: 25.3, lon: 51.5, noteZh: "海湾 GCC 成员国，富裕小市场，高端偏好。", noteEn: "GCC member, wealthy small market, premium preference." },
  { id: "kuwait", name: "科威特", nameEn: "Kuwait", nameJa: "クウェート", nameKo: "쿠웨이트", flag: "🇰🇼", org: ["GCC"], tariff: "low", nev: "low", lat: 29.3, lon: 48.0, noteZh: "海湾 GCC 成员国，油补强，油车依赖。", noteEn: "GCC member, strong fuel subsidies, ICE-dependent." },
  { id: "bahrain", name: "巴林", nameEn: "Bahrain", nameJa: "バーレーン", nameKo: "바레인", flag: "🇧🇭", org: ["GCC"], tariff: "low", nev: "low", lat: 26.0, lon: 50.5, noteZh: "海湾 GCC 成员国，最小海湾市场。", noteEn: "GCC member, smallest Gulf market." },
  { id: "jordan", name: "约旦", nameEn: "Jordan", nameJa: "ヨルダン", nameKo: "요르단", flag: "🇯🇴", org: ["BRI"], tariff: "mid", nev: "low", lat: 31.0, lon: 36.0, noteZh: "一带一路沿线，中东小市场，进口依赖。", noteEn: "Along BRI, small Middle Eastern market, import-dependent." },
  { id: "iraq", name: "伊拉克", nameEn: "Iraq", nameJa: "イラク", nameKo: "이라크", flag: "🇮🇶", org: ["BRI"], tariff: "mid", nev: "low", lat: 33.0, lon: 44.0, noteZh: "一带一路沿线，重建需求，安全与基建风险。", noteEn: "Along BRI, reconstruction demand, security & infra risk." },
  { id: "lebanon", name: "黎巴嫩", nameEn: "Lebanon", nameJa: "レバノン", nameKo: "레바논", flag: "🇱🇧", org: [], tariff: "mid", nev: "low", lat: 33.9, lon: 35.5, noteZh: "中东小市场，经济危机，需求疲软。", noteEn: "Small Middle Eastern market political/economic crisis, weak demand." },
  { id: "argentina", name: "阿根廷", nameEn: "Argentina", nameJa: "アルゼンチン", nameKo: "아르헨티나", flag: "🇦🇷", org: ["LATAM", "Mercosur", "BRI"], tariff: "high", nev: "low", lat: -38.0, lon: -63.0, noteZh: "拉美大国，南方共同市场，经济波动大。", noteEn: "Large LatAm economy, Mercosur, high macro volatility." },
  { id: "colombia", name: "哥伦比亚", nameEn: "Colombia", nameJa: "コロンビア", nameKo: "콜롬비아", flag: "🇨🇴", org: ["LATAM", "BRI"], tariff: "mid", nev: "low", lat: 4.6, lon: -74.0, noteZh: "拉美中等市场，安第斯枢纽，进口依赖。", noteEn: "Mid-size LatAm market, Andean hub, import-dependent." },
  { id: "chile", name: "智利", nameEn: "Chile", nameJa: "チリ", nameKo: "칠레", flag: "🇨🇱", org: ["LATAM", "CPTPP", "BRI"], tariff: "mid", nev: "low", lat: -35.0, lon: -71.0, noteZh: "拉美稳定市场，锂资源国，开放度高。", noteEn: "Stable LatAm market, lithium producer, open economy." },
  { id: "peru", name: "秘鲁", nameEn: "Peru", nameJa: "ペルー", nameKo: "페루", flag: "🇵🇪", org: ["LATAM", "CPTPP", "BRI"], tariff: "mid", nev: "low", lat: -12.0, lon: -75.0, noteZh: "拉美市场，一带一路与 CPTPP 双成员。", noteEn: "LatAm market, dual BRI & CPTPP member." },
  { id: "ecuador", name: "厄瓜多尔", nameEn: "Ecuador", nameJa: "エクアドル", nameKo: "에콰도르", flag: "🇪🇨", org: ["LATAM", "BRI"], tariff: "mid", nev: "low", lat: -2.0, lon: -78.0, noteZh: "拉美小市场，美元化经济，进口依赖。", noteEn: "Small LatAm market, dollarized, import-dependent." },
  { id: "panama", name: "巴拿马", nameEn: "Panama", nameJa: "パナマ", nameKo: "파나마", flag: "🇵🇦", org: ["LATAM", "BRI"], tariff: "mid", nev: "low", lat: 9.0, lon: -80.0, noteZh: "拉美枢纽，运河经济，转口价值高。", noteEn: "LatAm hub, canal economy, high re-export value." },
  { id: "uruguay", name: "乌拉圭", nameEn: "Uruguay", nameJa: "ウルグアイ", nameKo: "우루과이", flag: "🇺🇾", org: ["LATAM", "Mercosur"], tariff: "mid", nev: "low", lat: -33.0, lon: -56.0, noteZh: "南方共同市场，稳定小市场，高人均。", noteEn: "Mercosur, stable small market, high per-capita." },
  { id: "paraguay", name: "巴拉圭", nameEn: "Paraguay", nameJa: "パラグアイ", nameKo: "파라과이", flag: "🇵🇾", org: ["Mercosur"], tariff: "mid", nev: "low", lat: -23.0, lon: -58.0, noteZh: "南方共同市场，内陆小市场。", noteEn: "Mercosur, landlocked small market." },
  { id: "venezuela", name: "委内瑞拉", nameEn: "Venezuela", nameJa: "ベネズエラ", nameKo: "베네수엘라", flag: "🇻🇪", org: ["Mercosur"], tariff: "high", nev: "low", lat: 8.0, lon: -66.0, noteZh: "南方共同市场，经济危机，需求萎缩。", noteEn: "Mercosur, economic crisis, shrinking demand." },
  { id: "bolivia", name: "玻利维亚", nameEn: "Bolivia", nameJa: "ボリビア", nameKo: "볼리비아", flag: "🇧🇴", org: ["LATAM", "BRI"], tariff: "mid", nev: "low", lat: -17.0, lon: -65.0, noteZh: "拉美锂资源国，市场小，基建弱。", noteEn: "LatAm lithium state, small market, weak infra." },
  { id: "costarica", name: "哥斯达黎加", nameEn: "Costa Rica", nameJa: "コスタリカ", nameKo: "코스타리카", flag: "🇨🇷", org: ["LATAM", "CPTPP"], tariff: "mid", nev: "low", lat: 9.7, lon: -84.0, noteZh: "拉美稳定市场，绿色形象强。", noteEn: "Stable LatAm market, strong green image." },
  { id: "dominican", name: "多米尼加", nameEn: "Dominican Republic", nameJa: "ドミニカ共和国", nameKo: "도미니카 공화국", flag: "🇩🇴", org: ["LATAM"], tariff: "mid", nev: "low", lat: 18.5, lon: -70.0, noteZh: "加勒比市场，旅游经济，进口依赖。", noteEn: "Caribbean market, tourism economy, import-dependent." },
  { id: "canada", name: "加拿大", nameEn: "Canada", nameJa: "カナダ", nameKo: "캐나다", flag: "🇨🇦", org: ["CPTPP", "USMCA"], tariff: "low", nev: "mid", lat: 56.0, lon: -106.0, noteZh: "CPTPP 与 USMCA 双成员，高渗透，气候寒冷。", noteEn: "Dual CPTPP & USMCA member, high penetration, cold climate." },
  { id: "uk", name: "英国", nameEn: "United Kingdom", nameJa: "イギリス", nameKo: "영국", flag: "🇬🇧", org: ["CPTPP"], tariff: "high", nev: "mid", lat: 54.0, lon: -2.0, noteZh: "CPTPP 成员，脱欧后独立关税，右舵市场。", noteEn: "CPTPP member, post-Brexit independent tariff, RHD market." }
];
