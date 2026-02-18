import React, { useEffect, useMemo, useState } from "react";
import AdSlot from "../components/AdSlot";
import EquationEditor from "../components/EquationEditor";
import KatexBlock from "../components/KatexBlock";
import { evaluateExpression, friendlyMathError } from "../lib/math";
import { pushHistory } from "../lib/storage";
import { copyShareLink, getHashQueryParams } from "../lib/share";
import { getInitialTabValue, persistTabState } from "../lib/project";

export default function CalculatorPage() {
  const qp = getHashQueryParams();
  const [latex, setLatex] = useState<string>(getInitialTabValue("calculator", "latex", qp.get("latex"), "\\frac{1}{n(n-1)}\\sum_{u\\neq v} d(u,v)"));
  const [ascii, setAscii] = useState<string>("");
  const [expr, setExpr] = useState<string>(getInitialTabValue("calculator", "expr", qp.get("expr"), "(1)/(n*(n-1))"));
  const [vars, setVars] = useState<string>(getInitialTabValue("calculator", "vars", qp.get("vars"), "n=10"));
  const [result, setResult] = useState<string>(getInitialTabValue("calculator", "result", qp.get("result"), ""));
  const [status, setStatus] = useState("");

  const scope = useMemo(() => {
    const out: Record<string, number> = {};
    vars.split(/,|\n/).map(s => s.trim()).filter(Boolean).forEach(pair => {
      const m = pair.match(/^([a-zA-Z]\w*)\s*=\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)$/i);
      if (m) out[m[1]] = Number(m[2]);
    });
    return out;
  }, [vars]);

  const canEval = useMemo(() => expr.trim().length > 0, [expr]);

  useEffect(() => {
    persistTabState("calculator", { latex, expr, vars, result });
  }, [latex, expr, vars, result]);

  function onCalculate() {
    try {
      const v = evaluateExpression(expr, scope);
      const txt = typeof v === "number" ? String(v) : JSON.stringify(v);
      setResult(txt);
      pushHistory({ area: "Calculator", latex, ascii, resultText: txt });
    } catch (e) {
      setResult(friendlyMathError(e));
    }
  }

  async function onCopyShare() {
    await copyShareLink("/calculator", { latex, expr, vars, result });
    setStatus("Share link copied.");
    setTimeout(() => setStatus(""), 1200);
  }

  function fillExample() {
    setLatex("M(P_n)=\\frac{n+1}{3}");
    setExpr("(n+1)/3");
    setVars("n=10");
    setResult("");
  }

  return (
    <div className="grid">
      <div className="card">
        <div className="card-header">
          <h2>Equation + Calculator</h2>
          <p>Write the equation beautifully (PDF-style), and compute using a separate evaluatable expression (Phase 1).</p>
        </div>
        <div className="card-body">
          <EquationEditor
            latex={latex}
            onChange={({ latex: L, ascii: A }) => {
              setLatex(L);
              setAscii(A);
            }}
            placeholder="Type equation (LaTeX-quality)…"
          />

          <hr className="sep" />

          <div className="row" style={{ marginBottom: 10 }}>
            <div className="pill">Compute Expression (math.js)</div>
            <button className="button" onClick={fillExample}>✨ Load Example</button>
          </div>

          <input
            className="input mono"
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            placeholder="Example: (n+1)/3"
          />
          <div className="small" style={{ marginTop: 8 }}>
            Variables: write like <span className="mono">n=10, x=2</span>
          </div>
          <textarea
            style={{ marginTop: 10 }}
            className="input mono"
            rows={2}
            value={vars}
            onChange={(e) => setVars(e.target.value)}
          />

          <div className="row" style={{ marginTop: 12 }}>
            <button className="button primary" disabled={!canEval} onClick={onCalculate}>🧮 Calculate</button>
            <button className="button" onClick={() => navigator.clipboard.writeText(latex)}>📄 Copy LaTeX</button>
            <button className="button" onClick={() => navigator.clipboard.writeText(expr)}>📋 Copy Expression</button>
            <button className="button" onClick={onCopyShare}>🔗 Copy Share Link</button>
          </div>
          {status && <div className="small" style={{ marginTop: 8 }}>{status}</div>}

          <div style={{ marginTop: 12 }}>
            <div className="small">Result</div>
            <div className="katex-wrap mono">{result || "—"}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Rendered (KaTeX)</h2>
          <p>What the user sees: clean mathematical typesetting.</p>
        </div>
        <div className="card-body">
          <div className="hide-mobile" style={{ marginBottom: 12 }}>
            <AdSlot slot="sidebar" />
          </div>
          <KatexBlock latex={latex || "\\text{ }"} />
          <div className="small" style={{ marginTop: 12 }}>
            Your typed ASCII (from MathLive) is:
            <div className="katex-wrap mono" style={{ marginTop: 6 }}>{ascii || "—"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
