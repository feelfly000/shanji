#!/usr/bin/env python3
from __future__ import annotations

import csv
import math
import sys
import tempfile
import zipfile
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

KML_NS = {"kml": "http://www.opengis.net/kml/2.2", "gx": "http://www.google.com/kml/ext/2.2"}
GPX_NS = {"gpx": "http://www.topografix.com/GPX/1/1"}


@dataclass
class Point:
    lat: float
    lon: float
    ele: float | None = None
    when: str | None = None


def node_text(node: ET.Element | None) -> str:
    return (node.text or "").strip() if node is not None else ""


def strip_ns(name: str) -> str:
    return name.split("}", 1)[-1]


def haversine(a: Point, b: Point) -> float:
    radius = 6_371_000
    lat1, lat2 = math.radians(a.lat), math.radians(b.lat)
    dlat = math.radians(b.lat - a.lat)
    dlon = math.radians(b.lon - a.lon)
    x = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * radius * math.atan2(math.sqrt(x), math.sqrt(1 - x))


def parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def parse_csv(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def parse_kml(path: Path) -> dict:
    root = ET.parse(path).getroot()
    data = {}
    for item in root.findall(".//kml:ExtendedData/kml:Data", KML_NS):
        data[item.attrib.get("name", "")] = node_text(item.find("kml:value", KML_NS))

    points: list[Point] = []
    whens = [node_text(item) for item in root.findall(".//gx:Track/kml:when", KML_NS)]
    gx_coords = root.findall(".//gx:Track/gx:coord", KML_NS)
    if gx_coords:
        for index, coord in enumerate(gx_coords):
            parts = node_text(coord).split()
            if len(parts) >= 2:
                points.append(Point(float(parts[1]), float(parts[0]), float(parts[2]) if len(parts) > 2 else None, whens[index] if index < len(whens) else None))
    else:
        for coord in root.findall(".//kml:LineString/kml:coordinates", KML_NS):
            for chunk in node_text(coord).split():
                parts = chunk.split(",")
                if len(parts) >= 2:
                    points.append(Point(float(parts[1]), float(parts[0]), float(parts[2]) if len(parts) > 2 and parts[2] else None))

    snippet = node_text(root.find(".//kml:snippet", KML_NS)).lower()
    return {
        "platform": "两步路" if "2bulu" in snippet else "KML",
        "name": node_text(root.find(".//kml:Document/kml:name", KML_NS)) or path.stem,
        "author": node_text(root.find(".//kml:Document/kml:author", KML_NS)) or data.get("CreaterName", ""),
        "tags": data.get("TrackTags", ""),
        "begin_ms": data.get("BeginTime", ""),
        "end_ms": data.get("EndTime", ""),
        "time_used_ms": data.get("TimeUsed", ""),
        "start_name": data.get("PosStartName", ""),
        "end_name": data.get("PosEndName", ""),
        "creator_id": data.get("CreaterId", ""),
        "points": points,
    }


def parse_gpx(path: Path) -> dict:
    root = ET.parse(path).getroot()
    ns_uri = root.tag.split("}", 1)[0].strip("{") if root.tag.startswith("{") else ""
    ns = {"gpx": ns_uri} if ns_uri else {}
    prefix = ".//gpx:" if ns_uri else ".//"
    name = node_text(root.find(f"{prefix}name", ns)) or path.stem
    points: list[Point] = []
    trkpts = root.findall(f"{prefix}trkpt", ns)
    for trkpt in trkpts:
        lat = trkpt.attrib.get("lat")
        lon = trkpt.attrib.get("lon")
        if lat and lon:
            ele = node_text(trkpt.find("gpx:ele", ns)) if ns_uri else node_text(trkpt.find("ele"))
            when = node_text(trkpt.find("gpx:time", ns)) if ns_uri else node_text(trkpt.find("time"))
            points.append(Point(float(lat), float(lon), float(ele) if ele else None, when or None))
    return {
        "platform": "GPX",
        "name": name,
        "author": "",
        "tags": "",
        "begin_ms": "",
        "end_ms": "",
        "time_used_ms": "",
        "start_name": "",
        "end_name": "",
        "creator_id": "",
        "points": points,
    }


def parse_kmz(path: Path) -> list[dict]:
    tracks = []
    with tempfile.TemporaryDirectory() as tmp:
        tmpdir = Path(tmp)
        with zipfile.ZipFile(path) as archive:
            archive.extractall(tmpdir)
        for kml in sorted(tmpdir.rglob("*.kml")):
            track = parse_kml(kml)
            track["name"] = track["name"] or path.stem
            tracks.append(track)
    return tracks


def collect_files(source: Path) -> list[Path]:
    if source.is_file():
        return [source]
    suffixes = {".kml", ".gpx", ".kmz"}
    return sorted(path for path in source.rglob("*") if path.is_file() and path.suffix.lower() in suffixes)


def parse_track_file(path: Path) -> list[dict]:
    suffix = path.suffix.lower()
    if suffix == ".kml":
        return [parse_kml(path)]
    if suffix == ".gpx":
        return [parse_gpx(path)]
    if suffix == ".kmz":
        return parse_kmz(path)
    return []


def route_region(lat: float, lon: float, name: str) -> str:
    text = name
    if "平潭" in text or (lat < 25.75 and lon > 119.65):
        return "平潭县"
    if "连江" in text or "奇达" in text or "黄岐" in text or "定海" in text:
        return "连江县"
    if "长乐" in text or "下沙" in text or "猴屿" in text:
        return "长乐区"
    if "永泰" in text or lon < 119.0:
        return "永泰县"
    if "福清" in text or "大姆山" in text or "石竹山" in text:
        return "福清市"
    if "罗源" in text:
        return "罗源县"
    if "马尾" in text:
        return "马尾区"
    if "闽侯" in text or "五虎" in text or "旗山" in text:
        return "闽侯县"
    if "鼓山" in text or "鼓岭" in text or "状元岭" in text or "小北岭" in text:
        return "晋安区"
    return "福州周边"


def region_priority(region: str, name: str) -> str:
    if any(word in name for word in ["莆田", "泉州", "厦门", "三明", "南平"]):
        return "跨区参考"
    if region in {"鼓楼区", "晋安区", "闽侯县", "马尾区", "连江县", "长乐区", "永泰县", "福清市", "平潭县", "罗源县"}:
        return "优先候选"
    return "边界候选"


def recommend_tags(name: str, region: str, ascent: float, distance_km: float, loop: bool) -> tuple[str, str, str]:
    text = f"{name} {region}"
    themes = []
    audience = []
    route_type = "徒步路线"
    if any(word in text for word in ["海", "湾", "岛", "平潭", "黄岐", "奇达", "定海"]):
        themes += ["看海", "海岸", "摄影"]
        route_type = "山海徒步" if ascent >= 250 else "海岸轻徒步"
    if any(word in text for word in ["古道", "状元岭", "小北岭"]):
        themes += ["古道", "历史人文"]
        route_type = "古道徒步"
    if any(word in text for word in ["溪", "瀑", "谷"]):
        themes += ["溪谷", "避暑"]
    if any(word in text for word in ["森林", "鼓岭", "雪峰"]):
        themes += ["森林", "避暑"]
    if any(word in text for word in ["寺", "岩"]):
        themes.append("寺庙")
    if not themes:
        themes.append("观景")
    if distance_km <= 7 and ascent <= 250:
        audience += ["新手", "半日"]
    elif distance_km <= 10 and ascent <= 600:
        audience += ["新手进阶", "半日", "摄影"]
    else:
        audience += ["进阶", "摄影"]
    if loop:
        themes.append("环线")
    return route_type, "|".join(dict.fromkeys(themes)), "|".join(dict.fromkeys(audience))


def season_for(themes: str) -> str:
    if "看海" in themes or "海岸" in themes:
        return "秋季|冬季|春季"
    if "避暑" in themes or "溪谷" in themes or "森林" in themes:
        return "春季|夏季|秋季"
    return "全年|避开极端天气"


def summarize(track: dict, source: Path) -> dict:
    points: list[Point] = track["points"]
    if len(points) < 2:
        raise ValueError(f"{source} 轨迹点不足，无法分析。")

    distance = 0.0
    ascent = 0.0
    descent = 0.0
    gap_count = 0
    max_gap = 0.0
    max_speed = 0.0
    timed_seconds = 0.0

    for before, after in zip(points, points[1:]):
        segment = haversine(before, after)
        distance += segment
        if segment > 300:
            gap_count += 1
            max_gap = max(max_gap, segment)
        if before.ele is not None and after.ele is not None:
            diff = after.ele - before.ele
            if abs(diff) < 80:
                if diff > 0:
                    ascent += diff
                else:
                    descent += abs(diff)
        t1, t2 = parse_time(before.when), parse_time(after.when)
        if t1 and t2:
            seconds = (t2 - t1).total_seconds()
            if seconds > 0:
                timed_seconds += seconds
                max_speed = max(max_speed, segment / seconds * 3.6)

    duration_hours = float(track["time_used_ms"] or 0) / 1000 / 3600 if track["time_used_ms"] else timed_seconds / 3600
    avg_speed = distance / 1000 / duration_hours if duration_hours else 0
    elevations = [point.ele for point in points if point.ele is not None]
    lats = [point.lat for point in points]
    lons = [point.lon for point in points]
    loop_distance = haversine(points[0], points[-1])
    is_loop = loop_distance < 300
    distance_km = distance / 1000
    region = route_region(points[0].lat, points[0].lon, track["name"])
    priority = region_priority(region, track["name"])
    route_type, themes, audience = recommend_tags(track["name"], region, ascent, distance_km, is_loop)

    score = 100
    if len(points) < 300:
        score -= 20
    if gap_count:
        score -= min(30, gap_count * 5)
    if max_speed > 18:
        score -= 15
    if elevations and min(elevations) < -20:
        score -= 5
    if not track["start_name"] or not track["end_name"]:
        score -= 5
    if distance_km < 2 or distance_km > 30:
        score -= 10

    return {
        "sourceFile": str(source),
        "platform": track["platform"],
        "sourceAuthor": track["author"],
        "sourceTrackId": track.get("creator_id", ""),
        "sourceLicense": "待确认",
        "name": track["name"],
        "region": region,
        "regionPriority": priority,
        "type": route_type,
        "tags": track["tags"],
        "startName": track["start_name"],
        "endName": track["end_name"],
        "pointCount": len(points),
        "distanceKm": round(distance_km, 2),
        "durationHours": round(duration_hours, 2),
        "ascentM": round(ascent),
        "descentM": round(descent),
        "minEle": round(min(elevations), 1) if elevations else "",
        "maxEle": round(max(elevations), 1) if elevations else "",
        "startLat": round(points[0].lat, 6),
        "startLng": round(points[0].lon, 6),
        "endLat": round(points[-1].lat, 6),
        "endLng": round(points[-1].lon, 6),
        "bbox": f"{round(min(lats), 6)},{round(min(lons), 6)},{round(max(lats), 6)},{round(max(lons), 6)}",
        "isLoop": "是" if is_loop else "否",
        "startEndGapM": round(loop_distance),
        "gapOver300mCount": gap_count,
        "maxGapM": round(max_gap),
        "avgSpeedKmh": round(avg_speed, 2),
        "maxSegmentSpeedKmh": round(max_speed, 2),
        "qualityScore": max(0, score - (15 if priority == "跨区参考" else 5 if priority == "边界候选" else 0)),
        "suggestedDifficulty": "较难" if ascent >= 700 or distance_km >= 14 else "中等" if ascent >= 350 or distance_km >= 8 else "轻松",
        "suggestedThemes": themes,
        "suggestedAudience": audience,
        "bestSeason": season_for(themes),
        "suggestedStatus": "候选待复核",
        "dedupeKey": f"{round(points[0].lat, 3)}:{round(points[0].lon, 3)}:{round(points[-1].lat, 3)}:{round(points[-1].lon, 3)}:{round(distance_km)}",
        "duplicateGroup": "",
        "duplicateHint": "",
        "reviewNotes": "海拔低值可能有噪声；起终点名称与坐标需人工复核。" if elevations and min(elevations) < -20 else "需人工复核起终点、停车、开放状态和风险点。",
    }


def mark_duplicates(rows: list[dict]) -> None:
    groups: dict[str, list[dict]] = {}
    for row in rows:
        groups.setdefault(row["dedupeKey"], []).append(row)
    group_index = 1
    for items in groups.values():
        if len(items) <= 1:
            continue
        group_name = f"DUP-{group_index:03d}"
        best = max(items, key=lambda item: (int(item["qualityScore"]), int(item["pointCount"])))
        for item in items:
            item["duplicateGroup"] = group_name
            item["duplicateHint"] = "保留优先" if item is best else f"疑似重复，建议与 {best['name']} 合并比较"
        group_index += 1


def next_import_id(existing_routes_path: Path, offset: int) -> str:
    rows = parse_csv(existing_routes_path)
    max_num = 0
    for row in rows:
        route_id = row.get("id", "")
        if route_id.startswith("FZ") and route_id[2:].isdigit():
            max_num = max(max_num, int(route_id[2:]))
    return f"FZ{max_num + offset:03d}"


def route_row(candidate: dict, route_id: str) -> dict:
    name = str(candidate["name"]).replace(".kml", "").replace(".gpx", "")
    color = "#6f9f7b"
    return {
        "id": route_id,
        "name": name,
        "region": candidate["region"],
        "type": candidate["type"],
        "difficulty": candidate["suggestedDifficulty"],
        "distance": candidate["distanceKm"],
        "time": candidate["durationHours"],
        "ascent": candidate["ascentM"],
        "transit": "待补充",
        "transitFriendly": "false",
        "themes": candidate["suggestedThemes"],
        "audience": candidate["suggestedAudience"],
        "score": candidate["qualityScore"],
        "highlight": f"{name}，由轨迹文件自动导入，适合作为候选路线复核。",
        "summary": f"轨迹距离约{candidate['distanceKm']}km，累计爬升约{candidate['ascentM']}m，质量评分{candidate['qualityScore']}。正式发布前需人工复核。",
        "warning": "该路线由外部轨迹导入，开放状态、路况、风险点、交通和补给尚未复核。",
        "verify": "起点、终点、停车、公交、厕所、补给、下撤点、轨迹授权和实地路况",
        "lat": candidate["startLat"],
        "lng": candidate["startLng"],
        "locationAccuracy": "轨迹起点坐标，待复核",
        "status": "轨迹导入待复核",
        "updatedAt": datetime.now().strftime("%Y-%m-%d"),
        "color": color,
        "startPoint": candidate["startName"] or "待补充",
        "endPoint": candidate["endName"] or ("原路/环线返回" if candidate["isLoop"] == "是" else "待补充"),
        "parking": "待补充",
        "publicTransit": "待补充",
        "toilet": "待补充",
        "supply": "建议自备饮水和路餐，补给待复核",
        "exitPoints": "待补充",
        "bestSeason": candidate["bestSeason"],
        "routeStatus": "轨迹导入待复核",
        "publicStatus": "待复核",
        "dataOwner": "山迹导入工具",
        "sourceType": f"{candidate['platform']}|轨迹导入",
        "reviewNote": f"来源作者：{candidate['sourceAuthor']}；来源授权：{candidate['sourceLicense']}；{candidate['reviewNotes']}",
    }


def write_csv(path: Path, rows: list[dict], fields: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def write_outputs(rows: list[dict], out_dir: Path, existing_routes_path: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    mark_duplicates(rows)
    candidate_fields = list(rows[0].keys()) if rows else []
    write_csv(out_dir / "import-candidates.csv", rows, candidate_fields)

    existing_fields = list(parse_csv(existing_routes_path)[0].keys()) if parse_csv(existing_routes_path) else []
    import_routes = []
    import_index = 1
    for candidate in rows:
        if int(candidate["qualityScore"]) < 70:
            continue
        if candidate["regionPriority"] == "跨区参考":
            continue
        if candidate["duplicateHint"].startswith("疑似重复"):
            continue
        import_routes.append(route_row(candidate, next_import_id(existing_routes_path, import_index)))
        import_index += 1
    if existing_fields and import_routes:
        write_csv(out_dir / "routes-v1.2-import.csv", import_routes, existing_fields)

    report = ["# 山迹 V1.2 一键轨迹导入报告", ""]
    report.append(f"- 解析轨迹：{len(rows)} 条")
    report.append(f"- 可进入候选入库表：{len(import_routes)} 条")
    report.append(f"- 疑似重复：{sum(1 for row in rows if row['duplicateGroup'])} 条")
    report.append("")
    for row in rows:
        report.extend([
            f"## {row['name']}",
            "",
            f"- 平台：{row['platform']}",
            f"- 区域：{row['region']}",
            f"- 区域优先级：{row['regionPriority']}",
            f"- 距离：{row['distanceKm']} km，用时：{row['durationHours']} h，爬升：{row['ascentM']} m",
            f"- 是否闭环：{row['isLoop']}，起终点距离 {row['startEndGapM']} m",
            f"- 质量评分：{row['qualityScore']}，建议难度：{row['suggestedDifficulty']}",
            f"- 推荐主题：{row['suggestedThemes']}",
            f"- 推荐人群：{row['suggestedAudience']}",
            f"- 重复提示：{row['duplicateHint'] or '未发现明显重复'}",
            f"- 复核提示：{row['reviewNotes']}",
            "",
        ])
    (out_dir / "import-report.md").write_text("\n".join(report), encoding="utf-8")


def main() -> int:
    root = Path(__file__).resolve().parents[3]
    default_source = root / "outputs" / "shanji-import" / "raw"
    default_out = root / "outputs" / "shanji-import" / "reports"
    default_routes = root / "outputs" / "shanji-site" / "data" / "routes-v1.1.csv"

    source = Path(sys.argv[1]).expanduser() if len(sys.argv) > 1 else default_source
    out_dir = Path(sys.argv[2]).expanduser() if len(sys.argv) > 2 else default_out
    routes_path = Path(sys.argv[3]).expanduser() if len(sys.argv) > 3 else default_routes

    rows = []
    errors = []
    for file in collect_files(source):
        try:
            for track in parse_track_file(file):
                rows.append(summarize(track, file))
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{file}: {exc}")

    if not rows:
        print("没有找到可解析的 KML/GPX/KMZ 文件。", file=sys.stderr)
        for error in errors:
            print(error, file=sys.stderr)
        return 1

    write_outputs(rows, out_dir, routes_path)
    if errors:
        (out_dir / "import-errors.txt").write_text("\n".join(errors), encoding="utf-8")
    print(f"已解析轨迹：{len(rows)} 条")
    print(f"已生成：{out_dir / 'import-candidates.csv'}")
    print(f"已生成：{out_dir / 'routes-v1.2-import.csv'}")
    print(f"已生成：{out_dir / 'import-report.md'}")
    if errors:
        print(f"有 {len(errors)} 个文件解析失败，见：{out_dir / 'import-errors.txt'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
