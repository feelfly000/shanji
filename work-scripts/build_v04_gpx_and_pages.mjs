import fs from "node:fs/promises";
import vm from "node:vm";

const root = "/Users/firephoenix/Documents/Codex/2026-06-17/100/outputs/shanji-site";
const context = { window: {} };
vm.createContext(context);
vm.runInContext(await fs.readFile(`${root}/data/routes.js`, "utf8"), context);
vm.runInContext(await fs.readFile(`${root}/data/activities.js`, "utf8"), context);

const routes = context.window.SHANJI_ROUTES;
const activities = context.window.SHANJI_CLUB_ACTIVITIES;

const testTracks = {
  FZ001: [
    [26.0950, 119.2780, 45],
    [26.0980, 119.2840, 68],
    [26.1015, 119.2910, 120],
    [26.1040, 119.2980, 168]
  ],
  FZ002: [
    [26.0950, 119.3050, 42],
    [26.0990, 119.3090, 66],
    [26.1040, 119.3120, 98],
    [26.1080, 119.3160, 134]
  ],
  FZ003: [
    [26.0700, 119.3950, 60],
    [26.0740, 119.4000, 180],
    [26.0790, 119.4050, 330],
    [26.0840, 119.4110, 520]
  ]
};

function gpx(route, points) {
  const trkpts = points.map(([lat, lng, ele]) => `      <trkpt lat="${lat}" lon="${lng}">
        <ele>${ele}</ele>
      </trkpt>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="shanji-v0.4-test" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${route.name} 测试轨迹</name>
    <desc>山迹 V0.4 测试 GPX，仅用于下载链路验证，非真实导航轨迹。</desc>
  </metadata>
  <trk>
    <name>${route.name}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
}

await fs.mkdir(`${root}/content/gpx`, { recursive: true });

for (const route of routes) {
  if (testTracks[route.id]) {
    const fileName = `${route.id}.gpx`;
    await fs.writeFile(`${root}/content/gpx/${fileName}`, gpx(route, testTracks[route.id]));
    route.gpx = {
      status: "测试轨迹",
      downloadable: true,
      file: `../content/gpx/${fileName}`,
      homeFile: `./content/gpx/${fileName}`,
      note: "V0.4 测试 GPX，仅用于验证下载链路，正式发布前必须替换为实地复核轨迹。"
    };
  } else {
    route.gpx = {
      ...route.gpx,
      status: route.gpx?.status || "无轨迹",
      downloadable: false,
      note: route.gpx?.note || "暂无可下载轨迹。"
    };
  }
}

await fs.writeFile(`${root}/data/routes.js`, `window.SHANJI_ROUTES = ${JSON.stringify(routes, null, 2)};\n`);

function osmUrl(route) {
  if (!route.location) return "https://www.openstreetmap.org/";
  return `https://www.openstreetmap.org/?mlat=${route.location.lat}&mlon=${route.location.lng}#map=14/${route.location.lat}/${route.location.lng}`;
}

function layout(title, body) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <link rel="stylesheet" href="../assets/styles.css?v=0.4">
</head>
<body>
  <main class="detail-page">
    <a class="back-link" href="../index.html">返回山迹首页</a>
${body}
  </main>
</body>
</html>
`;
}

function gpxBlock(route) {
  if (!route.gpx?.downloadable) {
    return `<p>${route.gpx?.note || "暂无可下载轨迹。"}</p>`;
  }
  return `<p>${route.gpx.note}</p>
        <p><a class="download-link" href="${route.gpx.file}" download>下载测试 GPX</a></p>`;
}

function routePage(route) {
  return layout(`${route.name}｜山迹`, `    <section class="detail-hero" style="--detail-color:${route.color}">
      <span class="status-chip">${route.id} · ${route.status}</span>
      <h1>${route.name}</h1>
      <p>${route.summary}</p>
    </section>
    <section class="detail-page-grid">
      <article class="detail-page-main">
        <h2>路线亮点</h2>
        <p>${route.highlight}</p>
        <h2>地图点位</h2>
        <p>当前点位：${route.location.lat}, ${route.location.lng}（${route.location.accuracy}）。V0.4 用于地图功能测试，正式发布前需要复核起点、终点和轨迹。</p>
        <p><a class="inline-link" href="${osmUrl(route)}" target="_blank" rel="noreferrer">在 OpenStreetMap 查看近似点位</a></p>
        <h2>风险提示</h2>
        <p>${route.warning}</p>
        <h2>发布前复核</h2>
        <p>${route.verify}</p>
        <h2>GPX轨迹</h2>
        ${gpxBlock(route)}
      </article>
      <aside class="detail-page-side">
        <div class="detail-stat"><strong>${route.region}</strong><span>区域</span></div>
        <div class="detail-stat"><strong>${route.difficulty}</strong><span>难度</span></div>
        <div class="detail-stat"><strong>${route.distance}km</strong><span>距离</span></div>
        <div class="detail-stat"><strong>${route.time}h</strong><span>预计用时</span></div>
        <div class="detail-stat"><strong>${route.ascent}m</strong><span>累计爬升</span></div>
        <div class="detail-stat"><strong>${route.gpx.status}</strong><span>GPX状态</span></div>
      </aside>
    </section>`);
}

function activityPage(activity) {
  const linkedRoute = routes.find(route => route.id === activity.routeId);
  return layout(`${activity.title}｜山迹活动`, `    <section class="detail-hero" style="--detail-color:#7f9d68">
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
        <p>V0.4 测试版仅展示报名入口占位。正式版建议跳转到俱乐部官方报名页，山迹不代收费用。</p>
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
      </aside>
    </section>`);
}

for (const route of routes) {
  await fs.writeFile(`${root}/routes/${route.id}.html`, routePage(route));
}

for (const activity of activities) {
  await fs.writeFile(`${root}/activities/${activity.id}.html`, activityPage(activity));
}

const csv = [
  "id,name,gpxStatus,gpxDownloadable,gpxFile,note",
  ...routes.map(route => [
    route.id,
    `"${route.name}"`,
    route.gpx.status,
    route.gpx.downloadable,
    route.gpx.homeFile || "",
    `"${route.gpx.note}"`
  ].join(","))
].join("\n");

await fs.writeFile(`${root}/data/gpx-v0.4.csv`, `${csv}\n`);
