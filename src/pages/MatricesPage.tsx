import React, { useState } from "react";
import AdSlot from "../components/AdSlot";
import { determinant, formatMatrix, friendlyMathError, inverse, matrixAdd, matrixMul, parseMatrix } from "../lib/math";
import { pushHistory } from "../lib/storage";
import { copyShareLink, getQueryValue } from "../lib/share";
import KatexBlock from "../components/KatexBlock";

function matrixToLatex(A: number[][]) {
  const rows = A.map((r) => r.join(" & ")).join(" \\ ");
  return "\\begin{bmatrix} " + rows + " \\end{bmatrix}";
}

export default function MatricesPage() {
  const [Atext, setAtext] = useState(getQueryValue("A", "1 2\n3 4"));
  const [Btext, setBtext] = useState(getQueryValue("B", "5 6\n7 8"));
  const [result, setResult] = useState<string>(getQueryValue("result", ""));
  const [latex, setLatex] = useState<string>("A=\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}");

  function doOp(op: "add" | "mul" | "det" | "inv") {
    try {
      const A = parseMatrix(Atext);
      let txt = "";
      let L = "";
      if (op === "add") {
        const B = parseMatrix(Btext);
        const C = matrixAdd(A, B);
        txt = formatMatrix(C);
        L = "A+B=" + matrixToLatex(C);
      }
      if (op === "mul") {
        const B = parseMatrix(Btext);
        const C = matrixMul(A, B);
        txt = formatMatrix(C);
        L = "AB=" + matrixToLatex(C);
      }
      if (op === "det") {
        const d = determinant(A);
        txt = String(d);
        L = "\\det(A)=" + String(d);
      }
      if (op === "inv") {
        const invA = inverse(A);
        txt = formatMatrix(invA);
        L = "A^{-1}=" + matrixToLatex(invA);
      }
      setResult(txt);
      setLatex(L);
      pushHistory({ area: "Matrices", latex: L, ascii: "", resultText: txt });
    } catch (e) {
      setResult(friendlyMathError(e));
    }
  }

  return (
    <div className="grid">
      <div className="card">
        <div className="card-header">
          <h2>Matrices</h2>
          <p>Enter matrices as rows separated by new lines. Columns separated by spaces or commas.</p>
        </div>
        <div className="card-body">
          <div className="row" style={{ alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div className="small">Matrix A</div>
              <textarea className="input mono" rows={6} value={Atext} onChange={(e) => setAtext(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="small">Matrix B</div>
              <textarea className="input mono" rows={6} value={Btext} onChange={(e) => setBtext(e.target.value)} />
            </div>
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <button className="button" onClick={() => copyShareLink("/matrices", { A: Atext, B: Btext, result })}>🔗 Copy Share Link</button>
            <button className="button" onClick={() => { setAtext("1 2\n3 4"); setBtext("5 6\n7 8"); }}>✨ Load Example</button>
            <button className="button primary" onClick={() => doOp("add")}>A + B</button>
            <button className="button primary" onClick={() => doOp("mul")}>A × B</button>
            <button className="button" onClick={() => doOp("det")}>det(A)</button>
            <button className="button" onClick={() => doOp("inv")}>A⁻¹</button>
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="small">Result</div>
            <div className="katex-wrap mono" style={{ whiteSpace: "pre-wrap" }}>{result || "—"}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Rendered Result</h2>
          <p>KaTeX preview for matrix outputs.</p>
        </div>
        <div className="card-body">
          <div className="hide-mobile" style={{ marginBottom: 12 }}>
            <AdSlot slot="sidebar" />
          </div>
          <KatexBlock latex={latex || "\\text{ }"} />
          <div className="row" style={{ marginTop: 12 }}>
            <button className="button" onClick={() => copyShareLink("/matrices", { A: Atext, B: Btext, result })}>🔗 Copy Share Link</button>
            <button className="button" onClick={() => navigator.clipboard.writeText(latex)}>📄 Copy LaTeX</button>
          </div>
        </div>
      </div>
    </div>
  );
}
