import React, { useMemo, useState } from "react";
import AdSlot from "../components/AdSlot";
import Plot from "react-plotly.js";
import { evaluateExpression, friendlyMathError } from "../lib/math";
import { pushHistory } from "../lib/storage";
import KatexBlock from "../components/KatexBlock";
import EquationEditor from "../components/EquationEditor";
import { copyShareLink, getQueryValue } from "../lib/share";

function linspace(a: number, b: number, n: number) {
  const out: number[] = [];
  const step = (b - a) / (n - 1);
  for (let i = 0; i < n; i++) out.push(a + i * step);
  return out;
}

export default function GraphsPage() {
  const [latex, setLatex] = useState<string>(getQueryValue("latex", "y=\\sin(x)"));
  const [ascii, setAscii] = useState<string>("");
  const [functionsText, setFunctionsText] = useState<string>(getQueryValue("fns", "sin(x)\ncos(x)"));
  const [xmin, setXmin] = useState<string>(getQueryValue("xmin", "-10"));
  const [xmax, setXmax] = useState<string>(getQueryValue("xmax", "10"));
  const [result, setResult] = useState<string>(getQueryValue("result", ""));

  const functions = useMemo(() => functionsText.split("\n").map((s) => s.trim()).filter(Boolean), [functionsText]);
  const params = useMemo(() => {
    const vars = new Set<string>();
    functions.forEach((fn) => {
      const m = fn.match(/[a-zA-Z_]\w*/g) || [];
      m.forEach((t) => {
        if (!["x", "sin", "cos", "tan", "sqrt", "log", "ln", "abs", "pi", "e", "exp"].includes(t)) vars.add(t);
      });
    });
    return Array.from(vars).slice(0, 3);
  }, [functions]);

  const [paramValues, setParamValues] = useState<Record<string, number>>({ a: 1, b: 1, c: 1 });

  const plot2d = useMemo(() => {
    try {
      const a = Number(xmin), b = Number(xmax);
      if (!Number.isFinite(a) || !Number.isFinite(b) || a >= b) return null;
      const xs = linspace(a, b, 400);
      const traces = functions.map((fn) => {
        const ys = xs.map((x) => Number(evaluateExpression(fn, { x, ...paramValues })));
        return { x: xs, y: ys, type: "scatter", mode: "lines", name: `y=${fn}` };
      });
      return traces;
    } catch {
      return null;
    }
  }, [functions, xmin, xmax, paramValues]);

  function saveToHistory() {
    const txt = `Plot functions: ${functions.join(" | ")}`;
    setResult("Saved to history.");
    pushHistory({ area: "Graphs", latex, ascii, resultText: txt });
    setTimeout(() => setResult(""), 1200);
  }

  async function onShare() {
    try {
      await copyShareLink("/graphs", { latex, fns: functionsText, xmin, xmax, result });
      setResult("Share link copied.");
      setTimeout(() => setResult(""), 1200);
    } catch (e) {
      setResult(friendlyMathError(e));
    }
  }

  return (
    <div className="grid">
      <div className="card">
        <div className="card-header"><h2>Graphs (Desmos-style upgrades)</h2><p>Multi-function graphing, live sliders, and shareable state.</p></div>
        <div className="card-body">
          <div className="row" style={{ marginBottom: 10 }}>
            <button className="button" onClick={() => { setLatex("y=\\sin(x)"); setFunctionsText("sin(x)\ncos(x)"); setXmin("-10"); setXmax("10"); }}>✨ Load Example</button>
            <button className="button primary" onClick={saveToHistory}>💾 Save</button>
            <button className="button" onClick={onShare}>🔗 Copy Share Link</button>
          </div>

          <EquationEditor latex={latex} onChange={({ latex: L, ascii: A }) => { setLatex(L); setAscii(A); }} />

          <hr className="sep" />
          <div className="small">Functions (one per line):</div>
          <textarea rows={4} className="input mono" value={functionsText} onChange={(e) => setFunctionsText(e.target.value)} />

          <div className="row" style={{ marginTop: 10 }}>
            <div style={{ flex: 1 }}><div className="small">x min</div><input className="input mono" value={xmin} onChange={(e) => setXmin(e.target.value)} /></div>
            <div style={{ flex: 1 }}><div className="small">x max</div><input className="input mono" value={xmax} onChange={(e) => setXmax(e.target.value)} /></div>
          </div>

          {params.length > 0 && (
            <>
              <hr className="sep" />
              <div className="small">Parameter sliders</div>
              {params.map((p) => (
                <div key={p} style={{ marginTop: 8 }}>
                  <div className="small">{p} = {paramValues[p] ?? 1}</div>
                  <input type="range" min={-10} max={10} step={0.1} value={paramValues[p] ?? 1} onChange={(e) => setParamValues((prev) => ({ ...prev, [p]: Number(e.target.value) }))} style={{ width: "100%" }} />
                </div>
              ))}
            </>
          )}

          <div style={{ marginTop: 12 }}>
            {plot2d ? <Plot data={plot2d as any} layout={{ autosize: true, height: 420, margin: { l: 40, r: 20, t: 20, b: 40 }, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", xaxis: { title: "x", gridcolor: "rgba(255,255,255,0.08)" }, yaxis: { title: "y", gridcolor: "rgba(255,255,255,0.08)" }, font: { color: "#e9eeff" }, showlegend: true }} config={{ responsive: true, displaylogo: false }} style={{ width: "100%" }} /> : <div className="katex-wrap mono">Invalid expression or range.</div>}
          </div>
          {result && <div className="small" style={{ marginTop: 10 }}>{result}</div>}
        </div>
      </div>

      <div className="card"><div className="card-header"><h2>Rendered Equation</h2><p>Use this for sharing and exporting later.</p></div><div className="card-body"><div className="hide-mobile" style={{ marginBottom: 12 }}><AdSlot slot="sidebar" /></div><KatexBlock latex={latex || "\\text{ }"} /><div className="row" style={{ marginTop: 12 }}><button className="button" onClick={() => navigator.clipboard.writeText(latex)}>📄 Copy LaTeX</button><button className="button" onClick={() => navigator.clipboard.writeText(functionsText)}>📋 Copy Expressions</button></div></div></div>
    </div>
  );
}
