import { cn } from '@/lib/cn';

/**
 * 生成式织纹图形（纯 SVG，无外部图片、无位图、无运行时 JS）。
 *
 * 背景：公司尚未提供任何真实产品照片、工厂照片或证书。
 * 按设计要求，此时**不能**使用「媒体占位 / 待上传」之类开发文案，也不能伪造产品影像，
 * 因此这里用可复现的织造结构（罗纹 / 平纹 / 斜纹 / 齿链 / 锯齿 / 网眼 / 折板）作为装饰语言。
 *
 * 尺度约定：viewBox 固定 1200，图案 tile 的尺寸按「渲染宽度 / 1200」等比缩放。
 * 一个 tile 在实际版面上约 10–25px 时，读起来才是「材料」而不是「底纹」——
 * 因此各结构的 tile 都按这个目标取值，纱线本身保持清晰可辨的粗细。
 */

export type WeaveVariant =
  | 'rib' // 织带：密织纵向经线（罗纹）+ 细纬线
  | 'plain' // 标签：平纹经纬交织
  | 'twill' // 斜纹：连续斜向浮线
  | 'teeth' // 拉链：左右齿带交错咬合
  | 'chevron' // 松紧带：锯齿罗纹
  | 'net' // 花边：菱形网眼 + 结点
  | 'fold' // 包装：折板与压痕
  | 'macro' // 材料切片：放大的经纬结构（质检区使用）
  | 'warp'; // 经线场：底纹

type Tone = 'navy' | 'ink' | 'ivory' | 'sand';

interface Palette {
  base: string;
  thread: string;
  accent: string;
  /** 深色底用白色提亮，浅色底用黑色压暗 */
  highlight: string;
  shadow: string;
}

const PALETTES: Record<Tone, Palette> = {
  navy: {
    base: '#160a0d',
    thread: '#a9aaad',
    accent: '#df4a54',
    highlight: '#ffffff',
    shadow: '#000000',
  },
  ink: {
    base: '#251419',
    thread: '#949498',
    accent: '#c6222d',
    highlight: '#ffffff',
    shadow: '#000000',
  },
  ivory: {
    base: '#f2efee',
    thread: '#2c1e22',
    accent: '#ad1e27',
    highlight: '#ffffff',
    shadow: '#000000',
  },
  sand: {
    base: '#d7d3d2',
    thread: '#3a2d31',
    accent: '#c6222d',
    highlight: '#ffffff',
    shadow: '#000000',
  },
};

interface TextileArtworkProps {
  variant: WeaveVariant;
  tone?: Tone;
  /** SVG defs 的 id 前缀，同一页面重复使用同一 variant 时必须区分 */
  uid: string;
  className?: string;
}

const VIEW = 1200;

