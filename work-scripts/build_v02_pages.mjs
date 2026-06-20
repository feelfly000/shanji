import fs from "node:fs/promises";
import vm from "node:vm";

const root = "/Users/firephoenix/Documents/Codex/2026-06-17/100/outputs/shanji-site";
const context = { window: {} };
vm.createContext(context);
vm.runInContext(await fs.readFile(`${root}/data/routes.js`, "utf8"), context);
vm.runInContext(await fs.readFile(`${root}/data/activities.js`, "utf8"), context);

const routes = context.window.SHANJI_ROUTES;
const activities = context.window.SHANJI_CLUB_ACTIVITIES;

await fs.mkdir(`${root}/routes`, { recursive: true });
await fs.mkdir(`${root}/activities`, { recursive: true });

function layout(title, body) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <link rel="stylesheet" href="../assets/styles.css">
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
  return layout(`${route.name}｜山迹`, `    <section class="detail-hero" style="--detail-color:${route.color}">
      <span class="status-chip">${route.id} · ${route.status}</span>
      <h1>${route.name}</h1>
      <p>${route.summary}</p>
    </section>
    <section class="detail-page-grid">
      <article class="detail-page-main">
        <h2>路线亮点</h2>
        <p>${route.highlight}</p>
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
        <p>V0.2 测试版仅展示报名入口占位。正式版建议跳转到俱乐部官方报名页，山迹不代收费用。</p>
        <h2>关联路线</h2>
        <p>${linkedRoute ? `<a href="../routes/${linkedRoute.id}.html">${linkedRoute.name}</a>` : "该活动路线尚未进入 V0.2 路线库，可先作为活动信息展示。"}</p>
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

const mapPoints = routes.map(route => `
        <a class="map-list-item" href="./routes/${route.id}.html">
          <strong>${route.name}</strong>
          <span>${route.region}｜${route.difficulty}｜${route.distance}km</span>
        </a>`).join("");

const mapPage = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>山迹路线地图｜V0.2</title>
  <link rel="stylesheet" href="./assets/styles.css">
</head>
<body>
  <main class="detail-page">
    <a class="back-link" href="./index.html">返回山迹首页</a>
    <section class="detail-hero" style="--detail-color:#5f9e78">
      <span class="status-chip">V0.2 地图页</span>
      <h1>路线地图</h1>
      <p>这是 V0.2 的开源地图预备页。当前先展示路线点位列表，下一步可接入 Leaflet + OpenStreetMap，把这些点位渲染到真实地图上。</p>
    </section>
    <section class="map-list">
${mapPoints}
    </section>
  </main>
</body>
</html>
`;

await fs.writeFile(`${root}/map.html`, mapPage);
