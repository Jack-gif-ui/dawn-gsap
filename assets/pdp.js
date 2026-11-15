/**
 * 商品详情页（product.pdp）脚本
 *  - <pdp-gallery>：主图横向滑动 + 缩略图 + 左右箭头（首张无左箭头、末张无右箭头）
 *  - <pdp-sticky-bar>：主加购按钮向下滚出视口后，在桌面端底部出现吸底加购栏
 *  - 变体选项：给“尺寸”等选项补上已选值和提示文案
 *
 * 变体切换仍由 Dawn 的 product-info.js 负责，它会调用
 * `<pdp-gallery>.setActiveMedia(mediaId, prepend)`，所以这里保持同名方法。
 */

/* ---------- 画廊 ---------- */
if (!customElements.get('pdp-gallery')) {
  class PdpGallery extends HTMLElement {
    connectedCallback() {
      this.track = this.querySelector('[data-pdp-track]');
      this.thumbsList = this.querySelector('[data-pdp-thumbs]');
      this.prevButton = this.querySelector('[data-pdp-prev]');
      this.nextButton = this.querySelector('[data-pdp-next]');
      if (!this.track) return;

      this.index = 0;
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

      this.onScroll = () => {
        if (this.scrollFrame) return;
        this.scrollFrame = requestAnimationFrame(() => {
          this.scrollFrame = null;
          this.syncFromScroll();
        });
      };
      this.track.addEventListener('scroll', this.onScroll, { passive: true });

      this.prevButton?.addEventListener('click', () => this.goTo(this.index - 1));
      this.nextButton?.addEventListener('click', () => this.goTo(this.index + 1));

      // 事件委托：变体切换后缩略图会重建，不需要重新绑定
      this.thumbsList?.addEventListener('click', (event) => {
        const thumb = event.target.closest('[data-target]');
        if (!thumb) return;
        const position = this.slides.findIndex((slide) => slide.dataset.mediaId === thumb.dataset.target);
        if (position > -1) this.goTo(position);
      });

      // 键盘：画廊获得焦点时用左右键切换
      this.track.setAttribute('tabindex', '0');
      this.track.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          this.goTo(this.index + 1);
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          this.goTo(this.index - 1);
        }
      });

      // product-info.js 切换变体时会增删、重排 <li>，这里跟着重建缩略图
      this.mutationObserver = new MutationObserver(() => {
        this.rebuildThumbs();
        this.syncFromScroll();
      });
      this.mutationObserver.observe(this.track, { childList: true });

      // 窗口尺寸变化后重新对齐到当前这一张
      this.resizeObserver = new ResizeObserver(() => this.goTo(this.index, true));
      this.resizeObserver.observe(this.track);

      this.update();
    }

    disconnectedCallback() {
      this.mutationObserver?.disconnect();
      this.resizeObserver?.disconnect();
      if (this.scrollFrame) cancelAnimationFrame(this.scrollFrame);
    }

    get slides() {
      return Array.from(this.track.children).filter((el) => el.matches('[data-media-id]'));
    }

    syncFromScroll() {
      const width = this.track.clientWidth;
      if (!width) return;
      const next = Math.round(this.track.scrollLeft / width);
      const clamped = Math.max(0, Math.min(next, this.slides.length - 1));
      if (clamped !== this.index) {
        this.index = clamped;
        if (typeof window.pauseAllMedia === 'function') window.pauseAllMedia();
      }
      this.update();
    }

    goTo(position, instant = false) {
      const slides = this.slides;
      if (!slides.length) return;
      const target = Math.max(0, Math.min(position, slides.length - 1));
      this.index = target;
      const behavior = instant || this.reducedMotion.matches ? 'auto' : 'smooth';
      this.track.scrollTo({ left: slides[target].offsetLeft, behavior });
      this.update();
    }

    /** 同步箭头、主图 is-active、缩略图高亮 */
    update() {
      const slides = this.slides;
      const last = slides.length - 1;

      // 第一张不显示左箭头，最后一张不显示右箭头
      if (this.prevButton) this.prevButton.hidden = this.index <= 0;
      if (this.nextButton) this.nextButton.hidden = this.index >= last;

      slides.forEach((slide, i) => slide.classList.toggle('is-active', i === this.index));

      const activeId = slides[this.index]?.dataset.mediaId;
      if (!this.thumbsList || !activeId) return;
      this.thumbsList.querySelectorAll('[data-target]').forEach((thumb) => {
        const active = thumb.dataset.target === activeId;
        thumb.classList.toggle('is-active', active);
        if (active) {
          thumb.setAttribute('aria-current', 'true');
          this.revealThumb(thumb);
        } else {
          thumb.removeAttribute('aria-current');
        }
      });
    }

    /** 只滚动缩略图列表本身，不用 scrollIntoView，避免带着整个页面一起滚 */
    revealThumb(thumb) {
      const list = this.thumbsList;
      if (!list) return;
      const top = thumb.offsetTop;
      const bottom = top + thumb.offsetHeight;
      if (top < list.scrollTop) list.scrollTo({ top: top - 8 });
      else if (bottom > list.scrollTop + list.clientHeight) list.scrollTo({ top: bottom - list.clientHeight + 8 });

      const left = thumb.offsetLeft;
      const right = left + thumb.offsetWidth;
      if (left < list.scrollLeft) list.scrollTo({ left: left });
      else if (right > list.scrollLeft + list.clientWidth) list.scrollTo({ left: right - list.clientWidth });
    }

    rebuildThumbs() {
      if (!this.thumbsList) return;
      const slides = this.slides;
      const ids = slides.map((slide) => slide.dataset.mediaId).join('|');
      const existing = Array.from(this.thumbsList.querySelectorAll('[data-target]'))
        .map((thumb) => thumb.dataset.target)
        .join('|');
      if (ids === existing) return;

      const fragment = document.createDocumentFragment();
      slides.forEach((slide, i) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'pdp-thumb';
        button.dataset.target = slide.dataset.mediaId;
        button.setAttribute('aria-label', `Image ${i + 1}`);

        const img = document.createElement('img');
        img.src = slide.dataset.thumb || '';
        img.alt = '';
        img.loading = 'lazy';
        button.appendChild(img);
        fragment.appendChild(button);
      });
      this.thumbsList.replaceChildren(fragment);
    }

    /** 兼容 product-info.js 的调用：激活某张媒体 */
    setActiveMedia(mediaId) {
      const position = this.slides.findIndex((slide) => slide.dataset.mediaId === mediaId);
      this.goTo(position > -1 ? position : 0, true);
    }
  }

  customElements.define('pdp-gallery', PdpGallery);
}