export function TextileArtwork({ variant, tone = 'navy', uid, className }: TextileArtworkProps) {
  const p = PALETTES[tone];
  const id = (name: string) => `${uid}-${name}`;

  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      className={cn('h-full w-full', className)}
    >
      <defs>
        <WeavePattern variant={variant} id={id} palette={p} />
        {/* 柱面感：让纤维看起来是圆的 */}
        <linearGradient id={id('sheen')} x1="0.05" y1="0" x2="0.95" y2="1">
          <stop offset="0%" stopColor={p.highlight} stopOpacity="0.14" />
          <stop offset="42%" stopColor={p.highlight} stopOpacity="0.02" />
          <stop offset="100%" stopColor={p.shadow} stopOpacity="0.26" />
        </linearGradient>
        <radialGradient id={id('vignette')} cx="46%" cy="38%" r="80%">
          <stop offset="45%" stopColor={p.shadow} stopOpacity="0" />
          <stop offset="100%" stopColor={p.shadow} stopOpacity="0.42" />
        </radialGradient>
      </defs>

      <rect width={VIEW} height={VIEW} fill={p.base} />
      <rect width={VIEW} height={VIEW} fill={`url(#${id('weave')})`} />
      {variant === 'macro' ? <MacroOverlay palette={p} /> : null}
      {variant === 'fold' ? <FoldMarks palette={p} /> : null}
      {variant === 'net' ? <NetNodes palette={p} /> : null}
      <rect width={VIEW} height={VIEW} fill={`url(#${id('sheen')})`} />
      <rect width={VIEW} height={VIEW} fill={`url(#${id('vignette')})`} />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* 织造结构：每种 variant 对应一种真实的织物组织                                  */
/* -------------------------------------------------------------------------- */

function WeavePattern({
  variant,
  id,
  palette: p,
}: {
  variant: WeaveVariant;
  id: (name: string) => string;
  palette: Palette;
}) {
  const warp = id('weave');

  switch (variant) {
    /* 织带：纵向经线密排成罗纹，每隔一段压一道细纬线 */
    case 'rib':
      return (
        <pattern id={warp} width="44" height="220" patternUnits="userSpaceOnUse">
          <rect width="44" height="220" fill={p.base} />
          <rect x="0" width="26" height="220" fill={p.thread} opacity="0.34" />
          <rect x="2" width="7" height="220" fill={p.highlight} opacity="0.10" />
          <rect x="19" width="7" height="220" fill={p.shadow} opacity="0.20" />
          <rect x="0" width="26" height="5" fill={p.thread} opacity="0.30" />
          <rect x="0" width="26" height="5" fill={p.highlight} opacity="0.14" />
          <rect y="110" width="44" height="5" fill={p.thread} opacity="0.24" />
          <rect y="110" width="44" height="2" fill={p.highlight} opacity="0.10" />
          <rect y="118" width="44" height="3" fill={p.shadow} opacity="0.16" />
        </pattern>
      );

    /* 标签：标准平纹，经纬一上一下交错 */
    case 'plain':
      return (
        <pattern id={warp} width="52" height="52" patternUnits="userSpaceOnUse">
          <rect width="52" height="52" fill={p.base} />
          {/* 纬线 */}
          <rect y="0" width="52" height="23" fill={p.thread} opacity="0.26" />
          <rect y="26" width="52" height="23" fill={p.thread} opacity="0.26" />
          <rect y="0" width="52" height="4" fill={p.highlight} opacity="0.10" />
          <rect y="26" width="52" height="4" fill={p.highlight} opacity="0.10" />
          <rect y="21" width="52" height="4" fill={p.shadow} opacity="0.16" />
          <rect y="47" width="52" height="4" fill={p.shadow} opacity="0.16" />
          {/* 经线压过纬线的部分，交错排列形成平纹 */}
          <rect x="0" y="0" width="23" height="23" fill={p.thread} opacity="0.40" />
          <rect x="26" y="26" width="23" height="23" fill={p.thread} opacity="0.40" />
          <rect x="0" y="0" width="6" height="23" fill={p.highlight} opacity="0.12" />
          <rect x="26" y="26" width="6" height="23" fill={p.highlight} opacity="0.12" />
        </pattern>
      );

    /* 斜纹：连续的斜向浮线，2/2 斜纹的视觉节奏 */
    case 'twill':
      return (
        <pattern id={warp} width="72" height="72" patternUnits="userSpaceOnUse">
          <rect width="72" height="72" fill={p.base} />
          <path d="M-12 72 L72 -12" stroke={p.thread} strokeWidth="22" opacity="0.22" />
          <path d="M-12 36 L36 -12" stroke={p.thread} strokeWidth="22" opacity="0.34" />
          <path d="M36 84 L84 36" stroke={p.thread} strokeWidth="22" opacity="0.34" />
          <path d="M-12 36 L36 -12" stroke={p.highlight} strokeWidth="4" opacity="0.12" />
          <path d="M36 84 L84 36" stroke={p.highlight} strokeWidth="4" opacity="0.12" />
          <path d="M-12 72 L72 -12" stroke={p.accent} strokeWidth="2" opacity="0.20" />
        </pattern>
      );

    /* 拉链：左右齿带交错咬合，中央为链牙轨道 */
    case 'teeth':
      return (
        <pattern id={warp} width="132" height="56" patternUnits="userSpaceOnUse">
          <rect width="132" height="56" fill={p.base} />
          {/* 左右两条织带 */}
          <rect width="48" height="56" fill={p.thread} opacity="0.14" />
          <rect x="84" width="48" height="56" fill={p.thread} opacity="0.14" />
          <rect y="52" width="132" height="4" fill={p.shadow} opacity="0.14" />
          {/* 中央链牙轨道 */}
          <rect x="58" width="16" height="56" fill={p.shadow} opacity="0.30" />
          <rect x="58" width="3" height="56" fill={p.accent} opacity="0.40" />
          <rect x="71" width="3" height="56" fill={p.accent} opacity="0.40" />
          {/* 交错咬合的链牙 */}
          <rect x="34" y="4" width="32" height="18" rx="5" fill={p.thread} opacity="0.48" />
          <rect x="66" y="32" width="32" height="18" rx="5" fill={p.thread} opacity="0.48" />
          <rect x="34" y="4" width="32" height="4" rx="2" fill={p.highlight} opacity="0.16" />
          <rect x="66" y="32" width="32" height="4" rx="2" fill={p.highlight} opacity="0.16" />
          <rect x="34" y="18" width="32" height="4" fill={p.shadow} opacity="0.22" />
          <rect x="66" y="46" width="32" height="4" fill={p.shadow} opacity="0.22" />
        </pattern>
      );

    /* 松紧带：锯齿/人字罗纹，弹性织物常见的组织结构 */
    case 'chevron':
      return (
        <pattern id={warp} width="140" height="80" patternUnits="userSpaceOnUse">
          <rect width="140" height="80" fill={p.base} />
          <path
            d="M0 62 L35 16 L70 62 L105 16 L140 62"
            fill="none"
            stroke={p.thread}
            strokeWidth="18"
            strokeLinejoin="round"
            opacity="0.38"
          />
          <path
            d="M0 62 L35 16 L70 62 L105 16 L140 62"
            fill="none"
            stroke={p.highlight}
            strokeWidth="4"
            strokeLinejoin="round"
            opacity="0.12"
          />
          <path
            d="M0 98 L35 52 L70 98 L105 52 L140 98"
            fill="none"
            stroke={p.thread}
            strokeWidth="18"
            strokeLinejoin="round"
            opacity="0.25"
          />
          <path
            d="M0 62 L35 16 L70 62 L105 16 L140 62"
            fill="none"
            stroke={p.accent}
            strokeWidth="2"
            opacity="0.26"
          />
        </pattern>
      );

    /* 花边：菱形网眼 + 结点，六角网眼的简化几何 */
    case 'net':
      return (
        <pattern id={warp} width="180" height="108" patternUnits="userSpaceOnUse">
          <rect width="180" height="108" fill={p.base} />
          <path
            d="M0 108 L45 24 L135 24 L180 108 M90 -12 L0 108 M90 -12 L180 108"
            fill="none"
            stroke={p.thread}
            strokeWidth="5"
            opacity="0.36"
          />
          <path d="M45 24 L135 24" stroke={p.thread} strokeWidth="3" opacity="0.24" />
          <path d="M90 -12 L90 24" stroke={p.thread} strokeWidth="3" opacity="0.24" />
          <path
            d="M0 108 L45 24"
            stroke={p.highlight}
            strokeWidth="1.5"
            opacity="0.12"
          />
        </pattern>
      );

    /* 包装：折板与压痕，配合 FoldMarks 形成盒面结构 */
    case 'fold':
      return (
        <pattern id={warp} width="300" height="300" patternUnits="userSpaceOnUse">
          <rect width="300" height="300" fill={p.base} />
          <path d="M0 300 L300 0" stroke={p.thread} strokeWidth="5" opacity="0.16" />
          <path d="M0 300 L300 0" stroke={p.highlight} strokeWidth="1.5" opacity="0.10" />
          <path
            d="M-150 150 L150 -150 M150 450 L450 150"
            stroke={p.thread}
            strokeWidth="2.5"
            opacity="0.10"
          />
        </pattern>
      );

    /* 材料切片：放大的经纬交织，用于质检区的「材料细节」 */
    case 'macro':
      return (
        <pattern id={warp} width="300" height="300" patternUnits="userSpaceOnUse">
          <rect width="300" height="300" fill={p.base} />
          {/* 纬线束（横向） */}
          {[0, 75, 150, 225].map((y) => (
            <g key={`w-${y}`}>
              <rect y={y + 8} width="300" height="60" fill={p.thread} opacity="0.21" />
              <rect y={y + 8} width="300" height="10" fill={p.highlight} opacity="0.075" />
              <rect y={y + 60} width="300" height="9" fill={p.shadow} opacity="0.30" />
            </g>
          ))}
          {/* 经线束（纵向），压过纬线的部分更亮 */}
          {[0, 60, 120, 180, 240].map((x) => (
            <rect key={`s-${x}`} x={x + 8} width="46" height="300" fill={p.thread} opacity="0.15" />
          ))}
          {[30, 90, 150, 210, 270].map((x) => (
            <g key={`h-${x}`}>
              <rect x={x} width="20" height="300" fill={p.thread} opacity="0.26" />
              <rect x={x} width="6" height="300" fill={p.highlight} opacity="0.085" />
            </g>
          ))}
          <rect width="300" height="300" fill={p.shadow} opacity="0.10" />
        </pattern>
      );

    /* 经线场：底纹，极低对比的纵向纤维 */
    default:
      return (
        <pattern id={warp} width="64" height="600" patternUnits="userSpaceOnUse">
          <rect width="64" height="600" fill={p.base} />
          <rect x="8" width="5" height="600" fill={p.thread} opacity="0.16" />
          <rect x="38" width="3" height="600" fill={p.thread} opacity="0.10" />
          <rect x="54" width="7" height="600" fill={p.accent} opacity="0.06" />
        </pattern>
      );
  }
}

/* -------------------------------------------------------------------------- */
/* 结构附加件                                                                    */
/* -------------------------------------------------------------------------- */

/** 材料切片上的布边（selvedge）：一侧更密实的经线收边 + 一道裁剪断口 */
function MacroOverlay({ palette: p }: { palette: Palette }) {
  return (
    <g>
      <rect x="0" y="0" width="170" height={VIEW} fill={p.base} opacity="0.62" />
      {Array.from({ length: 8 }, (_, i) => (
        <rect
          key={i}
          x={8 + i * 20}
          width="9"
          height={VIEW}
          fill={p.thread}
          opacity="0.30"
        />
      ))}
      <rect x="164" y="0" width="4" height={VIEW} fill={p.accent} opacity="0.40" />
      <rect x="170" y="0" width="3" height={VIEW} fill={p.shadow} opacity="0.30" />
      <path
        d="M232 0 L240 120 L228 250 L244 380 L232 520 L241 660 L229 800 L242 940 L232 1080 L238 1200"
        fill="none"
        stroke={p.accent}
        strokeWidth="3"
        opacity="0.30"
      />
    </g>
  );
}

/** 包装折板：盒面的压痕与封口线 */
function FoldMarks({ palette: p }: { palette: Palette }) {
  return (
    <g>
      <rect
        x="130"
        y="130"
        width={VIEW - 260}
        height={VIEW - 260}
        fill="none"
        stroke={p.thread}
        strokeWidth="4"
        opacity="0.30"
      />
      <rect
        x="230"
        y="230"
        width={VIEW - 460}
        height={VIEW - 460}
        fill="none"
        stroke={p.accent}
        strokeWidth="2"
        opacity="0.26"
      />
      <path d={`M130 600 L${VIEW - 130} 600`} stroke={p.thread} strokeWidth="3" opacity="0.22" />
    </g>
  );
}

/** 花边结点：沿网眼交叉点分布的刺绣点 */
function NetNodes({ palette: p }: { palette: Palette }) {
  const nodes: Array<[number, number]> = [
    [180, 180],
    [420, 300],
    [660, 180],
    [900, 300],
    [1020, 180],
    [300, 540],
    [540, 660],
    [780, 540],
    [1020, 660],
    [180, 900],
    [420, 1020],
    [660, 900],
    [900, 1020],
  ];
  return (
    <g>
      {nodes.map(([cx, cy]) => (
        <g key={`${cx}-${cy}`}>
          <circle cx={cx} cy={cy} r="9" fill={p.accent} opacity="0.30" />
          <circle cx={cx} cy={cy} r="4" fill={p.highlight} opacity="0.14" />
        </g>
      ))}
    </g>
  );
}
