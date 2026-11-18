(() => {
  "use strict";

  function setupAbstract() {
    const toggle = document.querySelector("[data-abstract-toggle]");
    if (!toggle) return;

    const parts = toggle.getAttribute("aria-controls").split(" ")
      .map((id) => document.getElementById(id));
    const label = toggle.querySelector("span");
    const setExpanded = (expanded) => {
      parts.forEach((part) => { part.hidden = !expanded; });
      toggle.setAttribute("aria-expanded", String(expanded));
      label.textContent = expanded ? "Show less" : "Show more";
    };

    setExpanded(false);
    toggle.hidden = false;
    toggle.addEventListener("click", () => setExpanded(toggle.getAttribute("aria-expanded") !== "true"));
  }

  function setupDialogDismissal(dialog) {
    dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const { left, right, top, bottom } = dialog.getBoundingClientRect();
      if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) {
        dialog.close();
      }
    });
    dialog.addEventListener("close", () => document.body.classList.remove("dialog-open"));
  }

  function setupTaskVideos() {
    const dialog = document.querySelector(".video-dialog");
    const canEnlarge = typeof dialog?.showModal === "function";
    const enlarged = canEnlarge ? dialog.querySelector("video") : null;
    let activeClip;

    // Keep one video playing at a time.
    document.querySelectorAll("video").forEach((video) => {
      video.addEventListener("play", () => {
        document.querySelectorAll("video").forEach((other) => {
          if (other !== video) other.pause();
        });
      });
    });

    document.querySelectorAll(".task-card").forEach((card) => {
      const media = card.querySelector(".task-media");
      const video = media.querySelector("video");
      const poster = media.querySelector("img");
      const placeholder = media.querySelector(".video-placeholder");
      const opener = media.querySelector("[data-video-enlarge]");
      const speedBadge = media.querySelector(".video-speed");

      const showFallback = () => {
        video.remove();
        poster.hidden = false;
        placeholder.hidden = false;
        speedBadge.hidden = true;
        opener.hidden = true;
        if (activeClip?.video === video && dialog.open) dialog.close();
      };
      video.addEventListener("error", showFallback, { once: true });
      if (video.error) {
        showFallback();
        return;
      }
      if (!canEnlarge) return;

      opener.hidden = false;
      opener.addEventListener("click", () => {
        if (activeClip) return;
        const position = video.currentTime;
        const wasPlaying = !video.paused && !video.ended;
        const clip = { video, opener, ready: false };
        activeClip = clip;
        video.pause();

        dialog.querySelector("h3").textContent = `${card.querySelector("h3").textContent} demonstration`;
        const badge = dialog.querySelector(".video-speed");
        badge.textContent = speedBadge.textContent;
        badge.setAttribute("aria-label", speedBadge.getAttribute("aria-label"));
        badge.hidden = speedBadge.hidden;
        enlarged.setAttribute("aria-label", video.getAttribute("aria-label"));
        enlarged.poster = video.poster;
        enlarged.src = video.currentSrc || video.src;
        enlarged.playbackRate = video.playbackRate;
        enlarged.muted = video.muted;
        enlarged.volume = video.volume;

        const syncPlayback = () => {
          if (!dialog.open || activeClip !== clip) return;
          enlarged.currentTime = position;
          clip.ready = true;
          enlarged.onloadedmetadata = null;
          if (wasPlaying) enlarged.play().catch(() => {});
        };
        dialog.showModal();
        document.body.classList.add("dialog-open");
        if (enlarged.readyState >= HTMLMediaElement.HAVE_METADATA) syncPlayback();
        else enlarged.onloadedmetadata = syncPlayback;
      });
    });

    if (!canEnlarge) return;
    setupDialogDismissal(dialog);
    dialog.addEventListener("close", () => {
      const clip = activeClip;
      activeClip = undefined;
      enlarged.onloadedmetadata = null;
      const wasPlaying = !enlarged.paused && !enlarged.ended;
      enlarged.pause();
      if (clip?.ready && !clip.video.error) {
        clip.video.currentTime = enlarged.currentTime;
        clip.video.playbackRate = enlarged.playbackRate;
        if (wasPlaying) clip.video.play().catch(() => {});
      }
      enlarged.removeAttribute("src");
      enlarged.load();
      clip?.opener.focus({ preventScroll: true });
    });
  }

  function setupBenchmarkTabs() {
    document.querySelectorAll("[data-tabs]").forEach((group) => {
      const tablist = group.querySelector("[role='tablist']");
      const tabs = [...tablist.querySelectorAll("[role='tab']")].map((button) => ({
        button,
        panel: document.getElementById(button.getAttribute("aria-controls")),
      }));
      const select = (activeIndex, focus = false) => {
        tabs.forEach(({ button, panel }, index) => {
          const active = index === activeIndex;
          button.setAttribute("aria-selected", String(active));
          button.tabIndex = active ? 0 : -1;
          panel.hidden = !active;
        });
        if (focus) tabs[activeIndex].button.focus();
      };
      tabs.forEach(({ button, panel }, index) => {
        panel.setAttribute("role", "tabpanel");
        panel.setAttribute("aria-labelledby", button.id);
        panel.tabIndex = 0;
        button.addEventListener("click", () => select(index));
        button.addEventListener("keydown", (event) => {
          let next;
          if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
          if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
          if (event.key === "Home") next = 0;
          if (event.key === "End") next = tabs.length - 1;
          if (next !== undefined) {
            event.preventDefault();
            select(next, true);
          }
        });
      });
      group.classList.add("tabs-enhanced");
      tablist.hidden = false;
      select(0);
    });
  }

  function setupFigureDialog() {
    const dialog = document.querySelector(".figure-dialog");
    if (typeof dialog?.showModal !== "function") return;

    const enlarged = dialog.querySelector(".dialog-image");
    const original = dialog.querySelector(".dialog-original-link");
    const description = dialog.querySelector(".dialog-caption");
    let opener;
    document.querySelectorAll("[data-lightbox]").forEach((link) => {
      link.addEventListener("click", (event) => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        opener = link;
        const image = link.querySelector("img");
        enlarged.src = link.href;
        enlarged.alt = image.alt;
        original.href = link.href;
        const caption = link.closest("figure")?.querySelector("figcaption")?.cloneNode(true);
        caption?.querySelector(".figure-scroll-note")?.remove();
        description.textContent = caption?.textContent.trim() || image.alt;
        dialog.showModal();
        document.body.classList.add("dialog-open");
      });
    });
    setupDialogDismissal(dialog);
    dialog.addEventListener("close", () => opener?.focus({ preventScroll: true }));
  }

  function setupNavigation() {
    const header = document.querySelector(".site-header");
    const navigation = [...header.querySelectorAll(".nav-links a")].map((link) => ({
      link,
      section: document.getElementById(link.hash.slice(1)),
    })).filter(({ section }) => section);
    let frame;
    const update = () => {
      frame = undefined;
      const readingLine = header.offsetHeight + window.innerHeight * .2;
      let current;
      navigation.forEach(({ link, section }) => {
        if (section.getBoundingClientRect().top <= readingLine) current = link;
      });
      navigation.forEach(({ link }) => {
        const active = link === current;
        link.classList.toggle("is-active", active);
        if (active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    };
    const scheduleUpdate = () => {
      if (frame === undefined) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    update();
  }

  setupAbstract();
  setupTaskVideos();
  setupBenchmarkTabs();
  setupFigureDialog();
  setupNavigation();
})();
