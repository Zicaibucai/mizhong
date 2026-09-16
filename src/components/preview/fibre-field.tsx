'use client';

import { useEffect, useRef } from 'react';

/**
 * 首屏纤维场：经线（纵向）与纬线（横向）构成的织物底纹。
 *
 * 性能与克制是这里的第一原则：
 *   - 只在首屏可见、标签页可见时运行；离开视口立即停止 rAF；
 *   - 指针静止时降到约 15fps 的环境漂移，指针移动时才回到逐帧；
 *   - 只绘制细线，不做模糊/阴影/合成模式；
 *   - prefers-reduced-motion 下只画一帧静态图案，不启动循环。
 *
 * 它纯粹是装饰（aria-hidden），所有信息都在 HTML 文本里。
 */
export function FibreField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const context = canvasEl.getContext('2d', { alpha: true });
    if (!context) return;

    // 下面都是函数声明（会被提升），TS 在提升作用域里会丢失可空收窄，
    // 因此这里用显式类型的别名，闭包内直接引用它们。
    const canvas: HTMLCanvasElement = canvasEl;
    const ctx: CanvasRenderingContext2D = context;

    const host = canvas.parentElement ?? canvas;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let frame = 0;
    let running = true;
    let lastDraw = 0;
    let pointerActive = 0;

    const pointer = { x: -9999, y: -9999 };
    let scrollPhase = window.scrollY;

    function resize() {
      const rect = host.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /** 指针附近把经线轻轻推开，形成一个克制的凹陷 */
    function pointerOffset(x: number, y: number) {
      if (pointer.x < -1000) return 0;
      const dx = x - pointer.x;
      const dy = y - pointer.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const radius = 260;
      if (dist > radius) return 0;
      const falloff = 1 - dist / radius;
      return (dx >= 0 ? 1 : -1) * falloff * falloff * 26;
    }

    function draw(time: number) {
      ctx.clearRect(0, 0, width, height);

      const phase = time * 0.00013;
      const drift = (scrollPhase / Math.max(1, height)) * 0.6;

      /* ---- 细纤维：纵向密排，构成织物的"地"（不摆动，只做纹理） ---- */
      const fineStep = width < 700 ? 12 : 9;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= width; x += fineStep) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, height);
      }
      ctx.strokeStyle = 'rgba(198, 211, 224, 0.045)';
      ctx.stroke();

      /* ---- 经线：纵向丝束，构成织物的主体，随指针轻微让位 ---- */
      const warpCount = Math.max(10, Math.min(42, Math.round(width / 52)));
      for (let i = 0; i < warpCount; i += 1) {
        const baseX = ((i + 0.5) / warpCount) * width;
        const amplitude = 5 + (i % 4) * 2.4;
        ctx.beginPath();
        for (let y = -20; y <= height + 20; y += 18) {
          const x =
            baseX +
            Math.sin(y * 0.0037 + phase + i * 0.42) * amplitude +
            pointerOffset(baseX, y);
          if (y <= -20) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        const accent = i % 7 === 3;
        ctx.strokeStyle = accent
          ? 'rgba(213, 178, 115, 0.40)'
          : `rgba(198, 211, 224, ${0.17 + (i % 3) * 0.055})`;
        ctx.lineWidth = accent ? 1.25 : 1.05;
        ctx.stroke();
      }

      /* ---- 纬线：横向丝束，随滚动缓慢漂移 ---- */
      const weftCount = width < 700 ? 9 : 16;
      for (let i = 0; i < weftCount; i += 1) {
        const baseY = ((i + 0.5) / weftCount) * height;
        ctx.beginPath();
        for (let x = 0; x <= width; x += 22) {
          const y =
            baseY +
            Math.sin(x * 0.0052 + phase * 2.2 + i * 0.62) * (3.2 + (i % 3)) +
            drift * 10;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = i % 5 === 2 ? 'rgba(213, 178, 115, 0.18)' : 'rgba(198, 211, 224, 0.085)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      /* ---- 一束穿过画面的强纬线，作为视觉锚点 ---- */
      const anchorY = height * 0.62 + Math.sin(phase * 1.6) * 10;
      const anchorPath = (offset: number) => {
        ctx.beginPath();
        for (let x = 0; x <= width; x += 18) {
          const y = anchorY + offset + Math.sin(x * 0.004 + phase * 2.4) * 6;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };

      // 两侧阴影让这根线"压"在织物上
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.30)';
      ctx.lineWidth = 1;
      for (const dy of [-3, 3]) anchorPath(dy);

      ctx.strokeStyle = 'rgba(213, 178, 115, 0.34)';
      ctx.lineWidth = 1.2;
      anchorPath(0);
    }

    function loop(time: number) {
      if (!running) return;
      frame = requestAnimationFrame(loop);

      // 指针静止时降频：环境漂移本身极慢，15fps 肉眼无差别
      const interval = pointerActive > 0 ? 0 : 64;
      if (interval && time - lastDraw < interval) return;
      lastDraw = time;
      if (pointerActive > 0) pointerActive -= 1;

      draw(time);
    }

    function onPointerMove(event: PointerEvent) {
      const rect = host.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointerActive = 24;
    }

    function onPointerLeave() {
      pointer.x = -9999;
      pointer.y = -9999;
      pointerActive = 24;
    }

    function onScroll() {
      scrollPhase = window.scrollY;
      pointerActive = 8;
    }

    resize();
    draw(reduceMotion ? 0 : performance.now());

    if (reduceMotion) return () => undefined;

    // 离开视口或切到后台就停，回来再继续
    const visibility = new IntersectionObserver(
      ([entry]) => {
        const shouldRun = entry.isIntersecting && !document.hidden;
        if (shouldRun && !running) {
          running = true;
          frame = requestAnimationFrame(loop);
        } else if (!shouldRun && running) {
          running = false;
          cancelAnimationFrame(frame);
        }
      },
      { threshold: 0 },
    );
    visibility.observe(host);

    function onVisibilityChange() {
      if (document.hidden && running) {
        running = false;
        cancelAnimationFrame(frame);
      } else if (!document.hidden && !running) {
        running = true;
        frame = requestAnimationFrame(loop);
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      resize();
      draw(performance.now());
    });

    resizeObserver.observe(host);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);

    frame = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      visibility.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />;
}
