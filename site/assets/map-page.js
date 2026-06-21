(function () {
  const routes = window.SHANJI_ROUTES || [];
  const state = {
    query: "",
    region: "",
    difficulty: "",
    theme: "",
    collapsedGroups: new Set(),
    selectedId: null
  };

  const searchInput = document.getElementById("distributionSearch");
  const regionSelect = document.getElementById("distributionRegion");
  const difficultySelect = document.getElementById("distributionDifficulty");
  const themeSelect = document.getElementById("distributionGroupBy");
  const resetButton = document.getElementById("distributionReset");
  const fitButton = document.getElementById("distributionFit");
  const list = document.getElementById("distributionList");
  const listCount = document.getElementById("distributionListCount");
  const mapEl = document.getElementById("routeDistributionMap");
  const routeById = new Map(routes.map(route => [route.id, route]));
  const markerById = new Map();

  let map = null;
  let markerLayer = null;
  let currentRoutes = [];
  const themeOrder = [
    "城市森林",
    "古道",
    "观景",
    "看海",
    "海岸",
    "森林",
    "寺庙",
    "亲子",
    "历史人文",
    "避暑",
    "训练",
    "溪谷",
    "草场",
  ];

  function difficultyRank(route) {
    if (route.difficulty.includes("轻松")) return 1;
    if (route.difficulty.includes("中等")) return 2;
    return 3;
  }

  function difficultyClass(route) {
    const rank = difficultyRank(route);
    if (rank === 1) return "easy";
    if (rank === 2) return "medium";
    return "hard";
  }

  function markerColor(route) {
    const rank = difficultyRank(route);
    if (rank === 1) return "#1f6f5b";
    if (rank === 2) return "#9a6b22";
    return "#b84a3a";
  }

  function searchableText(route) {
    return [
      route.id,
      route.name,
      route.region,
      route.type,
      route.difficulty,
      route.transit,
      route.highlight,
      route.summary,
      ...(route.themes || []),
      ...(route.audience || [])
    ].join(" ").toLowerCase();
  }

  function routeMatches(route) {
    const query = state.query.trim().toLowerCase();
    if (state.region && route.region !== state.region) return false;
    if (state.difficulty && route.difficulty !== state.difficulty) return false;
    if (state.theme && !route.themes?.includes(state.theme)) return false;
    if (query && !searchableText(route).includes(query)) return false;
    return Boolean(route.location?.lat && route.location?.lng);
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function fillSelect(select, values) {
    values.forEach(value => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  }

  function groupKey(route) {
    if (state.theme && route.themes?.includes(state.theme)) return state.theme;
    return route.themes?.find(theme => themeOrder.includes(theme)) || "其他主题";
  }

  function groupTitle(key) {
    return key || "其他主题";
  }

  function sortGroups(groups) {
    return [...groups.entries()].sort(([keyA, routesA], [keyB, routesB]) => {
      const rankA = themeRank(keyA);
      const rankB = themeRank(keyB);
      return rankA - rankB || keyA.localeCompare(keyB) || routesA[0].id.localeCompare(routesB[0].id);
    });
  }

  function themeRank(theme) {
    const index = themeOrder.indexOf(theme);
    return index === -1 ? themeOrder.length : index;
  }

  function sortedThemes() {
    return themeOrder.filter(theme => routes.some(route => route.themes?.includes(theme)));
  }

  function routeFacts(route) {
    return [
      route.region,
      `${route.distance}km`,
      `约${route.time}h`,
      route.transitFriendly ? "公交友好" : "需规划交通"
    ];
  }

  function scrollRouteIntoView(routeId) {
    const card = list.querySelector(`[data-route-id="${routeId}"]`);
    if (!card) return;
    card.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function renderStats(filtered) {
    const locatedRoutes = routes.filter(route => route.location?.lat && route.location?.lng);
    setText("distributionTotal", locatedRoutes.length);
    setText("distributionTransit", locatedRoutes.filter(route => route.transitFriendly).length);
    setText("distributionEasy", locatedRoutes.filter(route => difficultyRank(route) === 1 || route.audience?.includes("新手")).length);
    setText("distributionShown", filtered.length);
    listCount.textContent = `${filtered.length}条`;
  }

  function ensureMap() {
    if (map || !window.L) return;

    map = L.map(mapEl, {
      scrollWheelZoom: true,
      zoomControl: true
    }).setView([26.08, 119.3], 9);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "© OpenStreetMap contributors"
    }).addTo(map);

    markerLayer = L.layerGroup().addTo(map);
  }

  function fitCurrentRoutes() {
    if (!map || !currentRoutes.length) return;
    const bounds = L.latLngBounds(currentRoutes.map(route => [route.location.lat, route.location.lng]));
    map.fitBounds(bounds, { padding: [34, 34], maxZoom: 12 });
  }

  function selectRoute(routeId, openPopup, shouldScroll = true) {
    const route = routeById.get(routeId);
    if (!route) return;

    state.selectedId = routeId;
    state.collapsedGroups.delete(groupKey(route));
    document.querySelectorAll(".distribution-route").forEach(item => {
      item.classList.toggle("active", item.dataset.routeId === routeId);
    });

    markerById.forEach((marker, id) => {
      const route = routeById.get(id);
      const active = id === routeId;
      marker.setStyle({
        radius: active ? 10 : 7,
        weight: active ? 4 : 2,
        fillOpacity: active ? 0.95 : 0.78,
        color: active ? "#f3b454" : markerColor(route),
        fillColor: active ? "#f3b454" : markerColor(route)
      });
      if (active && openPopup) marker.openPopup();
    });

    const group = [...list.querySelectorAll(".distribution-group")]
      .find(item => item.dataset.groupKey === groupKey(route));
    if (group) group.open = true;
    if (shouldScroll) scrollRouteIntoView(routeId);
  }

  function renderMap(filtered) {
    if (!window.L) {
      mapEl.innerHTML = `<div class="map-fallback">开源地图资源暂时没有加载成功。当前有 ${filtered.length} 条路线可在下方列表查看。</div>`;
      return;
    }

    ensureMap();
    markerLayer.clearLayers();
    markerById.clear();

    filtered.forEach(route => {
      const active = route.id === state.selectedId;
      const marker = L.circleMarker([route.location.lat, route.location.lng], {
        radius: active ? 10 : 7,
        color: active ? "#f3b454" : markerColor(route),
        weight: active ? 4 : 2,
        fillColor: active ? "#f3b454" : markerColor(route),
        fillOpacity: active ? 0.95 : 0.78
      }).addTo(markerLayer);

      marker.bindPopup(`
        <strong>${route.name}</strong>
        <span>${route.region}｜${route.difficulty}｜${route.distance}km</span>
        <a href="./routes/${route.id}.html">打开路线详情</a>
      `);
      marker.bindTooltip(`${route.id} ${route.name}`, { direction: "top", offset: [0, -8] });
      marker.on("click", () => selectRoute(route.id, true));
      markerById.set(route.id, marker);
    });

    window.requestAnimationFrame(() => {
      map.invalidateSize();
      fitCurrentRoutes();
    });
  }

  function renderList(filtered) {
    if (!filtered.length) {
      list.innerHTML = `<div class="empty-state">没有找到匹配路线。可以换个关键词，或重置区域和难度。</div>`;
      return;
    }

    const groups = new Map();
    filtered.forEach(route => {
      const key = groupKey(route);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(route);
    });

    list.innerHTML = sortGroups(groups).map(([key, groupRoutes]) => {
      const isCollapsed = state.collapsedGroups.has(key);
      return `
        <details class="distribution-group" data-group-key="${key}" ${isCollapsed ? "" : "open"}>
          <summary>
            <span>${groupTitle(key)}</span>
            <b>${groupRoutes.length}条</b>
          </summary>
          <div class="distribution-group-routes">
            ${groupRoutes.map(route => `
              <article class="distribution-route ${state.selectedId === route.id ? "active" : ""}" data-route-id="${route.id}">
                <button type="button" class="distribution-route-main">
                  <span class="route-code">${route.id.replace("FZ", "")}</span>
                  <span class="distribution-route-copy">
                    <strong>${route.name}</strong>
                    <small>${routeFacts(route).join("｜")}｜${route.location.accuracy || "近似点位"}</small>
                  </span>
                </button>
                <div class="distribution-route-meta">
                  <span class="difficulty ${difficultyClass(route)}">${route.difficulty}</span>
                  <a class="inline-link" href="./routes/${route.id}.html">详情</a>
                </div>
              </article>
            `).join("")}
          </div>
        </details>
      `;
    }).join("");

    list.querySelectorAll(".distribution-route-main").forEach(button => {
      button.addEventListener("click", () => {
        const routeId = button.closest(".distribution-route").dataset.routeId;
        const marker = markerById.get(routeId);
        selectRoute(routeId, true, false);
        if (marker && map) {
          map.setView(marker.getLatLng(), Math.max(map.getZoom(), 12), { animate: true });
        }
      });
    });

    list.querySelectorAll(".distribution-group").forEach(group => {
      group.addEventListener("toggle", () => {
        const key = group.dataset.groupKey;
        if (group.open) {
          state.collapsedGroups.delete(key);
        } else {
          state.collapsedGroups.add(key);
        }
      });
    });
  }

  function render() {
    currentRoutes = routes
      .filter(routeMatches)
      .sort((a, b) => difficultyRank(a) - difficultyRank(b) || a.distance - b.distance || a.id.localeCompare(b.id));

    if (state.selectedId && !currentRoutes.some(route => route.id === state.selectedId)) {
      state.selectedId = null;
    }

    renderStats(currentRoutes);
    renderMap(currentRoutes);
    renderList(currentRoutes);
  }

  function init() {
    fillSelect(regionSelect, [...new Set(routes.map(route => route.region).filter(Boolean))].sort());
    fillSelect(difficultySelect, [...new Set(routes.map(route => route.difficulty).filter(Boolean))].sort());
    fillSelect(themeSelect, sortedThemes());

    searchInput.addEventListener("input", event => {
      state.query = event.target.value;
      render();
    });
    regionSelect.addEventListener("change", event => {
      state.region = event.target.value;
      render();
    });
    difficultySelect.addEventListener("change", event => {
      state.difficulty = event.target.value;
      render();
    });
    themeSelect.addEventListener("change", event => {
      state.theme = event.target.value;
      state.collapsedGroups.clear();
      render();
    });
    resetButton.addEventListener("click", () => {
      state.query = "";
      state.region = "";
      state.difficulty = "";
      state.theme = "";
      state.collapsedGroups.clear();
      state.selectedId = null;
      searchInput.value = "";
      regionSelect.value = "";
      difficultySelect.value = "";
      themeSelect.value = "";
      render();
    });
    fitButton.addEventListener("click", fitCurrentRoutes);

    render();
  }

  init();
}());
