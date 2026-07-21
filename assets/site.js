(() => {
  const body = document.body;
  const sizeKey = "archive-text-size";
  const sizeControls = document.querySelectorAll("[data-text-size]");
  const allowedSizes = new Set(["small", "default", "large"]);

  const applySize = (requestedSize) => {
    const size = allowedSizes.has(requestedSize) ? requestedSize : "default";
    body.dataset.textSize = size;
    sizeControls.forEach((control) => {
      control.setAttribute("aria-pressed", String(control.dataset.textSize === size));
    });
  };

  applySize(localStorage.getItem(sizeKey) || "default");
  sizeControls.forEach((control) => {
    control.addEventListener("click", () => {
      const size = control.dataset.textSize || "default";
      localStorage.setItem(sizeKey, size);
      applySize(size);
    });
  });

  const sidebarToggle = document.querySelector(".sidebar-toggle");
  const sidebar = document.querySelector(".docs-sidebar");
  const mobileSidebar = window.matchMedia("(max-width: 779px)");
  const syncSidebarAccess = () => {
    if (!sidebar) return;
    const concealed = mobileSidebar.matches && !body.classList.contains("sidebar-open");
    sidebar.toggleAttribute("inert", concealed);
    sidebar.setAttribute("aria-hidden", String(concealed));
  };
  const closeSidebar = () => {
    body.classList.remove("sidebar-open");
    sidebarToggle?.setAttribute("aria-expanded", "false");
    syncSidebarAccess();
  };

  sidebarToggle?.addEventListener("click", () => {
    const open = body.classList.toggle("sidebar-open");
    sidebarToggle.setAttribute("aria-expanded", String(open));
    syncSidebarAccess();
  });
  sidebar?.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a")) closeSidebar();
  });
  mobileSidebar.addEventListener("change", syncSidebarAccess);
  syncSidebarAccess();

  const dialog = document.querySelector("#search-dialog");
  const searchInput = document.querySelector("#dialog-search-input");
  const resultList = document.querySelector("#dialog-results");
  const resultStatus = document.querySelector("#dialog-status");
  const searchIndex = Array.isArray(window.SEARCH_INDEX) ? window.SEARCH_INDEX : [];
  const siteRoot = document.documentElement.dataset.siteRoot || "./";
  let returnFocus = null;

  const normalize = (value) => value.toLocaleLowerCase("ko-KR").replaceAll(/\s+/g, " ").trim();
  const renderResults = (query) => {
    if (!resultList || !resultStatus) return;
    const normalized = normalize(query);
    const matches = searchIndex.filter((item) => {
      if (!normalized) return true;
      return normalize(`${item.title} ${item.chapter} ${item.topic} ${item.content}`).includes(normalized);
    }).slice(0, 30);

    resultList.replaceChildren();
    matches.forEach((item) => {
      const link = document.createElement("a");
      const title = document.createElement("strong");
      const meta = document.createElement("small");
      link.className = "dialog-result";
      link.href = `${siteRoot}${item.path}`;
      title.textContent = item.title;
      meta.textContent = `${item.chapter} · ${item.date}`;
      link.append(title, meta);
      resultList.append(link);
    });
    resultStatus.textContent = `${matches.length}개 결과${matches.length === 30 ? " · 상위 30개 표시" : ""}`;
  };

  const openSearch = (trigger) => {
    if (!dialog || !searchInput || typeof dialog.showModal !== "function") return;
    returnFocus = trigger;
    dialog.showModal();
    searchInput.value = "";
    renderResults("");
    searchInput.focus();
  };

  document.querySelectorAll("[data-search-open]").forEach((trigger) => {
    trigger.addEventListener("click", () => openSearch(trigger));
  });
  document.querySelector(".dialog-close")?.addEventListener("click", () => dialog?.close());
  searchInput?.addEventListener("input", () => renderResults(searchInput.value));
  dialog?.addEventListener("close", () => returnFocus?.focus());

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
      event.preventDefault();
      openSearch(document.activeElement);
      return;
    }
    if (event.key === "Escape") closeSidebar();
  });
})();
