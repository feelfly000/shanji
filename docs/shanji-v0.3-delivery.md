# 山迹 V0.3 交付清单

## 版本目标

V0.3 是地图与数据维护版，重点验证开源地图方向、路线点位字段和后续表格维护流程。

## 已完成

- 首页升级为 V0.3 地图版。
- 10条路线增加近似经纬度字段。
- 路线详情页增加 OpenStreetMap 查看入口。
- 路线弹窗增加地图点位说明。
- 地图页升级为 OpenStreetMap 嵌入 + 近似点位示意板。
- 生成 `data/routes-v0.3.csv`，方便后续表格维护。
- 新增 `tools/README.md`，说明数据维护字段。

## 注意事项

当前经纬度均为近似点位，只用于地图功能测试，不能作为正式导航依据。正式上线前必须复核起点、终点、轨迹和GPX文件。

## 主要入口

- `shanji-site/index.html`
- `shanji-site/map.html`
- `shanji-site/routes/FZ001.html` 到 `FZ010.html`
- `shanji-site/data/routes-v0.3.csv`
- `shanji-site/tools/README.md`

## V0.4 建议

- 接入真实 Leaflet 地图库，替代当前 iframe + 点位示意。
- 补齐每条路线起点/终点坐标。
- 加入真实GPX文件试下载。
- 从CSV自动生成路线数据和详情页。
- 增加活动报名外链字段。
