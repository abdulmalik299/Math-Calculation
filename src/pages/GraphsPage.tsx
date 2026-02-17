import React, { useMemo, useState } from "react";
import AdSlot from "../components/AdSlot";
import Plot from "react-plotly.js";
import { evaluateExpression } from "../lib/math";
import { pushHistory } from "../lib/storage";
import KatexBlock from "../components/KatexBlock";
import EquationEditor from "../components/EquationEditor";

function linspace(a: number, b: number, n: number) {
  const out: number[] = [];
  const step = (b - a) / (n - 1);
  for (let i = 0; i < n; i++) out.push(a + i * step);
  return out;
}

export default function GraphsPage() {
  const [latex, setLatex] = useState<string>("y=\sin(x)");
  const [ascii, setAscii] = useState<string>("");
  const [expr, setExpr] = useState<string>("sin(x)");
  const [xmin, setXmin] = useState<string>("-10");
  const [xmax, setXmax] = useState<string>("10");
  const [mode, setMode] = useState<"2d" | "3d">("2d");
  const [zexpr, setZexpr] = useState<string>("sin(x)*cos(y)");
  const [result, setResult] = useState<string>("");

  const plot2d = useMemo(() => {
    try {
      const a = Number(xmin), b = Number(xmax);
      if (!Number.isFinite(a) || !Number.isFinite(b) || a >= b) return null;
      const xs = linspace(a, b, 400);
      const ys = xs.map((x) => Number(evaluateExpression(expr, { x })));
      return { xs, ys };
    } catch {
      return null;
    }
  }, [expr, xmin, xmax]);

  const plot3d = useMemo(() => {
    if (mode !== "3d") return null;
    try {
      const x = linspace(-5, 5, 60);
      const y = linspace(-5, 5, 60);
      const z: number[][] = y.map((yy) => x.map((xx) => Number(evaluateExpression(zexpr, { x: xx, y: yy }))));
      return { x, y, z };
    } catch {
      return null;
    }
  }, [mode, zexpr]);

  function saveToHistory() {
    const txt = mode === "2d" ? `Plot y = ${expr}` : `Plot z = ${zexpr}`;
    setResult("Saved to history.");
    pushHistory({ area: "Graphs", latex, ascii, resultText: txt });
    setTimeout(() => setResult(""), 1200);
  }

  return (
    <div className="grid">
      <div className="card">
        <div className="card-header">
          <h2>Graphs (2D & 3D)</h2>
          <p>Interactive plotter with zoom/pan. Use math.js syntax (sin, cos, ^, etc.).</p>
        </div>
        <div className="card-body">
          <div className="row" style={{ marginBottom: 10 }}>
            <button className={`button ${mode === "2d" ? "primary" : ""}`} onClick={() => setMode("2d")}>2D</button>
            <button className={`button ${mode === "3d" ? "primary" : ""}`} onClick={() => setMode("3d")}>3D</button>
            <button className="button" onClick={() => { setLatex("y=\\sin(x)"); setExpr("sin(x)"); setXmin("-10"); setXmax("10"); }}>Load 2D Example</button>
            <button className="button" onClick={() => { setLatex("z=\\sin(x)\\cos(y)"); setZexpr("sin(x)*cos(y)"); setMode("3d"); }}>Load 3D Example</button>
          </div>

          <EquationEditor
            latex={latex}
            onChange={({ latex: L, ascii: A }) => {
              setLatex(L);
              setAscii(A);
            }}
          />

          <hr className="sep" />

          {mode === "2d" ? (
            <>
              <div className="small">y = f(x)</div>
              <input className="input mono" value={expr} onChange={(e) => setExpr(e.target.value)} placeholder="sin(x)" />
              <div className="row" style={{ marginTop: 10 }}>
                <div style={{ flex: 1 }}>
                  <div className="small">x min</div>
                  <input className="input mono" value={xmin} onChange={(e) => setXmin(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="small">x max</div>
                  <input className="input mono" value={xmax} onChange={(e) => setXmax(e.target.value)} />
                </div>
                <button className="button primary" onClick={saveToHistory}>Save</button>
              </div>

              <div style={{ marginTop: 12 }}>
                {plot2d ? (
                  <Plot
                    data={[
                      { x: plot2d.xs, y: plot2d.ys, type: "scatter", mode: "lines", name: "y" },
                    ]}
                    layout={{
                      autosize: true,
                      height: 420,
                      margin: { l: 40, r: 20, t: 20, b: 40 },
                      paper_bgcolor: "rgba(0,0,0,0)",
                      plot_bgcolor: "rgba(0,0,0,0)",
                      xaxis: { title: "x", gridcolor: "rgba(255,255,255,0.08)" },
                      yaxis: { title: "y", gridcolor: "rgba(255,255,255,0.08)" },
                      font: { color: "#e9eeff" },
                    }}
                    config={{ responsive: true, displaylogo: false }}
                    style={{ width: "100%" }}
                  />
                ) : (
                  <div className="katex-wrap mono">Invalid expression or range.</div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="small">z = f(x, y)</div>
              <input className="input mono" value={zexpr} onChange={(e) => setZexpr(e.target.value)} placeholder="sin(x)*cos(y)" />
              <div className="row" style={{ marginTop: 10 }}>
                <button className="button primary" onClick={saveToHistory}>Save</button>
              </div>

              <div style={{ marginTop: 12 }}>
                {plot3d ? (
                  <Plot
                    data={[
                      { x: plot3d.x, y: plot3d.y, z: plot3d.z, type: "surface" as any },
                    ]}
                    layout={{
                      autosize: true,
                      height: 460,
                      margin: { l: 10, r: 10, t: 20, b: 10 },
                      paper_bgcolor: "rgba(0,0,0,0)",
                      font: { color: "#e9eeff" },
                    }}
                    config={{ responsive: true, displaylogo: false }}
                    style={{ width: "100%" }}
                  />
                ) : (
                  <div className="katex-wrap mono">Invalid expression.</div>
                )}
              </div>
            </>
          )}

          {result && <div className="small" style={{ marginTop: 10 }}>{result}</div>}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Rendered Equation</h2>
          <p>Use this for sharing and exporting later.</p>
        </div>
        <div className="card-body">
          <div className="hide-mobile" style={{ marginBottom: 12 }}>
            <AdSlot slot="sidebar" />
          </div>
          <KatexBlock latex={latex || "\\text{ }"} />
          <div className="row" style={{ marginTop: 12 }}>
            <button className="button" onClick={() => navigator.clipboard.writeText(latex)}>Copy LaTeX</button>
            <button className="button" onClick={() => navigator.clipboard.writeText(mode === "2d" ? expr : zexpr)}>Copy Expression</button>
          </div>
        </div>
      </div>
    </div>
  );
}
