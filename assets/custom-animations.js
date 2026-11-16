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
        const viewport = section.querySelector("[data-gsap-viewport]");
        const track = section.querySelector("[data-gsap-track]");
        if (!viewport || !track) return;

        section.setAttribute("data-gsap-init", "");
        const mm = gsap.matchMedia();
        section._mm = mm;

        const query = "(min-width: 990px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";
        mm.add(query, () => {
          let tween;
          let frame = 0;
          const getDistance = () => Math.max(0, viewport.scrollWidth - viewport.clientWidth);
          const getHeaderHeight = () => document.querySelector("sticky-header")?.offsetHeight || 0;

          const stop = () => {
            if (!tween) return;
            tween.scrollTrigger?.kill();
            tween.kill();
            tween = undefined;
            section.classList.remove("is-gsap");
            viewport.scrollLeft = 0;
          };

          const update = () => {
            frame = 0;
            // Exclude the fallback scrollbar when measuring whether the cards fit.
            const height = section.offsetHeight - viewport.offsetHeight + track.offsetHeight;
            if (getDistance() <= 1 || height + getHeaderHeight() > window.innerHeight) {
              if (tween) {
                stop();
                ScrollTrigger.refresh(true);
              }
              return;
            }

            if (!tween) {
              section.classList.add("is-gsap");
              tween = gsap.fromTo(viewport, { scrollLeft: 0 }, {
                scrollLeft: getDistance,
                ease: "none",
                scrollTrigger: {
                  trigger: section,
                  start: () => "top " + getHeaderHeight() + "px",
                  end: () => "+=" + getDistance(),
                  pin: true,
                  scrub: true,
                  anticipatePin: 1,
                  invalidateOnRefresh: true,
                },
              });
            }
            ScrollTrigger.refresh(true);
          };

          const scheduleUpdate = () => {
            if (!frame) frame = requestAnimationFrame(update);
          };
          const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(scheduleUpdate) : null;
          resizeObserver?.observe(track);
          window.addEventListener("resize", scheduleUpdate, { passive: true });
          update();

          return () => {
            resizeObserver?.disconnect();
            window.removeEventListener("resize", scheduleUpdate);
            cancelAnimationFrame(frame);
            stop();
          };
        });
      });
  }
    // Bento 画廊的坐标与 CSS grid-area 一致。
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

  function bentoRect({ x, y, column, row, gap }, [rowStart, colStart, rowEnd, colEnd]) {
    const columns = colEnd - colStart;
    const rows = rowEnd - rowStart;
    return {
      x: x + (colStart - 1) * (column + gap),
      y: y + (rowStart - 1) * (row + gap),
      width: columns * column + (columns - 1) * gap,
      height: rows * row + (rows - 1) * gap,
    };
  }

  function initBento(root = document) {
    root.querySelectorAll('[data-gsap-bento-flip]:not([data-gsap-init])').forEach((section) => {
      const grid = section.querySelector('[data-gsap-bento-grid]');
      const center = section.querySelector('[data-gsap-bento-center]');
      if (!grid || !center) return;

      section.setAttribute('data-gsap-init', '');
      const media = gsap.matchMedia();
      section._mm = media;

      media.add('(width < 990px) and (prefers-reduced-motion: no-preference)', () => {
        const frame = section.querySelector('[data-bf-story-frame]');
        if (!frame) return;

        const shots = [...frame.querySelectorAll('[data-bf-shot]')];
        if (shots.length < 2) return;

        gsap.set(shots, { autoAlpha: 0 });
        gsap.set(shots[0], { autoAlpha: 1 });

        const timeline = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: frame,
            start: () => {
              const headerHeight = document.querySelector('sticky-header')?.offsetHeight || 0;
              const centeredTop = (window.innerHeight - frame.offsetHeight) / 2;
              return 'top ' + Math.round(Math.max(centeredTop, headerHeight)) + 'px';
            },
            end: () => '+=' + Math.round(window.innerHeight * (shots.length === 3 ? 0.9 : 0.65)),
            pin: true,
            scrub: true,
            anticipatePin: 1,
          },
        });

        for (const shot of shots.slice(1)) {
          if (shot.dataset.bfShot === 'craft') {
            gsap.set(shot, { clipPath: 'inset(0 100% 0 0)' });
            timeline.set(shot, { autoAlpha: 1 }, '+=0.24');
            timeline.to(shot, { clipPath: 'inset(0 0% 0 0)', duration: 0.3 }, '<');
          } else {
            timeline.to(shot, { autoAlpha: 1, duration: 0.26 }, '+=0.24');
          }
        }

        // Hold the last shot before the frame returns to the normal page flow.
        timeline.to({}, { duration: 0.3 });
      });

      media.add('(min-width: 990px) and (prefers-reduced-motion: no-preference)', () => {
        if (!center.hasAttribute('data-bf-desktop-ready')) return;
        section.classList.add('is-gsap');

        let startLayout;
        let endLayout;
        const measure = () => {
          const style = getComputedStyle(grid);
          const gap = parseFloat(style.columnGap) || 0;
          const left = parseFloat(style.paddingLeft) || 0;
          const right = parseFloat(style.paddingRight) || 0;
          const top = parseFloat(style.paddingTop) || 0;
          const bottom = parseFloat(style.paddingBottom) || 0;
          const width = section.clientWidth;
          const height = grid.clientHeight;
          const endRow = (height - gap) / 2;

          startLayout = {
            x: left,
            y: top,
            column: (grid.clientWidth - left - right - 2 * gap) / 3,
            row: (height - top - bottom - 3 * gap) / 4,
            gap,
          };
          endLayout = {
            x: -grid.offsetLeft - width - gap,
            y: -endRow - gap,
            column: width,
            row: endRow,
            gap,
          };
        };
        measure();

        const tiles = [...grid.querySelectorAll('[data-gsap-bento-item]:not([data-gsap-bento-center])')];
        const items = tiles.slice(0, BENTO_TILE_AREAS.length).map((el, index) => ({
          el,
          area: BENTO_TILE_AREAS[index],
        }));
        items.push({ el: center, area: BENTO_CENTER_AREA });

        const timeline = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: '+=100%',
            scrub: true,
            pin: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onRefreshInit: measure,
          },
        });

        for (const { el, area } of items) {
          timeline.fromTo(el, {
            x: () => bentoRect(startLayout, area).x,
            y: () => bentoRect(startLayout, area).y,
            width: () => bentoRect(startLayout, area).width,
            height: () => bentoRect(startLayout, area).height,
          }, {
            x: () => bentoRect(endLayout, area).x,
            y: () => bentoRect(endLayout, area).y,
            width: () => bentoRect(endLayout, area).width,
            height: () => bentoRect(endLayout, area).height,
          }, 0);
        }
        timeline.to(center, { borderRadius: 0 }, 0);

        return () => section.classList.remove('is-gsap');
      });
    });
  }



  
    // 效果 4：抽屉菜单项依次入场（一级、二级、三级通用）
  function initDrawerStagger(root = document) {
    root.querySelectorAll('.menu-drawer-container:not([data-gsap-init])').forEach((main) => {
      main.setAttribute('data-gsap-init', '');

      const getItems = (details) => {
        if (details === main) {
          return main.querySelectorAll('.menu-drawer__navigation > .menu-drawer__menu > li');
        }
        const panel = details.querySelector(':scope > .menu-drawer__submenu');
        if (!panel) return [];
        const list = panel.querySelector(
          ':scope > .menu-drawer__inner-submenu > .menu-drawer__menu, :scope > .menu-drawer__menu'
        );
        return list ? list.querySelectorAll(':scope > li') : [];
      };

      const observer = new MutationObserver((mutations) => {
        mutations.forEach(({ target }) => {
          const opening = target.classList.contains('menu-opening');
          if (opening === !!target._gsapOpen) return;
          target._gsapOpen = opening;

          const items = getItems(target);
          if (!items.length) return;

          if (opening) {
            gsap.fromTo(
              items,
              { opacity: 0, x: target === main ? -24 : 32 },
              {
                opacity: 1,
                x: 0,
                duration: 0.5,
                ease: 'power3.out',
                stagger: 0.06,
                delay: target === main ? 0.1 : 0.15,
                overwrite: true,
                clearProps: 'transform,opacity',
              }
            );
          } else {
            gsap.killTweensOf(items);
            gsap.set(items, { clearProps: 'transform,opacity' });
          }
        });
      });

      [main, ...main.querySelectorAll('details')].forEach((d) =>
        observer.observe(d, { attributes: true, attributeFilter: ['class'] })
      );
      main._gsapObserver = observer;
    });
  }

  // 效果 5：按钮悬停光晕，跟随鼠标
  function initHeroGlow(root = document) {
    root.querySelectorAll('.hero__button:not([data-gsap-init])').forEach((btn) => {
      btn.setAttribute('data-gsap-init', '');
      const glow = btn.querySelector('.hero__glow');
      if (!glow) return;

      const xTo = gsap.quickTo(glow, 'left', { duration: 0.3, ease: 'power3' });
      const yTo = gsap.quickTo(glow, 'top', { duration: 0.3, ease: 'power3' });

      btn.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'mouse') return;
        const r = btn.getBoundingClientRect();
        gsap.set(glow, { left: e.clientX - r.left, top: e.clientY - r.top });
        gsap.to(glow, { opacity: 1, duration: 0.2 });
      });
      btn.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        const r = btn.getBoundingClientRect();
        xTo(e.clientX - r.left);
        yTo(e.clientY - r.top);
      });
      btn.addEventListener('pointerleave', () => gsap.to(glow, { opacity: 0, duration: 0.3 }));
    });
  }


  function initAll(root = document) {
    initHorizontal(root);
    initBento(root);
    if (reduceMotion) return;
    initFadeUp(root);
    
    initDrawerStagger(root);
    initHeroGlow(root);
    // 后面的效果都在这里注册
  }

  initAll();

  // 主题编辑器里增删/刷新 section 时重新初始化
  document.addEventListener("shopify:section:load", (e) => {
    initAll(e.target);
    ScrollTrigger.refresh();
  });
  document.addEventListener("shopify:section:reorder", () => ScrollTrigger.refresh(true));
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
        e.target.querySelectorAll('.menu-drawer-container').forEach((d) => d._gsapObserver && d._gsapObserver.disconnect());
  });
})();
