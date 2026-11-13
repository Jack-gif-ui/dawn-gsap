(() => {
  if (window.__siteDrawerInit) return;
  window.__siteDrawerInit = true;

  const root = document.documentElement;
  const LOCK = 'site-drawer-open';
  const mobile = window.matchMedia('(max-width: 989px)');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let closing = false;
  let downTarget = null;

  const getDialog = () => document.getElementById('SiteDrawer');

  const lock = () => {
    // 先量出滚动条宽度，锁定后用同样宽度补上，页面不会跳
    const bar = window.innerWidth - root.clientWidth;
    root.style.setProperty('--site-drawer-scrollbar', (bar > 0 ? bar : 0) + 'px');
    root.classList.add(LOCK);
  };
  const unlock = () => {
    root.classList.remove(LOCK);
    root.style.removeProperty('--site-drawer-scrollbar');
  };

  // ===== 人物卡片：无缝循环、匀速向左自动滚动 =====
  const players = new WeakMap();

  const setupPeople = (row) => {
    if (players.has(row)) return players.get(row);

    const cards = [...row.children];
    const autoplay = row.dataset.autoplay !== 'false';
    const speed = parseFloat(row.dataset.speed) || 40; // 每秒像素
    const player = { running: false, raf: 0, last: 0, paused: false, cloned: false, pos: 0, lastSet: 0 };

    // 滚动由我们自己每一帧驱动：不能有吸附，也不能有平滑滚动，
    // 否则每一帧的小位移会被吸附点拉回去，或被平滑动画吞掉
    row.style.scrollSnapType = 'none';
    row.style.scrollBehavior = 'auto';

    // 原来那一份卡片的总宽度（含卡片之间的间距）
    const loopWidth = () => {
      const first = cards[0];
      const firstClone = row.querySelector('[data-sd-clone]');
      return first && firstClone ? firstClone.offsetLeft - first.offsetLeft : 0;
    };

    const buildLoop = () => {
      if (player.cloned || cards.length < 2) return;
      let guard = 0;
      do {
        // 复制一份接在后面：读屏器不重复读，也不会被键盘聚焦
        cards.forEach((card) => {
          const clone = card.cloneNode(true);
          clone.setAttribute('data-sd-clone', '');
          clone.setAttribute('aria-hidden', 'true');
          clone.removeAttribute('data-sd-item');
          clone.setAttribute('tabindex', '-1');
          row.appendChild(clone);
        });
        guard++;
        // 卡片太少、一份撑不满一屏时，多复制几份，保证能滚到"一份的宽度"
      } while (guard < 4 && row.scrollWidth - row.clientWidth <= loopWidth() + 1);
      player.cloned = true;
    };

    const tick = (now) => {
      if (!player.running) return;
      const dt = Math.min(64, now - player.last) / 1000; // 标签页切走后不会一次跳很远
      player.last = now;

      const actual = row.scrollLeft;
      if (player.paused || Math.abs(actual - player.lastSet) > 1.5) {
        // 按住中，或位置被用户拖动、惯性滚动改了：以实际位置为准
        player.pos = actual;
      } else {
        // 自己用小数累计位置，避免每帧不到 1px 的增量被浏览器取整吞掉
        player.pos += speed * dt;
        const w = loopWidth();
        if (w > 0 && player.pos >= w) player.pos -= w; // 回到第一份，视觉上看不出接缝
        row.scrollLeft = player.pos;
      }
      player.lastSet = row.scrollLeft;
      player.raf = requestAnimationFrame(tick);
    };

    player.start = () => {
      if (!autoplay || reduce.matches || player.running) return;
      buildLoop();
      if (!player.cloned) return;
      player.running = true;
      player.last = performance.now();
      player.pos = row.scrollLeft;
      player.lastSet = row.scrollLeft;
      player.raf = requestAnimationFrame(tick);
    };
    player.stop = () => {
      player.running = false;
      cancelAnimationFrame(player.raf);
    };

    // 手指或鼠标按住时暂停，松开后继续
    const hold = () => (player.paused = true);
    const release = () => (player.paused = false);
    row.addEventListener('pointerdown', hold, { passive: true });
    row.addEventListener('touchstart', hold, { passive: true });
    ['pointerup', 'pointercancel', 'touchend', 'touchcancel'].forEach((evt) =>
      row.addEventListener(evt, release, { passive: true })
    );

    players.set(row, player);
    return player;
  };

  const startPeople = (dialog) =>
    dialog.querySelectorAll('[data-sd-people]').forEach((row) => setupPeople(row).start());
  const stopPeople = (dialog) =>
    dialog.querySelectorAll('[data-sd-people]').forEach((row) => {
      const player = players.get(row);
      if (player) player.stop();
    });

  // ===== 打开后，内容块依次淡入上浮 =====
  const intro = (dialog) => {
    const content = dialog.querySelector('[data-sd-root]');
    if (!window.gsap || reduce.matches || (window.Shopify && Shopify.designMode)) return;
    if (content && content.dataset.animate === 'false') return;
    const items = dialog.querySelectorAll('[data-sd-item]');
    if (!items.length) return;
    gsap.fromTo(
      items,
      { y: 22, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.5,
        ease: 'power3.out',
        stagger: Math.min(0.05, 0.9 / items.length),
        delay: 0.12,
        clearProps: 'transform,opacity',
      }
    );
  };

  const open = () => {
    const dialog = getDialog();
    if (!dialog || dialog.open || typeof dialog.showModal !== 'function') return false;
    closing = false;

    // 平板侧栏的宽度来自后台设置
    const content = dialog.querySelector('[data-sd-root]');
    if (content && content.dataset.width) {
      dialog.style.setProperty('--sd-width', content.dataset.width + 'px');
    }

    lock();
    dialog.showModal();
    if (content) content.scrollTop = 0;
    void dialog.offsetWidth; // 强制重排，滑入过渡才会播放
    dialog.classList.add('is-open');
    intro(dialog);
    startPeople(dialog);
    return true;
  };

  const close = (instant) => {
    const dialog = getDialog();
    if (!dialog || !dialog.open || closing) return;
    stopPeople(dialog);

    if (instant || reduce.matches) {
      dialog.classList.remove('is-open');
      dialog.close();
      return;
    }

    closing = true;
    dialog.classList.remove('is-open');
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      closing = false;
      dialog.removeEventListener('transitionend', onEnd);
      if (dialog.open) dialog.close();
    };
    const onEnd = (e) => {
      if (e.target === dialog && e.propertyName === 'transform') finish();
    };
    dialog.addEventListener('transitionend', onEnd);
    setTimeout(finish, 500); // 兜底
  };

  document.addEventListener('pointerdown', (e) => (downTarget = e.target), true);

  document.addEventListener(
    'click',
    (event) => {
      // 1. 拦截汉堡按钮：手机和平板打开我们的抽屉，不再触发 Dawn 原来的抽屉
      const trigger = event.target.closest('header-drawer summary');
      if (trigger && mobile.matches && getDialog()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        open();
        return;
      }

      // 2. 叉号
      if (event.target.closest('[data-sd-close]')) {
        close();
        return;
      }

      // 3. 平板侧栏：点遮罩（点击目标就是 dialog 本身）
      const dialog = getDialog();
      if (dialog && event.target === dialog && downTarget === dialog) close();
    },
    true
  );

  // ESC：先播放滑出动画，再关闭
  document.addEventListener(
    'cancel',
    (event) => {
      if (event.target && event.target.id === 'SiteDrawer') {
        event.preventDefault();
        close();
      }
    },
    true
  );

  // 无论怎么关闭，都停掉自动滚动并解除锁定
  document.addEventListener(
    'close',
    (event) => {
      if (event.target && event.target.id === 'SiteDrawer') {
        event.target.classList.remove('is-open');
        stopPeople(event.target);
        unlock();
      }
    },
    true
  );

  // 窗口变宽到桌面时直接关掉；从浏览器的前进后退缓存回来时，也不要停在打开状态
  mobile.addEventListener('change', () => {
    if (!mobile.matches) close(true);
  });
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) close(true);
  });

  // 主题编辑器：选中抽屉里的区块或块，自动打开抽屉；选别的就关上
  document.addEventListener('shopify:section:select', (e) => {
    if (e.target.closest && e.target.closest('#SiteDrawer')) open();
  });
  document.addEventListener('shopify:section:deselect', (e) => {
    if (e.target.closest && e.target.closest('#SiteDrawer')) close(true);
  });
  document.addEventListener('shopify:block:select', (e) => {
    if (e.target.closest && e.target.closest('#SiteDrawer')) {
      open();
      setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 400);
    }
  });
})();