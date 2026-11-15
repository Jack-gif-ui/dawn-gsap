if (!customElements.get('celebrity-carousel')) {
  class CelebrityCarousel extends HTMLElement {
    connectedCallback() {
      this.track = this.querySelector('[data-celebrity-track]');
      if (!this.track) return;

      this.cards = Array.from(this.track.querySelectorAll('.celebrity-carousel__card'));
      this.visible = false;
      this.loopWidth = 0;
      this.clones = [];
      this.listeners = new AbortController();
      const options = { signal: this.listeners.signal };

      this.addEventListener('shopify:block:select', (event) => {
        const card = event.target.closest('.celebrity-carousel__card');
        if (!card || !this.cards.includes(card)) return;

        this.selected = true;
        this.syncPlayback();
        const inset = parseFloat(getComputedStyle(this.track).paddingLeft) || 0;
        this.track.scrollLeft = card.offsetLeft - inset;
      }, options);

      this.addEventListener('shopify:block:deselect', () => {
        this.selected = false;
        this.syncPlayback();
      }, options);

      if (this.dataset.autoplay !== 'true' || this.cards.length < 2) return;

      this.speed = Number(this.dataset.speed) || 50;
      this.pointerId = null;
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.advance = this.advance.bind(this);

      this.visibilityObserver = new IntersectionObserver(([entry]) => {
        this.visible = entry.isIntersecting;
        this.updateLoop();
      });
      this.visibilityObserver.observe(this.track);

      this.resizeObserver = new ResizeObserver(() => this.updateLoop());
      this.resizeObserver.observe(this.track);
      this.reducedMotion.addEventListener('change', () => this.updateLoop(), options);
      document.addEventListener('visibilitychange', () => this.syncPlayback(), options);

      this.track.addEventListener('pointerdown', (event) => {
        if (!event.isPrimary) return;
        this.pointerId = event.pointerId;
        this.syncPlayback();
      }, options);

      const release = (event) => {
        if (event.pointerId !== this.pointerId) return;
        this.pointerId = null;
        this.deferPlayback();
      };

      window.addEventListener('pointerup', release, options);
      window.addEventListener('pointercancel', release, options);
      window.addEventListener('blur', () => {
        this.pointerId = null;
        this.deferPlayback();
      }, options);

      this.track.addEventListener('wheel', () => this.deferPlayback(), { ...options, passive: true });
      this.track.addEventListener('focusin', () => {
        this.focused = true;
        this.syncPlayback();
      }, options);
      this.track.addEventListener('focusout', (event) => {
        this.focused = this.track.contains(event.relatedTarget);
        this.syncPlayback();
      }, options);
    }

    disconnectedCallback() {
      this.listeners?.abort();
      this.visibilityObserver?.disconnect();
      this.resizeObserver?.disconnect();
      clearTimeout(this.resumeTimer);
      this.resumeTimer = 0;
      this.focused = false;
      this.selected = false;
      this.stop();
      this.clones?.forEach((card) => card.remove());
    }

    updateLoop() {
      if (this.reducedMotion.matches) {
        this.stop();
        if (this.loopWidth) this.track.scrollLeft %= this.loopWidth;
        this.clones.forEach((card) => card.remove());
        this.clones = [];
        this.loopWidth = 0;
        return;
      }

      if (this.visible && this.track.clientWidth) {
        const gap = parseFloat(getComputedStyle(this.track).columnGap) || 0;
        const cardWidth = this.cards[0].getBoundingClientRect().width;
        this.loopWidth = (cardWidth + gap) * this.cards.length;

        if (this.loopWidth) {
          const copies = Math.ceil((this.track.clientWidth + gap) / this.loopWidth);
          const cloneCount = copies * this.cards.length;
          while (this.clones.length > cloneCount) this.clones.pop().remove();

          const fragment = document.createDocumentFragment();
          for (let index = this.clones.length; index < cloneCount; index++) {
            const clone = this.cards[index % this.cards.length].cloneNode(true);
            clone.getAttributeNames()
              .filter((name) => name.startsWith('data-shopify-'))
              .forEach((name) => clone.removeAttribute(name));
            clone.setAttribute('aria-hidden', 'true');
            clone.tabIndex = -1;
            this.clones.push(clone);
            fragment.append(clone);
          }
          this.track.append(fragment);
        }
      }

      this.syncPlayback();
    }

    deferPlayback() {
      clearTimeout(this.resumeTimer);
      this.resumeTimer = setTimeout(() => {
        this.resumeTimer = 0;
        this.syncPlayback();
      }, 800);
      this.syncPlayback();
    }

    syncPlayback() {
      if (
        !this.visible ||
        !this.loopWidth ||
        document.hidden ||
        this.reducedMotion.matches ||
        this.pointerId !== null ||
        this.resumeTimer ||
        this.focused ||
        this.selected
      ) {
        this.stop();
        return;
      }

      if (this.frame) return;

      this.lastSet = this.track.scrollLeft;
      this.position = Math.max(0, this.lastSet);
      this.lastTime = performance.now();
      this.frame = requestAnimationFrame(this.advance);
    }

    stop() {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }

    advance(now) {
      const elapsed = Math.min(Math.max(0, now - this.lastTime), 64) / 1000;
      this.lastTime = now;

      if (Math.abs(this.track.scrollLeft - this.lastSet) > 1.5) {
        this.position = Math.max(0, this.track.scrollLeft);
      } else {
        this.position = (this.position + this.speed * elapsed) % this.loopWidth;
        this.track.scrollLeft = this.position;
      }

      this.lastSet = this.track.scrollLeft;
      this.frame = requestAnimationFrame(this.advance);
    }
  }

  customElements.define('celebrity-carousel', CelebrityCarousel);
}