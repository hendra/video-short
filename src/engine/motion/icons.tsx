import React from "react";

export const DARK_TECH = {
  bg: "#0b0f17",
  surface: "rgba(15, 23, 42, 0.9)",
  surfaceAlt: "rgba(30, 41, 59, 0.78)",
  border: "rgba(148, 163, 184, 0.22)",
  mint: "#7fe3c4",
  cyan: "#38bdf8",
  violet: "#a78bfa",
  amber: "#fbbf24",
  red: "#f87171",
  ink: "#f8fafc",
  muted: "#94a3b8",
} as const;

export const TECH_ICON_NAMES = [
  "sparkle",
  "terminal",
  "code",
  "brain",
  "bot",
  "folder",
  "file",
  "git",
  "plug",
  "shield",
  "lock",
  "image",
  "video",
  "clock",
  "bolt",
  "check",
  "x",
  "warning",
  "search",
  "copy",
  "sliders",
  "layers",
  "database",
  "globe",
] as const;

export type TechIconName = (typeof TECH_ICON_NAMES)[number];

type IconRenderer = (color: string, accent: string) => React.ReactNode;

const ICONS: Record<TechIconName, IconRenderer> = {
  sparkle: (c, a) => (
    <>
      <path
        d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3z"
        fill={a}
        fillOpacity={0.2}
        stroke={c}
      />
      <path d="M19 3.5v3M17.5 5h3" stroke={a} />
    </>
  ),
  terminal: (c, a) => (
    <>
      <rect x={3} y={4} width={18} height={16} rx={3} fill={a} fillOpacity={0.14} stroke={c} />
      <path d="M7.5 9.5l3.5 2.5-3.5 2.5" stroke={c} />
      <path d="M13 14.5h3.5" stroke={a} />
    </>
  ),
  code: (c, a) => (
    <>
      <path d="M8 7l-5 5 5 5M16 7l5 5-5 5" stroke={c} />
      <path d="M14 5l-4 14" stroke={a} />
    </>
  ),
  brain: (c, a) => (
    <>
      <path
        d="M12 5a3.5 3.5 0 0 0-6.5 1.8A3.2 3.2 0 0 0 4 12a3.2 3.2 0 0 0 2 5.2A3.5 3.5 0 0 0 12 19a3.5 3.5 0 0 0 6-1.8A3.2 3.2 0 0 0 20 12a3.2 3.2 0 0 0-1.5-5.2A3.5 3.5 0 0 0 12 5z"
        fill={a}
        fillOpacity={0.16}
        stroke={c}
      />
      <path d="M12 5v14M8.5 9.5c1 .4 2 .4 3.5 0M12 13.5c1.5.4 2.5.4 3.5 0" stroke={a} />
    </>
  ),
  bot: (c, a) => (
    <>
      <path d="M12 4v3" stroke={c} />
      <circle cx={12} cy={3.5} r={1} fill={a} stroke={a} />
      <rect x={4} y={7} width={16} height={12} rx={4} fill={a} fillOpacity={0.15} stroke={c} />
      <circle cx={9} cy={12.5} r={1.1} fill={a} stroke="none" />
      <circle cx={15} cy={12.5} r={1.1} fill={a} stroke="none" />
      <path d="M9 16h6" stroke={c} />
    </>
  ),
  folder: (c, a) => (
    <>
      <path
        d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"
        fill={a}
        fillOpacity={0.16}
        stroke={c}
      />
      <path d="M3 10h18" stroke={a} />
    </>
  ),
  file: (c, a) => (
    <>
      <path
        d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"
        fill={a}
        fillOpacity={0.15}
        stroke={c}
      />
      <path d="M14 3v4h4" stroke={c} />
      <path d="M8.5 12h7M8.5 16h4.5" stroke={a} />
    </>
  ),
  git: (c, a) => (
    <>
      <path d="M6 8v8M6 16c0-4 12-2 12-6" stroke={c} />
      <circle cx={6} cy={6} r={2} fill={a} fillOpacity={0.25} stroke={a} />
      <circle cx={6} cy={18} r={2} fill={a} fillOpacity={0.25} stroke={c} />
      <circle cx={18} cy={8} r={2} fill={a} fillOpacity={0.25} stroke={a} />
    </>
  ),
  plug: (c, a) => (
    <>
      <path d="M9 3v4M15 3v4" stroke={a} />
      <path
        d="M6 7h12v4a6 6 0 0 1-12 0V7z"
        fill={a}
        fillOpacity={0.18}
        stroke={c}
      />
      <path d="M12 17v4" stroke={c} />
    </>
  ),
  shield: (c, a) => (
    <>
      <path
        d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z"
        fill={a}
        fillOpacity={0.16}
        stroke={c}
      />
      <path d="M9 12l2 2 4-4" stroke={a} />
    </>
  ),
  lock: (c, a) => (
    <>
      <path d="M7.5 11V7.5a4.5 4.5 0 0 1 9 0V11" stroke={c} />
      <rect x={5} y={11} width={14} height={10} rx={2.5} fill={a} fillOpacity={0.18} stroke={c} />
      <circle cx={12} cy={16} r={1.3} fill={a} stroke="none" />
    </>
  ),
  image: (c, a) => (
    <>
      <rect x={3} y={4} width={18} height={16} rx={2.5} fill={a} fillOpacity={0.14} stroke={c} />
      <circle cx={8.5} cy={9.5} r={1.4} fill={a} stroke="none" />
      <path d="M4.5 17.5l4.5-4.5 3.5 3.5 3-3 4 4" stroke={a} />
    </>
  ),
  video: (c, a) => (
    <>
      <rect x={3} y={5} width={18} height={14} rx={2.5} fill={a} fillOpacity={0.14} stroke={c} />
      <path d="M10 9l5.5 3-5.5 3V9z" fill={a} stroke={a} />
    </>
  ),
  clock: (c, a) => (
    <>
      <circle cx={12} cy={12} r={9} fill={a} fillOpacity={0.14} stroke={c} />
      <path d="M12 7v5l3.5 2" stroke={a} />
    </>
  ),
  bolt: (c, a) => (
    <path
      d="M13 2L4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5z"
      fill={a}
      fillOpacity={0.22}
      stroke={c}
    />
  ),
  check: (c, a) => (
    <>
      <circle cx={12} cy={12} r={9} fill={a} fillOpacity={0.16} stroke={c} />
      <path d="M8.5 12.5l2.5 2.5 5-5.5" stroke={a} />
    </>
  ),
  x: (c, a) => (
    <>
      <circle cx={12} cy={12} r={9} fill={a} fillOpacity={0.15} stroke={c} />
      <path d="M9 9l6 6M15 9l-6 6" stroke={a} />
    </>
  ),
  warning: (c, a) => (
    <>
      <path
        d="M12 3.5L2.5 19.5h19L12 3.5z"
        fill={a}
        fillOpacity={0.18}
        stroke={c}
      />
      <path d="M12 9.5v4.5" stroke={a} />
      <circle cx={12} cy={17} r={1} fill={a} stroke="none" />
    </>
  ),
  search: (c, a) => (
    <>
      <circle cx={10.5} cy={10.5} r={6.5} fill={a} fillOpacity={0.16} stroke={c} />
      <path d="M15.5 15.5L20.5 20.5" stroke={a} />
    </>
  ),
  copy: (c, a) => (
    <>
      <path
        d="M5.5 15.5H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8.5a2 2 0 0 1 2 2v.5"
        stroke={c}
      />
      <rect x={8.5} y={8.5} width={12} height={12} rx={2} fill={a} fillOpacity={0.18} stroke={a} />
    </>
  ),
  sliders: (c, a) => (
    <>
      <path d="M3 6h3.5M11.5 6H21" stroke={c} />
      <circle cx={9} cy={6} r={2} fill={a} fillOpacity={0.25} stroke={a} />
      <path d="M3 12h9.5M17.5 12H21" stroke={c} />
      <circle cx={15} cy={12} r={2} fill={a} fillOpacity={0.25} stroke={a} />
      <path d="M3 18h4.5M12.5 18H21" stroke={c} />
      <circle cx={10} cy={18} r={2} fill={a} fillOpacity={0.25} stroke={a} />
    </>
  ),
  layers: (c, a) => (
    <>
      <path d="M12 3l9 4.5-9 4.5-9-4.5L12 3z" fill={a} fillOpacity={0.22} stroke={c} />
      <path d="M3 12l9 4.5 9-4.5" stroke={a} />
      <path d="M3 16.5L12 21l9-4.5" stroke={c} />
    </>
  ),
  database: (c, a) => (
    <>
      <ellipse cx={12} cy={6} rx={7} ry={3} fill={a} fillOpacity={0.22} stroke={c} />
      <path d="M5 6v12c0 1.66 3.13 3 7 3s7-1.34 7-3V6" stroke={c} />
      <path d="M5 12c0 1.66 3.13 3 7 3s7-1.34 7-3" stroke={a} />
    </>
  ),
  globe: (c, a) => (
    <>
      <circle cx={12} cy={12} r={9} fill={a} fillOpacity={0.14} stroke={c} />
      <ellipse cx={12} cy={12} rx={4} ry={9} stroke={a} />
      <path d="M3.5 12h17" stroke={a} />
    </>
  ),
};

export const TechIcon: React.FC<{
  name: TechIconName;
  size?: number;
  color?: string;
  accent?: string;
}> = ({ name, size = 24, color = DARK_TECH.ink, accent = DARK_TECH.cyan }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.9}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {ICONS[name](color, accent)}
  </svg>
);
