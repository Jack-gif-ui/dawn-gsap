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
  function initBentoFlip(root = document) {
    const sections = root.querySelectorAll(
      "[data-gsap-bento-flip]:not([data-gsap-init])",
    );
    if (!sections.length) return;
    if (typeof Flip === "undefined") {
      console.warn("[anim] Flip 未加载");
      return;
    }
    const easeName =
      typeof ExpoScaleEase !== "undefined" ? "expoScale(1, 5)" : "power2.inOut";

    sections.forEach((section) => {
      section.setAttribute("data-gsap-init", "");
      const grid = section.querySelector("[data-gsap-bento-grid]");
      const items = section.querySelectorAll("[data-gsap-bento-item]");
      if (!grid || !items.length) return;

      const desktop = window.matchMedia("(min-width: 750px)");
      let ctx = null;
      let timer;
      let lastW = window.innerWidth;
      let lastH = window.innerHeight;

      const destroy = () => {
        if (ctx) {
          ctx.revert();
          ctx = null;
        }
        grid.classList.remove("bf__grid--final");
      };

      const build = () => {
        destroy();
        if (!desktop.matches) return; // 手机端保持静态网格

        ctx = gsap.context(() => {
          // 临时加上 final 类，记录最终状态
          grid.classList.add("bf__grid--final");
          const state = Flip.getState(items);
          grid.classList.remove("bf__grid--final");

          const flip = Flip.to(state, { simple: true, ease: easeName });

          gsap
            .timeline({
              scrollTrigger: {
                trigger: section,
                start: "top top",
                end: "+=100%",
                scrub: true,
                pin: section,
              },
            })
            .add(flip);

          return () => gsap.set(items, { clearProps: "all" });
        });
      };

      // 窗口尺寸变化后重新记录状态（防抖；触屏设备只在宽度变化时重建）
      const onResize = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const w = window.innerWidth;
          const h = window.innerHeight;
          if (w === lastW && (ScrollTrigger.isTouch || h === lastH)) return;
          lastW = w;
          lastH = h;
          build();
        }, 250);
      };

      build();
      window.addEventListener("resize", onResize);

      section._cleanup = () => {
        clearTimeout(timer);
        window.removeEventListener("resize", onResize);
        destroy();
      };
    });
  }

  function initAll(root = document) {
    initFadeUp(root);
    initHorizontal(root);
    initBentoFlip(root);
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
