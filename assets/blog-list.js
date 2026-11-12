if (!customElements.get('blog-list')) {
  class BlogList extends HTMLElement {
    connectedCallback() {
      this.formEl = this.querySelector('[data-bl-form]');
      this.inputEl = this.querySelector('[data-bl-input]');
      this.defaultEl = this.querySelector('[data-bl-default]');
      this.resultsEl = this.querySelector('[data-bl-results]');
      this.statusEl = this.querySelector('[data-bl-status]');
      if (!this.formEl || !this.inputEl || !this.resultsEl || !this.defaultEl) return;

      this.searchUrl = this.dataset.searchUrl;
      this.blogUrl = (this.dataset.blogUrl || '').replace(/\/$/, '');
      this.sectionId = this.dataset.resultsSection || 'blog-search-results';
      this.reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.timer = null;
      this.controller = null;
      this.lastTerm = '';

      this.onInput = () => {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.search(this.inputEl.value), 250);
      };
      this.onSubmit = (e) => {
        e.preventDefault();
        clearTimeout(this.timer);
        this.search(this.inputEl.value);
      };
      this.onKey = (e) => {
        if (e.key === 'Escape' && this.inputEl.value) {
          this.inputEl.value = '';
          this.reset();
        }
      };
      this.onClick = (e) => {
        if (e.target.closest('[data-bl-clear]')) {
          this.inputEl.value = '';
          this.reset();
          this.inputEl.focus();
        }
      };

      this.inputEl.addEventListener('input', this.onInput);
      this.formEl.addEventListener('submit', this.onSubmit);
      this.addEventListener('keydown', this.onKey);
      this.addEventListener('click', this.onClick);
    }

    disconnectedCallback() {
      clearTimeout(this.timer);
      if (this.controller) this.controller.abort();
      if (this.inputEl) this.inputEl.removeEventListener('input', this.onInput);
      if (this.formEl) this.formEl.removeEventListener('submit', this.onSubmit);
      this.removeEventListener('keydown', this.onKey);
      this.removeEventListener('click', this.onClick);
    }

    inBlog(url) {
      if (!this.blogUrl) return true;
      return typeof url === 'string' && url.startsWith(this.blogUrl + '/');
    }

    setBusy(on) {
      this.classList.toggle('is-loading', on);
      this.setAttribute('aria-busy', on ? 'true' : 'false');
    }

    search(raw) {
      const term = raw.trim();
      if (term.length < 2) {
        this.reset();
        return;
      }
      if (term === this.lastTerm) return;
      this.lastTerm = term;

      if (this.controller) this.controller.abort();
      this.controller = new AbortController();
      this.setBusy(true);

      const params = new URLSearchParams({
        q: term,
        section_id: this.sectionId,
        'resources[type]': 'article',
        'resources[options][fields]': 'title',
        'resources[limit]': '10',
        'resources[limit_scope]': 'each',
      });

      fetch(`${this.searchUrl}?${params.toString()}`, { signal: this.controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error(String(res.status));
          return res.text();
        })
        .then((html) => {
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const cards = [...doc.querySelectorAll('[data-bl-card]')].filter((card) =>
            this.inBlog(card.dataset.url)
          );
          this.show(term, cards);
        })
        .catch((err) => {
          if (err.name === 'AbortError') return;
          this.lastTerm = '';
          this.setBusy(false);
          this.setStatus('Search is unavailable right now. Please try again.');
        });
    }

    setStatus(text, withClear) {
      this.statusEl.textContent = text;
      if (withClear) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bl__clear';
        btn.setAttribute('data-bl-clear', '');
        btn.textContent = 'Clear search';
        this.statusEl.appendChild(btn);
      }
    }

    show(term, cards) {
      this.setBusy(false);
      this.resultsEl.innerHTML = '';
      cards.forEach((card) => this.resultsEl.appendChild(document.importNode(card, true)));

      this.defaultEl.hidden = true;
      this.resultsEl.hidden = false;

      const n = cards.length;
      this.setStatus(
        n ? `${n} ${n === 1 ? 'article' : 'articles'} for “${term}”` : `No articles found for “${term}”.`,
        true
      );

      if (n && window.gsap && !this.reduce.matches) {
        gsap.fromTo(
          this.resultsEl.children,
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', stagger: 0.06, clearProps: 'opacity,transform' }
        );
      }
    }

    reset() {
      clearTimeout(this.timer);
      if (this.controller) this.controller.abort();
      this.lastTerm = '';
      this.setBusy(false);
      this.resultsEl.hidden = true;
      this.resultsEl.innerHTML = '';
      this.defaultEl.hidden = false;
      this.statusEl.textContent = '';
    }
  }

  customElements.define('blog-list', BlogList);
}