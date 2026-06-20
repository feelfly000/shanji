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
    if (ch === '"') quoted = true;
    else if (ch === ",") {
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
  return body.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function placeFor(route, kind) {
  if (kind === "start") return `${route.region.replace("/高新区", "")} · ${route.name.split("-")[0]}附近`;
  if (kind === "end") return route.name.includes("-") ? `${route.region.replace("/高新区", "")} · ${route.name.split("-").at(-1)}附近` : `${route.region.replace("/高新区", "")} · 原路/环线返回`;
  return `${route.region}待复核点`;
}

function seasonFor(route) {
  const text = `${route.themes} ${route.name} ${route.summary}`;
  if (text.includes("看海") || text.includes("海岸") || text.includes("草场")) return "秋季|冬季|春季";
  if (text.includes("避暑") || text.includes("溪谷") || text.includes("森林")) return "春季|夏季|秋季";
  return "全年|避开极端天气";
}

function publicStatus(route) {
  if (route.id === "FZ001") return "可内测";
  if (["FZ002", "FZ003", "FZ007", "FZ018", "FZ019"].includes(route.id)) return "可内测";
  return "待复核";
}

function parkingFor(route) {
  if (route.transitFriendly === "true") return "周边公共停车/路侧停车待确认";
  if (route.themes.includes("看海") || route.region.includes("平潭")) return "目的地停车场/临时停车点待确认";
  return "起点停车条件待确认";
}

function transitFor(route) {
  if (route.transitFriendly === "true") return route.transit;
  if (route.region.includes("平潭") || route.region.includes("连江") || route.region.includes("永泰")) return "建议自驾、包车或参加活动大巴";
  return route.transit || "公共交通待确认";
}

const baseRoutes = parseCsv(await fs.readFile(new URL("routes-v0.8.csv", dataDir), "utf8"));
const routeHeaders = [
  ...Object.keys(baseRoutes[0]),
  "startPoint", "endPoint", "parking", "publicTransit", "toilet", "supply",
  "exitPoints", "bestSeason", "routeStatus", "publicStatus", "dataOwner",
  "sourceType", "reviewNote"
];

const enrichedRoutes = baseRoutes.map(route => ({
  ...route,
  startPoint: placeFor(route, "start"),
  endPoint: placeFor(route, "end"),
  parking: parkingFor(route),
  publicTransit: transitFor(route),
  toilet: route.difficulty === "轻松" ? "起终点周边厕所待确认" : "起点厕所待确认，途中厕所不稳定",
  supply: route.difficulty === "轻松" ? "起终点周边补给待确认" : "建议自备饮水和路餐",
  exitPoints: route.difficulty === "较难" ? "需补充至少2个下撤点" : "起终点及中途可下撤点待复核",
  bestSeason: seasonFor(route),
  routeStatus: route.status === "资料已整理" ? "资料已整理" : "候选待复核",
  publicStatus: publicStatus(route),
  dataOwner: "山迹编辑",
  sourceType: "资料整理|待实地复核",
  reviewNote: "V1.1 前仍按候选路线展示，正式出行前必须复核。"
}));

await fs.writeFile(
  new URL("routes-v1.1.csv", dataDir),
  [routeHeaders.join(","), ...enrichedRoutes.map(route => routeHeaders.map(key => csvEscape(route[key])).join(","))].join("\n") + "\n"
);

const baseActivities = parseCsv(await fs.readFile(new URL("activities-v0.6.csv", dataDir), "utf8"));
const activityHeaders = [
  ...Object.keys(baseActivities[0]),
  "sourceName", "sourceUrl", "publishedAt", "deadline", "officialStatus",
  "isFeatured", "isExpired", "platformNote"
];

const activityExtras = {
  A202607001: ["示例户外A公众号", "https://example.com/shanji-demo/A202607001", "2026-06-18 20:00", "周五 18:00", "待二次确认", "否", "否"],
  A202607002: ["示例户外B活动页", "https://example.com/shanji-demo/A202607002", "2026-06-18 21:30", "周五 22:00", "余位需确认", "是", "否"],
  A202607003: ["示例亲子户外群公告", "https://example.com/shanji-demo/A202607003", "2026-06-18 12:00", "周六 09:00", "待审核", "否", "否"],
  A202607004: ["示例户外C活动页", "https://example.com/shanji-demo/A202607004", "2026-06-18 19:00", "周六 20:00", "天气待确认", "否", "否"],
  A202607005: ["示例户外D公众号", "https://example.com/shanji-demo/A202607005", "2026-06-18 18:00", "周六 18:00", "正常报名", "否", "否"]
};

const enrichedActivities = baseActivities.map(activity => {
  const extra = activityExtras[activity.id] || ["示例来源", activity.signupUrl, "待补充", "待补充", "待确认", "否", "否"];
  return {
    ...activity,
    sourceName: extra[0],
    sourceUrl: extra[1],
    publishedAt: extra[2],
    deadline: extra[3],
    officialStatus: extra[4],
    isFeatured: extra[5],
    isExpired: extra[6],
    platformNote: "山迹只做活动信息聚合，报名和安全责任以组织方官方说明为准。"
  };
});

await fs.writeFile(
  new URL("activities-v1.1.csv", dataDir),
  [activityHeaders.join(","), ...enrichedActivities.map(activity => activityHeaders.map(key => csvEscape(activity[key])).join(","))].join("\n") + "\n"
);

