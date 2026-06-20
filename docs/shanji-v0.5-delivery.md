# 山迹 V0.5 交付清单

## 版本目标

V0.5 是数据自动生成版，把维护方式从“手改网页数据”升级为“维护 CSV 后自动生成网站”。

## 已完成

- 新增 `data/routes-v0.5.csv` 路线源数据表。
- 新增 `data/activities-v0.5.csv` 活动源数据表。
- 新增 `data/gpx-v0.5.csv` GPX源数据表。
- 新增 `tools/build-from-csv.mjs` 构建脚本。
- 从 CSV 自动生成 `data/routes.js`。
- 从 CSV 自动生成 `data/activities.js`。
- 从 CSV 自动生成路线详情页。
- 从 CSV 自动生成活动详情页。
- 从 CSV 自动生成地图页。
- 自动生成 `data-check-v0.5.md` 数据检查报告。

## 验收标准

- 首页显示 V0.5 数据版。
- 路线数量为10。
- 活动数量为5。
- 可下载 GPX 为3条。
- 数据检查报告无阻塞性问题。

## 下一步 V0.6 建议

- 接入真实俱乐部活动外链。
- 设计真实反馈表单或人工反馈入口。
- 增加 SEO 基础：标题、描述、专题页。
- 为部署准备 GitHub Pages / Vercel 静态站结构。
