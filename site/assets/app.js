const routes = window.SHANJI_ROUTES;


    const clubActivities = window.SHANJI_CLUB_ACTIVITIES;


    const state = {
      query: "",
      filters: { region: null, difficulty: null, theme: null, audience: null },
      maxDistance: 25,
      sort: "recommended",
      selectedId: null,
      clubFilter: "全部"
    };

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
    const drawer = document.getElementById("drawer");
    const drawerBackdrop = document.getElementById("drawerBackdrop");
    const drawerBody = document.getElementById("drawerBody");
    const drawerCover = document.getElementById("drawerCover");

    function routeOsmUrl(route) {
      if (!route.location) return "https://www.openstreetmap.org/";
      return `https://www.openstreetmap.org/?mlat=${route.location.lat}&mlon=${route.location.lng}#map=14/${route.location.lat}/${route.location.lng}`;
    }

    function routeGpxBlock(route) {
      if (route.gpx?.downloadable) {
        const href = route.gpx.homeFile || route.gpx.file || "#";
        return `<p>${route.gpx.note}</p><p><a class="download-link" href="${href}" download>下载轨迹文件</a></p>`;
      }
      return `<p>${route.gpx?.note || "暂无可下载轨迹。"}</p>`;
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
      resultCount.textContent = `当前显示 ${filtered.length} 条路线`;
      mapCount.textContent = `${filtered.length}条`;
    }

    function renderRoutes(filtered) {
      routeList.innerHTML = "";
      if (!filtered.length) {
        routeList.innerHTML = `<div class="empty-state">没有找到匹配路线。可以放宽距离、难度或关键词。</div>`;
        return;
      }

      filtered.forEach(route => {
        const card = document.createElement("article");
        card.className = `route-card ${state.selectedId === route.id ? "active" : ""}`;
        card.tabIndex = 0;
        card.innerHTML = `
          <div class="route-thumb" style="--thumb:${route.color}"></div>
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
              <span class="meta-pill">${route.ops?.publicStatus || route.status}</span>
              <span class="meta-pill">复核${route.review?.score ?? 0}分</span>
              <span class="meta-pill">${route.review?.level || "待复核"}</span>
              <span class="meta-pill">${route.ops?.bestSeason?.[0] || "季节待复核"}</span>
            </div>
            <p class="route-desc">${route.highlight}</p>
          <div class="route-warning">待复核：${route.verify}</div>
          <a class="inline-link" href="./routes/${route.id}.html" onclick="event.stopPropagation()">独立详情页</a>
          </div>
        `;
        card.addEventListener("click", () => openDrawer(route.id));
        card.addEventListener("keydown", event => {
          if (event.key === "Enter") openDrawer(route.id);
        });
        routeList.appendChild(card);
      });
    }

    function renderMap(filtered) {
      mapCanvas.innerHTML = "";
      filtered.forEach(route => {
        const point = document.createElement("button");
        point.className = `map-point ${state.selectedId === route.id ? "active" : ""}`;
        point.style.setProperty("--x", route.x);
        point.style.setProperty("--y", route.y);
        point.title = route.name;
        point.setAttribute("aria-label", route.name);
        point.addEventListener("click", () => openDrawer(route.id));
        mapCanvas.appendChild(point);
      });
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
          render();
        });
        container.appendChild(button);
      });
    }

    function activityMatches(activity) {
      if (state.clubFilter === "全部") return true;
      if (state.clubFilter === "报名中") return activity.status === "报名中";
      if (state.clubFilter === "即将满员") return activity.status === "余位紧张";
      if (state.clubFilter === "已审核") return activity.audit === "已审核";
      return activity.tags.includes(state.clubFilter) || activity.difficulty === state.clubFilter;
    }

    function statusClass(status) {
      if (status === "余位紧张") return "hot";
      if (status === "已截止" || status === "已满员") return "closed";
      return "";
    }

    function renderClubFilters() {
      const filters = ["全部", "报名中", "即将满员", "已审核", "新手", "亲子", "看海", "进阶", "避暑"];
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
          <strong>${activity.title}</strong>
          <span class="club-status ${statusClass(activity.status)}">${activity.status}</span>
          <div class="club-meta">
            <span class="meta-pill">${activity.date}</span>
            <span class="meta-pill">${activity.club}</span>
            <span class="meta-pill">${activity.region}</span>
            <span class="meta-pill">${activity.difficulty}</span>
            <span class="meta-pill">${activity.distance}km</span>
            <span class="meta-pill">爬升${activity.ascent}m</span>
          </div>
          <p>${activity.meeting}｜${activity.transport}｜费用：${activity.fee}</p>
          <p>${activity.note}</p>
          <p>来源：${activity.sourceName || "待补充"}｜发布：${activity.publishedAt || "待补充"}｜截止：${activity.deadline || "待补充"}</p>
          <div class="club-actions">
            <span class="club-status">${activity.officialStatus || activity.audit}</span>
            <a href="./activities/${activity.id}.html" aria-label="${activity.title}详情页">活动详情页</a>
          </div>
          ${linkedRoute ? `<p style="margin-top:8px">关联路线：${linkedRoute.name}</p>` : ""}
        `;
        container.appendChild(card);
      });
    }

    function openDrawer(routeId) {
      const route = routes.find(item => item.id === routeId);
      if (!route) return;
      state.selectedId = route.id;
      drawerCover.style.setProperty("--drawer-thumb", route.color);
      drawerBody.innerHTML = `
        <span class="status-chip">${route.id} · ${route.region}</span>
        <h2>${route.name}</h2>
        <p class="route-desc">${route.summary}</p>
        <div class="detail-grid">
          <div class="detail-stat"><strong>${route.distance}km</strong><span>距离</span></div>
          <div class="detail-stat"><strong>${route.time}h</strong><span>预计用时</span></div>
          <div class="detail-stat"><strong>${route.ascent}m</strong><span>累计爬升</span></div>
          <div class="detail-stat"><strong>${route.difficulty}</strong><span>难度</span></div>
          <div class="detail-stat"><strong>${route.type}</strong><span>路线类型</span></div>
          <div class="detail-stat"><strong>${route.transitFriendly ? "较方便" : "需规划"}</strong><span>交通</span></div>
          <div class="detail-stat"><strong>${route.ops?.publicStatus || "待复核"}</strong><span>公开状态</span></div>
          <div class="detail-stat"><strong>${route.ops?.bestSeason?.[0] || "待复核"}</strong><span>适合季节</span></div>
          <div class="detail-stat"><strong>${route.review?.level || "待复核"}</strong><span>复核等级</span></div>
          <div class="detail-stat"><strong>${route.review?.score ?? 0}分</strong><span>复核完成度</span></div>
        </div>
        <div class="detail-section">
          <h3>复核状态</h3>
          <p>阻塞项：${route.review?.blockers || "待生成"}。下一步：${route.review?.nextAction || "补齐复核字段"}。</p>
          <div class="review-check-grid">
            ${(route.review?.checks || []).map(([label, status]) => `<span class="${status === "已完成" ? "review-ok" : "review-wait"}">${label}：${status}</span>`).join("")}
          </div>
        </div>
        <div class="detail-section">
          <h3>路线亮点</h3>
          <p>${route.highlight}</p>
        </div>
        <div class="detail-section">
          <h3>标签</h3>
          <p>${[...route.themes, ...route.audience].join("、")}</p>
        </div>
        <div class="detail-section">
          <h3>风险提示</h3>
          <p>${route.warning}</p>
        </div>
        <div class="detail-section">
          <h3>发布前必须复核</h3>
          <ul>
            <li>${route.verify}</li>
            <li>起点、终点、距离、累计爬升和最新开放状态。</li>
            <li>交通返程、补给厕所、下撤点和雨天风险。</li>
          </ul>
        </div>
        <div class="detail-section">
          <h3>维护字段</h3>
          <ul>
            <li>起点：${route.ops?.startPoint || "待补充"}</li>
            <li>终点：${route.ops?.endPoint || "待补充"}</li>
            <li>停车：${route.ops?.parking || "待补充"}</li>
            <li>公共交通：${route.ops?.publicTransit || route.transit}</li>
            <li>厕所：${route.ops?.toilet || "待补充"}</li>
            <li>补给：${route.ops?.supply || "待补充"}</li>
            <li>下撤：${route.ops?.exitPoints || "待补充"}</li>
          </ul>
        </div>
        <div class="detail-section">
          <h3>地图点位</h3>
          <p>${route.location ? `${route.location.lat}, ${route.location.lng}（${route.location.accuracy}）` : "待补充。"} V1.4 仍需按复核体系确认点位，正式发布前需要复核。</p>
          <p><a class="inline-link" href="${routeOsmUrl(route)}" target="_blank" rel="noreferrer">在 OpenStreetMap 查看近似点位</a></p>
        </div>
        <div class="detail-section">
          <h3>GPX轨迹</h3>
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
      render();
    });

    sortSelect.addEventListener("change", event => {
      state.sort = event.target.value;
      render();
    });

    document.getElementById("distanceRange").addEventListener("input", event => {
      state.maxDistance = Number(event.target.value);
      document.getElementById("distanceValue").textContent = `${state.maxDistance}km`;
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
