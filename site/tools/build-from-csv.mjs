import fs from "node:fs/promises";

const root = new URL("../", import.meta.url);
const dataDir = new URL("data/", root);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [headers, ...body] = rows;
  const cleanHeaders = headers.map(header => header.replace(/^\uFEFF/, ""));
  return body.map(values => Object.fromEntries(cleanHeaders.map((header, index) => [header, values[index] ?? ""])));
}

function splitList(value) {
  return value ? value.split("|").map(item => item.trim()).filter(Boolean) : [];
}

function bool(value) {
  return value === "true" || value === "是";
}

function number(value) {
  return Number(value);
}

function pct(value) {
  return `${Math.max(0, Math.min(100, Number(value) || 0))}%`;
}

function osmUrl(route) {
  return `https://www.openstreetmap.org/?mlat=${route.location.lat}&mlon=${route.location.lng}#map=14/${route.location.lat}/${route.location.lng}`;
}

function pageShell(title, body, prefix = "..") {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <link rel="stylesheet" href="${prefix}/assets/styles.css?v=1.4">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
</head>
<body>
  <main class="detail-page">
    <a class="back-link" href="${prefix}/index.html">返回山迹首页</a>
${body}
  </main>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="${prefix}/data/tracks.js?v=1.4"></script>
  <script src="${prefix}/assets/track-viewer.js?v=1.4"></script>
</body>
</html>
`;
}

const version = "V1.4";
const routeRows = parseCsv(await fs.readFile(new URL("routes-v1.3.csv", dataDir), "utf8"));
const activityRows = parseCsv(await fs.readFile(new URL("activities-v1.1.csv", dataDir), "utf8"));
const gpxRows = parseCsv(await fs.readFile(new URL("gpx-v1.3.csv", dataDir), "utf8"));
const gpxById = new Map(gpxRows.map(row => [row.id, row]));
const reviewRows = parseCsv(await fs.readFile(new URL("route-review-v1.4.csv", dataDir), "utf8"));
const reviewById = new Map(reviewRows.map(row => [row.id, row]));

const routes = routeRows.map((row, index) => {
  const gpx = gpxById.get(row.id) || {};
  const review = reviewById.get(row.id) || {};
  return {
    id: row.id,
    name: row.name,
    region: row.region,
    type: row.type,
    difficulty: row.difficulty,
    distance: number(row.distance),
    time: number(row.time),
    ascent: number(row.ascent),
    transit: row.transit,
    transitFriendly: bool(row.transitFriendly),
    themes: splitList(row.themes),
    audience: splitList(row.audience),
    score: number(row.score),
    highlight: row.highlight,
    summary: row.summary,
    warning: row.warning,
    verify: row.verify,
    x: `${14 + (index % 6) * 14}%`,
    y: `${18 + Math.floor(index / 6) * 15}%`,
    color: row.color,
    status: row.status,
    updatedAt: row.updatedAt,
    ops: {
      startPoint: row.startPoint,
      endPoint: row.endPoint,
      parking: row.parking,
      publicTransit: row.publicTransit,
      toilet: row.toilet,
      supply: row.supply,
      exitPoints: row.exitPoints,
      bestSeason: splitList(row.bestSeason),
      routeStatus: row.routeStatus,
      publicStatus: row.publicStatus,
      dataOwner: row.dataOwner,
      sourceType: splitList(row.sourceType),
      reviewNote: row.reviewNote
    },
    review: {
      level: review.reviewLevel || "待复核",
      score: number(review.reviewScore),
      blockers: review.blockers || "待生成",
      nextAction: review.nextAction || "补齐复核字段",
      checks: [
        ["起点", review.startPointCheck],
        ["终点", review.endPointCheck],
        ["停车", review.parkingCheck],
        ["公共交通", review.publicTransitCheck],
        ["厕所", review.toiletCheck],
        ["补给", review.supplyCheck],
        ["下撤点", review.exitPointsCheck],
        ["季节", review.seasonCheck],
        ["风险提示", review.riskCheck],
        ["地图点位", review.locationCheck],
        ["轨迹", review.trackCheck],
        ["授权", review.licenseCheck]
      ].filter(item => item[1])
    },
    location: {
      lat: number(row.lat),
      lng: number(row.lng),
      accuracy: row.locationAccuracy
    },
    gpx: {
      status: gpx.gpxStatus || "无轨迹",
      downloadable: bool(gpx.gpxDownloadable),
      file: gpx.gpxFile ? `.${gpx.gpxFile}` : "",
      homeFile: gpx.gpxFile || "",
      note: gpx.note || "暂无可下载轨迹。"
    }
  };
});

const activities = activityRows.map(row => ({
  id: row.id,
  title: row.title,
  club: row.club,
  date: row.date,
  routeId: row.routeId,
  region: row.region,
  difficulty: row.difficulty,
  distance: number(row.distance),
  ascent: number(row.ascent),
  meeting: row.meeting,
  transport: row.transport,
  fee: row.fee,
  status: row.status,
  tags: splitList(row.tags),
  signup: row.signup,
  signupUrl: row.signupUrl,
  audit: row.audit,
  note: row.note,
  sourceName: row.sourceName,
  sourceUrl: row.sourceUrl,
  publishedAt: row.publishedAt,
  deadline: row.deadline,
  officialStatus: row.officialStatus,
  isFeatured: bool(row.isFeatured),
  isExpired: bool(row.isExpired),
  platformNote: row.platformNote
}));

function routePage(route) {
  const gpxBlock = route.gpx.downloadable
    ? `<p>${route.gpx.note}</p><p><a class="download-link" href="${route.gpx.file}" download>下载轨迹文件</a></p>`
    : `<p>${route.gpx.note}</p>`;
  const trackBlock = route.gpx.downloadable && route.gpx.status.includes("KML")
    ? `        <h2>轨迹预览</h2>
        <div class="track-map" data-track-route="${route.id}"></div>
        <p class="route-desc">轨迹线来自导入文件，仅用于桌面复核和路线理解，不代表已完成实地验证。</p>`
    : "";
  return pageShell(`${route.name}｜山迹`, `    <section class="detail-hero" style="--detail-color:${route.color}">
      <span class="status-chip">${route.id} · ${route.status}</span>
      <h1>${route.name}</h1>
      <p>${route.summary}</p>
    </section>
    <section class="detail-page-grid">
      <article class="detail-page-main">
        <h2>复核状态</h2>
        <div class="review-panel">
          <div class="review-score"><strong>${route.review.score}</strong><span>复核完成度</span></div>
          <div class="review-progress"><span style="width:${pct(route.review.score)}"></span></div>
          <p>当前等级：${route.review.level}。阻塞项：${route.review.blockers}。下一步：${route.review.nextAction}。</p>
        </div>
        <div class="review-check-grid">
          ${route.review.checks.map(([label, status]) => `<span class="${status === "已完成" ? "review-ok" : "review-wait"}">${label}：${status}</span>`).join("")}
        </div>
        <h2>路线亮点</h2>
        <p>${route.highlight}</p>
        <h2>地图点位</h2>
        <p>当前点位：${route.location.lat}, ${route.location.lng}（${route.location.accuracy}）。${version} 数据由 CSV 自动生成，正式发布前需要复核。</p>
        <p><a class="inline-link" href="${osmUrl(route)}" target="_blank" rel="noreferrer">在 OpenStreetMap 查看近似点位</a></p>
        <h2>风险提示</h2>
        <p>${route.warning}</p>
        <h2>发布前复核</h2>
        <p>${route.verify}</p>
        <h2>维护字段</h2>
        <p>起点：${route.ops.startPoint}</p>
        <p>终点：${route.ops.endPoint}</p>
        <p>停车：${route.ops.parking}</p>
        <p>公共交通：${route.ops.publicTransit}</p>
        <p>厕所：${route.ops.toilet}</p>
        <p>补给：${route.ops.supply}</p>
        <p>下撤：${route.ops.exitPoints}</p>
        <p>适合季节：${route.ops.bestSeason.join("、")}</p>
${trackBlock}
        <h2>轨迹文件</h2>
        ${gpxBlock}
      </article>
      <aside class="detail-page-side">
        <div class="detail-stat"><strong>${route.region}</strong><span>区域</span></div>
        <div class="detail-stat"><strong>${route.difficulty}</strong><span>难度</span></div>
        <div class="detail-stat"><strong>${route.distance}km</strong><span>距离</span></div>
        <div class="detail-stat"><strong>${route.time}h</strong><span>预计用时</span></div>
        <div class="detail-stat"><strong>${route.ascent}m</strong><span>累计爬升</span></div>
        <div class="detail-stat"><strong>${route.gpx.status}</strong><span>GPX状态</span></div>
        <div class="detail-stat"><strong>${route.ops.publicStatus}</strong><span>公开状态</span></div>
        <div class="detail-stat"><strong>${route.ops.routeStatus}</strong><span>资料状态</span></div>
        <div class="detail-stat"><strong>${route.review.level}</strong><span>复核等级</span></div>
        <div class="detail-stat"><strong>${route.review.score}分</strong><span>复核完成度</span></div>
      </aside>
    </section>`);
}

function activityPage(activity) {
  const linkedRoute = routes.find(route => route.id === activity.routeId);
  return pageShell(`${activity.title}｜山迹活动`, `    <section class="detail-hero" style="--detail-color:#7f9d68">
      <span class="status-chip">${activity.id} · ${activity.status}</span>
      <h1>${activity.title}</h1>
      <p>${activity.note}</p>
    </section>
    <section class="detail-page-grid">
      <article class="detail-page-main">
        <h2>活动摘要</h2>
        <p>${activity.date}，由${activity.club}发布。集合点：${activity.meeting}。交通方式：${activity.transport}。费用：${activity.fee}。</p>
        <h2>风险提示</h2>
        <p>${activity.note}</p>
        <h2>报名说明</h2>
        <p>山迹仅聚合活动信息，不代收费用。报名、保险、领队安排和行程变更以俱乐部官方说明为准。</p>
        <p>${activity.signupUrl ? `<a class="download-link" href="${activity.signupUrl}" target="_blank" rel="noreferrer">打开官方报名页</a>` : "暂无官方报名链接。"}</p>
        <h2>信息来源</h2>
        <p>来源：${activity.sourceName || "待补充"}。发布时间：${activity.publishedAt || "待补充"}。报名截止：${activity.deadline || "待补充"}。官方状态：${activity.officialStatus || "待确认"}。</p>
        <p>${activity.platformNote || "山迹仅做信息聚合。"}</p>
        <h2>关联路线</h2>
        <p>${linkedRoute ? `<a class="inline-link" href="../routes/${linkedRoute.id}.html">${linkedRoute.name}</a>` : "该活动路线尚未进入路线库，可先作为活动信息展示。"}</p>
      </article>
      <aside class="detail-page-side">
        <div class="detail-stat"><strong>${activity.club}</strong><span>俱乐部</span></div>
        <div class="detail-stat"><strong>${activity.region}</strong><span>区域</span></div>
        <div class="detail-stat"><strong>${activity.difficulty}</strong><span>难度</span></div>
        <div class="detail-stat"><strong>${activity.distance}km</strong><span>距离</span></div>
        <div class="detail-stat"><strong>${activity.ascent}m</strong><span>累计爬升</span></div>
        <div class="detail-stat"><strong>${activity.audit}</strong><span>审核状态</span></div>
        <div class="detail-stat"><strong>${activity.officialStatus || "待确认"}</strong><span>官方状态</span></div>
        <div class="detail-stat"><strong>${activity.deadline || "待补充"}</strong><span>报名截止</span></div>
      </aside>
    </section>`);
}

await fs.writeFile(new URL("routes.js", dataDir), `window.SHANJI_ROUTES = ${JSON.stringify(routes, null, 2)};\n`);
await fs.writeFile(new URL("activities.js", dataDir), `window.SHANJI_CLUB_ACTIVITIES = ${JSON.stringify(activities, null, 2)};\n`);

await fs.mkdir(new URL("routes/", root), { recursive: true });
await fs.mkdir(new URL("activities/", root), { recursive: true });

for (const route of routes) {
  await fs.writeFile(new URL(`routes/${route.id}.html`, root), routePage(route));
}

for (const activity of activities) {
  await fs.writeFile(new URL(`activities/${activity.id}.html`, root), activityPage(activity));
}

const minLat = Math.min(...routes.map(route => route.location.lat)) - 0.05;
const maxLat = Math.max(...routes.map(route => route.location.lat)) + 0.05;
const minLng = Math.min(...routes.map(route => route.location.lng)) - 0.05;
const maxLng = Math.max(...routes.map(route => route.location.lng)) + 0.05;
const pins = routes.map(route => `
          <a class="coordinate-pin" href="./routes/${route.id}.html" style="left:${((route.location.lng - minLng) / (maxLng - minLng) * 100).toFixed(2)}%;top:${(100 - (route.location.lat - minLat) / (maxLat - minLat) * 100).toFixed(2)}%" title="${route.name}">${route.id.replace("FZ", "")}</a>`).join("");
const list = routes.map(route => `
        <a class="map-list-item" href="./routes/${route.id}.html">
          <strong>${route.name}</strong>
          <span>${route.region}｜${route.difficulty}｜${route.distance}km｜${route.location.accuracy}</span>
        </a>`).join("");

const reviewSummary = {
  total: routes.length,
  publicReady: routes.filter(route => route.review.level === "可公开").length,
  betaReady: routes.filter(route => route.review.level === "可内测").length,
  needData: routes.filter(route => route.review.level === "待补全").length,
  notReady: routes.filter(route => route.review.level === "暂不推荐").length,
  averageScore: Math.round(routes.reduce((sum, route) => sum + route.review.score, 0) / routes.length)
};

const reviewCards = [...routes]
  .sort((a, b) => a.review.score - b.review.score || a.id.localeCompare(b.id))
  .map(route => `
        <a class="review-board-card" href="./routes/${route.id}.html">
          <div>
            <strong>${route.id} ${route.name}</strong>
            <span>${route.region}｜${route.difficulty}｜${route.distance}km</span>
          </div>
          <div class="review-board-score">
            <b>${route.review.score}</b>
            <span>${route.review.level}</span>
          </div>
          <p>阻塞项：${route.review.blockers}</p>
          <p>下一步：${route.review.nextAction}</p>
        </a>`).join("");

const reviewPage = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="山迹路线复核看板，展示福州周边徒步路线的资料完整度、阻塞项和下一步处理建议。">
  <title>路线复核看板｜山迹</title>
  <link rel="stylesheet" href="./assets/styles.css?v=1.4">
</head>
<body>
  <main class="detail-page review-board-page">
    <a class="back-link" href="./index.html">返回山迹首页</a>
    <section class="detail-hero" style="--detail-color:#315f55">
      <span class="status-chip">${version} 路线复核体系</span>
      <h1>路线复核看板</h1>
      <p>把每条路线拆成起终点、交通、补给、厕所、下撤、点位、轨迹和授权等复核项，方便内测前集中补齐资料。</p>
    </section>
    <section class="topic-summary review-summary">
      <div class="metric"><strong>${reviewSummary.total}</strong><span>候选路线</span></div>
      <div class="metric"><strong>${reviewSummary.averageScore}</strong><span>平均完成度</span></div>
      <div class="metric"><strong>${reviewSummary.publicReady}</strong><span>可公开</span></div>
      <div class="metric"><strong>${reviewSummary.betaReady}</strong><span>可内测</span></div>
      <div class="metric"><strong>${reviewSummary.needData}</strong><span>待补全</span></div>
      <div class="metric"><strong>${reviewSummary.notReady}</strong><span>暂不推荐</span></div>
    </section>
    <section class="test-notice">
      <strong>复核原则</strong>
      <span>先处理完成度最低和阻塞项最多的路线。未确认授权、真实点位和关键安全字段之前，只能作为候选资料，不建议公开推荐。</span>
    </section>
    <section class="review-board-list">
${reviewCards}
    </section>
  </main>
</body>
</html>
`;

await fs.writeFile(new URL("review.html", root), reviewPage);

const mapPage = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>山迹路线地图｜${version}</title>
  <link rel="stylesheet" href="./assets/styles.css?v=1.4">
</head>
<body>
  <main class="detail-page">
    <a class="back-link" href="./index.html">返回山迹首页</a>
    <section class="detail-hero" style="--detail-color:#5f9e78">
      <span class="status-chip">${version} 地图页</span>
      <h1>路线地图</h1>
      <p>路线点位由 CSV 自动生成，当前仍为近似坐标，正式发布前需要复核。</p>
    </section>
    <section class="osm-panel">
      <iframe title="OpenStreetMap 福州周边视图" src="https://www.openstreetmap.org/export/embed.html?bbox=118.65%2C25.25%2C120.05%2C26.65&amp;layer=mapnik" loading="lazy"></iframe>
      <div class="coordinate-board" aria-label="路线近似点位图">
${pins}
      </div>
    </section>
    <section class="map-list">
${list}
    </section>
  </main>
</body>
</html>
`;

await fs.writeFile(new URL("map.html", root), mapPage);

const trackLibraryPage = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="山迹轨迹库，集中展示从 KML、GPX、KMZ 导入的候选轨迹。">
  <title>轨迹库｜山迹</title>
  <link rel="stylesheet" href="./assets/styles.css?v=1.4">
</head>
<body>
  <main class="detail-page">
    <a class="back-link" href="./index.html">返回山迹首页</a>
    <section class="detail-hero" style="--detail-color:#4f9071">
      <span class="status-chip">V1.4 轨迹复核</span>
      <h1>轨迹库</h1>
      <p>这里展示由 V1.2 导入工具解析的轨迹。优先候选可进入路线库，跨区轨迹只作为参考。</p>
    </section>
    <section class="test-notice">
      <strong>轨迹说明</strong>
      <span>导入轨迹必须确认来源授权和实地路况后才能正式发布；当前仅用于路线复核和地图预览。</span>
    </section>
    <section class="track-library-list" id="trackLibraryList"></section>
  </main>
  <script src="./data/tracks.js?v=1.4"></script>
  <script src="./assets/track-viewer.js?v=1.4"></script>
</body>
</html>
`;

await fs.writeFile(new URL("tracks.html", root), trackLibraryPage);

const activityCards = activities.map(activity => {
  const linkedRoute = routes.find(route => route.id === activity.routeId);
  return `        <a class="map-list-item activity-list-item" href="./activities/${activity.id}.html">
          <strong>${activity.title}</strong>
          <span>${activity.date}｜${activity.club}｜${activity.region}｜${activity.status}｜${activity.officialStatus || "待确认"}</span>
          <span>来源：${activity.sourceName || "待补充"}｜报名截止：${activity.deadline || "待补充"}${linkedRoute ? `｜关联路线：${linkedRoute.name}` : ""}</span>
        </a>`;
}).join("\n");

const activitiesPage = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="山迹户外俱乐部活动聚合页，集中展示福州周边每周徒步活动信息。">
  <title>俱乐部活动｜山迹</title>
  <link rel="stylesheet" href="./assets/styles.css?v=1.4">
</head>
<body>
  <main class="detail-page">
    <a class="back-link" href="./index.html">返回山迹首页</a>
    <section class="detail-hero" style="--detail-color:#4f9071">
      <span class="status-chip">V1.4 活动聚合</span>
      <h1>本周俱乐部活动</h1>
      <p>集中查看户外俱乐部发布的组织线路。山迹只做信息聚合，不代收费用，不替代组织方安全责任。</p>
    </section>
    <section class="topic-summary">
      <div class="metric"><strong>${activities.length}</strong><span>活动数量</span></div>
      <div class="metric"><strong>${activities.filter(activity => activity.status === "报名中").length}</strong><span>报名中</span></div>
      <div class="metric"><strong>${activities.filter(activity => activity.audit === "已审核").length}</strong><span>已审核</span></div>
    </section>
    <section class="test-notice">
      <strong>活动说明</strong>
      <span>报名、费用、保险、领队、集合点和变更通知以俱乐部官方说明为准。山迹当前只展示摘要和跳转入口。</span>
    </section>
    <section class="map-list">
${activityCards}
    </section>
  </main>
</body>
</html>
`;

await fs.writeFile(new URL("activities.html", root), activitiesPage);

const issues = [];
for (const route of routes) {
  for (const key of ["id", "name", "region", "difficulty", "highlight", "warning", "verify"]) {
    if (!route[key]) issues.push(`[路线 ${route.id}] 缺少 ${key}`);
  }
  if (!route.location.lat || !route.location.lng) issues.push(`[路线 ${route.id}] 缺少经纬度`);
  if (route.gpx.downloadable && !route.gpx.file) issues.push(`[路线 ${route.id}] 标记可下载但缺少GPX文件`);
}
for (const activity of activities) {
  for (const key of ["id", "title", "club", "date", "fee", "status", "note"]) {
    if (!activity[key]) issues.push(`[活动 ${activity.id}] 缺少 ${key}`);
  }
}

const report = `# 山迹 ${version} 数据检查报告

## 汇总

- 路线数量：${routes.length}
- 活动数量：${activities.length}
- 可下载轨迹文件：${routes.filter(route => route.gpx.downloadable).length}
- 问题数量：${issues.length}

## 问题

${issues.length ? issues.map(issue => `- ${issue}`).join("\n") : "未发现阻塞性数据问题。"}

## 说明

${version} 已实现从 CSV 生成路线数据、活动数据、路线详情页、活动详情页和地图页。
`;

await fs.writeFile(new URL("data-check-v1.4.md", root), report);

const urls = [
  "index.html",
  "map.html",
  "review.html",
  "activities.html",
  "tracks.html",
  "about.html",
  "safety.html",
  "feedback.html",
  "topics/beginner.html",
  "topics/transit.html",
  "topics/sea.html",
  "topics/family.html",
  "topics/advanced.html",
  "topics/summer.html",
  ...routes.map(route => `routes/${route.id}.html`),
  ...activities.map(activity => `activities/${activity.id}.html`)
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url><loc>https://example.com/${url}</loc></url>`).join("\n")}
</urlset>
`;

await fs.writeFile(new URL("sitemap.xml", root), sitemap);
await fs.writeFile(new URL("robots.txt", root), `User-agent: *
Allow: /
Sitemap: https://example.com/sitemap.xml
`);
