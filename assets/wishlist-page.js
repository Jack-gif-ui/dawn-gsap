if (!customElements.get('wishlist-page')) {
  class WishlistPage extends HTMLElement {
    connectedCallback() {
      this.grid = this.querySelector('[data-wp-grid]');
      this.emptyEl = this.querySelector('[data-wp-empty]');
      this.loadingEl = this.querySelector('[data-wp-loading]');
      this.countEl = this.querySelector('[data-wp-count]');
      if (!this.grid || !window.Wishlist) return;

      this.cache = new Map(); // handle -> 商品数据
      this.token = 0;
      this.currency = this.dataset.currency || (window.Shopify && Shopify.currency && Shopify.currency.active) || 'USD';
      this.reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

      this.onChange = () => this.render();
      this.onClick = (e) => {
        const btn = e.target.closest('[data-wp-remove]');
        if (!btn) return;
        const card = btn.closest('[data-handle]');
        if (card) window.Wishlist.remove(card.dataset.handle);
      };

      document.addEventListener('wishlist:change', this.onChange);
      this.grid.addEventListener('click', this.onClick);
      this.render();
    }

    disconnectedCallback() {
      document.removeEventListener('wishlist:change', this.onChange);
      if (this.grid) this.grid.removeEventListener('click', this.onClick);
    }

    money(cents) {
      const value = cents / 100;
      return new Intl.NumberFormat(document.documentElement.lang || undefined, {
        style: 'currency',
        currency: this.currency,
        minimumFractionDigits: value % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      }).format(value);
    }

    async fetchProduct(handle) {
      try {
        const res = await fetch(`/products/${encodeURIComponent(handle)}.js`, {
          headers: { Accept: 'application/json' },
        });
        if (res.status === 404) {
          // 商品已经下架或删除：从心愿单里去掉
          this.cache.set(handle, null);
          window.Wishlist.remove(handle);
          return;
        }
        if (!res.ok) return;
        this.cache.set(handle, await res.json());
      } catch (e) {
        /* 网络问题：这次不显示，下次进入页面会再试 */
      }
    }

    async render() {
      const token = ++this.token;
      const handles = window.Wishlist.all();

      await Promise.all(handles.filter((h) => !this.cache.has(h)).map((h) => this.fetchProduct(h)));
      if (token !== this.token) return; // 期间又有变化，让最新那次来处理

      const list = window.Wishlist.all().filter((h) => this.cache.get(h));
      this.update(list);
    }

    update(list) {
      if (this.loadingEl) this.loadingEl.hidden = true;

      const existing = new Map([...this.grid.children].map((el) => [el.dataset.handle, el]));
      existing.forEach((el, handle) => {
        if (!list.includes(handle)) this.dropCard(el);
      });
      list.forEach((handle) => {
        if (!existing.has(handle)) this.grid.appendChild(this.buildCard(this.cache.get(handle)));
      });

      const n = list.length;
      if (this.countEl) {
        this.countEl.hidden = n === 0;
        this.countEl.textContent = n === 1 ? '1 item' : `${n} items`;
      }
      if (this.emptyEl) this.emptyEl.hidden = n > 0;
    }

    dropCard(el) {
      if (this.reduce.matches) {
        el.remove();
        return;
      }
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 260);
    }

    badge(text, cls) {
      const span = document.createElement('span');
      span.className = `cb__item cb__item--${cls}`;
      span.textContent = text;
      return span;
    }

    buildCard(p) {
      const stockText = (this.dataset.stock || '').trim();
      const saleText = (this.dataset.sale || '').trim();
      const soldoutText = (this.dataset.soldout || '').trim();

      const li = document.createElement('li');
      li.className = 'wp__card';
      li.dataset.handle = p.handle;

      const media = document.createElement('div');
      media.className = 'wp__media';

      const link = document.createElement('a');
      link.className = 'wp__media-link';
      link.href = p.url;
      link.tabIndex = -1;
      link.setAttribute('aria-hidden', 'true');

      if (p.featured_image) {
        const img = document.createElement('img');
        img.className = 'wp__img';
        const base = p.featured_image + (p.featured_image.includes('?') ? '&' : '?');
        img.src = `${base}width=540`;
        img.srcset = [360, 540, 720, 940].map((w) => `${base}width=${w} ${w}w`).join(', ');
        img.sizes = '(min-width: 990px) 25vw, (min-width: 750px) 33vw, 50vw';
        img.alt = p.title;
        img.loading = 'lazy';
        img.decoding = 'async';
        link.appendChild(img);
      }
      media.appendChild(link);

      // 矩形徽章：沿用商品卡的 .cb 样式
      const cb = document.createElement('div');
      cb.className = 'cb';
      if (p.available) {
        if (stockText) cb.appendChild(this.badge(stockText, 'stock'));
        const percent =
          p.compare_at_price > p.price
            ? Math.round(((p.compare_at_price - p.price) * 100) / p.compare_at_price)
            : 0;
        if (percent > 0 && saleText) {
          cb.appendChild(this.badge(saleText.split('{percent}').join(String(percent)), 'sale'));
        }
      } else if (soldoutText) {
        cb.appendChild(this.badge(soldoutText, 'soldout'));
      }
      if (cb.children.length) media.appendChild(cb);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'wp__remove';
      remove.setAttribute('data-wp-remove', '');
      remove.setAttribute('aria-label', `Remove ${p.title} from wishlist`);
      remove.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      media.appendChild(remove);

      const info = document.createElement('div');
      info.className = 'wp__info';

      const name = document.createElement('a');
      name.className = 'wp__name';
      name.href = p.url;
      name.textContent = p.title;

      const price = document.createElement('p');
      price.className = 'wp__price';
      const now = document.createElement('span');
      now.className = 'wp__now';
      now.textContent = this.money(p.price);
      price.appendChild(now);
      if (p.compare_at_price > p.price) {
        const was = document.createElement('s');
        was.className = 'wp__was';
        was.textContent = this.money(p.compare_at_price);
        price.appendChild(was);
      }

      info.append(name, price);
      li.append(media, info);
      return li;
    }
  }

  customElements.define('wishlist-page', WishlistPage);
}