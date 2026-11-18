const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

(() => {
  const name = document.getElementById('name');
  const layer = document.getElementById('namelayer');
  const hint = document.getElementById('langhint');
  if (!name) return;
  const forms = [
    { t: 'Gio Huh', h: 'EN' },
    { t: '허지오',   h: '한' },
    { t: '许知悟',   h: '中' },
  ];
  let i = 0, busy = false;
  function advance() {
    if (busy) return;
    i = (i + 1) % forms.length;
    const f = forms[i];
    if (reduce) { layer.textContent = f.t; hint.textContent = f.h; return; }
    busy = true;
    name.dataset.anim = '1';
    setTimeout(() => {
      layer.textContent = f.t; hint.textContent = f.h;
      name.dataset.anim = '0';
      setTimeout(() => { busy = false; }, 280);
    }, 240);
  }
  name.addEventListener('pointerenter', advance);
  name.addEventListener('click', advance);
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance(); } });
})();

let videosPaused = reduce;
const visibleVideos = new Set();
const videoToggle = document.getElementById('video-toggle');
const videoLightbox = document.getElementById('video-lightbox');
const syncVideo = (video) => {
  if (!videosPaused && !document.hidden && !videoLightbox?.open && visibleVideos.has(video)
      && !video.closest('[hidden]')) {
    video.preload = 'auto';
    video.play().catch(() => {});
  }
  else video.pause();
};
const syncVideos = () => document.querySelectorAll('.viz video').forEach(syncVideo);
const updateVideoToggle = () => {
  if (!videoToggle) return;
  videoToggle.textContent = videosPaused ? '[play videos]' : '[pause videos]';
  videoToggle.setAttribute('aria-label', videosPaused ? 'Play research videos' : 'Pause research videos');
};
updateVideoToggle();
videoToggle?.addEventListener('click', () => {
  videosPaused = !videosPaused;
  updateVideoToggle();
  syncVideos();
});
document.addEventListener('visibilitychange', syncVideos);
const vizIO = ('IntersectionObserver' in window)
  ? new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting && e.intersectionRatio >= 0.15) visibleVideos.add(e.target);
      else visibleVideos.delete(e.target);
      syncVideo(e.target);
    }), { threshold: 0.15 })
  : null;

const refreshVisibleVideos = () => {
  document.querySelectorAll('.viz video[src]').forEach((video) => {
    const rect = video.getBoundingClientRect();
    if (rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight) visibleVideos.add(video);
    else visibleVideos.delete(video);
  });
  syncVideos();
};
if (!vizIO) {
  window.addEventListener('scroll', refreshVisibleVideos, { passive: true });
  window.addEventListener('resize', refreshVisibleVideos);
}

