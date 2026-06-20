import fs from "node:fs/promises";
import vm from "node:vm";

const root = "/Users/firephoenix/Documents/Codex/2026-06-17/100/outputs/shanji-site";
const context = { window: {} };
vm.createContext(context);
vm.runInContext(await fs.readFile(`${root}/data/routes.js`, "utf8"), context);
vm.runInContext(await fs.readFile(`${root}/data/activities.js`, "utf8"), context);

const coordMap = {
  FZ001: { lat: 26.095, lng: 119.278, accuracy: "近似点位，待复核" },
  FZ002: { lat: 26.095, lng: 119.305, accuracy: "近似点位，待复核" },
  FZ003: { lat: 26.070, lng: 119.395, accuracy: "近似点位，待复核" },
  FZ004: { lat: 26.083, lng: 119.405, accuracy: "近似点位，待复核" },
  FZ005: { lat: 26.080, lng: 119.390, accuracy: "近似点位，待复核" },
  FZ006: { lat: 26.128, lng: 119.430, accuracy: "近似点位，待复核" },
  FZ007: { lat: 26.132, lng: 119.425, accuracy: "近似点位，待复核" },
  FZ008: { lat: 25.940, lng: 119.225, accuracy: "近似点位，待复核" },
  FZ009: { lat: 25.955, lng: 119.205, accuracy: "近似点位，待复核" },
  FZ010: { lat: 26.020, lng: 119.165, accuracy: "近似点位，待复核" }
};

const routes = context.window.SHANJI_ROUTES.map(route => ({
  ...route,
  location: coordMap[route.id] || null
}));
const activities = context.window.SHANJI_CLUB_ACTIVITIES;

await fs.writeFile(`${root}/data/routes.js`, `window.SHANJI_ROUTES = ${JSON.stringify(routes, null, 2)};\n`);
await fs.mkdir(`${root}/routes`, { recursive: true });
await fs.mkdir(`${root}/activities`, { recursive: true });
await fs.mkdir(`${root}/tools`, { recursive: true });

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
  <link rel="stylesheet" href="../assets/styles.css?v=0.3">
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

function routePage(route) {
  const locationText = route.location
    ? `${route.location.lat}, ${route.location.lng}（${route.location.accuracy}）`
    : "待补充";
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
        <p>当前点位：${locationText}。V0.3 用于地图功能测试，正式发布前需要复核起点、终点和轨迹。</p>
        <p><a class="inline-link" href="${osmUrl(route)}" target="_blank" rel="noreferrer">在 OpenStreetMap 查看近似点位</a></p>
        <h2>风险提示</h2>
        <p>${route.warning}</p>
        <h2>发布前复核</h2>
        <p>${route.verify}</p>
        <h2>GPX轨迹</h2>
        <p>${route.gpx?.note || "候选阶段暂不开放下载。"}</p>
      </article>
      <aside class="detail-page-side">
        <div class="detail-stat"><strong>${route.region}</strong><span>区域</span></div>
        <div class="detail-stat"><strong>${route.difficulty}</strong><span>难度</span></div>
        <div class="detail-stat"><strong>${route.distance}km</strong><span>距离</span></div>
        <div class="detail-stat"><strong>${route.time}h</strong><span>预计用时</span></div>
        <div class="detail-stat"><strong>${route.ascent}m</strong><span>累计爬升</span></div>
        <div class="detail-stat"><strong>${route.transit}</strong><span>交通方式</span></div>
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
        <p>V0.3 测试版仅展示报名入口占位。正式版建议跳转到俱乐部官方报名页，山迹不代收费用。</p>
        <h2>关联路线</h2>
        <p>${linkedRoute ? `<a class="inline-link" href="../routes/${linkedRoute.id}.html">${linkedRoute.name}</a>` : "该活动路线尚未进入 V0.3 路线库，可先作为活动信息展示。"}</p>
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

const minLat = Math.min(...routes.map(route => route.location.lat)) - 0.05;
const maxLat = Math.max(...routes.map(route => route.location.lat)) + 0.05;
const minLng = Math.min(...routes.map(route => route.location.lng)) - 0.05;
const maxLng = Math.max(...routes.map(route => route.location.lng)) + 0.05;

const mapPoints = routes.map(route => `
        <a class="map-list-item" href="./routes/${route.id}.html">
          <strong>${route.name}</strong>
          <span>${route.region}｜${route.difficulty}｜${route.distance}km｜${route.location.accuracy}</span>
        </a>`).join("");

const pinLayer = routes.map(route => `
          <a class="coordinate-pin" href="./routes/${route.id}.html" style="left:${((route.location.lng - minLng) / (maxLng - minLng) * 100).toFixed(2)}%;top:${(100 - (route.location.lat - minLat) / (maxLat - minLat) * 100).toFixed(2)}%" title="${route.name}">${route.id.replace("FZ", "")}</a>`).join("");

const mapPage = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>山迹路线地图｜V0.3</title>
  <link rel="stylesheet" href="./assets/styles.css?v=0.3">
</head>
<body>
  <main class="detail-page">
    <a class="back-link" href="./index.html">返回山迹首页</a>
    <section class="detail-hero" style="--detail-color:#5f9e78">
      <span class="status-chip">V0.3 地图页</span>
      <h1>路线地图</h1>
      <p>当前使用开源地图思路做点位测试。下方点位为近似坐标，正式发布前需要复核起点、终点和轨迹。</p>
    </section>
    <section class="osm-panel">
      <iframe title="OpenStreetMap 福州周边视图" src="https://www.openstreetmap.org/export/embed.html?bbox=118.95%2C25.85%2C119.55%2C26.25&amp;layer=mapnik" loading="lazy"></iframe>
      <div class="coordinate-board" aria-label="路线近似点位图">
${pinLayer}
      </div>
    </section>
    <section class="map-list">
${mapPoints}
    </section>
  </main>
</body>
</html>
`;

await fs.writeFile(`${root}/map.html`, mapPage);

const csv = [
  "id,name,region,difficulty,distance,time,ascent,lat,lng,locationAccuracy,status,updatedAt",
  ...routes.map(route => [
    route.id,
    `"${route.name}"`,
    route.region,
    route.difficulty,
    route.distance,
    route.time,
    route.ascent,
    route.location.lat,
    route.location.lng,
    route.location.accuracy,
    route.status,
    route.updatedAt
  ].join(","))
].join("\n");

await fs.writeFile(`${root}/data/routes-v0.3.csv`, `${csv}\n`);

await fs.writeFile(`${root}/tools/README.md`, `# 山迹数据维护工具说明

V0.3 开始，路线数据增加经纬度字段：

- lat：纬度
- lng：经度
- locationAccuracy：点位准确性说明

当前点位均为近似点位，正式上线前必须复核。

建议后续流程：

1. 用表格维护路线基础字段。
2. 导出 CSV。
3. 用构建脚本生成 data/routes.js、路线详情页和地图页。
4. 已复核路线再开放 GPX 下载。
`);
