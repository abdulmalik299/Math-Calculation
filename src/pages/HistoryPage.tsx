import React, { useMemo, useState } from "react";
import AdSlot from "../components/AdSlot";
import KatexBlock from "../components/KatexBlock";
import { clearHistory, loadHistory, setHistoryFlag, setHistoryTags, ToolArea } from "../lib/storage";

const filters: ("All" | ToolArea)[] = ["All", "Calculator", "Algebra", "Calculus", "Graphs", "Matrices", "Graph Theory"];

export default function HistoryPage() {
  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState<("All" | ToolArea)>("All");
  const [search, setSearch] = useState("");

  const items = useMemo(() => loadHistory(), [tick]);
  const shown = useMemo(() => items.filter((it) => {
    if (filter !== "All" && it.area !== filter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [it.latex, it.resultText, it.area, ...(it.tags ?? [])].join(" ").toLowerCase().includes(q);
  }), [items, filter, search]);

  return (
    <div className="card">
      <div className="card-header"><h2>History</h2><p>Grouped by tool with search, pin, favorites, and tags.</p></div>
      <div className="card-body">
        <div className="row">
          <button className="button danger" onClick={() => { clearHistory(); setTick((x) => x + 1); }}>Clear</button>
          <button className="button" onClick={() => setTick((x) => x + 1)}>Refresh</button>
          <input className="input" style={{ maxWidth: 240 }} placeholder="Search history…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {filters.map((f) => <button key={f} className={`button ${filter === f ? "primary" : ""}`} onClick={() => setFilter(f)}>{f}</button>)}
        </div>

        <hr className="sep" />

        <div className="ad-grid" style={{ marginBottom: 14 }}><AdSlot slot="inline" /></div>

        {shown.length === 0 ? (
          <div className="katex-wrap mono">No history yet. Use save/calculate actions across the site.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {shown.map((it) => (
              <div key={it.id} className="card" style={{ padding: 0 }}>
                <div className="card-header"><h2>{it.pinned ? "📌 " : ""}{it.area}{it.favorite ? " ★" : ""}</h2><p>{new Date(it.createdAt).toLocaleString()}</p></div>
                <div className="card-body">
                  {it.latex ? <KatexBlock latex={it.latex} /> : <div className="katex-wrap mono">—</div>}
                  <div className="small" style={{ marginTop: 10 }}>Result</div>
                  <div className="katex-wrap mono" style={{ whiteSpace: "pre-wrap" }}>{it.resultText}</div>
                  <div className="small" style={{ marginTop: 8 }}>Tags: {(it.tags ?? []).join(", ") || "—"}</div>
                  <div className="row" style={{ marginTop: 10 }}>
                    <button className="button" onClick={() => navigator.clipboard.writeText(it.latex)}>📄 Copy LaTeX</button>
                    <button className="button" onClick={() => navigator.clipboard.writeText(it.resultText)}>📋 Copy Result</button>
                    <button className="button" onClick={() => { setHistoryFlag(it.id, "pinned", !it.pinned); setTick((x) => x + 1); }}>{it.pinned ? "Unpin" : "Pin"}</button>
                    <button className="button" onClick={() => { setHistoryFlag(it.id, "favorite", !it.favorite); setTick((x) => x + 1); }}>{it.favorite ? "Unfavorite" : "Favorite"}</button>
                    <button className="button" onClick={() => {
                      const value = prompt("Enter comma-separated tags", (it.tags ?? []).join(", "));
                      if (value === null) return;
                      setHistoryTags(it.id, value.split(","));
                      setTick((x) => x + 1);
                    }}>🏷️ Tags</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
