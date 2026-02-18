import React from "react";

type Props = {
  slot: "header" | "sidebar" | "inline" | "footer";
  label?: string;
};

const adsEnabled = import.meta.env.VITE_ADS_ENABLED === "true";

export default function AdSlot({ slot, label }: Props) {
  if (!adsEnabled) return null;

  const meta = {
    header: { h: 54, title: "Ad slot" },
    sidebar: { h: 80, title: "Ad slot" },
    inline: { h: 64, title: "Ad slot" },
    footer: { h: 54, title: "Ad slot" },
  }[slot];

  return (
    <div
      className={`ad-skeleton ${slot === "footer" ? "ad-footer" : ""}`}
      aria-label={`Ad slot: ${slot}`}
      style={{ minHeight: meta.h }}
    >
      <div className="ad-skeleton-inner">
        <span>{label ?? meta.title}</span>
      </div>
    </div>
  );
}