const expandedVideo = document.getElementById('expanded-video');
let expandedSource = null;
let expandTrigger = null;
let resumeExpanded = false;
let lightboxMotion = null;
let headingMotion = null;
let closingVideo = false;
const lightboxHeading = videoLightbox?.querySelector('.video-lightbox-heading');
const thumbnailTransform = () => {
  const from = expandedSource.getBoundingClientRect();
  const to = expandedVideo.getBoundingClientRect();
  const zoom = to.width / expandedVideo.offsetWidth || 1;
  return `translate(${(from.left - to.left) / zoom}px, ${(from.top - to.top) / zoom}px) scale(${from.width / to.width}, ${from.height / to.height})`;
};
const openVideo = (source, trigger, title) => {
  if (!videoLightbox || !expandedVideo || videoLightbox.open) return;
  expandedSource = source;
  expandTrigger = trigger;
  const startTime = source.currentTime;
  document.getElementById('video-lightbox-title').textContent = title;
  expandedVideo.muted = source.muted;
  expandedVideo.playbackRate = source.playbackRate;
  expandedVideo.width = source.videoWidth;
  expandedVideo.height = source.videoHeight;

  try {
    const frame = document.createElement('canvas');
    frame.width = source.videoWidth;
    frame.height = source.videoHeight;
    frame.getContext('2d').drawImage(source, 0, 0);
    expandedVideo.poster = frame.toDataURL('image/jpeg', 0.85);
  } catch { expandedVideo.removeAttribute('poster'); }
  expandedVideo.onloadedmetadata = () => {
    expandedVideo.width = expandedVideo.videoWidth;
    expandedVideo.height = expandedVideo.videoHeight;
    expandedVideo.currentTime = Math.min(startTime, expandedVideo.duration || startTime);

    if (videoLightbox.open && !document.hidden) expandedVideo.play().catch(() => {});
  };
  expandedVideo.src = source.currentSrc || source.src;
  videoLightbox.showModal();
  document.documentElement.classList.add('video-expanded');
  syncVideos();
  if (!reduce) {
    lightboxMotion = expandedVideo.animate([
      { transform: thumbnailTransform() }, { transform: 'none' },
    ], { duration: 280, easing: 'cubic-bezier(.2,.7,.2,1)' });
    headingMotion = lightboxHeading.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, delay: 60, fill: 'backwards' });
  }
};
const closeVideo = async () => {
  if (!videoLightbox?.open || closingVideo) return;
  closingVideo = true;
  const currentTransform = getComputedStyle(expandedVideo).transform;
  const currentHeadingOpacity = getComputedStyle(lightboxHeading).opacity;
  lightboxMotion?.cancel();
  headingMotion?.cancel();
  if (!reduce && expandedSource) {
    videoLightbox.classList.add('is-closing');
    lightboxMotion = expandedVideo.animate([
      { transform: currentTransform }, { transform: thumbnailTransform() },
    ], { duration: 220, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    headingMotion = lightboxHeading.animate([{ opacity: currentHeadingOpacity }, { opacity: 0 }], { duration: 120, fill: 'forwards' });
    await lightboxMotion.finished.catch(() => {});
  }
  videoLightbox.close();
};
document.getElementById('video-lightbox-close')?.addEventListener('click', closeVideo);
videoLightbox?.addEventListener('cancel', (event) => { event.preventDefault(); closeVideo(); });
let backdropPressed = false;
videoLightbox?.addEventListener('pointerdown', (event) => {
  const bounds = videoLightbox.getBoundingClientRect();
  backdropPressed = event.target === videoLightbox &&
    (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom);
});
videoLightbox?.addEventListener('click', (event) => {
  if (backdropPressed && event.target === videoLightbox) closeVideo();
  backdropPressed = false;
});
videoLightbox?.addEventListener('close', () => {
  lightboxMotion?.cancel();
  headingMotion?.cancel();
  videoLightbox.classList.remove('is-closing');
  closingVideo = false;
  expandedVideo.pause();
  if (expandedSource && Number.isFinite(expandedVideo.currentTime)) expandedSource.currentTime = expandedVideo.currentTime;
  expandedVideo.onloadedmetadata = null;
  expandedVideo.removeAttribute('src');
  expandedVideo.removeAttribute('poster');
  expandedVideo.load();
  expandedSource = null;
  resumeExpanded = false;
  document.documentElement.classList.remove('video-expanded');
  syncVideos();
  expandTrigger?.focus({ preventScroll: true });
});
document.addEventListener('visibilitychange', () => {
  if (!videoLightbox?.open) return;
  if (document.hidden) {
    resumeExpanded = !expandedVideo.paused;
    expandedVideo.pause();
  } else if (resumeExpanded) {
    resumeExpanded = false;
    expandedVideo.play().catch(() => {});
  }
});

const pendingMedia = new Map();
const loadIO = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        if (!isIntersecting || target.closest('[hidden]')) return;
        pendingMedia.get(target)?.();
        pendingMedia.delete(target);
        loadIO.unobserve(target);
      });
    }, { rootMargin: window.matchMedia('(max-width: 600px)').matches ? '400px 0px' : '600px 0px' })
  : null;

