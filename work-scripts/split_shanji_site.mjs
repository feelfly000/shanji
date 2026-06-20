import fs from "node:fs/promises";

const sourcePath = "/Users/firephoenix/Documents/Codex/2026-06-17/100/outputs/fuzhou-hiking-prototype.html";
const outDir = "/Users/firephoenix/Documents/Codex/2026-06-17/100/outputs/shanji-site";
const source = await fs.readFile(sourcePath, "utf8");

function between(text, start, end) {
  const startIndex = text.indexOf(start);
  if (startIndex < 0) throw new Error(`Missing ${start}`);
  const bodyStart = startIndex + start.length;
  const endIndex = text.indexOf(end, bodyStart);
  if (endIndex < 0) throw new Error(`Missing ${end}`);
  return text.slice(bodyStart, endIndex);
}

function findArrayBlock(text, declaration) {
  const start = text.indexOf(declaration);
  if (start < 0) throw new Error(`Missing declaration ${declaration}`);
  const bracketStart = text.indexOf("[", start);
  let depth = 0;
  let inString = false;
  let quote = "";
  let escaped = false;

  for (let i = bracketStart; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        inString = false;
        quote = "";
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = true;
      quote = ch;
      continue;
    }
    if (ch === "[") depth += 1;
    if (ch === "]") depth -= 1;
    if (depth === 0) {
      const semicolon = text.indexOf(";", i);
      return {
        start,
        end: semicolon + 1,
        array: text.slice(bracketStart, i + 1)
      };
    }
  }
  throw new Error(`Could not parse ${declaration}`);
}

const css = between(source, "  <style>\n", "\n  </style>");
const bodyOpen = source.indexOf("<body>");
const scriptStart = source.indexOf("  <script>\n", bodyOpen);
const scriptEnd = source.lastIndexOf("\n  </script>");
if (bodyOpen < 0 || scriptStart < 0 || scriptEnd < 0) {
  throw new Error("Could not locate body/script blocks");
}

const bodyMarkup = source.slice(bodyOpen + "<body>".length, scriptStart).trim();
let script = source.slice(scriptStart + "  <script>\n".length, scriptEnd);

const routesBlock = findArrayBlock(script, "const routes =");
const routesArray = routesBlock.array;
script = `${script.slice(0, routesBlock.start)}const routes = window.SHANJI_ROUTES;\n${script.slice(routesBlock.end)}`;

const activitiesBlock = findArrayBlock(script, "const clubActivities =");
const activitiesArray = activitiesBlock.array;
script = `${script.slice(0, activitiesBlock.start)}const clubActivities = window.SHANJI_CLUB_ACTIVITIES;\n${script.slice(activitiesBlock.end)}`;

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>山迹｜福州徒步线路库</title>
  <link rel="stylesheet" href="./assets/styles.css">
</head>
<body>
${bodyMarkup}
  <script src="./data/routes.js"></script>
  <script src="./data/activities.js"></script>
  <script src="./assets/app.js"></script>
</body>
</html>
`;

await fs.writeFile(`${outDir}/index.html`, html);
await fs.writeFile(`${outDir}/assets/styles.css`, `${css.trim()}\n`);
await fs.writeFile(`${outDir}/assets/app.js`, `${script.trim()}\n`);
await fs.writeFile(`${outDir}/data/routes.js`, `window.SHANJI_ROUTES = ${routesArray};\n`);
await fs.writeFile(`${outDir}/data/activities.js`, `window.SHANJI_CLUB_ACTIVITIES = ${activitiesArray};\n`);

const readme = `# 山迹网站原型项目结构

这是从单文件原型拆分出来的可维护版本。

## 文件说明

- \`index.html\`：页面结构。
- \`assets/styles.css\`：页面样式。
- \`assets/app.js\`：搜索、筛选、详情抽屉、活动筛选等交互。
- \`data/routes.js\`：路线数据。
- \`data/activities.js\`：俱乐部活动数据。

## 下一步

后续可以把 \`data/routes.js\` 和 \`data/activities.js\` 改成由表格或Markdown生成。
`;

await fs.writeFile(`${outDir}/README.md`, readme);
