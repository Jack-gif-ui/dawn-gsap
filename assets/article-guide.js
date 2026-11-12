if (!customElements.get('article-guide')) {
  class ArticleGuide extends HTMLElement {
    connectedCallback() {
      this.contentEl = this.querySelector('[data-ag-content]');
      if (!this.contentEl) return;

      this.tocBlocks = [...this.querySelectorAll('[data-ag-toc]')];
      this.tocLists = [...this.querySelectorAll('[data-ag-toc-list]')];
      this.reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.minHeadings = parseInt(this.dataset.minHeadings || '2', 10);
      this.entries = [];
      this.currentId = null;
      this.ticking = false;

      this.wrapTables();
      this.collectHeadings();
      this.renderToc();

      this.onClick = (e) => this.handleClick(e);
      this.onScroll = () => {
        if (this.ticking) return;
        this.ticking = true;
        requestAnimationFrame(() => {
          this.ticking = false;
          this.update();
        });
      };

      this.addEventListener('click', this.onClick);
      window.addEventListener('scroll', this.onScroll, { passive: true });
      window.addEventListener('resize', this.onScroll, { passive: true });
      this.update();

      // 带 #锚点 打开页面时，图片加载完再定位（锚点 id 是 JS 生成的，浏览器自己跳不到）
      this.onLoad = () => this.scrollToHash();
      if (document.readyState === 'complete') this.scrollToHash();
      else window.addEventListener('load', this.onLoad, { once: true });
    }

    disconnectedCallback() {
      this.removeEventListener('click', this.onClick);
      window.removeEventListener('scroll', this.onScroll);
      window.removeEventListener('resize', this.onScroll);
      window.removeEventListener('load', this.onLoad);
    }

    // 表格外面包一层，窄屏时横向滚动，不撑破版面
    wrapTables() {
      this.contentEl.querySelectorAll('table').forEach((table) => {
        if (table.parentElement.classList.contains('ag__table')) return;
        const wrap = document.createElement('div');
        wrap.className = 'ag__table';
        wrap.tabIndex = 0;
        wrap.setAttribute('role', 'region');
        wrap.setAttribute('aria-label', 'Scrollable table');
        table.parentNode.insertBefore(wrap, table);
        wrap.appendChild(table);
      });
    }

    collectHeadings() {
      const used = new Set([...document.querySelectorAll('[id]')].map((el) => el.id));
      const slug = (text) =>
        text
          .toLowerCase()
          .normalize('NFKD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^\p{L}\p{N}]+/gu, '-')
          .replace(/^-+|-+$/g, '');

      this.contentEl.querySelectorAll('h2').forEach((el) => {
        const text = el.textContent.trim();
        if (!text) return;

        let id = el.id;
        if (!id) {
          const base = slug(text) || 'section';
          id = base;
          let n = 2;
          while (used.has(id)) id = `${base}-${n++}`;
          el.id = id;
        }
        used.add(id);
        this.entries.push({ id, text, el });
      });
    }

    renderToc() {
      if (this.entries.length < this.minHeadings) {
        this.classList.add('ag--no-toc');
        return;
      }
      this.tocLists.forEach((list) => {
        list.innerHTML = '';
        this.entries.forEach(({ id, text }) => {
          const li = document.createElement('li');
          const a = document.createElement('a');
          a.href = `#${id}`;
          a.textContent = text;
          a.dataset.agLink = id;
          li.appendChild(a);
          list.appendChild(li);
        });
      });
    }

    handleClick(e) {
      const link = e.target.closest('a[data-ag-link]');
      if (link) {
        e.preventDefault();
        const id = link.dataset.agLink;
        const details = link.closest('details');
        if (details && details.open) {
          // 先收起移动端目录，再滚动，否则收起造成的位移会让定位偏掉
          details.open = false;
          requestAnimationFrame(() => this.goTo(id));
        } else {
          this.goTo(id);
        }
        return;
      }

      const copy = e.target.closest('[data-ag-copy]');
      if (copy && navigator.clipboard) {
        const label = copy.dataset.label || copy.textContent;
        navigator.clipboard
          .writeText(window.location.href.split('#')[0])
          .then(() => {
            copy.textContent = copy.dataset.done || 'Copied';
            setTimeout(() => (copy.textContent = label), 2000);
          })
          .catch(() => {});
      }
    }

    goTo(id) {
      const target = document.getElementById(id);
      if (!target) return;
      target.scrollIntoView({ behavior: this.reduce.matches ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', `#${id}`);
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }

    scrollToHash() {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const entry = this.entries.find((item) => item.id === id);
      if (entry) entry.el.scrollIntoView({ block: 'start' });
    }

    update() {
      if (!this.entries.length) return;

      const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0;
      const line = header + 120;

      let current = null;
      for (const entry of this.entries) {
        if (entry.el.getBoundingClientRect().top <= line) current = entry;
        else break;
      }

      const id = current ? current.id : '';
      if (id === this.currentId) return;
      this.currentId = id;

      this.querySelectorAll('a[data-ag-link]').forEach((a) => {
        const on = a.dataset.agLink === id;
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      });

      // 目录太长时，让当前项保持在可视范围内
      const active = this.querySelector('.ag__toc--aside a.is-active');
      const box = active && active.closest('[data-ag-toc-scroll]');
      if (box) {
        const top = active.offsetTop;
        const bottom = top + active.offsetHeight;
        if (top < box.scrollTop + 20 || bottom > box.scrollTop + box.clientHeight - 20) {
          box.scrollTo({
            top: top - box.clientHeight / 2,
            behavior: this.reduce.matches ? 'auto' : 'smooth',
          });
        }
      }
    }
  }

  customElements.define('article-guide', ArticleGuide);
}