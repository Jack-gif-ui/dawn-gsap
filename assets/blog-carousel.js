if (!customElements.get("blog-carousel")) {
  class BlogCarousel extends HTMLElement {
    connectedCallback() {
      this.track = this.querySelector("[data-bc-track]");
      if (!this.track) return;

      // 清掉旧版本留下的克隆卡片
      this.track
        .querySelectorAll("[data-bc-clone]")
        .forEach((el) => el.remove());

      // 移动端指示器：固定两个胶囊。页面里没有就自动补上
      const dotsEl = this.querySelector(".bc__dots");
      if (dotsEl && !dotsEl.querySelector("[data-bc-pill]")) {
        dotsEl.innerHTML =
          '<button type="button" class="bc__dot is-active" data-bc-pill="prev" aria-label="Previous article"></button>' +
          '<button type="button" class="bc__dot" data-bc-pill="next" aria-label="Next article"></button>';
      }

      this.prev = this.querySelector("[data-bc-prev]");
      this.next = this.querySelector("[data-bc-next]");
      this.fill = this.querySelector("[data-bc-fill]");
      this.pills = [...this.querySelectorAll("[data-bc-pill]")];
      this.cards = [...this.track.children];
      this.reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.loop = this.hasAttribute("data-loop");
      this.facing = "prev"; // 'prev'：深色胶囊在左；'next'：深色胶囊在右
      this.lastLeft = 0;
      this.ticking = false;
      this.touch = null;

      this.onScroll = () => {
        if (this.ticking) return;
        this.ticking = true;
        requestAnimationFrame(() => {
          this.ticking = false;
          this.update();
        });
      };
      this.onUserInput = () => this.stopTween();

      // 在最右侧时再向左滑，回到第一篇
      this.onTouchStart = (e) => {
        this.stopTween();
        const t = e.touches[0];
        this.touch = {
          x: t.clientX,
          y: t.clientY,
          atEnd:
            this.track.scrollLeft >= this.maxScroll - 2 && this.maxScroll > 2,
        };
      };
      this.onTouchEnd = (e) => {
        const start = this.touch;
        this.touch = null;
        if (!start || !this.loop || !start.atEnd) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        if (dx < -40 && Math.abs(dx) > Math.abs(dy)) {
          this.scrollToX(0, 1);
        }
      };

      this.track.addEventListener("scroll", this.onScroll, { passive: true });
      ["pointerdown", "wheel"].forEach((evt) =>
        this.track.addEventListener(evt, this.onUserInput, { passive: true }),
      );
      this.track.addEventListener("touchstart", this.onTouchStart, {
        passive: true,
      });
      this.track.addEventListener("touchend", this.onTouchEnd, {
        passive: true,
      });
      this.track.addEventListener("touchcancel", () => (this.touch = null), {
        passive: true,
      });

      if (this.prev) this.prev.addEventListener("click", () => this.go(-1));
      if (this.next) this.next.addEventListener("click", () => this.go(1));
      this.pills.forEach((pill) =>
        pill.addEventListener("click", () =>
          this.go(pill.dataset.bcPill === "next" ? 1 : -1),
        ),
      );

      this.resizeObserver = new ResizeObserver(() => this.update());
      this.resizeObserver.observe(this.track);

      this.update();
      this.intro();
    }

    disconnectedCallback() {
      this.stopTween();
      if (this.resizeObserver) this.resizeObserver.disconnect();
      if (this.introObserver) this.introObserver.disconnect();
      if (window.gsap && this.cards) gsap.killTweensOf(this.cards);
    }

    // 相邻两张卡片左边的距离（含间距）
    get step() {
      const [a, b] = this.cards;
      if (a && b) return b.offsetLeft - a.offsetLeft;
      return a ? a.offsetWidth : 1;
    }

    get maxScroll() {
      return this.track.scrollWidth - this.track.clientWidth;
    }

    go(dir) {
      const max = this.maxScroll;
      const left = this.track.scrollLeft;
      if (max <= 2) return;

      const atStart = left <= 2;
      const atEnd = left >= max - 2;

      let target;
      let wrap = false;
      if (this.loop && dir > 0 && atEnd) {
        target = 0;
        wrap = true;
      } else if (this.loop && dir < 0 && atStart) {
        target = max;
        wrap = true;
      } else {
        const step = this.step;
        const current = Math.round(left / step);
        target = Math.max(0, Math.min(max, (current + dir) * step));
      }

      if (Math.abs(target - left) < 2) return;
      this.scrollToX(target, wrap ? 1.2 : 0.9);
    }

    scrollToX(x, duration = 0.9) {
      const track = this.track;

      // 没有 GSAP，或用户开了"减少动态效果"：不做缓动
      if (!window.gsap || this.reduce.matches) {
        track.scrollTo({
          left: x,
          behavior: this.reduce.matches ? "auto" : "smooth",
        });
        return;
      }

      this.stopTween();
      const state = { v: track.scrollLeft };
      track.style.scrollSnapType = "none"; // 缓动期间关掉吸附，避免和补间打架
      this.tween = gsap.to(state, {
        v: x,
        duration,
        ease: "power3.inOut",
        onUpdate: () => {
          track.scrollLeft = state.v;
        },
        onComplete: () => {
          track.style.scrollSnapType = "";
          this.tween = null;
        },
      });
    }

    stopTween() {
      if (this.tween) {
        this.tween.kill();
        this.tween = null;
      }
      if (this.track) this.track.style.scrollSnapType = "";
    }

    update() {
      const t = this.track;
      const max = this.maxScroll;
      const left = t.scrollLeft;
      const scrollable = max > 2;
      const atStart = left <= 2;
      const atEnd = left >= max - 2;

      this.classList.toggle("is-static", !scrollable);

      // 桌面端箭头：只有关闭"循环"时，到头的箭头才会变淡
      if (this.prev) {
        const off = !this.loop && atStart;
        this.prev.classList.toggle("is-disabled", off);
        this.prev.setAttribute("aria-disabled", off);
      }
      if (this.next) {
        const off = !this.loop && atEnd;
        this.next.classList.toggle("is-disabled", off);
        this.next.setAttribute("aria-disabled", off);
      }

      // 桌面端"跟随滚动的进度线"
      if (this.fill && t.scrollWidth > 0 && t.clientWidth > 0) {
        this.fill.style.width = (t.clientWidth / t.scrollWidth) * 100 + "%";
        this.fill.style.transform = `translateX(${(left / t.clientWidth) * 100}%)`;
      }

      // 移动端两个胶囊：到头由位置决定，中间由最近一次滑动方向决定
      const delta = left - this.lastLeft;
      if (Math.abs(delta) > 1) {
        this.facing = delta > 0 ? "next" : "prev";
        this.lastLeft = left;
      }
      if (atStart) this.facing = "prev";
      else if (atEnd) this.facing = "next";

      this.pills.forEach((pill) => {
        const active =
          (pill.dataset.bcPill === "next") === (this.facing === "next");
        pill.classList.toggle("is-active", active);
        if (active) pill.setAttribute("aria-current", "true");
        else pill.removeAttribute("aria-current");
      });
    }

    // 卡片首次进入屏幕：依次上浮淡入
    intro() {
      const inEditor = window.Shopify && Shopify.designMode;
      if (!window.gsap || this.reduce.matches || inEditor) return;

      const cards = this.cards;
      gsap.set(cards, { opacity: 0, y: 36 });

      this.introObserver = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          this.introObserver.disconnect();
          gsap.to(cards, {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: "power3.out",
            stagger: 0.1,
            clearProps: "opacity,transform",
          });
        },
        { threshold: 0.15 },
      );
      this.introObserver.observe(this);
    }
  }

  customElements.define("blog-carousel", BlogCarousel);
}
