(function () {
  const tracks = window.SHANJI_TRACKS || [];

  const libraryState = {
    query: "",
    region: "all",
    status: "all",
    sort: "score-desc",
    quick: "all",
    activeId: ""
  };
  let libraryPreviewMap = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function unique(values) {
    return [...new Set(values.filter(value => String(value ?? "").trim()))].sort((a, b) => String(a).localeCompare(String(b), "zh-CN"));
  }

  function fileType(track) {
    const file = track.downloadFile || track.detailDownloadFile || "";
    const ext = file.split(".").pop();
    return ext ? ext.toUpperCase() : (track.platform || "轨迹文件");
  }

  function displayRegion(track) {
    return track.region || track.regionPriority || "未标注区域";
  }

  function formatDistance(track) {
    return Number(track.distanceKm || 0).toFixed(2).replace(/\.?0+$/, "");
  }

  function formatDuration(track) {
    const hours = Number(track.durationHours || 0);
    return hours > 0 ? `${hours.toFixed(1).replace(/\.0$/, "")}h` : "待补充";
  }

  function bounds(coords) {
    return coords.reduce((acc, item) => ({
      minLat: Math.min(acc.minLat, item[0]),
      maxLat: Math.max(acc.maxLat, item[0]),
      minLng: Math.min(acc.minLng, item[1]),
      maxLng: Math.max(acc.maxLng, item[1])
    }), { minLat: 90, maxLat: -90, minLng: 180, maxLng: -180 });
  }

  function combinedBounds(trackList) {
    const coords = trackList.flatMap(track => track.coordinates || []);
    return coords.length ? bounds(coords) : null;
  }

  function svgPoints(track, box) {
    if (!track?.coordinates?.length || !box) return "";
    const latSpan = box.maxLat - box.minLat || 0.001;
    const lngSpan = box.maxLng - box.minLng || 0.001;
    return track.coordinates.map(([lat, lng]) => {
      const x = ((lng - box.minLng) / lngSpan * 92) + 4;
      const y = 96 - (((lat - box.minLat) / latSpan * 92) + 4);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");
  }

  function renderSvg(container, track) {
    if (!track?.coordinates?.length) {
      container.innerHTML = '<div class="empty-state">暂无可预览轨迹。</div>';
      return;
    }
    const points = svgPoints(track, bounds(track.coordinates));
    container.innerHTML = `
      <svg class="track-svg" viewBox="0 0 100 100" role="img" aria-label="${escapeHtml(track.name)}轨迹预览">
        <rect x="0" y="0" width="100" height="100" rx="3"></rect>
        <polyline points="${points}"></polyline>
        <circle cx="${points.split(" ")[0].split(",")[0]}" cy="${points.split(" ")[0].split(",")[1]}" r="1.8" class="track-start"></circle>
        <circle cx="${points.split(" ").at(-1).split(",")[0]}" cy="${points.split(" ").at(-1).split(",")[1]}" r="1.8" class="track-end"></circle>
      </svg>
    `;
  }

  function renderTrack(container, track) {
    if (!track || !track.coordinates?.length) {
      container.innerHTML = '<div class="empty-state">暂无可预览轨迹。</div>';
      return;
    }
    if (window.L) {
      container.innerHTML = "";
      const map = L.map(container, { scrollWheelZoom: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "© OpenStreetMap"
      }).addTo(map);
      const line = L.polyline(track.coordinates, { color: "#1f6f5b", weight: 4 }).addTo(map);
      L.circleMarker(track.coordinates[0], { radius: 6, color: "#1f6f5b", fillColor: "#ffffff", fillOpacity: 1 }).addTo(map);
      L.circleMarker(track.coordinates.at(-1), { radius: 6, color: "#b84a3a", fillColor: "#ffffff", fillOpacity: 1 }).addTo(map);
      map.fitBounds(line.getBounds(), { padding: [18, 18] });
      return;
    }
    renderSvg(container, track);
  }

  function clearLibraryPreviewMap() {
    if (!libraryPreviewMap) return;
    libraryPreviewMap.remove();
    libraryPreviewMap = null;
  }

  function matchesQuickFilter(track) {
    if (libraryState.quick === "matched") return track.regionPriority === "高匹配导入";
    if (libraryState.quick === "route") return Boolean(track.routeId);
    if (libraryState.quick === "score80") return Number(track.qualityScore || 0) >= 80;
    if (libraryState.quick === "reference") return track.regionPriority === "跨区参考" || !track.routeId;
    return true;
  }

  function getFilteredTracks() {
    const query = libraryState.query.trim().toLowerCase();
    return tracks
      .filter(track => {
        const region = displayRegion(track);
        const haystack = [track.id, track.routeId, track.name, region, track.status, track.regionPriority]
          .join(" ")
          .toLowerCase();
        return (!query || haystack.includes(query))
          && (libraryState.region === "all" || region === libraryState.region)
          && (libraryState.status === "all" || track.status === libraryState.status)
          && matchesQuickFilter(track);
      })
      .sort((a, b) => {
        if (libraryState.sort === "distance-asc") return Number(a.distanceKm || 0) - Number(b.distanceKm || 0);
        if (libraryState.sort === "distance-desc") return Number(b.distanceKm || 0) - Number(a.distanceKm || 0);
        if (libraryState.sort === "ascent-desc") return Number(b.ascentM || 0) - Number(a.ascentM || 0);
        if (libraryState.sort === "region-asc") return displayRegion(a).localeCompare(displayRegion(b), "zh-CN") || Number(b.qualityScore || 0) - Number(a.qualityScore || 0);
        return Number(b.qualityScore || 0) - Number(a.qualityScore || 0);
      });
  }

  function renderSummary() {
    const summary = document.getElementById("trackToolSummary");
    if (!summary) return;
    const matched = tracks.filter(track => track.regionPriority === "高匹配导入").length;
    const references = tracks.filter(track => track.regionPriority === "跨区参考" || !track.routeId).length;
    const averageScore = Math.round(tracks.reduce((sum, track) => sum + Number(track.qualityScore || 0), 0) / (tracks.length || 1));
    summary.innerHTML = `
      <div><strong>${tracks.length}</strong><span>轨迹</span></div>
      <div><strong>${matched}</strong><span>可入库候选</span></div>
      <div><strong>${references}</strong><span>跨区参考</span></div>
      <div><strong>${averageScore}</strong><span>平均评分</span></div>
    `;
  }

  function renderOverview(container, filtered, activeTrack) {
    clearLibraryPreviewMap();
    if (!filtered.length) {
      container.innerHTML = '<div class="empty-state">没有符合条件的轨迹。</div>';
      return;
    }
    if (window.L && activeTrack?.coordinates?.length) {
      container.innerHTML = `
        <div class="track-leaflet-map" aria-label="${escapeHtml(activeTrack.name)}地图底图预览"></div>
        <div class="track-map-legend">
          <span><i class="track-legend-line active"></i>当前预览</span>
          <span>${escapeHtml(displayRegion(activeTrack))}</span>
        </div>
      `;
      const mapEl = container.querySelector(".track-leaflet-map");
      libraryPreviewMap = L.map(mapEl, {
        attributionControl: true,
        scrollWheelZoom: false
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "© OpenStreetMap"
      }).addTo(libraryPreviewMap);
      const line = L.polyline(activeTrack.coordinates, {
        color: "#1f6f5b",
        opacity: .95,
        weight: 4
      }).addTo(libraryPreviewMap);
      L.circleMarker(activeTrack.coordinates[0], {
        radius: 6,
        color: "#1f6f5b",
        fillColor: "#ffffff",
        fillOpacity: 1,
        weight: 2
      }).addTo(libraryPreviewMap);
      L.circleMarker(activeTrack.coordinates.at(-1), {
        radius: 6,
        color: "#b84a3a",
        fillColor: "#ffffff",
        fillOpacity: 1,
        weight: 2
      }).addTo(libraryPreviewMap);
      libraryPreviewMap.fitBounds(line.getBounds(), { padding: [28, 28], maxZoom: 15 });
      window.setTimeout(() => libraryPreviewMap?.invalidateSize(), 0);
      return;
    }
    const previewTracks = activeTrack ? [activeTrack] : filtered;
    const box = activeTrack?.coordinates?.length ? bounds(activeTrack.coordinates) : combinedBounds(filtered);
    const mutedLines = activeTrack ? "" : filtered
      .map(track => `<polyline class="track-overview-line" points="${svgPoints(track, box)}"></polyline>`)
      .join("");
    const activePoints = svgPoints(activeTrack, box);
    const start = activePoints.split(" ")[0]?.split(",") || ["0", "0"];
    const end = activePoints.split(" ").at(-1)?.split(",") || ["0", "0"];
    container.innerHTML = `
      <svg class="track-overview-svg" viewBox="0 0 100 100" role="img" aria-label="${escapeHtml(activeTrack?.name || "筛选轨迹")}地图预览">
        <rect x="0" y="0" width="100" height="100" rx="3"></rect>
        ${mutedLines}
        ${activeTrack ? `<polyline class="track-overview-line active" points="${activePoints}"></polyline>
        <circle cx="${start[0]}" cy="${start[1]}" r="1.2" class="track-start"></circle>
        <circle cx="${end[0]}" cy="${end[1]}" r="1.2" class="track-end"></circle>` : ""}
      </svg>
      <div class="track-map-legend">
        <span><i class="track-legend-line active"></i>当前预览</span>
        <span>${previewTracks.length === 1 ? escapeHtml(displayRegion(previewTracks[0])) : `${previewTracks.length}条轨迹`}</span>
      </div>
    `;
  }

  function renderPreviewDetail(container, track) {
    if (!track) {
      container.innerHTML = "";
      return;
    }
    container.innerHTML = `
      <div class="track-preview-heading">
        <span class="route-code">${escapeHtml(track.routeId || track.id)}</span>
        <div>
          <h3>${escapeHtml(track.name)}</h3>
          <p>${escapeHtml(displayRegion(track))} · ${formatDistance(track)}km · 爬升${Number(track.ascentM || 0)}m</p>
        </div>
      </div>
      <div class="track-preview-stats">
        <div><strong>${Number(track.qualityScore || 0)}</strong><span>评分</span></div>
        <div><strong>${formatDuration(track)}</strong><span>预计时长</span></div>
        <div><strong>${escapeHtml(fileType(track))}</strong><span>文件</span></div>
      </div>
      <div class="track-preview-actions">
        ${track.routeId ? `<a class="inline-link" href="./routes/${escapeHtml(track.routeId)}.html">打开路线详情</a>` : '<span class="club-status closed">跨区参考，不自动入库</span>'}
      </div>
    `;
  }

  function renderTrackCard(track, activeTrack) {
    const isActive = track.id === activeTrack?.id;
    return `
      <article class="track-library-card${isActive ? " active" : ""}">
        <button class="track-card-main" type="button" data-track-select="${escapeHtml(track.id)}">
          <span class="track-card-code">${escapeHtml(track.routeId || track.id)}</span>
          <span class="track-card-body">
            <span class="track-card-title">${escapeHtml(track.name)}</span>
            <span class="track-card-meta">${escapeHtml(displayRegion(track))} · ${formatDistance(track)}km · 爬升${Number(track.ascentM || 0)}m</span>
          </span>
          <span class="track-score">${Number(track.qualityScore || 0)}</span>
        </button>
        <div class="track-card-foot">
          ${track.routeId ? `<a class="inline-link" href="./routes/${escapeHtml(track.routeId)}.html">详情</a>` : '<span class="club-status closed">参考</span>'}
          <details class="track-secondary">
            <summary>次级信息</summary>
            <p>来源：${escapeHtml(track.platform || "待确认")}｜文件：${escapeHtml(fileType(track))}｜状态：${escapeHtml(track.status || "待复核")}</p>
            <p>作者：${escapeHtml(track.author || "待补充")}｜授权：${escapeHtml(track.sourceLicense || "待确认")}</p>
          </details>
        </div>
      </article>
    `;
  }

  function renderLibrary() {
    const list = document.getElementById("trackLibraryList");
    const map = document.getElementById("trackLibraryMap");
    const preview = document.getElementById("trackPreviewDetail");
    const count = document.getElementById("trackResultCount");
    if (!list || !map || !preview) return;

    const filtered = getFilteredTracks();
    if (!filtered.some(track => track.id === libraryState.activeId)) {
      libraryState.activeId = filtered[0]?.id || "";
    }
    const activeTrack = filtered.find(track => track.id === libraryState.activeId);
    if (count) count.textContent = `${filtered.length} 条`;

    list.innerHTML = filtered.length
      ? filtered.map(track => renderTrackCard(track, activeTrack)).join("")
      : '<div class="empty-state">没有符合条件的轨迹，试试放宽筛选。</div>';
    renderOverview(map, filtered, activeTrack);
    renderPreviewDetail(preview, activeTrack);

    list.querySelectorAll("[data-track-select]").forEach(button => {
      button.addEventListener("click", () => {
        libraryState.activeId = button.getAttribute("data-track-select");
        renderLibrary();
      });
    });
  }

  function fillSelect(select, values, allLabel) {
    if (!select) return;
    select.innerHTML = `<option value="all">${allLabel}</option>` + values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
  }

  function bindTrackLibraryControls() {
    const search = document.getElementById("trackSearchInput");
    const region = document.getElementById("trackRegionFilter");
    const status = document.getElementById("trackStatusFilter");
    const sort = document.getElementById("trackSortSelect");
    const reset = document.getElementById("trackResetButton");
    const tags = document.getElementById("trackQuickTags");

    fillSelect(region, unique(tracks.map(displayRegion)), "全部区域");
    fillSelect(status, unique(tracks.map(track => track.status)), "全部状态");

    search?.addEventListener("input", () => {
      libraryState.query = search.value;
      renderLibrary();
    });
    region?.addEventListener("change", () => {
      libraryState.region = region.value;
      renderLibrary();
    });
    status?.addEventListener("change", () => {
      libraryState.status = status.value;
      renderLibrary();
    });
    sort?.addEventListener("change", () => {
      libraryState.sort = sort.value;
      renderLibrary();
    });
    reset?.addEventListener("click", () => {
      libraryState.query = "";
      libraryState.region = "all";
      libraryState.status = "all";
      libraryState.sort = "score-desc";
      libraryState.quick = "all";
      libraryState.activeId = "";
      if (search) search.value = "";
      if (region) region.value = "all";
      if (status) status.value = "all";
      if (sort) sort.value = "score-desc";
      tags?.querySelectorAll(".track-tag").forEach(button => button.classList.toggle("active", button.dataset.trackQuick === "all"));
      renderLibrary();
    });
    tags?.querySelectorAll("[data-track-quick]").forEach(button => {
      button.addEventListener("click", () => {
        libraryState.quick = button.dataset.trackQuick;
        tags.querySelectorAll(".track-tag").forEach(item => item.classList.toggle("active", item === button));
        renderLibrary();
      });
    });
  }

  function initRouteTracks() {
    document.querySelectorAll("[data-track-route]").forEach(container => {
      const routeId = container.getAttribute("data-track-route");
      renderTrack(container, tracks.find(track => track.routeId === routeId));
    });
  }

  function initTrackLibrary() {
    const list = document.getElementById("trackLibraryList");
    if (!list) return;
    renderSummary();
    bindTrackLibraryControls();
    renderLibrary();
  }

  document.addEventListener("DOMContentLoaded", () => {
    initRouteTracks();
    initTrackLibrary();
  });
})();
