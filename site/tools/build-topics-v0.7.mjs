import fs from "node:fs/promises";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const version = "V1.4";
const routesJs = await fs.readFile(new URL("data/routes.js", root), "utf8");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(routesJs, context);
const routes = context.window.SHANJI_ROUTES || [];

const topics = [
  {
    slug: "beginner",
    title: "新手友好路线",
    eyebrow: "第一次走山迹",
    description: "优先收录强度低、下撤容易、公共服务更清楚的路线，适合第一次在福州周边徒步的人。",
    match: route => route.difficulty === "轻松" || route.audience.includes("新手"),
    note: "新手路线也不等于无风险，雨天、暴晒和夜间都建议谨慎。"
  },
  {
    slug: "transit",
    title: "公交地铁友好路线",
    eyebrow: "少一点接驳焦虑",
    description: "适合没有自驾、想用公交地铁或短途打车完成的半日路线。",
    match: route => route.transitFriendly,
    note: "公共交通班次会变化，出发前需要再次确认末班车和返程方案。"
  },
  {
    slug: "sea",
    title: "观景与摄影路线",
    eyebrow: "登高、山景、出片",
    description: "为后续平潭、连江、罗源等方向预留山海扩展空间，当前先收录带有观景或摄影属性的路线。",
    match: route => textOf(route).includes("看海") || textOf(route).includes("山海") || textOf(route).includes("摄影") || textOf(route).includes("观景"),
    note: "海岸线、风口和礁石路线对天气更敏感，正式收录时需要单独补充潮汐和风力信息。"
  },
  {
    slug: "family",
    title: "亲子轻徒步",
    eyebrow: "慢一点，也很好",
    description: "偏向路况清楚、强度温和、适合家庭共同体验的路线。",
    match: route => route.themes.includes("亲子") || route.audience.includes("亲子"),
    note: "亲子路线需要额外关注厕所、补给、遮阴、护栏和下撤点。"
  },
  {
    slug: "advanced",
    title: "进阶训练路线",
    eyebrow: "给体力一点挑战",
    description: "收录爬升更明显、用时更长、适合有经验徒步者训练的路线。",
    match: route => route.difficulty === "较难" || route.audience.includes("进阶") || route.themes.includes("训练"),
    note: "进阶路线不建议新手独行，正式上线前必须复核路况、补给、下撤和通讯情况。"
  },
  {
    slug: "summer",
    title: "夏季避暑路线",
    eyebrow: "森林、山风、低一点的热感",
    description: "优先收录森林、鼓岭、山上步道等更适合夏季安排的路线。",
    match: route => route.themes.includes("避暑") || route.themes.includes("森林") || textOf(route).includes("夏季"),
    note: "避暑不代表凉爽安全，午后雷阵雨和山上天气变化仍然要重点关注。"
  }
];

function textOf(route) {
  return [
    route.name,
    route.type,
    route.highlight,
    route.summary,
    route.themes.join(" "),
    route.audience.join(" ")
  ].join(" ");
}

function difficultyClass(route) {
  if (route.difficulty === "较难") return "hard";
  if (route.difficulty === "中等") return "medium";
  return "";
}

function routeCard(route) {
  return `        <a class="topic-route-card" href="../routes/${route.id}.html">
          <div class="route-thumb" style="--thumb:${route.color}"></div>
          <div>
            <div class="route-head">
              <h3>${route.name}</h3>
              <span class="difficulty ${difficultyClass(route)}">${route.difficulty}</span>
            </div>
            <div class="route-meta">
              <span class="meta-pill">${route.region}</span>
              <span class="meta-pill">${route.distance}km</span>
              <span class="meta-pill">${route.time}h</span>
              <span class="meta-pill">爬升${route.ascent}m</span>
            </div>
            <p class="route-desc">${route.highlight}</p>
            <p class="topic-card-note">${route.warning}</p>
          </div>
        </a>`;
}

function topicPage(topic, matchedRoutes) {
  const cards = matchedRoutes.map(routeCard).join("\n");
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="山迹专题：${topic.title}，从福州周边徒步路线库中筛选适合的路线。">
  <title>${topic.title}｜山迹专题</title>
  <link rel="stylesheet" href="../assets/styles.css?v=1.4">
</head>
<body>
  <main class="detail-page topic-page">
    <a class="back-link" href="../index.html">返回山迹首页</a>
    <section class="detail-hero topic-hero" style="--detail-color:#1f6f5b">
      <span class="status-chip">${topic.eyebrow}</span>
      <h1>${topic.title}</h1>
      <p>${topic.description}</p>
    </section>
    <section class="topic-summary">
      <div class="metric"><strong>${matchedRoutes.length}</strong><span>当前入选路线</span></div>
      <div class="metric"><strong>${matchedRoutes.filter(route => route.transitFriendly).length}</strong><span>公共交通友好</span></div>
      <div class="metric"><strong>${matchedRoutes.filter(route => route.gpx?.downloadable).length}</strong><span>已有测试GPX</span></div>
    </section>
    <section class="test-notice">
      <strong>专题说明</strong>
      <span>${topic.note}</span>
    </section>
    <section class="topic-route-list">
${cards || `      <div class="empty-state">该专题还没有路线，后续会随着平潭、宁德边界等周边路线扩展逐步补齐。</div>`}
    </section>
  </main>
</body>
</html>
`;
}

await fs.mkdir(new URL("topics/", root), { recursive: true });

const summary = [];
for (const topic of topics) {
  const matchedRoutes = routes.filter(topic.match).sort((a, b) => b.score - a.score);
  await fs.writeFile(new URL(`topics/${topic.slug}.html`, root), topicPage(topic, matchedRoutes));
  summary.push(`- ${topic.title}：${matchedRoutes.length} 条，页面 topics/${topic.slug}.html`);
}

await fs.writeFile(new URL("topic-check-v1.4.md", root), `# 山迹 ${version} 专题页检查\n\n${summary.join("\n")}\n\n说明：专题页由现有路线标签和描述自动归类，正式上线前需人工复核每条路线是否适合对应专题。\n`);