document.querySelectorAll('.viz[data-paper]:not([data-static])').forEach((viz) => {
  const name = viz.dataset.paper;
  const title = viz.closest('article')?.querySelector('.ttl, .pt')?.textContent.trim() || name;
  const video = document.createElement('video');
  Object.assign(video, { muted: true, loop: true, playsInline: true, preload: 'none' });
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.className = 'preview-video';
  viz.appendChild(video);
  let shown = false;
  let fade = null;
  video.addEventListener('playing', () => {
    fade?.cancel();
    if (!reduce) fade = video.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
  });
  video.addEventListener('loadeddata', () => {
    video.classList.add('is-ready');
    if (!shown) {
      shown = true;
      viz.classList.add('has-video');
      const expand = document.createElement('button');
      expand.type = 'button';
      expand.className = 'video-expand';
      expand.setAttribute('aria-label', `Expand video: ${title}`);
      expand.setAttribute('aria-haspopup', 'dialog');
      const hint = document.createElement('span');
      hint.textContent = '[expand]';
      hint.setAttribute('aria-hidden', 'true');
      expand.appendChild(hint);
      expand.addEventListener('click', () => openVideo(video, expand, title));
      viz.appendChild(expand);
      if (videoToggle) videoToggle.hidden = false;
    }
    syncVideo(video);
  });
  video.addEventListener('error', () => {
    visibleVideos.delete(video);
    vizIO?.unobserve(video);
    viz.querySelector('.video-expand')?.remove();
    video.remove();
  }, { once: true });
  const load = () => {
    video.preload = 'metadata';
    video.src = `./assets/${name}.mp4`;
    video.load();
    if (vizIO) vizIO.observe(video); else refreshVisibleVideos();
  };
  if (loadIO && name !== 'homebody') {
    pendingMedia.set(viz, load);
    loadIO.observe(viz);
  } else load();
});

(() => {
  const details = document.querySelector('.background-details');
  if (!details) return;
  const summary = details.querySelector('summary');
  const copy = details.querySelector('.background-copy');
  let motion = null;
  let expanded = details.open;
  const label = () => summary.setAttribute('aria-label', expanded ? 'Show less background' : 'Show more background');
  label();
  summary.addEventListener('click', (event) => {
    event.preventDefault();
    const from = details.open ? copy.offsetHeight : 0;
    const opacity = details.open ? getComputedStyle(copy).opacity : '0';
    motion?.cancel();
    expanded = !expanded;
    label();
    copy.inert = !expanded;
    if (reduce) { details.open = expanded; return; }
    details.classList.toggle('is-closing', !expanded);
    details.open = true;
    copy.style.overflow = 'hidden';
    const animation = copy.animate([
      { height: `${from}px`, opacity },
      { height: `${expanded ? copy.scrollHeight : 0}px`, opacity: expanded ? 1 : 0 },
    ], { duration: 260, easing: 'cubic-bezier(.2,.7,.2,1)' });
    motion = animation;
    animation.finished.then(() => {
      if (motion !== animation) return;
      details.open = expanded;
      details.classList.remove('is-closing');
      copy.style.overflow = '';
      motion = null;
    }).catch(() => {});
  });
})();

