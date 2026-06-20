import fs from "node:fs/promises";
import vm from "node:vm";

const root = "/Users/firephoenix/Documents/Codex/2026-06-17/100/outputs/shanji-site";
const routesJs = await fs.readFile(`${root}/data/routes.js`, "utf8");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(routesJs, context);

const routes = context.window.SHANJI_ROUTES.slice(0, 10).map(route => ({
  ...route,
  status: route.id === "FZ001" ? "资料已整理" : "候选待复核",
  gpx: {
    status: "无轨迹",
    downloadable: false,
    file: "",
    note: "V0.1内测阶段暂不开放下载，待实地复核和轨迹清洗后更新。"
  },
  updatedAt: "2026-06-18"
}));

await fs.writeFile(`${root}/data/routes.js`, `window.SHANJI_ROUTES = ${JSON.stringify(routes, null, 2)};\n`);

await fs.mkdir(`${root}/content/routes`, { recursive: true });

function md(route) {
  const tags = [...route.themes, ...route.audience].join("、");
  return `---
id: ${route.id}
name: ${route.name}
region: ${route.region}
difficulty: ${route.difficulty}
distanceKm: ${route.distance}
estimatedHours: ${route.time}
ascentM: ${route.ascent}
routeType: ${route.type}
status: ${route.status}
gpxStatus: ${route.gpx.status}
updatedAt: ${route.updatedAt}
---

# ${route.name}

${route.summary}

## 一句话亮点

${route.highlight}

## 基础参数

- 区域：${route.region}
- 难度：${route.difficulty}
- 距离：约${route.distance}公里
- 用时：约${route.time}小时
- 累计爬升：约${route.ascent}米
- 路线类型：${route.type}
- 交通方式：${route.transit}
- 内容状态：${route.status}
- 更新时间：${route.updatedAt}

## 适合人群与主题

${tags}

## 风险提示

${route.warning}

## 发布前复核

${route.verify}

## 交通方式

${route.transit}。V0.1内测阶段仅作路线选择参考，正式发布前需要补齐具体站点、停车点、返程方式和末班车风险。

## 补给和厕所

待复核。正式发布前需要说明起点、途中、终点是否有厕所和补给。

## GPX轨迹

当前状态：${route.gpx.status}。

${route.gpx.note}
`;
}

for (const route of routes) {
  await fs.writeFile(`${root}/content/routes/${route.id}.md`, md(route));
}

await fs.writeFile(`${root}/content/routes/_v01-route-list.md`, `# V0.1内测路线清单

${routes.map(route => `- ${route.id} ${route.name}｜${route.region}｜${route.difficulty}｜${route.distance}km`).join("\n")}

说明：V0.1用于小范围体验测试，路线信息仍需继续复核，不建议作为正式出行依据。
`);
