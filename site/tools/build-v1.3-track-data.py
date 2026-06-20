#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import math
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT.parents[1]
IMPORT_DIR = WORK / "outputs" / "shanji-import"
RAW_DIR = IMPORT_DIR / "raw"
REPORT_DIR = IMPORT_DIR / "reports"
DATA_DIR = ROOT / "data"
TRACK_CONTENT_DIR = ROOT / "content" / "tracks"

KML_NS = {"kml": "http://www.opengis.net/kml/2.2", "gx": "http://www.google.com/kml/ext/2.2"}


def text(node):
    return (node.text or "").strip() if node is not None else ""


def read_csv(path: Path) -> list[dict]:
    with path.open(encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def write_csv(path: Path, rows: list[dict], fields: list[str]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def parse_kml_points(path: Path) -> list[tuple[float, float]]:
    root = ET.parse(path).getroot()
    points: list[tuple[float, float]] = []
    gx_coords = root.findall(".//gx:Track/gx:coord", KML_NS)
    if gx_coords:
        for coord in gx_coords:
            parts = text(coord).split()
            if len(parts) >= 2:
                points.append((float(parts[1]), float(parts[0])))
    else:
        for coord in root.findall(".//kml:LineString/kml:coordinates", KML_NS):
            for chunk in text(coord).split():
                parts = chunk.split(",")
                if len(parts) >= 2:
                    points.append((float(parts[1]), float(parts[0])))
    return points


def simplify(points: list[tuple[float, float]], max_points: int = 900) -> list[list[float]]:
    if len(points) <= max_points:
        return [[round(lat, 6), round(lng, 6)] for lat, lng in points]
    step = math.ceil(len(points) / max_points)
    sampled = points[::step]
    if sampled[-1] != points[-1]:
        sampled.append(points[-1])
    return [[round(lat, 6), round(lng, 6)] for lat, lng in sampled]


def safe_name(value: str) -> str:
    keep = []
    for char in value:
        if char.isalnum() or char in "-_":
            keep.append(char)
        elif char in " .":
            keep.append("-")
    return "".join(keep).strip("-") or "track"


def main() -> None:
    route_base = read_csv(DATA_DIR / "routes-v1.1.csv")
    import_routes = read_csv(REPORT_DIR / "routes-v1.2-import.csv")
    fields = list(route_base[0].keys())
    existing_ids = {row["id"] for row in route_base}
    merged = route_base + [row for row in import_routes if row["id"] not in existing_ids]
    write_csv(DATA_DIR / "routes-v1.3.csv", merged, fields)

    gpx_base = read_csv(DATA_DIR / "gpx-v0.8.csv")
    gpx_fields = list(gpx_base[0].keys())
    gpx_by_id = {row["id"]: row for row in gpx_base}
    for row in import_routes:
        filename = f"./content/tracks/{row['id']}.kml"
        gpx_by_id[row["id"]] = {
            "id": row["id"],
            "gpxStatus": "候选KML轨迹",
            "gpxDownloadable": "true",
            "gpxFile": filename,
            "note": "V1.3 导入轨迹，仅用于路线预览和复核，正式发布前需确认授权并实地核验。"
        }
    write_csv(DATA_DIR / "gpx-v1.3.csv", list(gpx_by_id.values()), gpx_fields)

    candidates = read_csv(REPORT_DIR / "import-candidates.csv")
    route_id_by_name = {row["name"]: row["id"] for row in import_routes}
    TRACK_CONTENT_DIR.mkdir(parents=True, exist_ok=True)
    tracks = []
    for index, row in enumerate(candidates, start=1):
        source = Path(row["sourceFile"])
        if not source.exists() or source.suffix.lower() != ".kml":
            continue
        route_id = route_id_by_name.get(row["name"], "")
        track_id = route_id or f"REF{index:03d}"
        target_name = f"{track_id}.kml"
        shutil.copy2(source, TRACK_CONTENT_DIR / target_name)
        tracks.append({
            "id": track_id,
            "routeId": route_id,
            "name": row["name"],
            "region": row["region"],
            "regionPriority": row.get("regionPriority", ""),
            "platform": row["platform"],
            "author": row["sourceAuthor"],
            "sourceLicense": row["sourceLicense"],
            "distanceKm": float(row["distanceKm"]),
            "durationHours": float(row["durationHours"]),
            "ascentM": int(float(row["ascentM"])),
            "qualityScore": int(float(row["qualityScore"])),
            "status": "候选轨迹待复核" if route_id else "跨区参考轨迹",
            "downloadFile": f"./content/tracks/{target_name}",
            "detailDownloadFile": f"../content/tracks/{target_name}",
            "coordinates": simplify(parse_kml_points(source)),
        })

    js = "window.SHANJI_TRACKS = " + json.dumps(tracks, ensure_ascii=False, indent=2) + ";\n"
    (DATA_DIR / "tracks.js").write_text(js, encoding="utf-8")


if __name__ == "__main__":
    main()
