(() => {
  if (window.__wishlistInit) return;
  window.__wishlistInit = true;

  const KEY = 'wishlist:v1';
  const EVENT = 'wishlist:change';

  const read = () => {
    try {
      const list = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(list) ? list.filter((h) => typeof h === 'string' && h) : [];
    } catch (e) {
      return [];
    }
  };
  const write = (list) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (e) {
      /* 无痕模式或存储被禁用：忽略，按钮仍能用但不会保存 */
    }
  };
  const emit = (handle, active) =>
    document.dispatchEvent(
      new CustomEvent(EVENT, { detail: { handle, active, count: read().length } })
    );

  const api = {
    all: read,
    has: (handle) => read().includes(handle),
    count: () => read().length,
    add(handle) {
      const list = read();
      if (!list.includes(handle)) {
        list.push(handle);
        write(list);
      }
      emit(handle, true);
    },
    remove(handle) {
      write(read().filter((h) => h !== handle));
      emit(handle, false);
    },
    toggle(handle) {
      const on = !api.has(handle);
      if (on) api.add(handle);
      else api.remove(handle);
      return on;
    },
  };
  window.Wishlist = api;

  // 把页面上所有心愿按钮、顶栏入口的状态同步成当前数据
  const sync = () => {
    const list = read();

    document.querySelectorAll('[data-wishlist-toggle]').forEach((btn) => {
      const on = list.includes(btn.dataset.handle);
      if (btn.getAttribute('aria-pressed') !== String(on)) {
        btn.setAttribute('aria-pressed', String(on));
        const label = on ? btn.dataset.labelRemove : btn.dataset.labelAdd;
        if (label) btn.setAttribute('aria-label', label);
      }
    });

    document.querySelectorAll('[data-wishlist-link]').forEach((link) => {
      link.toggleAttribute('data-has-items', list.length > 0);
    });
    document.querySelectorAll('[data-wishlist-count]').forEach((el) => {
      el.textContent = list.length ? String(list.length) : '';
    });
  };

  // 点击：事件委托，筛选、排序后重新渲染的商品卡不需要重新绑定
  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-wishlist-toggle]');
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();

    const handle = btn.dataset.handle;
    if (!handle) return;
    const on = api.toggle(handle);

    btn.classList.remove('is-pop');
    if (on) {
      void btn.offsetWidth; // 重新触发动画
      btn.classList.add('is-pop');
    }
  });

  document.addEventListener(EVENT, sync);
  window.addEventListener('pageshow', sync); // 从浏览器的前进后退缓存回来时
  window.addEventListener('storage', (e) => {
    // 另一个标签页改了心愿单
    if (e.key === KEY) {
      sync();
      emit(null, null);
    }
  });

  // 筛选、排序、翻页会重新渲染商品网格，新出现的按钮也要同步状态
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      sync();
    });
  }).observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync);
  else sync();
})();