/* ---------- 吸底加购栏 ---------- */
if (!customElements.get('pdp-sticky-bar')) {
  class PdpStickyBar extends HTMLElement {
    connectedCallback() {
      this.submit = document.getElementById(this.dataset.submitId);
      this.barButton = this.querySelector('[data-pdp-bar-submit]');
      this.barPrice = this.querySelector('[data-pdp-bar-price]');
      if (!this.submit || !this.barButton) return;

      this.desktop = window.matchMedia('(min-width: 990px)');
      this.passed = false;
      this.defaultLabel = this.barButton.textContent.trim();

      // 点击：直接触发主加购按钮，购物车逻辑只有一份
      this.barButton.addEventListener('click', () => {
        if (!this.submit.disabled) this.submit.click();
      });

      // 主按钮在视口之上（已向下滚过）才显示；向上滚回视口，或还在视口下方，都隐藏
      this.intersection = new IntersectionObserver(
        ([entry]) => {
          this.passed = !entry.isIntersecting && entry.boundingClientRect.top < 0;
          this.toggle();
        },
        { threshold: 0 }
      );
      this.intersection.observe(this.submit);

      // 跟随变体切换同步价格和按钮状态
      const priceEl = document.getElementById(this.dataset.priceId);
      this.syncObserver = new MutationObserver(() => this.sync(priceEl));
      if (priceEl) this.syncObserver.observe(priceEl, { childList: true, subtree: true, characterData: true });
      this.syncObserver.observe(this.submit, {
        attributes: true,
        attributeFilter: ['disabled', 'aria-disabled'],
        childList: true,
        subtree: true,
        characterData: true,
      });
      this.sync(priceEl);

      this.desktop.addEventListener?.('change', () => this.toggle());
      this.toggle();
    }

    disconnectedCallback() {
      this.intersection?.disconnect();
      this.syncObserver?.disconnect();
    }

    toggle() {
      const visible = this.passed && this.desktop.matches;
      this.classList.toggle('is-visible', visible);
      // 隐藏时不可聚焦、不被读屏读到
      this.toggleAttribute('inert', !visible);
    }

    sync(priceEl) {
      if (priceEl && this.barPrice) {
        const now = priceEl.querySelector('.pdp-price__now');
        const was = priceEl.querySelector('.pdp-price__was');
        if (now) {
          this.barPrice.replaceChildren(now.cloneNode(true), ...(was ? [was.cloneNode(true)] : []));
        }
      }
      const unavailable = this.submit.disabled || this.submit.getAttribute('aria-disabled') === 'true';
      this.barButton.disabled = unavailable;
      const label = unavailable
        ? this.submit.querySelector('span')?.textContent?.trim() || this.defaultLabel
        : this.defaultLabel;
      if (this.barButton.textContent !== label) this.barButton.textContent = label;
    }
  }

  customElements.define('pdp-sticky-bar', PdpStickyBar);
}

