(function () {
  const tracks = window.SHANJI_TRACKS || [];

  function bounds(coords) {
    return coords.reduce((acc, item) => ({
      minLat: Math.min(acc.minLat, item[0]),
      maxLat: Math.max(acc.maxLat, item[0]),
      minLng: Math.min(acc.minLng, item[1]),
      maxLng: Math.max(acc.maxLng, item[1])
    }), { minLat: 90, maxLat: -90, minLng: 180, maxLng: -180 });
  }

  function renderSvg(container, track) {
    const box = bounds(track.coordinates);
    const latSpan = box.maxLat - box.minLat || 0.001;
    const lngSpan = box.maxLng - box.minLng || 0.001;
    const points = track.coordinates.map(([lat, lng]) => {
      const x = ((lng - box.minLng) / lngSpan * 92) + 4;
      const y = 96 - (((lat - box.minLat) / latSpan * 92) + 4);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");
    container.innerHTML = `
      <svg class="track-svg" viewBox="0 0 100 100" role="img" aria-label="${track.name}轨迹预览">
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

  function initRouteTracks() {
    document.querySelectorAll("[data-track-route]").forEach(container => {
      const routeId = container.getAttribute("data-track-route");
      renderTrack(container, tracks.find(track => track.routeId === routeId));
    });
  }

  function initTrackLibrary() {
    const list = document.getElementById("trackLibraryList");
    if (!list) return;
    list.innerHTML = tracks.map(track => `
      <article class="track-library-card">
        <div class="track-mini-map" data-track-id="${track.id}"></div>
        <div>
          <div class="route-head">
            <h3>${track.name}</h3>
            <span class="difficulty">${track.status}</span>
          </div>
          <div class="route-meta">
            <span class="meta-pill">${track.region}</span>
            <span class="meta-pill">${track.distanceKm}km</span>
            <span class="meta-pill">爬升${track.ascentM}m</span>
            <span class="meta-pill">评分${track.qualityScore}</span>
          </div>
          <p class="route-desc">来源：${track.platform}｜作者：${track.author || "待补充"}｜授权：${track.sourceLicense}</p>
          <p>
            ${track.routeId ? `<a class="inline-link" href="./routes/${track.routeId}.html">打开路线详情</a>` : '<span class="club-status closed">跨区参考，不自动入库</span>'}
            <a class="inline-link" href="${track.downloadFile}" download>下载原始KML</a>
          </p>
        </div>
      </article>
    `).join("");
    document.querySelectorAll("[data-track-id]").forEach(container => {
      renderSvg(container, tracks.find(track => track.id === container.getAttribute("data-track-id")));
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initRouteTracks();
    initTrackLibrary();
  });
})();
