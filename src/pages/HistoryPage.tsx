import React, { useMemo, useState } from "react";
import AdSlot from "../components/AdSlot";
import KatexBlock from "../components/KatexBlock";
import { clearHistory, loadHistory } from "../lib/storage";

export default function HistoryPage() {
  const [tick, setTick] = useState(0);

  const items = useMemo(() => loadHistory(), [tick]);

  return (
    <div className="card">
      <div className="card-header">
        <h2>History</h2>
        <p>Saved results are stored locally in your browser (localStorage). This is perfect for GitHub Pages.</p>
      </div>
      <div className="card-body">
        <div className="row">
          <button className="button danger" onClick={() => { clearHistory(); setTick((x) => x + 1); }}>Clear</button>
          <button className="button" onClick={() => setTick((x) => x + 1)}>Refresh</button>
        </div>

        <hr className="sep" />

        <div className="ad-grid" style={{ marginBottom: 14 }}>
          <AdSlot slot="inline" />
        </div>

        {items.length === 0 ? (
          <div className="katex-wrap mono">No history yet. Use “Save” buttons across the site.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {items.map((it) => (
              <div key={it.id} className="card" style={{ padding: 0 }}>
                <div className="card-header">
                  <h2>{it.area}</h2>
                  <p>{new Date(it.createdAt).toLocaleString()}</p>
                </div>
                <div className="card-body">
                  {it.latex ? <KatexBlock latex={it.latex} /> : <div className="katex-wrap mono">—</div>}
                  <div className="small" style={{ marginTop: 10 }}>Result</div>
                  <div className="katex-wrap mono" style={{ whiteSpace: "pre-wrap" }}>{it.resultText}</div>
                  <div className="row" style={{ marginTop: 10 }}>
                    <button className="button" onClick={() => navigator.clipboard.writeText(it.latex)}>Copy LaTeX</button>
                    <button className="button" onClick={() => navigator.clipboard.writeText(it.resultText)}>Copy Result</button>
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
