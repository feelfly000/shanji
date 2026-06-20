# 山迹 V0.4 交付清单

## 版本目标

V0.4 是 GPX 试下载与轨迹数据维护版，用于验证路线详情页、弹窗和数据表里的 GPX 下载链路。

## 已完成

- 首页升级为 V0.4 GPX版。
- 生成3条测试 GPX：FZ001、FZ002、FZ003。
- FZ001-FZ003 路线详情页显示“下载测试 GPX”。
- 首页路线弹窗支持 GPX 下载按钮。
- 未开放 GPX 的路线显示原因。
- 生成 `data/gpx-v0.4.csv`，用于维护 GPX 状态。

## 重要说明

当前 GPX 是测试轨迹，只用于验证下载链路，不是真实导航轨迹。正式上线前必须替换为实地复核轨迹。

## 主要入口

- `shanji-site/index.html`
- `shanji-site/routes/FZ001.html`
- `shanji-site/content/gpx/FZ001.gpx`
- `shanji-site/data/gpx-v0.4.csv`

## V0.5 建议

- 从 CSV 自动生成 `routes.js`。
- 从 CSV 自动生成活动数据。
- 接入真实俱乐部报名外链。
- 将 GPX 文件和路线状态纳入发布检查。
