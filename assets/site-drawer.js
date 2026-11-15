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

  // 锁滚动只加一个类，滚动条位置由 CSS 的 scrollbar-gutter 保留，不再测量、不再补偿
  const lock = () => root.classList.add(LOCK);
  const unlock = () => root.classList.remove(LOCK);

 

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

   
    lock();
    dialog.showModal();
   dialog.querySelector('.sd').scrollTop = 0;
    void dialog.offsetWidth; // 强制重排，滑入过渡才会播放
    dialog.classList.add('is-open');
    intro(dialog);
    
    return true;
  };

  const close = (instant) => {
    const dialog = getDialog();
    if (!dialog || !dialog.open || closing) return;
   

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
      if (event.target.id === 'SiteDrawer' && !event.target.open) {
        event.target.classList.remove('is-open');
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

    let editorCloseFrame;

  document.addEventListener('shopify:section:select', (event) => {
    if (!event.target.closest?.('#SiteDrawer')) return;
    cancelAnimationFrame(editorCloseFrame);
    open();

    if (!event.target.querySelector('[data-sd-root]')) {
      event.target.scrollIntoView({ block: 'nearest' });
    }
  });

  document.addEventListener('shopify:section:deselect', (event) => {
    if (event.target.closest?.('#SiteDrawer')) {
      editorCloseFrame = requestAnimationFrame(() => close(true));
    }
  });

  document.addEventListener('shopify:block:select', (event) => {
    if (!event.target.closest?.('#SiteDrawer')) return;
    cancelAnimationFrame(editorCloseFrame);
    open();
    setTimeout(() => {
      event.target.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior: 'smooth',
      });
    }, 400);
  });
  })();