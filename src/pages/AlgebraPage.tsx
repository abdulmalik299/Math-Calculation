import React, { useEffect, useMemo, useState } from "react";
import AdSlot from "../components/AdSlot";
import EquationEditor from "../components/EquationEditor";
import KatexBlock from "../components/KatexBlock";
import { evaluateExpression, friendlyMathError } from "../lib/math";
import { pushHistory } from "../lib/storage";
import { copyShareLink, getHashQueryParams } from "../lib/share";
import { getInitialTabValue, persistTabState } from "../lib/project";

type Step = { title: string; latex: string };

function solveLinear(ax: number, b: number) {
  if (Math.abs(ax) < 1e-12) throw new Error("a cannot be 0 for a linear equation.");
  return -b / ax;
}

export default function AlgebraPage() {
  const qp = getHashQueryParams();
  const [latex, setLatex] = useState<string>(getInitialTabValue("algebra", "latex", qp.get("latex"), "ax+b=0"));
  const [ascii, setAscii] = useState<string>("");
  const [a, setA] = useState<string>(getInitialTabValue("algebra", "a", qp.get("a"), "2"));
  const [b, setB] = useState<string>(getInitialTabValue("algebra", "b", qp.get("b"), "5"));
  const [poly, setPoly] = useState<string>(getInitialTabValue("algebra", "poly", qp.get("poly"), "(x+1)*(x-3)"));
  const [result, setResult] = useState<string>(getInitialTabValue("algebra", "result", qp.get("result"), ""));
  const [steps, setSteps] = useState<Step[]>([]);
  const [showSteps, setShowSteps] = useState<boolean>(getInitialTabValue("algebra", "steps", qp.get("steps"), "0") === "1");

  useEffect(() => {
    persistTabState("algebra", { latex, a, b, poly, result, steps: showSteps ? "1" : "0" });
  }, [latex, a, b, poly, result, showSteps]);

  const linear = useMemo(() => {
    const A = Number(a);
    const B = Number(b);
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
        { title: "Given", latex: `${linear.A}x + ${linear.B} = 0` },
        { title: "Move constant", latex: `${linear.A}x = ${-linear.B}` },
        { title: "Divide by coefficient", latex: `x = \\frac{${-linear.B}}{${linear.A}}` },
        { title: "Answer", latex: `x = ${x}` },
      ]);
      pushHistory({ area: "Algebra", latex, ascii, resultText: txt });
    } catch (e) {
      setResult(friendlyMathError(e));
      setSteps([]);
    }
  }

  function onEvaluate() {
    try {
      const v = evaluateExpression(poly, { x: 2 });
      const txt = `f(2) = ${v}`;
      setResult(txt);
      setSteps([
        { title: "Expression", latex: `f(x) = ${poly}` },
        { title: "Substitute", latex: "x = 2" },
        { title: "Result", latex: `f(2) = ${v}` },
      ]);
      pushHistory({ area: "Algebra", latex, ascii, resultText: txt });
    } catch (e) {
      setResult(friendlyMathError(e));
      setSteps([]);
    }
  }

  function onSolveSteps() {
    onSolve();
    setShowSteps(true);
  }

  return (
    <div className="grid">
      <div className="card">
        <div className="card-header">
          <h2>Algebra Tools</h2>
          <p>Solve / simplify with structured step output (title + LaTeX).</p>
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
            <button className="button" onClick={() => { setPoly("x^2-1"); setA("3"); setB("-12"); }}>🧪 Example: Polynomial</button>
            <button className="button" onClick={() => { setPoly("sin(x)^2 + cos(x)^2"); }}>🧪 Example: Trig</button>
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
                <button className="button" onClick={onSolveSteps}>Solve (Steps)</button>
              </div>
              <div className="small" style={{ marginTop: 10 }}>Result</div>
              <div className="katex-wrap mono">{result || "—"}</div>
            </div>
          </div>

          <hr className="sep" />

          <div className="card" style={{ padding: 0 }}>
            <div className="card-header">
              <h2>Expression Check (Simplify/Evaluate)</h2>
              <p>Enter f(x) and evaluate at x=2.</p>
            </div>
            <div className="card-body">
              <input className="input mono" value={poly} onChange={(e) => setPoly(e.target.value)} />
              <div className="row" style={{ marginTop: 10 }}>
                <button className="button primary" onClick={onEvaluate}>Evaluate at x=2</button>
              </div>
            </div>
          </div>

          {showSteps && steps.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="small">Step-by-step</div>
              <div style={{ display: "grid", gap: 8 }}>
                {steps.map((s, i) => (
                  <div key={i} className="katex-wrap mono" style={{ whiteSpace: "pre-wrap" }}>
                    <strong>{i + 1}. {s.title}</strong>
                    <div>{s.latex}</div>
                  </div>
                ))}
              </div>
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
