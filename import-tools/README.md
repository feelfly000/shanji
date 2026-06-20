# 山迹 V1.2 一键轨迹导入工具

## 怎么用

1. 把两步路、六只脚或俱乐部授权提供的 KML/GPX/KMZ 放入：

```text
outputs/shanji-import/raw/
```

2. 运行：

```bash
/Users/firephoenix/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 \
/Users/firephoenix/Documents/Codex/2026-06-17/100/outputs/shanji-import/tools/import_tracks.py
```

3. 查看结果：

```text
outputs/shanji-import/reports/import-candidates.csv
outputs/shanji-import/reports/routes-v1.2-import.csv
outputs/shanji-import/reports/import-report.md
```

## 成功标志

- 终端显示“已解析轨迹：N 条”。
- `import-candidates.csv` 有轨迹分析结果。
- `routes-v1.2-import.csv` 有可人工审核的路线表。
- `import-report.md` 有每条轨迹的简要结论。

## 注意

只导入你自己拥有、平台允许下载或已经获得授权的轨迹。导入结果默认都是待复核，不应直接作为正式出行路线发布。
