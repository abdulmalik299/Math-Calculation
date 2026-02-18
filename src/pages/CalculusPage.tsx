import React, { useState } from "react";
import AdSlot from "../components/AdSlot";
import EquationEditor from "../components/EquationEditor";
import KatexBlock from "../components/KatexBlock";
import { friendlyMathError, numericDerivative, numericIntegral } from "../lib/math";
import { pushHistory } from "../lib/storage";
import { copyShareLink, getQueryValue } from "../lib/share";

export default function CalculusPage() {
  const [latex, setLatex] = useState<string>(getQueryValue("latex", "f(x)=x^3\\sin(x)"));
  const [ascii, setAscii] = useState<string>("");
  const [expr, setExpr] = useState<string>(getQueryValue("expr", "x^3*sin(x)"));
  const [x0, setX0] = useState<string>(getQueryValue("x0", "1"));
  const [a, setA] = useState<string>(getQueryValue("a", "0"));
  const [b, setB] = useState<string>(getQueryValue("b", "3.14159"));
  const [result, setResult] = useState<string>(getQueryValue("result", ""));
  const [showSteps, setShowSteps] = useState<boolean>(getQueryValue("steps", "0") === "1");
  const [steps, setSteps] = useState<string[]>([]);

  function doDerivative() {
    try {
      const x = Number(x0);
      if (!Number.isFinite(x)) throw new Error("Invalid x.");
      const d = numericDerivative(expr, x);
      const txt = `f'(${x}) ≈ ${d}`;
      setResult(txt);
      setSteps([`Given f(x)=${expr}`, `Use central difference at x=${x}`, `f'(x)≈(f(x+h)-f(x-h))/(2h)`, `Result: ${txt}`]);
      pushHistory({ area: "Calculus", latex, ascii, resultText: txt });
    } catch (e) {
      setResult(friendlyMathError(e));
      setSteps([]);
    }
  }

  function doIntegral() {
    try {
      const A = Number(a), B = Number(b);
      if (!Number.isFinite(A) || !Number.isFinite(B)) throw new Error("Invalid bounds.");
      const I = numericIntegral(expr, A, B);
      const txt = `∫[${A}, ${B}] f(x) dx ≈ ${I}`;
      setResult(txt);
      setSteps([`Given f(x)=${expr}`, `Integrate from a=${A} to b=${B}`, `Use Simpson's rule`, `Result: ${txt}`]);
      pushHistory({ area: "Calculus", latex, ascii, resultText: txt });
    } catch (e) {
      setResult(friendlyMathError(e));
      setSteps([]);
    }
  }

  return (
    <div className="grid">
      <div className="card">
        <div className="card-header">
          <h2>Calculus (Numeric in Phase 1)</h2>
          <p>Fast derivative/integral approximations in-browser. Phase 2 adds symbolic (step-by-step) via backend.</p>
        </div>
        <div className="card-body">
          <EquationEditor latex={latex} onChange={({ latex: L, ascii: A }) => { setLatex(L); setAscii(A); }} placeholder="Type a function…" />
          <hr className="sep" />
          <div className="small">Compute Expression (use variable x)</div>
          <input className="input mono" value={expr} onChange={(e) => setExpr(e.target.value)} />

          <div className="row" style={{ marginTop: 12 }}>
            <label className="small"><input type="checkbox" checked={showSteps} onChange={(e) => setShowSteps(e.target.checked)} /> Show Steps</label>
            <button className="button" onClick={() => copyShareLink("/calculus", { latex, expr, x0, a, b, result, steps: showSteps ? 1 : 0 })}>🔗 Copy Share Link</button>
            <button className="button" onClick={() => { setLatex("f(x)=x^3\\sin(x)"); setExpr("x^3*sin(x)"); }}>✨ Load Example</button>
          </div>

          <hr className="sep" />
          <div className="card" style={{ padding: 0 }}><div className="card-header"><h2>Derivative at x</h2><p>Central difference approximation.</p></div><div className="card-body"><div className="row"><div style={{ flex: 1 }}><div className="small">x</div><input className="input mono" value={x0} onChange={(e) => setX0(e.target.value)} /></div><button className="button primary" onClick={doDerivative}>Compute</button></div></div></div>
          <hr className="sep" />
          <div className="card" style={{ padding: 0 }}><div className="card-header"><h2>Definite Integral</h2><p>Simpson’s rule approximation.</p></div><div className="card-body"><div className="row"><div style={{ flex: 1 }}><div className="small">a</div><input className="input mono" value={a} onChange={(e) => setA(e.target.value)} /></div><div style={{ flex: 1 }}><div className="small">b</div><input className="input mono" value={b} onChange={(e) => setB(e.target.value)} /></div><button className="button primary" onClick={doIntegral}>Compute</button></div></div></div>

          <div style={{ marginTop: 12 }}><div className="small">Result</div><div className="katex-wrap mono">{result || "—"}</div></div>
          {showSteps && steps.length > 0 && <div className="katex-wrap mono" style={{ whiteSpace: "pre-wrap", marginTop: 10 }}>{steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}</div>}
        </div>
      </div>

      <div className="card"><div className="card-header"><h2>Rendered Function</h2><p>Preview and copy LaTeX.</p></div><div className="card-body"><div className="hide-mobile" style={{ marginBottom: 12 }}><AdSlot slot="sidebar" /></div><KatexBlock latex={latex || "\\text{ }"} /><div className="row" style={{ marginTop: 12 }}><button className="button" onClick={() => navigator.clipboard.writeText(latex)}>📄 Copy LaTeX</button><button className="button" onClick={() => navigator.clipboard.writeText(expr)}>📋 Copy Expression</button></div><div className="small" style={{ marginTop: 12 }}>ASCII:<div className="katex-wrap mono" style={{ marginTop: 6 }}>{ascii || "—"}</div></div></div></div>
    </div>
  );
}
