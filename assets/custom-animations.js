(() => {
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") {
    console.warn("[anim] GSAP 或 ScrollTrigger 未加载");
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

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

  function initAll(root = document) {
    initFadeUp(root);
    initHorizontal(root);

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
      .querySelectorAll("[data-gsap-horizontal]")
      .forEach((s) => s._mm && s._mm.revert());
  });
})();
