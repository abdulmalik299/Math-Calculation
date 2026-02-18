import React, { useMemo, useState } from "react";
import AdSlot from "../components/AdSlot";
import EquationEditor from "../components/EquationEditor";
import KatexBlock from "../components/KatexBlock";
import { evaluateExpression, friendlyMathError } from "../lib/math";
import { pushHistory } from "../lib/storage";
import { copyShareLink, getQueryValue } from "../lib/share";

function solveLinear(ax: number, b: number) {
  if (Math.abs(ax) < 1e-12) throw new Error("a cannot be 0 for a linear equation.");
  return -b / ax;
}

export default function AlgebraPage() {
  const [latex, setLatex] = useState<string>(getQueryValue("latex", "ax+b=0"));
  const [ascii, setAscii] = useState<string>("");
  const [a, setA] = useState<string>(getQueryValue("a", "2"));
  const [b, setB] = useState<string>(getQueryValue("b", "5"));
  const [poly, setPoly] = useState<string>(getQueryValue("poly", "(x+1)*(x-3)"));
  const [result, setResult] = useState<string>(getQueryValue("result", ""));
  const [steps, setSteps] = useState<string[]>([]);
  const [showSteps, setShowSteps] = useState<boolean>(getQueryValue("steps", "0") === "1");

  const linear = useMemo(() => {
    const A = Number(a), B = Number(b);
    if (!Number.isFinite(A) || !Number.isFinite(B)) return null;
    return { A, B };
  }, [a, b]);

  function onSolve() {
    try {
      if (!linear) throw new Error("Invalid a or b.");
      const x = solveLinear(linear.A, linear.B);
      const txt = `x = ${x}`;
      setResult(txt);
      setSteps([
        `Given equation: ${linear.A}x + ${linear.B} = 0`,
        `Move constant term: ${linear.A}x = ${-linear.B}`,
        `Divide both sides by ${linear.A}: x = ${-linear.B}/${linear.A}`,
        `Result: x = ${x}`,
      ]);
      pushHistory({ area: "Algebra", latex, ascii, resultText: txt });
    } catch (e) {
      setResult(friendlyMathError(e));
      setSteps([]);
    }
  }

  function onSimplify() {
    try {
      const v = evaluateExpression(poly, { x: 2 });
      const txt = `f(2) = ${v}`;
      setResult(txt);
      setSteps([
        `Expression: f(x) = ${poly}`,
        "Substitute x = 2",
        `Compute f(2) = ${v}`,
      ]);
      pushHistory({ area: "Algebra", latex, ascii, resultText: txt });
    } catch (e) {
      setResult(friendlyMathError(e));
      setSteps([]);
    }
  }

  return (
    <div className="grid">
      <div className="card">
        <div className="card-header">
          <h2>Algebra Tools (Phase 1)</h2>
          <p>Browser-only: fast, reliable for common tasks. Phase 2 adds symbolic step-by-step (backend).</p>
        </div>
        <div className="card-body">
          <EquationEditor
            latex={latex}
            onChange={({ latex: L, ascii: A }) => {
              setLatex(L);
              setAscii(A);
            }}
            placeholder="Type an algebra equation…"
          />

          <hr className="sep" />

          <div className="row" style={{ marginBottom: 10 }}>
            <label className="small"><input type="checkbox" checked={showSteps} onChange={(e) => setShowSteps(e.target.checked)} /> Show Steps</label>
            <button className="button" onClick={() => copyShareLink("/algebra", { latex, a, b, poly, result, steps: showSteps ? 1 : 0 })}>🔗 Copy Share Link</button>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="card-header">
              <h2>Linear Solver</h2>
              <p>Solve ax + b = 0</p>
            </div>
            <div className="card-body">
              <div className="row">
                <div style={{ flex: 1 }}><div className="small">a</div><input className="input mono" value={a} onChange={(e) => setA(e.target.value)} /></div>
                <div style={{ flex: 1 }}><div className="small">b</div><input className="input mono" value={b} onChange={(e) => setB(e.target.value)} /></div>
                <button className="button primary" onClick={onSolve}>Solve</button>
              </div>
              <div className="small" style={{ marginTop: 10 }}>Result</div>
              <div className="katex-wrap mono">{result || "—"}</div>
            </div>
          </div>

          <hr className="sep" />

          <div className="card" style={{ padding: 0 }}>
            <div className="card-header">
              <h2>Expression Check</h2>
              <p>Enter f(x) and evaluate at a point (Phase 1). Example: (x+1)*(x-3)</p>
            </div>
            <div className="card-body">
              <input className="input mono" value={poly} onChange={(e) => setPoly(e.target.value)} />
              <div className="row" style={{ marginTop: 10 }}>
                <button className="button" onClick={() => setPoly("(x+1)*(x-3)")} >✨ Load Example</button>
                <button className="button primary" onClick={onSimplify}>Evaluate at x=2</button>
              </div>
            </div>
          </div>

          {showSteps && steps.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="small">Step-by-step</div>
              <div className="katex-wrap mono" style={{ whiteSpace: "pre-wrap" }}>{steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}</div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h2>Rendered Equation</h2><p>KaTeX preview of what you typed.</p></div>
        <div className="card-body">
          <div className="hide-mobile" style={{ marginBottom: 12 }}><AdSlot slot="sidebar" /></div>
          <KatexBlock latex={latex || "\\text{ }"} />
          <div className="small" style={{ marginTop: 12 }}>ASCII:<div className="katex-wrap mono" style={{ marginTop: 6 }}>{ascii || "—"}</div></div>
        </div>
      </div>
    </div>
  );
}
