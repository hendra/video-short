import React, { useId } from "react";
import { FONT } from "../fonts";
import { DARK_TECH, TechIcon, type TechIconName } from "./icons";
import { clamp, countValue, fmtID, parseAccentTokens, ramp, spring, stagger, sway, typewriter } from "./math";

type AccentKey = "mint" | "cyan" | "amber" | "violet" | "red";

const ACCENT_HEX: Record<AccentKey, string> = {
  mint: DARK_TECH.mint,
  cyan: DARK_TECH.cyan,
  amber: DARK_TECH.amber,
  violet: DARK_TECH.violet,
  red: DARK_TECH.red,
};

const ACCENT_TINT: Record<AccentKey, string> = {
  mint: "rgba(127, 227, 196, 0.14)",
  cyan: "rgba(56, 189, 248, 0.14)",
  amber: "rgba(251, 191, 36, 0.14)",
  violet: "rgba(167, 139, 250, 0.14)",
  red: "rgba(248, 113, 113, 0.14)",
};

const ACCENT_BORDER: Record<AccentKey, string> = {
  mint: "rgba(127, 227, 196, 0.58)",
  cyan: "rgba(56, 189, 248, 0.58)",
  amber: "rgba(251, 191, 36, 0.58)",
  violet: "rgba(167, 139, 250, 0.58)",
  red: "rgba(248, 113, 113, 0.58)",
};

const cardShell: React.CSSProperties = {
  background: DARK_TECH.surface,
  border: `1px solid ${DARK_TECH.border}`,
  borderRadius: 20,
  boxShadow: "0 18px 44px rgba(2, 6, 23, 0.55)",
};

/** Index of the latest item whose `activeAt` cue has passed (-1 when none). */
const latestActive = <T extends { activeAt?: number }>(items: readonly T[], t: number): number => {
  let idx = -1;
  for (let i = 0; i < items.length; i++) {
    const at = items[i].activeAt;
    if (at !== undefined && t >= at) idx = i;
  }
  return idx;
};

/** Dim while another item is the one being narrated. */
const spotlightOpacity = (items: readonly { activeAt?: number }[], idx: number, t: number): number => {
  const active = latestActive(items, t);
  return active < 0 || active === idx ? 1 : 0.55;
};