/* ---------- 变体选项：已选值 + 提示文案 ---------- */
(() => {
  const SELECTOR = '.pdp-variants';

  const parseHints = (raw) => {
    const hints = new Map();
    (raw || '').split('\n').forEach((line) => {
      const [name, value, ...rest] = line.split('|');
      const text = rest.join('|').trim();
      if (name && value && text) hints.set(`${name.trim().toLowerCase()}|${value.trim().toLowerCase()}`, text);
    });
    return hints;
  };

  // 只在内容真的变化时才写 DOM，否则下面的 MutationObserver 会被自己触发而无限循环
  const setText = (el, text) => {
    if (el.textContent !== text) el.textContent = text;
  };

  const refresh = (wrapper) => {
    const hints = parseHints(wrapper.dataset.pdpHints);

    wrapper.querySelectorAll('fieldset').forEach((fieldset) => {
      const legend = fieldset.querySelector('legend');
      const checked = fieldset.querySelector('input:checked');
      if (!legend || !checked) return;

      const optionName = (checked.dataset.optionName || '').trim();
      const value = checked.value;

      // 按钮式选项的标题原本不显示已选值，这里补上；色块式选项 Dawn 自己会写
      if (!legend.querySelector('[data-selected-value]')) {
        let selected = legend.querySelector('.pdp-selected');
        if (!selected) {
          selected = document.createElement('span');
          selected.className = 'pdp-selected';
          legend.appendChild(selected);
        }
        setText(selected, value);
      } else {
        // 色块式：在名称前放一个已选色点
        const swatch = checked.nextElementSibling?.querySelector('.swatch');
        let dot = legend.querySelector('.pdp-legend-dot');
        if (swatch) {
          if (!dot) {
            dot = document.createElement('span');
            dot.className = 'pdp-legend-dot';
            legend.querySelector('[data-selected-value]').before(dot);
          }
          if (dot.firstElementChild?.getAttribute('style') !== swatch.getAttribute('style')) {
            dot.replaceChildren(swatch.cloneNode(true));
          }
        }
      }

      let hint = legend.querySelector('.pdp-hint');
      const text = hints.get(`${optionName.toLowerCase()}|${value.trim().toLowerCase()}`);
      if (text) {
        if (!hint) {
          hint = document.createElement('span');
          hint.className = 'pdp-hint';
          legend.appendChild(hint);
        }
        setText(hint, text);
      } else if (hint) {
        hint.remove();
      }
    });
  };

  const init = () => {
    document.querySelectorAll(SELECTOR).forEach((wrapper) => {
      if (wrapper.dataset.pdpReady) return;
      wrapper.dataset.pdpReady = 'true';
      refresh(wrapper);
      wrapper.addEventListener('change', () => requestAnimationFrame(() => refresh(wrapper)));

      // Dawn 切换变体后可能重绘选项，重绘后补回已选值（用 rAF 合并，避免循环触发）
      let queued = false;
      new MutationObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
          queued = false;
          refresh(wrapper);
        });
      }).observe(wrapper, { childList: true, subtree: true });
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  // 主题编辑器里区块被重新渲染时
  document.addEventListener('shopify:section:load', init);
})();
