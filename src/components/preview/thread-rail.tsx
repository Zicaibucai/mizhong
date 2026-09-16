/**
 * 贯穿页面的织线。
 *
 * 左侧留白处一根固定的 1px 铜色经线，随阅读进度自顶向下填充 —— 与页头底边的
 * 进度细线呼应，构成「一根线穿过整页」的视觉线索。
 * 纯 CSS 消费 --pv-progress，不产生额外的 JS 计算；窄屏隐藏，避免占用正文空间。
 */
export function ThreadRail() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-y-0 left-5 z-30 hidden lg:block"
    >
      <div className="relative h-full w-px bg-copper-500/20">
        <div className="pv-rail-fill absolute inset-x-0 top-0 h-full bg-copper-400/80" />
        {/* 进度端点 */}
        <span
          className="absolute -left-[3px] block h-[7px] w-[7px] border border-copper-400 bg-ivory-50"
          style={{ top: 'calc(var(--pv-progress, 0) * (100vh - 7px))' }}
        />
      </div>
    </div>
  );
}