// 1. KineticHeadline
export const KineticHeadline: React.FC<{
  t: number;
  at: number;
  kicker?: string;
  text: string;
  sub?: string;
  align?: "left" | "center";
}> = ({ t, at, kicker, text, sub, align = "center" }) => {
  const words = parseAccentTokens(text);
  const kickerP = spring((t - at) / 0.28);
  const subAt = at + Math.min(0.45, words.length * 0.055);
  const subP = ramp(t, subAt, subAt + 0.28);
  const isCenter = align === "center";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isCenter ? "center" : "flex-start",
        textAlign: align,
        gap: 14,
        width: "100%",
      }}
    >
      {kicker ? (
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 17,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: DARK_TECH.cyan,
            background: "rgba(56, 189, 248, 0.12)",
            border: "1px solid rgba(56, 189, 248, 0.35)",
            borderRadius: 999,
            padding: "6px 16px",
            opacity: clamp(kickerP),
            transform: `translate3d(0, ${(1 - kickerP) * 14}px, 0) scale(${0.92 + 0.08 * kickerP})`,
          }}
        >
          {kicker}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: isCenter ? "center" : "flex-start",
          columnGap: 14,
          rowGap: 6,
          fontFamily: FONT.display,
          fontSize: 56,
          fontWeight: 800,
          lineHeight: 1.12,
          letterSpacing: "-0.02em",
          color: DARK_TECH.ink,
        }}
      >
        {words.map((segs, idx) => {
          const p = stagger(t, at + 0.04, idx, 0.055, 0.34);
          return (
            <span
              key={`${idx}-${segs.map((s) => s.text).join("")}`}
              style={{
                display: "inline-block",
                opacity: clamp(p),
                transform: `translate3d(0, ${(1 - p) * 24}px, 0) scale(${0.9 + 0.1 * p})`,
              }}
            >
              {segs.map((seg, j) => (
                <span
                  key={j}
                  style={
                    seg.accent
                      ? {
                          color: DARK_TECH.mint,
                          textShadow: "0 0 24px rgba(127, 227, 196, 0.32)",
                        }
                      : undefined
                  }
                >
                  {seg.text}
                </span>
              ))}
            </span>
          );
        })}
      </div>

      {sub ? (
        <div
          style={{
            fontFamily: FONT.ui,
            fontSize: 23,
            fontWeight: 600,
            lineHeight: 1.4,
            color: DARK_TECH.muted,
            maxWidth: 820,
            opacity: subP,
            transform: `translate3d(0, ${(1 - subP) * 12}px, 0)`,
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
};

// 2. NodeFlow
export type NodeFlowItem = {
  id: string;
  icon: TechIconName;
  title: string;
  subtitle?: string;
  badge?: string;
  accent?: "mint" | "cyan" | "amber" | "red";
  at: number;
  activeAt?: number;
};

export const NodeFlow: React.FC<{
  t: number;
  direction?: "vertical" | "horizontal";
  nodes: NodeFlowItem[];
}> = ({ t, direction = "vertical", nodes }) => {
  const isHoriz = direction === "horizontal";

  let latestActiveIdx = -1;
  for (let i = 0; i < nodes.length; i++) {
    const act = nodes[i].activeAt;
    if (act !== undefined && t >= act) latestActiveIdx = i;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isHoriz ? "row" : "column",
        alignItems: "stretch",
        justifyContent: "center",
        width: "100%",
      }}
    >
      {nodes.map((node, idx) => {
        const accent: AccentKey = node.accent ?? "cyan";
        const hex = ACCENT_HEX[accent];
        const enterP = spring((t - node.at) / 0.35);
        const isCurrent = idx === latestActiveIdx;
        const wasActive = node.activeAt !== undefined && t >= node.activeAt;
        const activeGlow = isCurrent
          ? ramp(t, node.activeAt ?? node.at, (node.activeAt ?? node.at) + 0.22)
          : wasActive
            ? 0.45
            : 0;

        const nextNode = nodes[idx + 1];
        const connP = nextNode ? ramp(t, nextNode.at - 0.1, nextNode.at + 0.24) : 0;
        const pulsePhase = Math.max(0, (t - node.at) * 0.85) % 1;

        return (
          <React.Fragment key={node.id}>
            <div
              style={{
                ...cardShell,
                flex: isHoriz ? "1 1 0" : undefined,
                minWidth: 0,
                display: "flex",
                flexDirection: isHoriz ? "column" : "row",
                alignItems: isHoriz ? "flex-start" : "center",
                gap: isHoriz ? 12 : 16,
                padding: isHoriz ? "16px 16px" : "14px 18px",
                background: activeGlow > 0.5 ? DARK_TECH.surfaceAlt : DARK_TECH.surface,
                border: `1px solid ${activeGlow > 0.1 ? ACCENT_BORDER[accent] : DARK_TECH.border}`,
                boxShadow:
                  activeGlow > 0.5
                    ? `0 0 28px ${ACCENT_TINT[accent]}, 0 14px 34px rgba(2, 6, 23, 0.55)`
                    : cardShell.boxShadow,
                opacity: clamp(enterP),
                transform: isHoriz
                  ? `translate3d(${(1 - enterP) * 24}px, 0, 0) scale(${0.94 + 0.06 * enterP})`
                  : `translate3d(0, ${(1 - enterP) * 20}px, 0) scale(${0.95 + 0.05 * enterP})`,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: ACCENT_TINT[accent],
                  border: `1px solid ${ACCENT_BORDER[accent]}`,
                }}
              >
                <TechIcon name={node.icon} size={23} color={DARK_TECH.ink} accent={hex} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontFamily: FONT.ui,
                      fontSize: isHoriz ? 20 : 22,
                      fontWeight: 700,
                      color: DARK_TECH.ink,
                      lineHeight: 1.25,
                    }}
                  >
                    {node.title}
                  </span>
                  {node.badge ? (
                    <span
                      style={{
                        fontFamily: FONT.mono,
                        fontSize: 13,
                        color: hex,
                        background: ACCENT_TINT[accent],
                        border: `1px solid ${ACCENT_BORDER[accent]}`,
                        borderRadius: 999,
                        padding: "2px 10px",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {node.badge}
                    </span>
                  ) : null}
                </div>
                {node.subtitle ? (
                  <div
                    style={{
                      fontFamily: FONT.ui,
                      fontSize: isHoriz ? 16 : 17,
                      fontWeight: 600,
                      color: DARK_TECH.muted,
                      lineHeight: 1.35,
                      marginTop: 3,
                    }}
                  >
                    {node.subtitle}
                  </div>
                ) : null}
              </div>
            </div>

            {nextNode ? (
              isHoriz ? (
                <div
                  style={{
                    width: 34,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: connP,
                  }}
                >
                  <svg width={34} height={24} viewBox="0 0 34 24" aria-hidden="true">
                    <line
                      x1={2}
                      y1={12}
                      x2={2 + 30 * connP}
                      y2={12}
                      stroke={hex}
                      strokeOpacity={0.55}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                    />
                    {connP > 0.6 ? (
                      <>
                        <circle cx={4 + 26 * pulsePhase} cy={12} r={5.5} fill={hex} fillOpacity={0.28} />
                        <circle cx={4 + 26 * pulsePhase} cy={12} r={3} fill={DARK_TECH.ink} />
                      </>
                    ) : null}
                  </svg>
                </div>
              ) : (
                <div
                  style={{
                    height: 26,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: connP,
                  }}
                >
                  <svg width={24} height={26} viewBox="0 0 24 26" aria-hidden="true">
                    <line
                      x1={12}
                      y1={1}
                      x2={12}
                      y2={1 + 24 * connP}
                      stroke={hex}
                      strokeOpacity={0.55}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                    />
                    {connP > 0.6 ? (
                      <>
                        <circle cx={12} cy={3 + 20 * pulsePhase} r={5.5} fill={hex} fillOpacity={0.28} />
                        <circle cx={12} cy={3 + 20 * pulsePhase} r={3} fill={DARK_TECH.ink} />
                      </>
                    ) : null}
                  </svg>
                </div>
              )
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// 3. TerminalCard
export type TerminalLine = {
  text: string;
  kind?: "cmd" | "info" | "ok" | "err" | "dim";
  at: number;
  highlight?: boolean;
  /** When this line is being narrated: it stays lit, the others dim. */
  activeAt?: number;
};

export const TerminalCard: React.FC<{
  t: number;
  title?: string;
  lines: TerminalLine[];
}> = ({ t, title = "terminal — zsh", lines }) => {
  const firstAt = lines[0]?.at ?? 0;
  const winP = spring((t - (firstAt - 0.15)) / 0.32);

  let activeCmdIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if ((lines[i].kind ?? "info") === "cmd" && t >= lines[i].at) {
      activeCmdIdx = i;
    }
  }

  return (
    <div
      style={{
        ...cardShell,
        background: "rgba(10, 14, 23, 0.96)",
        overflow: "hidden",
        width: "100%",
        opacity: clamp(winP),
        transform: `translate3d(0, ${(1 - winP) * 18}px, 0) scale(${0.96 + 0.04 * winP})`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 18px",
          borderBottom: `1px solid ${DARK_TECH.border}`,
          background: "rgba(30, 41, 59, 0.52)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#f87171" }} />
          <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#fbbf24" }} />
          <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#34d399" }} />
        </div>
        <span style={{ fontFamily: FONT.mono, fontSize: 15, color: DARK_TECH.muted }}>{title}</span>
        <TechIcon name="terminal" size={18} color={DARK_TECH.muted} accent={DARK_TECH.mint} />
      </div>

      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        {lines.map((line, idx) => {
          const kind = line.kind ?? "info";
          const isCmd = kind === "cmd";
          const appearP = ramp(t, line.at, line.at + 0.16);
          const spot = spotlightOpacity(lines, idx, t);

          const typed = isCmd ? typewriter(line.text, t, line.at, 32) : line.text;
          const typingNow = isCmd && typed.length < line.text.length;
          const showCursor = isCmd && idx === activeCmdIdx && (typingNow || Math.floor(t * 2.5) % 2 === 0);

          const lineColor =
            kind === "cmd"
              ? DARK_TECH.ink
              : kind === "ok"
                ? DARK_TECH.mint
                : kind === "err"
                  ? DARK_TECH.red
                  : kind === "dim"
                    ? DARK_TECH.muted
                    : DARK_TECH.cyan;

          const hlAccent: AccentKey = kind === "err" ? "red" : kind === "ok" ? "mint" : "cyan";

          return (
            <div
              key={`${idx}-${line.at}`}
              style={{
                fontFamily: FONT.mono,
                fontSize: 19,
                lineHeight: 1.45,
                color: lineColor,
                padding: line.highlight ? "5px 12px" : "2px 0",
                borderRadius: line.highlight ? 8 : 0,
                background: line.highlight ? ACCENT_TINT[hlAccent] : "transparent",
                borderLeft: line.highlight ? `3px solid ${ACCENT_HEX[hlAccent]}` : "3px solid transparent",
                opacity: appearP * spot,
                transform: isCmd ? undefined : `translate3d(0, ${(1 - appearP) * 8}px, 0)`,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {isCmd ? <span style={{ color: DARK_TECH.mint, marginRight: 10 }}>$</span> : null}
              <span>{typed || "\u00A0"}</span>
              {showCursor ? (
                <span
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 19,
                    verticalAlign: "-3px",
                    marginLeft: 3,
                    background: DARK_TECH.mint,
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// 4. PromptCard
export type PromptSection = {
  role: string;
  text: string;
  accent?: "mint" | "cyan" | "amber" | "violet";
  at: number;
  activeAt?: number;
};

export const PromptCard: React.FC<{
  t: number;
  title?: string;
  badge?: string;
  copyHint?: string;
  sections: PromptSection[];
}> = ({ t, title = "PROMPT ANATOMY", badge, copyHint, sections }) => {
  const firstAt = sections[0]?.at ?? 0;
  const cardP = spring((t - (firstAt - 0.1)) / 0.34);

  let latestActiveIdx = -1;
  for (let i = 0; i < sections.length; i++) {
    const act = sections[i].activeAt;
    if (act !== undefined && t >= act) latestActiveIdx = i;
  }

  return (
    <div
      style={{
        ...cardShell,
        width: "100%",
        overflow: "hidden",
        opacity: clamp(cardP),
        transform: `translate3d(0, ${(1 - cardP) * 20}px, 0) scale(${0.96 + 0.04 * cardP})`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "13px 20px",
          borderBottom: `1px solid ${DARK_TECH.border}`,
          background: "rgba(30, 41, 59, 0.56)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <TechIcon name="sparkle" size={20} color={DARK_TECH.ink} accent={DARK_TECH.mint} />
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: DARK_TECH.ink,
            }}
          >
            {title}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {badge ? (
            <span
              style={{
                fontFamily: FONT.mono,
                fontSize: 13,
                color: DARK_TECH.cyan,
                background: ACCENT_TINT.cyan,
                border: `1px solid ${ACCENT_BORDER.cyan}`,
                borderRadius: 999,
                padding: "3px 11px",
              }}
            >
              {badge}
            </span>
          ) : null}
          {copyHint ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontFamily: FONT.mono,
                fontSize: 13,
                color: DARK_TECH.muted,
                background: "rgba(15, 23, 42, 0.8)",
                border: `1px solid ${DARK_TECH.border}`,
                borderRadius: 8,
                padding: "3px 10px",
              }}
            >
              <TechIcon name="copy" size={14} color={DARK_TECH.muted} accent={DARK_TECH.cyan} />
              {copyHint}
            </span>
          ) : null}
        </div>
      </div>

      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        {sections.map((sec, idx) => {
          const accent: AccentKey = sec.accent ?? "cyan";
          const enterP = spring((t - sec.at) / 0.32);
          const hasSpotlight = latestActiveIdx >= 0;
          const isSpot = idx === latestActiveIdx;
          const dimFactor = hasSpotlight && !isSpot ? 0.52 : 1;

          return (
            <div
              key={`${idx}-${sec.role}`}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: "13px 16px",
                borderRadius: 14,
                background: isSpot ? ACCENT_TINT[accent] : "rgba(15, 23, 42, 0.65)",
                border: `1px solid ${isSpot ? ACCENT_BORDER[accent] : DARK_TECH.border}`,
                boxShadow: isSpot ? `0 0 22px ${ACCENT_TINT[accent]}` : undefined,
                opacity: clamp(enterP) * dimFactor,
                transform: `translate3d(0, ${(1 - enterP) * 14}px, 0) scale(${isSpot ? 1.01 : 1})`,
              }}
            >
              <div>
                <span
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: ACCENT_HEX[accent],
                    background: ACCENT_TINT[accent],
                    border: `1px solid ${ACCENT_BORDER[accent]}`,
                    borderRadius: 999,
                    padding: "3px 10px",
                  }}
                >
                  {sec.role}
                </span>
              </div>
              <div
                style={{
                  fontFamily: FONT.ui,
                  fontSize: 20,
                  fontWeight: 600,
                  lineHeight: 1.4,
                  color: DARK_TECH.ink,
                }}
              >
                {sec.text}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// 5. ComparisonSplit
type ComparisonSide = {
  label: string;
  title: string;
  points: string[];
  /** One cue per point: the narrated point stays lit, the others dim. */
  pointsAt?: number[];
  at: number;
};

export const ComparisonSplit: React.FC<{
  t: number;
  before: ComparisonSide;
  after: ComparisonSide;
}> = ({ t, before, after }) => {
  const renderSide = (side: ComparisonSide, isAfter: boolean) => {
    const accent: AccentKey = isAfter ? "mint" : "red";
    const hex = ACCENT_HEX[accent];
    const p = spring((t - side.at) / 0.35);

    return (
      <div
        style={{
          ...cardShell,
          flex: "1 1 0",
          minWidth: 0,
          padding: "18px 20px",
          background: isAfter
            ? "linear-gradient(180deg, rgba(16, 42, 38, 0.85) 0%, rgba(15, 23, 42, 0.92) 100%)"
            : "linear-gradient(180deg, rgba(48, 20, 28, 0.82) 0%, rgba(15, 23, 42, 0.92) 100%)",
          border: `1px solid ${ACCENT_BORDER[accent]}`,
          boxShadow: `0 0 28px ${ACCENT_TINT[accent]}, 0 16px 36px rgba(2, 6, 23, 0.55)`,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          opacity: clamp(p),
          transform: `translate3d(${(1 - p) * (isAfter ? 24 : -24)}px, 0, 0) scale(${0.95 + 0.05 * p})`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: hex,
              background: ACCENT_TINT[accent],
              border: `1px solid ${ACCENT_BORDER[accent]}`,
              borderRadius: 999,
              padding: "4px 12px",
            }}
          >
            {side.label}
          </span>
          <TechIcon name={isAfter ? "check" : "x"} size={22} color={hex} accent={hex} />
        </div>

        <div
          style={{
            fontFamily: FONT.display,
            fontSize: 26,
            fontWeight: 800,
            lineHeight: 1.2,
            color: DARK_TECH.ink,
          }}
        >
          {side.title}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {side.points.map((pt, idx) => {
            const ptP = stagger(t, side.at + 0.12, idx, 0.09, 0.3);
            const cues = side.pointsAt ?? [];
            const spot = cues.length === 0 ? 1 : spotlightOpacity(cues.map((activeAt) => ({ activeAt })), idx, t);
            return (
              <div
                key={`${idx}-${pt}`}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  opacity: clamp(ptP) * spot,
                  transform: `translate3d(0, ${(1 - ptP) * 10}px, 0)`,
                }}
              >
                <div style={{ marginTop: 3, flexShrink: 0 }}>
                  <TechIcon name={isAfter ? "check" : "x"} size={18} color={hex} accent={hex} />
                </div>
                <span
                  style={{
                    fontFamily: FONT.ui,
                    fontSize: 19,
                    fontWeight: 600,
                    lineHeight: 1.38,
                    color: DARK_TECH.ink,
                  }}
                >
                  {pt}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "row", alignItems: "stretch", gap: 18, width: "100%" }}>
      {renderSide(before, false)}
      {renderSide(after, true)}
    </div>
  );
};

// 6. MetricPanel
export const MetricPanel: React.FC<{
  t: number;
  headline?: { label: string; from: number; to: number; unit?: string; decimals?: number; at: number; dur?: number };
  bars?: Array<{ label: string; value: number; max?: number; display?: string; accent?: "mint" | "cyan" | "amber"; at: number; activeAt?: number }>;
  meter?: { label: string; used: number; total: number; unit?: string; at: number };
}> = ({ t, headline, bars, meter }) => {
  const headlineP = headline ? spring((t - headline.at) / 0.35) : 0;
  const headlineVal = headline
    ? countValue(headline.from, headline.to, t, headline.at, headline.dur ?? 0.85)
    : 0;

  const maxBar = bars ? Math.max(100, ...bars.map((b) => b.max ?? b.value)) : 100;

  const meterP = meter ? spring((t - meter.at) / 0.34) : 0;
  const meterFill = meter ? ramp(t, meter.at + 0.08, meter.at + 0.85) : 0;
  const segCount = 20;
  const usedRatio = meter ? clamp((meter.used / Math.max(1e-6, meter.total)) * meterFill) : 0;
  const activeSegs = Math.round(usedRatio * segCount);
  const animatedUsed = meter ? meter.used * meterFill : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      {headline ? (
        <div
          style={{
            ...cardShell,
            padding: "18px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            border: `1px solid ${ACCENT_BORDER.mint}`,
            opacity: clamp(headlineP),
            transform: `translate3d(0, ${(1 - headlineP) * 16}px, 0) scale(${0.96 + 0.04 * headlineP})`,
          }}
        >
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 16,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: DARK_TECH.muted,
            }}
          >
            {headline.label}
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span
              style={{
                fontFamily: FONT.display,
                fontSize: 54,
                fontWeight: 800,
                color: DARK_TECH.mint,
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1,
                textShadow: "0 0 24px rgba(127, 227, 196, 0.28)",
              }}
            >
              {fmtID(headlineVal, headline.decimals ?? 0)}
            </span>
            {headline.unit ? (
              <span style={{ fontFamily: FONT.mono, fontSize: 20, color: DARK_TECH.cyan }}>{headline.unit}</span>
            ) : null}
          </div>
        </div>
      ) : null}

      {bars && bars.length > 0 ? (
        <div style={{ ...cardShell, padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          {bars.map((bar, idx) => {
            const accent: AccentKey = bar.accent ?? "cyan";
            const hex = ACCENT_HEX[accent];
            const rowP = spring((t - bar.at) / 0.3);
            const fillP = ramp(t, bar.at + 0.06, bar.at + 0.65);
            const barMax = bar.max ?? maxBar;
            const pct = clamp((bar.value / Math.max(1e-6, barMax)) * fillP) * 100;

            return (
              <div
                key={`${idx}-${bar.label}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  opacity: clamp(rowP) * (bars ? spotlightOpacity(bars, idx, t) : 1),
                  transform: `translate3d(0, ${(1 - rowP) * 10}px, 0)`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                  <span style={{ fontFamily: FONT.ui, fontSize: 19, fontWeight: 700, color: DARK_TECH.ink }}>
                    {bar.label}
                  </span>
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 18,
                      color: hex,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {bar.display ?? fmtID(bar.value * fillP)}
                  </span>
                </div>
                <div
                  style={{
                    height: 12,
                    borderRadius: 999,
                    background: "rgba(30, 41, 59, 0.85)",
                    border: `1px solid ${DARK_TECH.border}`,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      borderRadius: 999,
                      background: `linear-gradient(90deg, ${hex} 0%, ${DARK_TECH.ink} 140%)`,
                      boxShadow: `0 0 14px ${ACCENT_TINT[accent]}`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {meter ? (
        <div
          style={{
            ...cardShell,
            padding: "16px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            opacity: clamp(meterP),
            transform: `translate3d(0, ${(1 - meterP) * 14}px, 0)`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <span
              style={{
                fontFamily: FONT.mono,
                fontSize: 15,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: DARK_TECH.muted,
              }}
            >
              {meter.label}
            </span>
            <span
              style={{
                fontFamily: FONT.mono,
                fontSize: 18,
                color: DARK_TECH.ink,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {fmtID(animatedUsed)} / {fmtID(meter.total)}
              {meter.unit ? ` ${meter.unit}` : ""}
            </span>
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            {Array.from({ length: segCount }, (_, i) => {
              const lit = i < activeSegs;
              const ratio = i / segCount;
              const segHex =
                ratio >= 0.82 ? DARK_TECH.red : ratio >= 0.62 ? DARK_TECH.amber : DARK_TECH.mint;
              return (
                <div
                  key={i}
                  style={{
                    flex: "1 1 0",
                    height: 16,
                    borderRadius: 4,
                    background: lit ? segHex : "rgba(30, 41, 59, 0.85)",
                    border: `1px solid ${lit ? segHex : DARK_TECH.border}`,
                    opacity: lit ? 0.95 : 0.6,
                  }}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};

// 7. BentoGrid
export type BentoItem = {
  icon: TechIconName;
  title: string;
  detail: string;
  accent?: "mint" | "cyan" | "amber" | "violet";
  at: number;
  activeAt?: number;
};

export const BentoGrid: React.FC<{
  t: number;
  columns?: 1 | 2;
  items: BentoItem[];
}> = ({ t, columns = 2, items }) => {
  let latestActiveIdx = -1;
  for (let i = 0; i < items.length; i++) {
    const act = items[i].activeAt;
    if (act !== undefined && t >= act) latestActiveIdx = i;
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: columns === 1 ? "1fr" : "repeat(2, minmax(0, 1fr))",
        gap: 16,
        width: "100%",
      }}
    >
      {items.map((item, idx) => {
        const accent: AccentKey = item.accent ?? "cyan";
        const hex = ACCENT_HEX[accent];
        const enterP = spring((t - item.at) / 0.34);
        const isCurrent = idx === latestActiveIdx;
        const isLit = item.activeAt !== undefined && t >= item.activeAt;

        return (
          <div
            key={`${idx}-${item.title}`}
            style={{
              ...cardShell,
              padding: "18px 20px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              background: isCurrent ? DARK_TECH.surfaceAlt : DARK_TECH.surface,
              border: `1px solid ${isLit ? ACCENT_BORDER[accent] : DARK_TECH.border}`,
              boxShadow: isCurrent
                ? `0 0 26px ${ACCENT_TINT[accent]}, 0 16px 36px rgba(2, 6, 23, 0.55)`
                : cardShell.boxShadow,
              opacity: clamp(enterP),
              transform: `translate3d(0, ${(1 - enterP) * 18}px, 0) scale(${(0.94 + 0.06 * enterP) * (isCurrent ? 1.015 : 1)})`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: ACCENT_TINT[accent],
                  border: `1px solid ${ACCENT_BORDER[accent]}`,
                }}
              >
                <TechIcon name={item.icon} size={22} color={DARK_TECH.ink} accent={hex} />
              </div>
              <span
                style={{
                  fontFamily: FONT.ui,
                  fontSize: 22,
                  fontWeight: 700,
                  lineHeight: 1.25,
                  color: DARK_TECH.ink,
                }}
              >
                {item.title}
              </span>
            </div>

            <div
              style={{
                fontFamily: FONT.ui,
                fontSize: 18,
                fontWeight: 600,
                lineHeight: 1.4,
                color: DARK_TECH.muted,
              }}
            >
              {item.detail}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// 8. IllustrationStage
const PhotoWipeIllustration: React.FC<{ t: number; at: number; uid: string }> = ({ t, at, uid }) => {
  const enter = ramp(t, at, at + 0.45);
  const wipe = clamp(0.5 + 0.34 * Math.sin(Math.max(0, t - at) * 1.65) * enter, 0.14, 0.86);
  const splitX = 76 + 688 * wipe;
  const clipAfterId = `${uid}-after`;

  return (
    <svg width="100%" viewBox="0 0 840 360" style={{ display: "block" }} aria-hidden="true">
      <defs>
        <clipPath id={clipAfterId}>
          <rect x={splitX} y={24} width={764 - splitX} height={312} rx={16} />
        </clipPath>
      </defs>

      {/* BEFORE: dull noisy draft frame */}
      <rect x={76} y={24} width={688} height={312} rx={16} fill="#141923" stroke="rgba(148, 163, 184, 0.28)" strokeWidth={2} />
      <path d="M120 278 L270 155 L385 235 L515 125 L710 278 Z" fill="#1e2533" />
      <circle cx={225} cy={112} r={28} fill="#2a3344" />
      <g opacity={0.45} stroke="#64748b" strokeWidth={2}>
        <line x1={140} y1={72} x2={250} y2={72} />
        <line x1={540} y1={90} x2={690} y2={90} />
        <line x1={480} y1={116} x2={670} y2={116} />
      </g>
      <rect x={98} y={44} width={104} height={30} rx={15} fill="rgba(248, 113, 113, 0.18)" stroke="rgba(248, 113, 113, 0.6)" />
      <text x={150} y={64} textAnchor="middle" fill={DARK_TECH.red} fontFamily={FONT.mono} fontSize={14} fontWeight={700}>
        BEFORE
      </text>

      {/* AFTER: crisp vibrant studio frame */}
      <g clipPath={`url(#${clipAfterId})`}>
        <rect x={76} y={24} width={688} height={312} rx={16} fill="#0e2236" stroke={DARK_TECH.mint} strokeWidth={2} />
        <circle cx={225} cy={112} r={48} fill="rgba(56, 189, 248, 0.18)" />
        <circle cx={225} cy={112} r={28} fill={DARK_TECH.amber} />
        <path d="M120 278 L270 155 L385 235 L515 125 L710 278 Z" fill="#1b4d6e" stroke={DARK_TECH.cyan} strokeWidth={2.5} />
        <path d="M230 278 L385 182 L510 278 Z" fill="#185e58" stroke={DARK_TECH.mint} strokeWidth={2.5} />
        <circle cx={610} cy={92} r={4} fill={DARK_TECH.mint} />
        <circle cx={652} cy={128} r={3} fill={DARK_TECH.cyan} />
        <rect x={614} y={44} width={128} height={30} rx={15} fill="rgba(127, 227, 196, 0.2)" stroke={DARK_TECH.mint} />
        <text x={678} y={64} textAnchor="middle" fill={DARK_TECH.mint} fontFamily={FONT.mono} fontSize={14} fontWeight={700}>
          AI ENHANCED
        </text>
      </g>

      {/* Slider handle */}
      <line x1={splitX} y1={18} x2={splitX} y2={342} stroke={DARK_TECH.mint} strokeWidth={3} />
      <circle cx={splitX} cy={180} r={20} fill="#0f172a" stroke={DARK_TECH.mint} strokeWidth={2.5} />
      <path d={`M${splitX - 7} 180 l5 -5 M${splitX - 7} 180 l5 5 M${splitX + 7} 180 l-5 -5 M${splitX + 7} 180 l-5 5`} stroke={DARK_TECH.ink} strokeWidth={2.2} strokeLinecap="round" />
    </svg>
  );
};

const McpBridgeIllustration: React.FC<{ t: number; at: number }> = ({ t, at }) => {
  const hostP = spring((t - at) / 0.34);
  const hubP = spring((t - (at + 0.14)) / 0.34);
  const toolsP = spring((t - (at + 0.28)) / 0.34);
  const phase1 = Math.max(0, (t - at) * 0.75) % 1;
  const phase2 = Math.max(0, (t - (at + 0.2)) * 0.75) % 1;

  const toolYs = [72, 180, 288];
  const toolLabels = ["Database", "Local Files", "Web APIs"];
  const toolColors = [DARK_TECH.cyan, DARK_TECH.mint, DARK_TECH.amber];

  return (
    <svg width="100%" viewBox="0 0 840 360" style={{ display: "block" }} aria-hidden="true">
      {/* Host -> Hub line */}
      <line x1={232} y1={180} x2={360} y2={180} stroke={DARK_TECH.cyan} strokeWidth={3} strokeOpacity={0.55 * clamp(hubP)} />
      {hubP > 0.5 ? (
        <circle cx={232 + 128 * phase1} cy={180} r={5.5} fill={DARK_TECH.mint} />
      ) : null}

      {/* Hub -> Tools curved lines */}
      {toolYs.map((ty, idx) => (
        <g key={toolLabels[idx]} opacity={clamp(toolsP)}>
          <path
            d={`M480 180 C 540 180, 540 ${ty}, 602 ${ty}`}
            fill="none"
            stroke={toolColors[idx]}
            strokeWidth={2.6}
            strokeOpacity={0.5}
          />
          {toolsP > 0.6 ? (
            <circle
              cx={480 + 122 * phase2}
              cy={180 + (ty - 180) * (3 * phase2 * phase2 - 2 * phase2 * phase2 * phase2)}
              r={4.8}
              fill={toolColors[idx]}
            />
          ) : null}
        </g>
      ))}

      {/* AI Client Node */}
      <g opacity={clamp(hostP)} transform={`translate(0, ${(1 - hostP) * 14})`}>
        <rect x={44} y={122} width={188} height={116} rx={18} fill="rgba(15, 23, 42, 0.92)" stroke={DARK_TECH.cyan} strokeWidth={2} />
        <text x={138} y={174} textAnchor="middle" fill={DARK_TECH.ink} fontFamily={FONT.display} fontSize={23} fontWeight={800}>
          AI AGENT
        </text>
        <text x={138} y={204} textAnchor="middle" fill={DARK_TECH.cyan} fontFamily={FONT.mono} fontSize={14}>
          MCP Host
        </text>
      </g>

      {/* Center MCP Bridge */}
      <g opacity={clamp(hubP)} transform={`translate(0, ${(1 - hubP) * 14})`}>
        <circle cx={420} cy={180} r={62} fill="rgba(127, 227, 196, 0.14)" stroke={DARK_TECH.mint} strokeWidth={2.5} />
        <text x={420} y={176} textAnchor="middle" fill={DARK_TECH.mint} fontFamily={FONT.display} fontSize={26} fontWeight={800}>
          MCP
        </text>
        <text x={420} y={202} textAnchor="middle" fill={DARK_TECH.muted} fontFamily={FONT.mono} fontSize={13}>
          PROTOCOL
        </text>
      </g>

      {/* Tool Nodes */}
      {toolYs.map((ty, idx) => (
        <g key={toolLabels[idx]} opacity={clamp(toolsP)} transform={`translate(${(1 - toolsP) * 18}, 0)`}>
          <rect
            x={602}
            y={ty - 36}
            width={194}
            height={72}
            rx={14}
            fill="rgba(15, 23, 42, 0.92)"
            stroke={toolColors[idx]}
            strokeWidth={1.8}
          />
          <text x={699} y={ty + 6} textAnchor="middle" fill={DARK_TECH.ink} fontFamily={FONT.ui} fontSize={20} fontWeight={700}>
            {toolLabels[idx]}
          </text>
        </g>
      ))}
    </svg>
  );
};

const DocToJsonIllustration: React.FC<{ t: number; at: number }> = ({ t, at }) => {
  const docP = spring((t - at) / 0.34);
  const arrowP = ramp(t, at + 0.25, at + 0.55);
  const jsonP = spring((t - (at + 0.38)) / 0.36);
  const bob = sway(t, 4) * 4;

  const jsonLines = [
    '{',
    '  "intent": "summarize",',
    '  "priority": "high",',
    '  "tags": ["ai", "ops"]',
    '}',
  ];

  return (
    <svg width="100%" viewBox="0 0 840 360" style={{ display: "block" }} aria-hidden="true">
      {/* Unstructured doc */}
      <g opacity={clamp(docP)} transform={`translate(0, ${(1 - docP) * 16 + bob})`}>
        <rect x={54} y={58} width={274} height={244} rx={16} fill="rgba(15, 23, 42, 0.92)" stroke={DARK_TECH.amber} strokeWidth={1.8} />
        <text x={82} y={96} fill={DARK_TECH.amber} fontFamily={FONT.mono} fontSize={15} fontWeight={700}>
          RAW_NOTES.TXT
        </text>
        <rect x={82} y={120} width={210} height={12} rx={6} fill="rgba(148, 163, 184, 0.35)" />
        <rect x={82} y={146} width={168} height={12} rx={6} fill="rgba(148, 163, 184, 0.26)" />
        <rect x={82} y={172} width={222} height={12} rx={6} fill="rgba(148, 163, 184, 0.35)" />
        <rect x={82} y={198} width={132} height={12} rx={6} fill="rgba(148, 163, 184, 0.24)" />
        <rect x={82} y={224} width={196} height={12} rx={6} fill="rgba(148, 163, 184, 0.3)" />
        <rect x={82} y={250} width={145} height={12} rx={6} fill="rgba(148, 163, 184, 0.22)" />
      </g>

      {/* Transform chevrons */}
      <g opacity={arrowP}>
        <circle cx={420} cy={180} r={34} fill="rgba(56, 189, 248, 0.14)" stroke={DARK_TECH.cyan} strokeWidth={2} />
        <path d="M406 168l12 12-12 12M422 168l12 12-12 12" fill="none" stroke={DARK_TECH.mint} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* Structured JSON */}
      <g opacity={clamp(jsonP)} transform={`translate(0, ${(1 - jsonP) * 16 - bob * 0.6})`}>
        <rect x={512} y={58} width={274} height={244} rx={16} fill="rgba(10, 14, 23, 0.96)" stroke={DARK_TECH.mint} strokeWidth={2} />
        <text x={540} y={96} fill={DARK_TECH.mint} fontFamily={FONT.mono} fontSize={15} fontWeight={700}>
          OUTPUT.JSON
        </text>
        {jsonLines.map((ln, idx) => {
          const lineAlpha = ramp(t, at + 0.48 + idx * 0.08, at + 0.65 + idx * 0.08);
          return (
            <text
              key={ln}
              x={540}
              y={136 + idx * 32}
              fill={idx === 0 || idx === jsonLines.length - 1 ? DARK_TECH.muted : DARK_TECH.cyan}
              fontFamily={FONT.mono}
              fontSize={16}
              opacity={lineAlpha}
            >
              {ln}
            </text>
          );
        })}
      </g>
    </svg>
  );
};

export const IllustrationStage: React.FC<{
  t: number;
  at: number;
  title?: string;
  caption?: string;
  variant?: "photo-wipe" | "mcp-bridge" | "doc-to-json" | "custom";
  children?: React.ReactNode;
}> = ({ t, at, title, caption, variant, children }) => {
  const uid = useId();
  const enterP = spring((t - at) / 0.36);
  const mode = variant ?? (children ? "custom" : "mcp-bridge");

  return (
    <div
      style={{
        ...cardShell,
        width: "100%",
        overflow: "hidden",
        opacity: clamp(enterP),
        transform: `translate3d(0, ${(1 - enterP) * 20}px, 0) scale(${0.95 + 0.05 * enterP})`,
      }}
    >
      {title ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 20px",
            borderBottom: `1px solid ${DARK_TECH.border}`,
            background: "rgba(30, 41, 59, 0.52)",
          }}
        >
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: DARK_TECH.cyan,
            }}
          >
            {title}
          </span>
          <TechIcon name="layers" size={18} color={DARK_TECH.muted} accent={DARK_TECH.mint} />
        </div>
      ) : null}

      <div
        style={{
          padding: "12px 16px",
          background:
            "radial-gradient(circle at 50% 45%, rgba(56, 189, 248, 0.08) 0%, rgba(15, 23, 42, 0.25) 75%)",
        }}
      >
        {mode === "custom" ? (
          children
        ) : mode === "photo-wipe" ? (
          <PhotoWipeIllustration t={t} at={at} uid={uid} />
        ) : mode === "doc-to-json" ? (
          <DocToJsonIllustration t={t} at={at} />
        ) : (
          <McpBridgeIllustration t={t} at={at} />
        )}
      </div>

      {caption ? (
        <div
          style={{
            padding: "10px 20px 14px",
            borderTop: `1px solid ${DARK_TECH.border}`,
            fontFamily: FONT.ui,
            fontSize: 18,
            fontWeight: 600,
            color: DARK_TECH.muted,
            textAlign: "center",
          }}
        >
          {caption}
        </div>
      ) : null}
    </div>
  );
};

// 9. BeatCallout — a numbered step pill that appears on the script line it belongs to.
export const BeatCallout: React.FC<{
  t: number;
  at: number;
  until?: number;
  step: number;
  text: string;
  accent?: AccentKey;
  align?: "left" | "center";
}> = ({ t, at, until, step, text, accent = "cyan", align = "center" }) => {
  const hex = ACCENT_HEX[accent];
  const shown = t >= at && (until === undefined || t <= until);
  const p = shown ? spring((t - at) / 0.3) : 0;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: align === "center" ? "center" : "flex-start",
        width: "100%",
        opacity: p,
        transform: `translate3d(0, ${(1 - p) * 12}px, 0) scale(${0.92 + 0.08 * p})`,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 18px 8px 8px",
          borderRadius: 999,
          background: ACCENT_TINT[accent],
          border: `1px solid ${ACCENT_BORDER[accent]}`,
          boxShadow: `0 0 22px ${ACCENT_TINT[accent]}`,
        }}
      >
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: hex,
            color: DARK_TECH.bg,
            fontFamily: FONT.mono,
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          {step}
        </span>
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: hex,
          }}
        >
          {text}
        </span>
      </div>
    </div>
  );
};
