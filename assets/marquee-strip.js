if (!customElements.get('marquee-strip')) {
  class MarqueeStrip extends HTMLElement {
    connectedCallback() {
      this.groupEl = this.querySelector('[data-ms-group]');
      if (!this.groupEl) return;

      this.pxPerSecond = parseFloat(this.dataset.speed) || 50;
      this.lastWidth = 0;

      // 按"像素/秒"换算一圈的时长，让不同屏幕、不同头像数量下速度一致
      this.applySpeed = () => {
        const width = this.groupEl.scrollWidth;
        if (!width || Math.abs(width - this.lastWidth) < 2) return;
        this.lastWidth = width;
        this.style.setProperty('--ms-duration', (width / this.pxPerSecond).toFixed(2) + 's');
      };

      this.resizeObserver = new ResizeObserver(this.applySpeed);
      this.resizeObserver.observe(this.groupEl);
      this.applySpeed();

      // 不在屏幕内时暂停动画
      this.visibilityObserver = new IntersectionObserver(([entry]) => {
        this.classList.toggle('is-offscreen', !entry.isIntersecting);
      });
      this.visibilityObserver.observe(this);
    }

    disconnectedCallback() {
      if (this.resizeObserver) this.resizeObserver.disconnect();
      if (this.visibilityObserver) this.visibilityObserver.disconnect();
    }
  }

  customElements.define('marquee-strip', MarqueeStrip);
}