if (!customElements.get('card-gallery')) {
  class CardGallery extends HTMLElement {
    connectedCallback() {
      this.track = this.querySelector('[data-cg-track]');
      if (!this.track) return;

      this.slides = [...this.querySelectorAll('[data-cg-slide]')];
      this.thumb = this.querySelector('[data-cg-thumb]');
      this.prevBtn = this.querySelector('[data-cg-prev]');
      this.nextBtn = this.querySelector('[data-cg-next]');
      this.reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.current = 0;
      this.targetIndex = null; // 正在滑向哪一张（连续点击时，从这里接着算）
      this.tween = null;
      this.ticking = false;

      this.onScroll = () => {
        if (this.ticking) return;
        this.ticking = true;
        requestAnimationFrame(() => {
          this.ticking = false;
          this.sync();
        });
      };
      this.onPrev = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.go(-1);
      };
      this.onNext = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.go(1);
      };
      // 用户自己拖动或横向滚动时，停掉正在播放的缓动
      this.onUserInput = () => this.stopTween();
      this.onWheel = (e) => {
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) this.stopTween();
      };
      // 第一次悬停、聚焦或触摸时，把这张卡片的图片全部加载好
      this.onIntent = () => this.loadAll();

      this.track.addEventListener('scroll', this.onScroll, { passive: true });
      this.track.addEventListener('pointerdown', this.onUserInput, { passive: true });
      this.track.addEventListener('touchstart', this.onUserInput, { passive: true });
      this.track.addEventListener('wheel', this.onWheel, { passive: true });
      window.addEventListener('resize', this.onScroll, { passive: true });
      if (this.prevBtn) this.prevBtn.addEventListener('click', this.onPrev);
      if (this.nextBtn) this.nextBtn.addEventListener('click', this.onNext);

      ['pointerenter', 'focusin'].forEach((evt) =>
        this.addEventListener(evt, this.onIntent, { passive: true, once: true })
      );

      // 没有悬停能力的设备（手机）：卡片接近屏幕时，只先加载下一张图，滑动时再按需加载
      if (window.matchMedia('(hover: none)').matches && 'IntersectionObserver' in window) {
        this.io = new IntersectionObserver(
          (entries) => {
            if (entries.some((e) => e.isIntersecting)) {
              this.load(1);
              this.io.disconnect();
            }
          },
          { rootMargin: '200px' }
        );
        this.io.observe(this);
      }

      this.sync();
    }

    disconnectedCallback() {
      this.stopTween();
      if (this.track) {
        this.track.removeEventListener('scroll', this.onScroll);
        this.track.removeEventListener('pointerdown', this.onUserInput);
        this.track.removeEventListener('touchstart', this.onUserInput);
        this.track.removeEventListener('wheel', this.onWheel);
      }
      window.removeEventListener('resize', this.onScroll);
      if (this.prevBtn) this.prevBtn.removeEventListener('click', this.onPrev);
      if (this.nextBtn) this.nextBtn.removeEventListener('click', this.onNext);
      if (this.io) this.io.disconnect();
    }

    // 把第 i 张图从占位换成真正的图片
    load(i) {
      const slide = this.slides[i];
      const img = slide && slide.querySelector('img');
      if (!img || !img.dataset.src || img.dataset.cgLoaded) return;
      img.dataset.cgLoaded = '1';
      img.loading = 'eager';
      if (img.dataset.srcset) img.srcset = img.dataset.srcset;
      img.src = img.dataset.src;
    }

    loadAll() {
      this.slides.forEach((_, i) => this.load(i));
    }

    // dir 为 -1 或 1；到头后循环到另一端
    go(dir) {
      const last = this.slides.length - 1;
      const base = this.targetIndex !== null ? this.targetIndex : this.current;
      let target = base + dir;
      if (target < 0) target = last;
      else if (target > last) target = 0;
      this.moveTo(target);
    }

    moveTo(index) {
      const track = this.track;
      const left = index * track.clientWidth;

      this.loadAll(); // 长距离滑动会经过中间的图，先全部加载，避免出现空白
      this.targetIndex = index;

      // 没有 GSAP，或用户开了"减少动态效果"：不做缓动
      if (!window.gsap || this.reduce.matches) {
        track.scrollTo({ left, behavior: this.reduce.matches ? 'auto' : 'smooth' });
        return;
      }

      if (this.tween) {
        this.tween.kill();
        this.tween = null;
      }

      const state = { v: track.scrollLeft };
      const distance = Math.abs(index - this.current);
      track.style.scrollSnapType = 'none'; // 缓动期间关掉吸附，避免和补间打架

      this.tween = gsap.to(state, {
        v: left,
        // 一步约 0.5 秒，跨得越远越长，最长 1.1 秒
        duration: Math.min(1.1, 0.5 + 0.12 * Math.max(0, distance - 1)),
        ease: 'power3.inOut',
        onUpdate: () => {
          track.scrollLeft = state.v;
        },
        onComplete: () => {
          track.style.scrollSnapType = '';
          this.tween = null;
          this.targetIndex = null;
        },
      });
    }

    stopTween() {
      if (this.tween) {
        this.tween.kill();
        this.tween = null;
      }
      if (this.track) this.track.style.scrollSnapType = '';
      this.targetIndex = null;
    }

    // 每一帧：让底部滑块跟随当前的滚动位置；换到新的一张时，顺带加载相邻的图
    sync() {
      const w = this.track.clientWidth;
      if (!w) return;
      const last = this.slides.length - 1;
      const k = Math.min(last, Math.max(0, this.track.scrollLeft / w));

      // 滑块宽度是 1/N，百分比位移以滑块自己的宽度为基准，所以位移 k × 100% 就是 k 格
      if (this.thumb) this.thumb.style.transform = `translate3d(${k * 100}%, 0, 0)`;

      const i = Math.round(k);
      if (i !== this.current) {
        this.current = i;
        this.load(i);
        this.load(i + 1);
      }
    }
  }

  customElements.define('card-gallery', CardGallery);
}