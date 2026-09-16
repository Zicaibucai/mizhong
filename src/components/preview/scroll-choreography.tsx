'use client';

import { useEffect } from 'react';

/**
 * 页面动效总控（全站唯一的滚动监听）。
 *
 * 设计原则：动画本身全部写在 CSS 里，客户端只负责把「状态」写进 CSS 变量。
 *   --pv-progress    0→1 阅读进度（进度条 / 侧边织线消费）
 *   --pv-hero-shift  首屏视差位移（px，视口内封顶，避免长页面位移失控）
 * header[data-scrolled]  页头透明 / 实底状态
 *
 * 这样每个区块都保持为服务器组件，客户端只有这一个常驻循环，
 * 且只写 transform / opacity，不触发重排。
 */
export function ScrollChoreography() {
  useEffect(() => {
    const root = document.documentElement;
    const header = document.querySelector<HTMLElement>('[data-pv-header]');
    const hero = document.querySelector<HTMLElement>('[data-pv-hero]');

    let heroThreshold = window.innerHeight * 0.8;
    let maxScroll = 1;
    let ticking = false;

    function measure() {
      maxScroll = Math.max(1, root.scrollHeight - window.innerHeight);
      heroThreshold = hero ? Math.max(120, hero.offsetHeight - 80) : window.innerHeight * 0.8;
    }

    function write() {
      ticking = false;
      const y = window.scrollY || root.scrollTop;
      const progress = Math.min(1, Math.max(0, y / maxScroll));

      root.style.setProperty('--pv-progress', progress.toFixed(4));
      root.style.setProperty('--pv-hero-shift', `${Math.min(y, window.innerHeight)}px`);

      if (header) {
        header.dataset.scrolled = y > heroThreshold ? 'true' : 'false';
      }
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(write);
    }

    /* ---- 进入视口揭示：统一一个 observer，元素侧零 JS ---- */
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>('[data-reveal], [data-reveal-lines]'),
    );

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add('is-visible');
            observer?.unobserve(entry.target);
          }
        },
        // 元素露出约 12% 时触发，底部留出一点提前量，避免「看见才动」
        { rootMargin: '0px 0px -12% 0px', threshold: 0.01 },
      );
      for (const target of targets) observer.observe(target);
    } else {
      for (const target of targets) target.classList.add('is-visible');
    }

    measure();
    write();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => {
      measure();
      onScroll();
    });

    return () => {
      observer?.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return null;
}
