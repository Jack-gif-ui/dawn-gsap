(() => {
  if (window.__collectionPromoInit) return;
  window.__collectionPromoInit = true;

  const root = document.documentElement;
  const LOCK = 'promo-modal-open';
  let downTarget = null;

  const lock = () => {
    // 锁定前先量出滚动条宽度，锁定后用同样宽度的右内边距补上，页面就不会跳
    const scrollbar = window.innerWidth - root.clientWidth;
    root.style.setProperty('--promo-scrollbar', (scrollbar > 0 ? scrollbar : 0) + 'px');
    root.classList.add(LOCK);
  };

  const unlockIfNone = () => {
    if (!document.querySelector('dialog.promo-modal[open]')) {
      root.classList.remove(LOCK);
      root.style.removeProperty('--promo-scrollbar');
    }
  };

  // 记录按下时的目标：从弹窗里拖出去松手，不应该被当成"点遮罩"
  document.addEventListener('pointerdown', (event) => {
    downTarget = event.target;
  }, true);

  // 用事件委托：筛选、排序后网格会重新渲染，不需要重新绑定
  document.addEventListener('click', (event) => {
    const opener = event.target.closest('[data-promo-open]');
    if (opener) {
      const dialog = document.getElementById(opener.getAttribute('data-promo-open'));
      if (dialog && typeof dialog.showModal === 'function' && !dialog.open) {
        lock(); // 必须在 showModal 之前量
        dialog.showModal();
      }
      return;
    }

    const closer = event.target.closest('[data-promo-close]');
    if (closer) {
      const dialog = closer.closest('dialog');
      if (dialog) dialog.close();
      return;
    }

    // 点遮罩：点击目标就是 dialog 本身
    const t = event.target;
    if (t instanceof HTMLDialogElement && t.classList.contains('promo-modal') && downTarget === t) {
      t.close();
    }
  });

  // close 事件不冒泡，用捕获阶段监听（叉号、遮罩、ESC 关闭都会触发）
  document.addEventListener('close', (event) => {
    if (event.target instanceof HTMLDialogElement && event.target.classList.contains('promo-modal')) {
      unlockIfNone();
    }
  }, true);

  // 主题编辑器里区块被重新加载时，防止锁定状态残留
  document.addEventListener('shopify:section:load', unlockIfNone);
})();