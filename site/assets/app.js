const routes = window.SHANJI_ROUTES;


    const clubActivities = window.SHANJI_CLUB_ACTIVITIES;


    const state = {
      query: "",
      filters: { region: null, difficulty: null, theme: null, audience: null },
      maxDistance: 25,
      sort: "recommended",
      selectedId: null,
      clubFilter: "全部",
      routesExpanded: false
    };

    const homeRoutePreviewCount = 8;

    const filterDefs = {
      region: ["鼓楼区", "晋安区", "闽侯县", "马尾区", "连江县", "长乐区", "永泰县", "福清市", "平潭县", "罗源县"],
      difficulty: ["轻松", "中等", "较难"],
      theme: ["城市森林", "古道", "观景", "看海", "海岸", "森林", "寺庙", "亲子", "历史人文", "避暑", "训练", "溪谷", "草场"],
      audience: ["新手", "亲子", "摄影", "游客", "进阶", "半日"]
    };

    const topics = [
      { name: "新手友好", filter: { audience: "新手" } },
      { name: "公交/地铁可达", custom: "transit" },
      { name: "半日可走", filter: { audience: "半日" } },
      { name: "观景摄影", custom: "scenery" },
      { name: "进阶训练", filter: { audience: "进阶" } },
      { name: "夏季避暑", filter: { theme: "避暑" } }
    ];

    const quickActions = ["新手", "亲子", "看海", "摄影", "公交友好", "进阶"];
    const routeList = document.getElementById("routeList");
    const searchInput = document.getElementById("searchInput");
    const resultCount = document.getElementById("resultCount");
    const sortSelect = document.getElementById("sortSelect");
    const mapCanvas = document.getElementById("mapCanvas");
    const mapCount = document.getElementById("mapCount");
    let routeMap = null;
    let routeMarkerLayer = null;
    const drawer = document.getElementById("drawer");
    const drawerBackdrop = document.getElementById("drawerBackdrop");
    const drawerBody = document.getElementById("drawerBody");
    const drawerCover = document.getElementById("drawerCover");
    const routeImagePickKey = "shanji-route-image-picks-v1";
    function loadRouteImagePicks() {
      const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const imported = params.get("routeImagePicks");
      if (imported) {
        try {
          const picks = JSON.parse(imported);
          localStorage.setItem(routeImagePickKey, JSON.stringify(picks));
          history.replaceState(null, "", window.location.pathname + window.location.search);
          return picks;
        } catch {
          return JSON.parse(localStorage.getItem(routeImagePickKey) || "{}");
        }
      }
      return JSON.parse(localStorage.getItem(routeImagePickKey) || "{}");
    }
    const routeImagePicks = loadRouteImagePicks();

    function selectedRouteImage(route) {
      const pick = routeImagePicks[route.id];
      if (pick?.type !== "preview") return null;
      return route.imageCandidates?.[pick.index] || null;
    }

    function routeThumbStyle(route) {
      const image = selectedRouteImage(route);
      if (!image?.src) return `--thumb:${route.color}`;
      return `--thumb:${route.color};--thumb-image:url('${image.src.replaceAll("'", "%27")}')`;
    }

    function routeGpxBlock(route) {
      if (route.gpx?.homeFile) {
        return `<p>该路线可在独立详情页查看线路轨迹预览。为避免误用或二次传播，本页不开放原始文件。</p>`;
      }
      return `<p>这条路线暂未配置可预览的线路轨迹，出发前请结合地图、天气和现场路况再次确认。</p>`;
    }

    function publicText(value) {
      return String(value || "")
        .replaceAll("，适合作为候选路线复核。", "，可作为出行前路线参考。")
        .replaceAll("适合作为候选路线复核", "可作为出行前路线参考")
        .replaceAll("正式发布前", "出发前")
        .replaceAll("轨迹导入待复核", "轨迹预览")
        .replaceAll("待实地复核", "出行前请确认")
        .replaceAll("待复核", "出行前确认")
        .replaceAll("需复核", "请确认")
        .replaceAll("复核", "确认");
    }

    function seasonText(route) {
      return publicText(route.ops?.bestSeason?.filter(Boolean).join("、") || "出发前确认天气");
    }

    function detailValue(value, fallback = "出发前确认") {
      return publicText(value || fallback);
    }

    function difficultyRank(route) {
      if (route.difficulty.includes("轻松")) return 1;
      if (route.difficulty.includes("中等")) return 2;
      return 3;
    }

    function difficultyClass(route) {
      const rank = difficultyRank(route);
      if (rank === 1) return "";
      if (rank === 2) return "medium";
      return "hard";
    }

    function routeMatches(route) {
      const q = state.query.trim().toLowerCase();
      const haystack = [
        route.id, route.name, route.region, route.type, route.difficulty, route.transit,
        route.highlight, route.summary, route.warning, route.verify,
        route.ops?.startPoint, route.ops?.endPoint, route.ops?.bestSeason?.join(" "),
        route.ops?.publicStatus, route.review?.level, route.review?.blockers, route.review?.nextAction,
        ...route.themes, ...route.audience
      ].join(" ").toLowerCase();

      if (q && !haystack.includes(q)) return false;
      if (route.distance > state.maxDistance) return false;
      if (state.filters.region && !route.region.includes(state.filters.region)) return false;
      if (state.filters.difficulty && !route.difficulty.includes(state.filters.difficulty)) return false;
      if (state.filters.theme && !route.themes.includes(state.filters.theme)) return false;
      if (state.filters.audience && !route.audience.some(item => item.includes(state.filters.audience) || state.filters.audience.includes(item))) return false;
      return true;
    }

    function getFilteredRoutes() {
      const list = routes.filter(routeMatches);
      const sorters = {
        recommended: (a, b) => b.score - a.score,
        distanceAsc: (a, b) => a.distance - b.distance,
        timeAsc: (a, b) => a.time - b.time,
        difficultyAsc: (a, b) => difficultyRank(a) - difficultyRank(b) || a.distance - b.distance
      };
      return list.sort(sorters[state.sort]);
    }

    function renderFilterChips() {
      for (const [key, items] of Object.entries(filterDefs)) {
        const container = document.querySelector(`[data-filter="${key}"]`);
        container.innerHTML = "";
        items.forEach(item => {
          const button = document.createElement("button");
          button.className = `chip ${state.filters[key] === item ? "active" : ""}`;
          button.textContent = item;
          button.addEventListener("click", () => {
            state.filters[key] = state.filters[key] === item ? null : item;
            state.routesExpanded = false;
            render();
          });
          container.appendChild(button);
        });
      }
    }

    function renderQuickActions() {
      const container = document.getElementById("quickActions");
      container.innerHTML = "";
      quickActions.forEach(item => {
        const button = document.createElement("button");
        button.className = "chip";
        button.textContent = item;
        button.addEventListener("click", () => {
          if (item === "公交友好") {
            state.query = "公交";
            searchInput.value = "公交";
          } else if (["新手", "亲子", "进阶", "摄影"].includes(item)) {
            state.filters.audience = item;
          } else {
            state.filters.theme = item;
          }
          state.routesExpanded = false;
          render();
        });
        container.appendChild(button);
      });
    }

    function renderMetrics(filtered) {
      document.getElementById("metricTotal").textContent = routes.length;
      document.getElementById("metricEasy").textContent = routes.filter(r => difficultyRank(r) === 1 || r.audience.includes("新手")).length;
      document.getElementById("metricTransit").textContent = routes.filter(r => r.transitFriendly).length;
      document.getElementById("metricSea").textContent = routes.filter(r => r.themes.includes("观景") || r.themes.includes("看海") || r.audience.includes("摄影")).length;
      const visibleCount = Math.min(filtered.length, state.routesExpanded ? filtered.length : homeRoutePreviewCount);
      resultCount.textContent = filtered.length > homeRoutePreviewCount
        ? `当前显示 ${visibleCount} / ${filtered.length} 条路线`
        : `当前显示 ${filtered.length} 条路线`;
      mapCount.textContent = `${filtered.length}条`;
    }

    function renderRoutes(filtered) {
      routeList.innerHTML = "";
      if (!filtered.length) {
        routeList.innerHTML = `<div class="empty-state">没有找到匹配路线。可以放宽距离、难度或关键词。</div>`;
        return;
      }

      const visibleRoutes = state.routesExpanded ? filtered : filtered.slice(0, homeRoutePreviewCount);
      visibleRoutes.forEach(route => {
        const card = document.createElement("article");
        card.className = `route-card ${state.selectedId === route.id ? "active" : ""}`;
        card.tabIndex = 0;
        card.innerHTML = `
          <div class="route-thumb ${selectedRouteImage(route) ? "has-image" : ""}" style="${routeThumbStyle(route)}"></div>
          <div class="route-main">
            <div class="route-head">
              <h3>${route.name}</h3>
              <span class="difficulty ${difficultyClass(route)}">${route.difficulty}</span>
            </div>
            <div class="route-meta">
              <span class="meta-pill">${route.region}</span>
              <span class="meta-pill">${route.distance}km</span>
              <span class="meta-pill">约${route.time}h</span>
              <span class="meta-pill">爬升${route.ascent}m</span>
              <span class="meta-pill">${route.transit}</span>
              <span class="meta-pill">${seasonText(route).split("、")[0]}</span>
            </div>
            <p class="route-desc">${publicText(route.highlight)}</p>
          <div class="route-warning">出行提醒：${publicText(route.warning)}</div>
          <a class="inline-link" href="./routes/${route.id}.html" onclick="event.stopPropagation()">独立详情页</a>
          </div>
        `;
        card.addEventListener("click", () => openDrawer(route.id));
        card.addEventListener("keydown", event => {
          if (event.key === "Enter") openDrawer(route.id);
        });
        routeList.appendChild(card);
      });

      if (filtered.length > homeRoutePreviewCount) {
        const actions = document.createElement("div");
        actions.className = "route-list-actions";
        const toggleButton = document.createElement("button");
        toggleButton.className = "small-button route-list-toggle";
        toggleButton.type = "button";
        toggleButton.textContent = state.routesExpanded
          ? "收起路线"
          : `查看更多路线（剩余 ${filtered.length - homeRoutePreviewCount} 条）`;
        toggleButton.addEventListener("click", () => {
          state.routesExpanded = !state.routesExpanded;
          render();
        });
        actions.appendChild(toggleButton);
        routeList.appendChild(actions);
      }
    }

    function renderMap(filtered) {
      const routesWithLocation = filtered.filter(route => route.location?.lat && route.location?.lng);
      if (!window.L) {
        mapCanvas.innerHTML = `<div class="map-fallback">开源地图资源暂时没有加载成功。当前筛选到 ${routesWithLocation.length} 条有坐标的路线，可先打开路线详情查看起终点信息。</div>`;
        return;
      }

      if (!routeMap) {
        routeMap = L.map(mapCanvas, {
          scrollWheelZoom: false,
          zoomControl: true
        }).setView([26.08, 119.3], 9);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution: "© OpenStreetMap contributors"
        }).addTo(routeMap);
        routeMarkerLayer = L.layerGroup().addTo(routeMap);
      }

      routeMarkerLayer.clearLayers();
      routesWithLocation.forEach(route => {
        const active = state.selectedId === route.id;
        const marker = L.circleMarker([route.location.lat, route.location.lng], {
          radius: active ? 8 : 6,
          color: active ? "#f3b454" : "#1f6f5b",
          weight: active ? 3 : 2,
          fillColor: active ? "#f3b454" : "#1f6f5b",
          fillOpacity: 0.86
        }).addTo(routeMarkerLayer);
        marker.bindTooltip(route.name, { direction: "top", offset: [0, -8] });
        marker.on("click", () => openDrawer(route.id));
      });

      window.requestAnimationFrame(() => routeMap.invalidateSize());
      if (routesWithLocation.length) {
        const bounds = L.latLngBounds(routesWithLocation.map(route => [route.location.lat, route.location.lng]));
        routeMap.fitBounds(bounds, { padding: [28, 28], maxZoom: 12 });
      } else {
        routeMap.setView([26.08, 119.3], 9);
      }
    }

    function renderTopics() {
      const container = document.getElementById("topicList");
      container.innerHTML = "";
      topics.forEach(topic => {
        const button = document.createElement("button");
        button.className = "topic-item";
        button.textContent = topic.name;
        button.addEventListener("click", () => {
          state.query = "";
          searchInput.value = "";
          state.filters = { region: null, difficulty: null, theme: null, audience: null };
          if (topic.custom === "transit") {
            state.query = "公交";
            searchInput.value = "公交";
          }
          if (topic.custom === "scenery") {
            state.query = "摄影";
            searchInput.value = "摄影";
          }
          if (topic.filter) {
            state.filters = { ...state.filters, ...topic.filter };
          }
          state.routesExpanded = false;
          render();
        });
        container.appendChild(button);
      });
    }

    function activityMatches(activity) {
      if (state.clubFilter === "全部") return true;
      if (state.clubFilter === "已关联线路") return Boolean(activity.routeId);
      if (state.clubFilter === "已核验来源") return activity.audit === "已审核";
      if (state.clubFilter === "待确认") return activity.status === "待确认" || activity.audit === "待审核" || String(activity.officialStatus || "").includes("确认");
      return activity.tags.includes(state.clubFilter) || activity.difficulty === state.clubFilter;
    }

    function statusClass(status) {
      if (status === "重点关注") return "hot";
      if (status === "待确认") return "closed";
      return "";
    }

    function renderClubFilters() {
      const filters = ["全部", "已关联线路", "已核验来源", "待确认", "新手", "亲子", "看海", "进阶", "避暑"];
      const container = document.getElementById("clubFilters");
      container.innerHTML = "";
      filters.forEach(item => {
        const button = document.createElement("button");
        button.className = `chip ${state.clubFilter === item ? "active" : ""}`;
        button.textContent = item;
        button.addEventListener("click", () => {
          state.clubFilter = item;
          renderClubActivities();
          renderClubFilters();
        });
        container.appendChild(button);
      });
    }

    function renderClubActivities() {
      const container = document.getElementById("clubList");
      const filtered = clubActivities.filter(activityMatches);
      container.innerHTML = "";
      if (!filtered.length) {
        container.innerHTML = `<div class="empty-state">当前没有匹配的俱乐部活动。</div>`;
        return;
      }

      filtered.forEach(activity => {
        const linkedRoute = routes.find(route => route.id === activity.routeId);
        const card = document.createElement("article");
        card.className = "club-card";
        card.innerHTML = `
          <div class="club-card-head">
            <strong>${activity.title}</strong>
            <span class="club-status ${statusClass(activity.status)}">${activity.status}</span>
          </div>
          <div class="club-meta">
            <span class="meta-pill">${activity.date}</span>
            <span class="meta-pill">${activity.club}</span>
            <span class="meta-pill">${activity.region}</span>
            <span class="meta-pill">${activity.difficulty}</span>
            <span class="meta-pill">${activity.distance}km</span>
            <span class="meta-pill">爬升${activity.ascent}m</span>
          </div>
          <p>${activity.meeting}｜${activity.transport}｜原文费用：${activity.fee}</p>
          <p>${activity.note}</p>
          <p>来源：${activity.sourceName || "待补充"}｜发布：${activity.publishedAt || "待补充"}｜时效：${activity.deadline || "待补充"}</p>
          <div class="club-actions">
            <span class="club-status">${activity.officialStatus || activity.audit}</span>
            <a href="./activities/${activity.id}.html" aria-label="${activity.title}线索详情页">线索详情</a>
          </div>
          ${linkedRoute ? `<a class="club-route-link" href="./routes/${linkedRoute.id}.html">关联线路：${linkedRoute.name}</a>` : ""}
        `;
        container.appendChild(card);
      });
    }

    function openDrawer(routeId) {
      const route = routes.find(item => item.id === routeId);
      if (!route) return;
      const image = selectedRouteImage(route);
      state.selectedId = route.id;
      drawerCover.style.setProperty("--drawer-thumb", route.color);
      if (image?.src) {
        drawerCover.classList.add("has-image");
        drawerCover.style.setProperty("--drawer-image", `url('${image.src.replaceAll("'", "%27")}')`);
      } else {
        drawerCover.classList.remove("has-image");
        drawerCover.style.removeProperty("--drawer-image");
      }
      drawerBody.innerHTML = `
        <span class="status-chip">${route.id} · ${route.region}</span>
        <h2>${route.name}</h2>
        <p class="route-desc">${publicText(route.summary)}</p>
        <div class="detail-grid">
          <div class="detail-stat"><strong>${route.distance}km</strong><span>距离</span></div>
          <div class="detail-stat"><strong>${route.time}h</strong><span>预计用时</span></div>
          <div class="detail-stat"><strong>${route.ascent}m</strong><span>累计爬升</span></div>
          <div class="detail-stat"><strong>${route.difficulty}</strong><span>难度</span></div>
          <div class="detail-stat"><strong>${route.type}</strong><span>路线类型</span></div>
          <div class="detail-stat"><strong>${route.transitFriendly ? "较方便" : "需规划"}</strong><span>推荐到达</span></div>
          <div class="detail-stat"><strong>${seasonText(route)}</strong><span>适合季节</span></div>
        </div>
        <div class="detail-section">
          <h3>路线亮点</h3>
          <p>${publicText(route.highlight)}</p>
        </div>
        <div class="detail-section">
          <h3>标签</h3>
          <p>${[...route.themes, ...route.audience].join("、")}</p>
        </div>
        <div class="detail-section">
          <h3>交通与补给</h3>
          <ul>
            <li>起点：${detailValue(route.ops?.startPoint)}</li>
            <li>终点：${detailValue(route.ops?.endPoint)}</li>
            <li>公共交通：${detailValue(route.ops?.publicTransit, route.transit)}</li>
            <li>停车：${detailValue(route.ops?.parking)}</li>
            <li>厕所：${detailValue(route.ops?.toilet)}</li>
            <li>补给：${detailValue(route.ops?.supply)}</li>
          </ul>
        </div>
        <div class="detail-section">
          <h3>出行提醒</h3>
          <p>${publicText(route.warning)}</p>
          <ul>
            <li>下撤：${detailValue(route.ops?.exitPoints)}</li>
            <li>出发前请再次确认天气、路况、交通运营和自身能力。</li>
            <li>山迹只提供路线信息参考，不替代现场判断和安全准备。</li>
          </ul>
        </div>
        <div class="detail-section">
          <h3>线路轨迹</h3>
          ${routeGpxBlock(route)}
        </div>
        <div class="detail-section">
          <h3>分享链接</h3>
          <p><a class="inline-link" href="./routes/${route.id}.html">打开 ${route.id} 独立详情页</a></p>
        </div>
      `;
      drawer.classList.add("open");
      drawerBackdrop.classList.add("open");
      render();
    }

    function closeDrawer() {
      drawer.classList.remove("open");
      drawerBackdrop.classList.remove("open");
    }

    function render() {
      renderFilterChips();
      const filtered = getFilteredRoutes();
      renderMetrics(filtered);
      renderRoutes(filtered);
      renderMap(filtered);
    }

    searchInput.addEventListener("input", event => {
      state.query = event.target.value;
      state.routesExpanded = false;
      render();
    });

    document.getElementById("searchForm").addEventListener("submit", event => {
      event.preventDefault();
      state.query = searchInput.value;
      state.routesExpanded = false;
      render();
      document.getElementById("resultCount").scrollIntoView({ behavior: "smooth", block: "center" });
    });

    sortSelect.addEventListener("change", event => {
      state.sort = event.target.value;
      state.routesExpanded = false;
      render();
    });

    document.getElementById("distanceRange").addEventListener("input", event => {
      state.maxDistance = Number(event.target.value);
      document.getElementById("distanceValue").textContent = `${state.maxDistance}km`;
      state.routesExpanded = false;
      render();
    });

    document.getElementById("resetButton").addEventListener("click", () => {
      state.query = "";
      searchInput.value = "";
      state.filters = { region: null, difficulty: null, theme: null, audience: null };
      state.maxDistance = 25;
      document.getElementById("distanceRange").value = 25;
      document.getElementById("distanceValue").textContent = "25km";
      state.sort = "recommended";
      sortSelect.value = "recommended";
      state.routesExpanded = false;
      render();
    });

    document.getElementById("mobileFilterButton").addEventListener("click", () => {
      document.getElementById("filters").classList.toggle("open");
    });

    document.getElementById("routeEntryButton").addEventListener("click", () => {
      document.getElementById("routeEntryButton").classList.add("active");
      document.getElementById("clubEntryButton").classList.remove("active");
      document.getElementById("clubPanel").classList.remove("open");
      document.querySelector(".summary-row").style.display = "";
      document.querySelector(".list-tools").style.display = "";
      document.getElementById("routeList").style.display = "";
    });

    document.getElementById("clubEntryButton").addEventListener("click", () => {
      document.getElementById("clubEntryButton").classList.add("active");
      document.getElementById("routeEntryButton").classList.remove("active");
      document.getElementById("clubPanel").classList.add("open");
      document.querySelector(".summary-row").style.display = "none";
      document.querySelector(".list-tools").style.display = "none";
      document.getElementById("routeList").style.display = "none";
      renderClubActivities();
    });

    document.getElementById("drawerClose").addEventListener("click", closeDrawer);
    drawerBackdrop.addEventListener("click", closeDrawer);
    renderQuickActions();
    renderTopics();
    renderClubFilters();
    renderClubActivities();
    render();
