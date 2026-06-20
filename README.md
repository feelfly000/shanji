# 山迹徒步网站项目

这是“山迹｜福州徒步线路库”的项目归档目录，包含网站页面、轨迹导入工具、历史版本包、数据模板和产品规划文档。

## 目录说明

- `site/`：当前可预览的网站主体，最新为 V1.4 路线复核版。
- `import-tools/`：轨迹一键导入工具、原始 KML/GPX/KMZ 文件、导入报告和候选轨迹表。
- `packages/`：各版本交付压缩包，包含 V0.1 到 V1.4。
- `docs/`：产品方案、路线模板、交付说明、候选路线表等文档资料。
- `work-scripts/`：早期生成网站和数据的工作脚本。

## 当前重点文件

- 网站首页：`site/index.html`
- 复核看板：`site/review.html`
- 轨迹库：`site/tracks.html`
- 路线复核报告：`site/route-review-v1.4.md`
- 路线复核表：`site/data/route-review-v1.4.csv`
- 导入候选表：`import-tools/reports/import-candidates.csv`
- 导入报告：`import-tools/reports/import-report.md`
- 最新交付包：`packages/shanji-v1.4-route-review.zip`

## 使用方式

本地预览可在该目录的上级或当前目录启动静态服务，然后打开：

```bash
python3 -m http.server 8794 --bind 127.0.0.1
```

如果在本目录启动，访问：

```text
http://127.0.0.1:8794/site/index.html
```

## 后续工作建议

1. 把新导入的 48 条待确认轨迹做成候选轨迹池。
2. 从候选轨迹池中筛选 10-15 条优先复核路线。
3. 对优先路线补齐授权、停车、公交、厕所、补给、下撤点和风险说明。
4. 将达到标准的路线提升为“可内测”。
