(() => {
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") {
    console.warn("[anim] GSAP 或 ScrollTrigger 未加载");
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  if (typeof Flip !== "undefined") gsap.registerPlugin(Flip);
  if (typeof ExpoScaleEase !== "undefined") gsap.registerPlugin(ExpoScaleEase);

  // 尊重系统"减少动态效果"设置
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (reduceMotion) return;

  // 效果 1：滚动淡入上浮
  function initFadeUp(root = document) {
    const els = root.querySelectorAll(
      '[data-gsap="fade-up"]:not([data-gsap-init])',
    );
    if (!els.length) return;
    els.forEach((el) => el.setAttribute("data-gsap-init", ""));

    gsap.set(els, { opacity: 0, y: 40 });
    ScrollTrigger.batch(els, {
      start: "top 88%",
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.12,
          overwrite: true,
        }),
    });
  }

  // 效果 2：横向滚动画廊（pin + scrub）
  function initHorizontal(root = document) {
    root
      .querySelectorAll("[data-gsap-horizontal]:not([data-gsap-init])")
      .forEach((section) => {
        section.setAttribute("data-gsap-init", "");
        const track = section.querySelector("[data-gsap-track]");
        if (!track) return;

        const mm = gsap.matchMedia();
        section._mm = mm;

        mm.add("(min-width: 750px)", () => {
          section.classList.add("is-gsap");
          const getDistance = () => track.scrollWidth - window.innerWidth;

          gsap.to(track, {
            x: () => -getDistance(),
            ease: "none",
            scrollTrigger: {
              trigger: section,
              start: "top top",
              end: () => "+=" + getDistance(),
              pin: true,
              scrub: 1,
              anticipatePin: 1,
              invalidateOnRefresh: true,
            },
          });

          // 离开桌面断点时清理
          return () => section.classList.remove("is-gsap");
        });
      });
  }
  // 效果 3：Bento 画廊（Flip + scrub，中间图扩展到全屏）
    // 效果 3：Bento 画廊（直接补间 x/y/width/height，中间图扩展到全屏）
  // 格子编号：[起始行, 起始列, 结束行, 结束列]（结束为开区间，和 CSS grid-area 一致）
  const BENTO_TILE_AREAS = [
    [1, 1, 3, 2],
    [1, 2, 2, 3],
    [1, 3, 3, 4],
    [3, 1, 4, 2],
    [3, 3, 5, 4],
    [4, 1, 5, 2],
    [4, 2, 5, 3],
  ];
  const BENTO_CENTER_AREA = [2, 2, 4, 3];

  // 给定容器尺寸和网格参数，算出某个格子区域的矩形（网格整体在容器内居中）
  function bentoRect(W, H, colW, rowH, gap, area) {
    const [r1, c1, r2, c2] = area;
    const gridW = colW * 3 + gap * 2;
    const gridH = rowH * 4 + gap * 3;
    const x0 = (W - gridW) / 2;
    const y0 = (H - gridH) / 2;
    return {
      x: x0 + (c1 - 1) * (colW + gap),
      y: y0 + (r1 - 1) * (rowH + gap),
      width: (c2 - c1) * colW + (c2 - c1 - 1) * gap,
      height: (r2 - r1) * rowH + (r2 - r1 - 1) * gap,
    };
  }

  function initBento(root = document) {
    root.querySelectorAll('[data-gsap-bento-flip]:not([data-gsap-init])').forEach((section) => {
      section.setAttribute('data-gsap-init', '');
      const grid = section.querySelector('[data-gsap-bento-grid]');
      const center = section.querySelector('[data-gsap-bento-center]');
      const tiles = [...section.querySelectorAll('[data-gsap-bento-item]:not([data-gsap-bento-center])')];
      if (!grid || !center) return;

      const mm = gsap.matchMedia();
      section._mm = mm;

      mm.add('(min-width: 750px)', () => {
        section.classList.add('is-gsap');

        // 起点：每格 32.5vw × 23vh，间距 1vh；终点：每列 100vw，每行 49.5vh，间距 1vh
        const startRect = (area) => {
          const W = grid.clientWidth;
          const H = grid.clientHeight;
          return bentoRect(W, H, W * 0.325, H * 0.23, H * 0.01, area);
        };
        const endRect = (area) => {
          const W = grid.clientWidth;
          const H = grid.clientHeight;
          return bentoRect(W, H, W, H * 0.495, H * 0.01, area);
        };

        const items = tiles
          .slice(0, BENTO_TILE_AREAS.length)
          .map((el, i) => ({ el, area: BENTO_TILE_AREAS[i] }));
        items.push({ el: center, area: BENTO_CENTER_AREA });

        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: '+=100%',
            scrub: true,
            pin: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });

        items.forEach(({ el, area }) => {
          tl.fromTo(
            el,
            {
              x: () => startRect(area).x,
              y: () => startRect(area).y,
              width: () => startRect(area).width,
              height: () => startRect(area).height,
            },
            {
              x: () => endRect(area).x,
              y: () => endRect(area).y,
              width: () => endRect(area).width,
              height: () => endRect(area).height,
            },
            0
          );
        });

        return () => section.classList.remove('is-gsap');
      });
    });
  }

  function initAll(root = document) {
    initFadeUp(root);
    initHorizontal(root);
    initBento(root);
    // 后面的效果都在这里注册
  }

  initAll();

  // 主题编辑器里增删/刷新 section 时重新初始化
  document.addEventListener("shopify:section:load", (e) => {
    initAll(e.target);
    ScrollTrigger.refresh();
  });
  document.addEventListener("shopify:section:unload", (e) => {
    ScrollTrigger.getAll()
      .filter((st) => st.trigger && e.target.contains(st.trigger))
      .forEach((st) => st.kill());
    e.target
      .querySelectorAll("[data-gsap-horizontal], [data-gsap-bento-flip]")
      .forEach((s) => {
        s._mm && s._mm.revert();
        s._cleanup && s._cleanup();
      });
  });
})();
