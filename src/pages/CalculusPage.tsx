import React, { useEffect, useState } from "react";
import AdSlot from "../components/AdSlot";
import EquationEditor from "../components/EquationEditor";
import KatexBlock from "../components/KatexBlock";
import { evaluateExpression, friendlyMathError, numericDerivative, numericIntegral } from "../lib/math";
import { pushHistory } from "../lib/storage";
import { copyShareLink, getHashQueryParams } from "../lib/share";
import { getInitialTabValue, persistTabState } from "../lib/project";

type Step = { title: string; latex: string };

export default function CalculusPage() {
  const qp = getHashQueryParams();
  const [latex, setLatex] = useState<string>(getInitialTabValue("calculus", "latex", qp.get("latex"), "f(x)=x^3\\sin(x)"));
  const [ascii, setAscii] = useState<string>("");
  const [expr, setExpr] = useState<string>(getInitialTabValue("calculus", "expr", qp.get("expr"), "x^3*sin(x)"));
  const [x0, setX0] = useState<string>(getInitialTabValue("calculus", "x0", qp.get("x0"), "1"));
  const [a, setA] = useState<string>(getInitialTabValue("calculus", "a", qp.get("a"), "0"));
  const [b, setB] = useState<string>(getInitialTabValue("calculus", "b", qp.get("b"), "3.14159"));
  const [limitTo, setLimitTo] = useState<string>(getInitialTabValue("calculus", "limitTo", qp.get("limitTo"), "0"));
  const [result, setResult] = useState<string>(getInitialTabValue("calculus", "result", qp.get("result"), ""));
  const [showSteps, setShowSteps] = useState<boolean>(getInitialTabValue("calculus", "steps", qp.get("steps"), "0") === "1");
  const [steps, setSteps] = useState<Step[]>([]);

  useEffect(() => {
    persistTabState("calculus", { latex, expr, x0, a, b, limitTo, result, steps: showSteps ? "1" : "0" });
  }, [latex, expr, x0, a, b, limitTo, result, showSteps]);

  function doDerivative(withSteps = false) {
    try {
      const x = Number(x0);
      if (!Number.isFinite(x)) throw new Error("Invalid x.");
      const d = numericDerivative(expr, x);
      const txt = `f'(${x}) ≈ ${d}`;
      setResult(txt);
      setSteps([
        { title: "Given", latex: `f(x)=${expr}` },
        { title: "Derivative definition", latex: "f'(x)\\approx \\frac{f(x+h)-f(x-h)}{2h}" },
        { title: "Evaluate", latex: txt },
      ]);
      if (withSteps) setShowSteps(true);
      pushHistory({ area: "Calculus", latex, ascii, resultText: txt });
    } catch (e) {
      setResult(friendlyMathError(e));
      setSteps([]);
    }
  }

  function doIntegral(withSteps = false) {
    try {
      const A = Number(a);
      const B = Number(b);
      if (!Number.isFinite(A) || !Number.isFinite(B)) throw new Error("Invalid bounds.");
      const I = numericIntegral(expr, A, B);
      const txt = `∫[${A}, ${B}] f(x) dx ≈ ${I}`;
      setResult(txt);
      setSteps([
        { title: "Given", latex: `f(x)=${expr}` },
        { title: "Bounds", latex: `a=${A}, b=${B}` },
        { title: "Simpson rule", latex: "\\int_a^b f(x)dx \\approx \\frac{h}{3}(f_0+4f_1+2f_2+...)" },
        { title: "Evaluate", latex: txt },
      ]);
      if (withSteps) setShowSteps(true);
      pushHistory({ area: "Calculus", latex, ascii, resultText: txt });
    } catch (e) {
      setResult(friendlyMathError(e));
      setSteps([]);
    }
  }

  function doLimit(withSteps = false) {
    try {
      const x = Number(limitTo);
      if (!Number.isFinite(x)) throw new Error("Invalid limit point.");
      const h = 1e-4;
      const left = Number(evaluateExpression(expr, { x: x - h }));
      const right = Number(evaluateExpression(expr, { x: x + h }));
      const approx = (left + right) / 2;
      const txt = `lim x→${x} f(x) ≈ ${approx}`;
      setResult(txt);
      setSteps([
        { title: "Given", latex: `f(x)=${expr}` },
        { title: "One-sided samples", latex: `f(${x}-h)=${left}, f(${x}+h)=${right}` },
        { title: "Approximate limit", latex: txt },
      ]);
      if (withSteps) setShowSteps(true);
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
          <h2>Calculus</h2>
          <p>Derivative, integral, and limit with structured steps.</p>
        </div>
        <div className="card-body">
          <EquationEditor latex={latex} onChange={({ latex: L, ascii: A }) => { setLatex(L); setAscii(A); }} placeholder="Type a function…" />
          <hr className="sep" />
          <div className="small">Compute Expression (use x)</div>
          <input className="input mono" value={expr} onChange={(e) => setExpr(e.target.value)} />

          <div className="row" style={{ marginTop: 12 }}>
            <label className="small"><input type="checkbox" checked={showSteps} onChange={(e) => setShowSteps(e.target.checked)} /> Show Steps</label>
            <button className="button" onClick={() => copyShareLink("/calculus", { latex, expr, x0, a, b, limitTo, result, steps: showSteps ? 1 : 0 })}>🔗 Copy Share Link</button>
            <button className="button" onClick={() => { setLatex("f(x)=sin(x)/x"); setExpr("sin(x)/x"); setLimitTo("0"); }}>🧪 Example: limit</button>
          </div>

          <hr className="sep" />
          <div className="card" style={{ padding: 0 }}><div className="card-header"><h2>Derivative at x</h2></div><div className="card-body"><div className="row"><div style={{ flex: 1 }}><div className="small">x</div><input className="input mono" value={x0} onChange={(e) => setX0(e.target.value)} /></div><button className="button primary" onClick={() => doDerivative(false)}>Compute</button><button className="button" onClick={() => doDerivative(true)}>Solve (Steps)</button></div></div></div>
          <hr className="sep" />
          <div className="card" style={{ padding: 0 }}><div className="card-header"><h2>Definite Integral</h2></div><div className="card-body"><div className="row"><div style={{ flex: 1 }}><div className="small">a</div><input className="input mono" value={a} onChange={(e) => setA(e.target.value)} /></div><div style={{ flex: 1 }}><div className="small">b</div><input className="input mono" value={b} onChange={(e) => setB(e.target.value)} /></div><button className="button primary" onClick={() => doIntegral(false)}>Compute</button><button className="button" onClick={() => doIntegral(true)}>Solve (Steps)</button></div></div></div>
          <hr className="sep" />
          <div className="card" style={{ padding: 0 }}><div className="card-header"><h2>Limit at x→c</h2></div><div className="card-body"><div className="row"><div style={{ flex: 1 }}><div className="small">c</div><input className="input mono" value={limitTo} onChange={(e) => setLimitTo(e.target.value)} /></div><button className="button primary" onClick={() => doLimit(false)}>Compute</button><button className="button" onClick={() => doLimit(true)}>Solve (Steps)</button></div></div></div>

          <div style={{ marginTop: 12 }}><div className="small">Result</div><div className="katex-wrap mono">{result || "—"}</div></div>
          {showSteps && steps.length > 0 && <div className="katex-wrap mono" style={{ whiteSpace: "pre-wrap", marginTop: 10 }}>{steps.map((s, i) => `${i + 1}. ${s.title}: ${s.latex}`).join("\n")}</div>}
        </div>
      </div>

      <div className="card"><div className="card-header"><h2>Rendered Function</h2><p>Preview and copy LaTeX.</p></div><div className="card-body"><div className="hide-mobile" style={{ marginBottom: 12 }}><AdSlot slot="sidebar" /></div><KatexBlock latex={latex || "\\text{ }"} /><div className="row" style={{ marginTop: 12 }}><button className="button" onClick={() => navigator.clipboard.writeText(latex)}>📄 Copy LaTeX</button><button className="button" onClick={() => navigator.clipboard.writeText(expr)}>📋 Copy Expression</button></div><div className="small" style={{ marginTop: 12 }}>ASCII:<div className="katex-wrap mono" style={{ marginTop: 6 }}>{ascii || "—"}</div></div></div></div>
    </div>
  );
}
