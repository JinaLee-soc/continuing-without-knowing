(() => {
  const body = document.body;
  const sizeKey = "archive-text-size";
  const sizeControls = document.querySelectorAll("[data-text-size]");
  const allowedSizes = new Set(["small", "default", "large"]);
  const readStoredValue = (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const storeValue = (key, value) => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  };

  const applySize = (requestedSize) => {
    const size = allowedSizes.has(requestedSize) ? requestedSize : "default";
    body.dataset.textSize = size;
    sizeControls.forEach((control) => {
      control.setAttribute("aria-pressed", String(control.dataset.textSize === size));
    });
  };

  applySize(readStoredValue(sizeKey) || "default");
  sizeControls.forEach((control) => {
    control.addEventListener("click", () => {
      const size = control.dataset.textSize || "default";
      storeValue(sizeKey, size);
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

  const config = window.ARCHIVE_CONFIG || {};
  const supabaseUrl = typeof config.supabaseUrl === "string" ? config.supabaseUrl : "";
  const supabaseAnonKey =
    typeof config.supabaseAnonKey === "string" ? config.supabaseAnonKey : "";
  const callArchiveApi = async (functionName, payload, options = {}) => {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: options.keepalive === true,
    });
    if (!response.ok) throw new Error(`archive API returned ${response.status}`);
    return response.json();
  };

  document.querySelectorAll("[data-ebook-resource]").forEach((resource) => {
    const ebookDownloadButton = resource.querySelector("[data-ebook-download]");
    const ebookDownloadCounter = resource.querySelector("[data-ebook-download-counter]");
    const ebookDownloadCount = resource.querySelector("[data-ebook-download-count]");
    const ebookKey = ebookDownloadButton?.dataset.ebookKey || "";
    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !ebookDownloadButton ||
      !ebookDownloadCounter ||
      !ebookDownloadCount ||
      !ebookKey
    ) {
      return;
    }

    const applyDownloadCount = (payload) => {
      const count = Number(payload.count);
      if (!Number.isFinite(count)) return;
      ebookDownloadCount.textContent = new Intl.NumberFormat("ko-KR").format(count);
      ebookDownloadCounter.hidden = false;
    };

    callArchiveApi("get_ebook_download_count", { target_book_key: ebookKey })
      .then(applyDownloadCount)
      .catch(() => {
        ebookDownloadCounter.hidden = true;
      });

    ebookDownloadButton.addEventListener("click", () => {
      callArchiveApi(
        "register_ebook_download",
        { target_book_key: ebookKey },
        { keepalive: true },
      )
        .then(applyDownloadCount)
        .catch(() => {});
    });
  });

  const engagement = document.querySelector("[data-post-engagement]");
  if (!engagement) return;

  const track = (eventName, eventData) => {
    if (window.umami && typeof window.umami.track === "function") {
      window.umami.track(eventName, eventData);
    }
  };

  const recordedDepths = new Set();
  const depthMilestones = [25, 50, 75, 100];
  let scrollFramePending = false;
  const recordScrollDepth = () => {
    scrollFramePending = false;
    const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
    const depth = scrollableHeight <= 0 ? 100 : (window.scrollY / scrollableHeight) * 100;
    depthMilestones.forEach((milestone) => {
      if (depth >= milestone && !recordedDepths.has(milestone)) {
        recordedDepths.add(milestone);
        track("Post scroll", { depth: milestone });
      }
    });
  };
  window.addEventListener(
    "scroll",
    () => {
      if (scrollFramePending) return;
      scrollFramePending = true;
      window.requestAnimationFrame(recordScrollDepth);
    },
    { passive: true },
  );
  recordScrollDepth();

  const actionStatus = engagement.querySelector("[data-post-action-status]");
  const setActionStatus = (message) => {
    if (actionStatus) actionStatus.textContent = message;
  };
  engagement.querySelector("[data-share-post]")?.addEventListener("click", async () => {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: document.title, url: window.location.href });
        setActionStatus("공유 창을 열었습니다.");
      } else if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(window.location.href);
        setActionStatus("링크를 복사했습니다.");
      } else {
        setActionStatus("주소창의 링크를 복사해 주세요.");
        return;
      }
      track("Post share");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setActionStatus("공유하지 못했습니다. 다시 시도해 주세요.");
      }
    }
  });

})();
