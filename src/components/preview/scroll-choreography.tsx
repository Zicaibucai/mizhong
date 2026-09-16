'use client';

import { useEffect } from 'react';

/**
 * 页面动效总控（全站唯一的滚动监听）。
 *
 * 设计原则：动画本身全部写在 CSS 里，客户端只负责把「状态」写进 DOM / CSS 变量。
 *   --pv-progress        0→1 阅读进度（进度条 / 侧边织线消费）
 *   --pv-hero-shift      首屏视差位移（px，视口内封顶，避免长页面位移失控）
 *   header[data-scrolled]    页头透明 / 实底状态
 *   [data-pv-anim='on']  滚动揭示的「初始隐藏」开关（见下）
 *   [data-stage-row] / [data-stage-nav] 的 data-active  当前采购阶段
 *
 * 内容可见性优先于动效：
 *   1. 服务器渲染的 HTML 默认就是终态，无需任何 JS 也完整可读；
 *   2. 只有确认 IntersectionObserver 可用、且用户未要求减少动效时，才把
 *      首屏内的元素先标记为可见，再加 [data-pv-anim='on'] 隐藏视口外的元素；
 *   3. 除 observer 外还有「滚动兜底扫描」与「超时全量显示」两道保险，
 *      任何情况下都不会有内容停留在隐藏态。
 */
export function ScrollChoreography() {
  useEffect(() => {
    const root = document.documentElement;
    const header = document.querySelector<HTMLElement>('[data-pv-header]');
    const hero = document.querySelector<HTMLElement>('[data-pv-hero]');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let heroThreshold = window.innerHeight * 0.8;
    let maxScroll = 1;
    let ticking = false;
    let lastProgress = -1;
    let lastShift = -1;
    let lastScrolled: string | null = null;

    function measure() {
      maxScroll = Math.max(1, root.scrollHeight - window.innerHeight);
      heroThreshold = hero ? Math.max(120, hero.offsetHeight - 80) : window.innerHeight * 0.8;
    }

    function write() {
      ticking = false;
      const y = window.scrollY || root.scrollTop;
      const progress = +Math.min(1, Math.max(0, y / maxScroll)).toFixed(4);

      if (progress !== lastProgress) {
        root.style.setProperty('--pv-progress', String(progress));
        lastProgress = progress;
      }

      if (!reduceMotion) {
        const shift = Math.round(Math.min(y, window.innerHeight));
        if (shift !== lastShift) {
          root.style.setProperty('--pv-hero-shift', `${shift}px`);
          lastShift = shift;
        }
      }

      if (header) {
        const state = y > heroThreshold ? 'true' : 'false';
        if (state !== lastScrolled) {
          header.dataset.scrolled = state;
          lastScrolled = state;
        }
      }

      sweep();
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
    const pending = targets.slice();

    function reveal(element: HTMLElement) {
      element.classList.add('is-visible');
      const index = pending.indexOf(element);
      if (index >= 0) pending.splice(index, 1);
    }

    function revealAll() {
      for (const element of pending.slice()) reveal(element);
    }

    /** 兜底扫描：observer 漏掉的（快速滚动、锚点跳转、元素尺寸变化）在这里补上 */
    function sweep() {
      if (pending.length === 0) return;
      const limit = window.innerHeight * 0.94;
      for (const element of pending.slice()) {
        if (element.getBoundingClientRect().top < limit) reveal(element);
      }
    }

    let observer: IntersectionObserver | null = null;
    const canAnimate = !reduceMotion && typeof IntersectionObserver !== 'undefined';

    if (canAnimate) {
      // 先标记首屏内的元素，再加动画开关：两者在同一个同步块里完成，
      // 浏览器不会绘制出「内容先消失再出现」的中间帧。
      sweep();
      root.setAttribute('data-pv-anim', 'on');

      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            reveal(entry.target as HTMLElement);
            observer?.unobserve(entry.target);
          }
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0 },
      );

      for (const target of pending.slice()) observer.observe(target);
    } else {
      revealAll();
    }

    /* ---- 采购流程：当前阶段 ---- */

    const stageRows = Array.from(document.querySelectorAll<HTMLElement>('[data-stage-row]'));
    const stageNavs = Array.from(document.querySelectorAll<HTMLElement>('[data-stage-nav]'));
    let stageObserver: IntersectionObserver | null = null;

    function setStage(index: number) {
      for (const row of stageRows) {
        row.dataset.active = Number(row.dataset.stageIndex) === index ? 'true' : 'false';
      }
      for (const nav of stageNavs) {
        nav.dataset.active = Number(nav.dataset.stageIndex) === index ? 'true' : 'false';
      }
    }

    if (stageRows.length > 0 && typeof IntersectionObserver !== 'undefined') {
      setStage(0);
      stageObserver = new IntersectionObserver(
        (entries) => {
          let best: { index: number; ratio: number } | null = null;
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const index = Number((entry.target as HTMLElement).dataset.stageIndex ?? '0');
            if (!best || entry.intersectionRatio > best.ratio) {
              best = { index, ratio: entry.intersectionRatio };
            }
          }
          if (best) setStage(best.index);
        },
        { rootMargin: '-35% 0px -35% 0px', threshold: 0 },
      );
      for (const row of stageRows) stageObserver.observe(row);
    }

    measure();
    write();

    /* 超时保险：无论 observer 是否按预期工作，最终都呈现完整内容 */
    const failsafe = window.setTimeout(revealAll, 4000);

    function onResize() {
      measure();
      onScroll();
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    return () => {
      window.clearTimeout(failsafe);
      observer?.disconnect();
      stageObserver?.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return null;
}