(() => {
  const tabs = [...document.querySelectorAll('.tab')];
  const panels = [...document.querySelectorAll('.tabpanel')];
  if (!tabs.length || !panels.length) return;
  const tablist = tabs[0].parentElement;
  const underline = document.createElement('span');
  underline.className = 'tab-indicator';
  underline.setAttribute('aria-hidden', 'true');
  tablist.appendChild(underline);
  tablist.classList.add('has-indicator');
  const panelGroup = document.createElement('div');
  panelGroup.className = 'works-panels';
  panels[0].before(panelGroup);
  panels.forEach((panel) => panelGroup.appendChild(panel));
  let active = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true') || tabs[0];
  let motions = [];
  const positionIndicator = () => {
    underline.style.width = `${active.offsetWidth}px`;
    underline.style.transform = `translateX(${active.offsetLeft}px)`;
  };
  const select = (tab) => {
    if (tab === active) return;
    const zoom = panelGroup.getBoundingClientRect().width / panelGroup.offsetWidth || 1;
    const oldHeight = panelGroup.getBoundingClientRect().height / zoom;
    motions.forEach((motion) => motion.cancel());
    active = tab;
    tabs.forEach((item) => {
      item.setAttribute('aria-selected', String(item === active));
      item.tabIndex = item === active ? 0 : -1;
    });
    panels.forEach((panel) => { panel.hidden = panel.dataset.panel !== active.dataset.tab; });
    positionIndicator();
    if (vizIO) syncVideos(); else refreshVisibleVideos();
    const panel = panels.find((item) => !item.hidden);
    if (!reduce) {
      const easing = 'cubic-bezier(.2,.7,.2,1)';
      motions = [
        panel.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing }),
        panelGroup.animate([{ height: `${oldHeight}px` }, { height: `${panelGroup.offsetHeight}px` }], { duration: 280, easing }),
      ];
    }
  };
  tabs.forEach((tab, index) => {
    const panel = panels.find((item) => item.dataset.panel === tab.dataset.tab);
    tab.id = `works-tab-${tab.dataset.tab}`;
    tab.tabIndex = tab === active ? 0 : -1;
    panel.id = `works-panel-${tab.dataset.tab}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    tab.setAttribute('aria-controls', panel.id);
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (event) => {
      const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
      if (next === null) return;
      event.preventDefault();
      tabs[next].focus();
      select(tabs[next]);
    });
  });
  positionIndicator();
  window.addEventListener('resize', positionIndicator);
  document.fonts?.ready.then(positionIndicator);
})();

(() => {
  const list = document.getElementById('news-list');
  const btn = document.getElementById('news-toggle');
  if (!list || !btn) return;
  const DUR = 260, STEP = 45, EASE = 'cubic-bezier(.2,.6,.2,1)';
  const SHIFT = 'translateY(-4px)';
  const frames = [{ opacity: 0, transform: SHIFT }, { opacity: 1, transform: 'none' }];
  const enter = (li, i) => li.animate(
    frames, { duration: DUR, easing: EASE, fill: 'backwards', delay: i * STEP },
  );
  let running = null;

  if (!reduce) [...list.children].slice(0, 3).forEach(enter);

  const extras = [...list.children].slice(3);
  if (!extras.length) { btn.hidden = true; return; }

  btn.addEventListener('click', () => {
    const expanding = list.classList.contains('collapsed');
    btn.textContent = expanding ? '[less]' : '[more]';
    btn.setAttribute('aria-label', expanding ? 'Show less news' : 'Show more news');
    btn.setAttribute('aria-expanded', String(expanding));

    if (running) { running.forEach((a) => a.cancel()); running = null; }
    if (reduce) { list.classList.toggle('collapsed', !expanding); return; }

    if (expanding) list.classList.remove('collapsed');
    const anims = expanding
      ? extras.map(enter)
      : extras.map((li, i) => li.animate([...frames].reverse(),
          { duration: DUR, easing: EASE, fill: 'forwards',
            delay: (extras.length - 1 - i) * STEP }));
    running = anims;

    Promise.all(anims.map((a) => a.finished)).then(() => {
      if (running !== anims) return;
      if (!expanding) list.classList.add('collapsed');
      anims.forEach((a) => a.cancel());
      running = null;
    }).catch(() => {});
  });
})();

const y = document.getElementById('year');
if (y) y.textContent = '© ' + new Date().getFullYear();

if (['geo-179.github.io', 'giohuh.com', 'www.giohuh.com'].includes(window.location.hostname)) {
  window.sc_project = 13367803;
  window.sc_invisible = 1;
  window.sc_security = 'abfb94d7';
  const tracker = document.createElement('script');
  tracker.src = 'https://www.statcounter.com/counter/counter.js';
  tracker.async = true;
  document.head.appendChild(tracker);
}
