import React from "react";

type Props = {
  slot: "header" | "sidebar" | "inline" | "footer";
  label?: string;
};

/**
 * Phase 1.1: Ad placeholders.
 *
 * Later (when you get AdSense), replace the placeholder div with the official script/snippet.
 * Keep the same container sizes to avoid layout shift.
 */
export default function AdSlot({ slot, label }: Props) {
  const meta = {
    header: { h: 90, title: "Header Banner (728×90 / 320×100)" },
    sidebar: { h: 250, title: "Sidebar Rectangle (300×250)" },
    inline: { h: 280, title: "Inline Article (Responsive)" },
    footer: { h: 90, title: "Footer Banner (728×90 / 320×100)" },
  }[slot];

  return (
    <div
      aria-label={`Ad slot: ${slot}`}
      style={{
        borderRadius: 16,
        border: "1px dashed rgba(255,255,255,0.18)",
        background: "rgba(0,0,0,0.16)",
        padding: 12,
        minHeight: meta.h,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(233,238,255,0.55)",
        textAlign: "center",
      }}
    >
      <div>
        <div style={{ fontSize: 12, letterSpacing: 0.2 }}>{label ?? meta.title}</div>
        <div style={{ fontSize: 11, opacity: 0.9, marginTop: 6 }}>AdSense code goes here</div>
      </div>
    </div>
  );
}
