import React, { useState } from "react";
import AdSlot from "../components/AdSlot";
import EquationEditor from "../components/EquationEditor";
import KatexBlock from "../components/KatexBlock";
import { numericDerivative, numericIntegral } from "../lib/math";
import { pushHistory } from "../lib/storage";

export default function CalculusPage() {
  const [latex, setLatex] = useState<string>("f(x)=x^3\\sin(x)");
  const [ascii, setAscii] = useState<string>("");
  const [expr, setExpr] = useState<string>("x^3*sin(x)");
  const [x0, setX0] = useState<string>("1");
  const [a, setA] = useState<string>("0");
  const [b, setB] = useState<string>("3.14159");
  const [result, setResult] = useState<string>("");

  function doDerivative() {
    try {
      const x = Number(x0);
      if (!Number.isFinite(x)) throw new Error("Invalid x.");
      const d = numericDerivative(expr, x);
      const txt = `f'(${x}) ≈ ${d}`;
      setResult(txt);
      pushHistory({ area: "Calculus", latex, ascii, resultText: txt });
    } catch (e: any) {
      setResult(e?.message ?? "Error");
    }
  }

  function doIntegral() {
    try {
      const A = Number(a), B = Number(b);
      if (!Number.isFinite(A) || !Number.isFinite(B)) throw new Error("Invalid bounds.");
      const I = numericIntegral(expr, A, B);
      const txt = `∫[${A}, ${B}] f(x) dx ≈ ${I}`;
      setResult(txt);
      pushHistory({ area: "Calculus", latex, ascii, resultText: txt });
    } catch (e: any) {
      setResult(e?.message ?? "Error");
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
          <EquationEditor
            latex={latex}
            onChange={({ latex: L, ascii: A }) => {
              setLatex(L);
              setAscii(A);
            }}
            placeholder="Type a function…"
          />

          <hr className="sep" />

          <div className="small">Compute Expression (use variable x)</div>
          <input className="input mono" value={expr} onChange={(e) => setExpr(e.target.value)} />

          <div className="row" style={{ marginTop: 12 }}>
            <button className="button" onClick={() => { setLatex("f(x)=x^3\\sin(x)"); setExpr("x^3*sin(x)"); }}>Load Example</button>
          </div>

          <hr className="sep" />

          <div className="card" style={{ padding: 0 }}>
            <div className="card-header">
              <h2>Derivative at x</h2>
              <p>Central difference approximation.</p>
            </div>
            <div className="card-body">
              <div className="row">
                <div style={{ flex: 1 }}>
                  <div className="small">x</div>
                  <input className="input mono" value={x0} onChange={(e) => setX0(e.target.value)} />
                </div>
                <button className="button primary" onClick={doDerivative}>Compute</button>
              </div>
            </div>
          </div>

          <hr className="sep" />

          <div className="card" style={{ padding: 0 }}>
            <div className="card-header">
              <h2>Definite Integral</h2>
              <p>Simpson’s rule approximation.</p>
            </div>
            <div className="card-body">
              <div className="row">
                <div style={{ flex: 1 }}>
                  <div className="small">a</div>
                  <input className="input mono" value={a} onChange={(e) => setA(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="small">b</div>
                  <input className="input mono" value={b} onChange={(e) => setB(e.target.value)} />
                </div>
                <button className="button primary" onClick={doIntegral}>Compute</button>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="small">Result</div>
            <div className="katex-wrap mono">{result || "—"}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Rendered Function</h2>
          <p>Preview and copy LaTeX.</p>
        </div>
        <div className="card-body">
          <div className="hide-mobile" style={{ marginBottom: 12 }}>
            <AdSlot slot="sidebar" />
          </div>
          <KatexBlock latex={latex || "\\text{ }"} />
          <div className="row" style={{ marginTop: 12 }}>
            <button className="button" onClick={() => navigator.clipboard.writeText(latex)}>Copy LaTeX</button>
            <button className="button" onClick={() => navigator.clipboard.writeText(expr)}>Copy Expression</button>
          </div>
          <div className="small" style={{ marginTop: 12 }}>
            ASCII:
            <div className="katex-wrap mono" style={{ marginTop: 6 }}>{ascii || "—"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
