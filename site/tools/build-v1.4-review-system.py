#!/usr/bin/env python3
from __future__ import annotations

import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def read_csv(path: Path) -> list[dict]:
    with path.open(encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def write_csv(path: Path, rows: list[dict], fields: list[str]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def is_done(value: str) -> bool:
    value = (value or "").strip()
    if not value:
        return False
    bad_words = ["待补充", "待复核", "待确认", "暂无", "未知", "需补充"]
    return not any(word in value for word in bad_words)


def yn(done: bool) -> str:
    return "已完成" if done else "待复核"


def review_level(score: int, blockers: list[str], public_status: str) -> str:
    if public_status == "可公开" and score >= 90 and not blockers:
        return "可公开"
    if score >= 75 and len(blockers) <= 2:
        return "可内测"
    if score >= 45:
        return "待补全"
    return "暂不推荐"


def main() -> None:
    routes = read_csv(DATA / "routes-v1.3.csv")
    gpx_rows = {row["id"]: row for row in read_csv(DATA / "gpx-v1.3.csv")}
    rows = []
    for route in routes:
        checks = {
            "起点": is_done(route.get("startPoint")),
            "终点": is_done(route.get("endPoint")),
            "停车": is_done(route.get("parking")),
            "公共交通": is_done(route.get("publicTransit")),
            "厕所": is_done(route.get("toilet")),
            "补给": is_done(route.get("supply")),
            "下撤点": is_done(route.get("exitPoints")),
            "季节": is_done(route.get("bestSeason")),
            "风险提示": is_done(route.get("warning")),
            "地图点位": "近似" not in route.get("locationAccuracy", "") and is_done(route.get("lat")) and is_done(route.get("lng")),
            "轨迹": gpx_rows.get(route["id"], {}).get("gpxDownloadable") in {"true", "是"},
            "授权": "待确认" not in route.get("reviewNote", ""),
        }
        blockers = [name for name, done in checks.items() if not done and name in {"起点", "终点", "停车", "公共交通", "厕所", "补给", "下撤点", "地图点位", "授权"}]
        score = round(sum(1 for done in checks.values() if done) / len(checks) * 100)
        level = review_level(score, blockers, route.get("publicStatus", ""))
        rows.append({
            "id": route["id"],
            "name": route["name"],
            "region": route["region"],
            "difficulty": route["difficulty"],
            "publicStatus": route.get("publicStatus", ""),
            "routeStatus": route.get("routeStatus", ""),
            "reviewLevel": level,
            "reviewScore": score,
            "blockers": "、".join(blockers) if blockers else "无",
            "startPointCheck": yn(checks["起点"]),
            "endPointCheck": yn(checks["终点"]),
            "parkingCheck": yn(checks["停车"]),
            "publicTransitCheck": yn(checks["公共交通"]),
            "toiletCheck": yn(checks["厕所"]),
            "supplyCheck": yn(checks["补给"]),
            "exitPointsCheck": yn(checks["下撤点"]),
            "seasonCheck": yn(checks["季节"]),
            "riskCheck": yn(checks["风险提示"]),
            "locationCheck": yn(checks["地图点位"]),
            "trackCheck": yn(checks["轨迹"]),
            "licenseCheck": yn(checks["授权"]),
            "nextAction": "可安排公开前终审" if level == "可公开" else "安排内测复核" if level == "可内测" else "补齐阻塞字段后再评估",
        })

    fields = list(rows[0].keys())
    write_csv(DATA / "route-review-v1.4.csv", rows, fields)

    summary = {
        "可公开": sum(1 for row in rows if row["reviewLevel"] == "可公开"),
        "可内测": sum(1 for row in rows if row["reviewLevel"] == "可内测"),
        "待补全": sum(1 for row in rows if row["reviewLevel"] == "待补全"),
        "暂不推荐": sum(1 for row in rows if row["reviewLevel"] == "暂不推荐"),
    }
    lines = ["# 山迹 V1.4 路线复核报告", ""]
    lines.extend([
        "## 汇总",
        "",
        f"- 路线数量：{len(rows)}",
        f"- 可公开：{summary['可公开']}",
        f"- 可内测：{summary['可内测']}",
        f"- 待补全：{summary['待补全']}",
        f"- 暂不推荐：{summary['暂不推荐']}",
        "",
        "## 复核优先级",
        "",
    ])
    for row in sorted(rows, key=lambda item: (item["reviewLevel"] != "可内测", -int(item["reviewScore"]))):
        lines.append(f"- {row['id']} {row['name']}｜{row['reviewLevel']}｜{row['reviewScore']}分｜阻塞：{row['blockers']}")
    (ROOT / "route-review-v1.4.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
