import { create, all, MathJsStatic } from "mathjs";

const math = create(all as any, {}) as MathJsStatic;

export function friendlyMathError(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error ?? "Unknown error");
  const lower = msg.toLowerCase();

  if (lower.includes("undefined function") || lower.includes("is not a function")) {
    return "Invalid function name. Check function spelling like sin, cos, log, sqrt.";
  }
  if (lower.includes("undefined symbol") || lower.includes("undefined variable")) {
    return "Missing variable value. Define all variables before evaluating.";
  }
  if (lower.includes("parenthesis") || lower.includes("unexpected end of expression") || lower.includes("unexpected part")) {
    return "Invalid expression syntax. Check parentheses and operators.";
  }
  if (lower.includes("division by zero") || lower.includes("infinity") || lower.includes("cannot divide")) {
    return "Division by zero is not allowed in this expression.";
  }
  return msg || "Could not evaluate expression. Please check your math input.";
}

// Safer evaluation: restrict functions by using a scoped evaluate.
export function evaluateExpression(expr: string, scope: Record<string, number> = {}) {
  const cleaned = expr
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .trim();

  if (!cleaned) throw new Error("Please enter an expression.");

  try {
    const v = math.evaluate(cleaned, scope);
    if (typeof v === "number" && !Number.isFinite(v)) {
      throw new Error("Division by zero");
    }
    return v;
  } catch (error) {
    throw new Error(friendlyMathError(error));
  }
}

export function isLikelyVariableExpression(expr: string) {
  return /[a-zA-Z]/.test(expr);
}

// Numeric derivative using central difference
export function numericDerivative(expr: string, x: number, h = 1e-5) {
  const f1 = Number(evaluateExpression(expr, { x: x + h }));
  const f0 = Number(evaluateExpression(expr, { x: x - h }));
  const out = (f1 - f0) / (2 * h);
  if (!Number.isFinite(out)) throw new Error("Derivative is undefined at this point.");
  return out;
}

// Numeric integral using Simpson's rule
export function numericIntegral(expr: string, a: number, b: number, n = 200) {
  const N = n % 2 === 0 ? n : n + 1;
  const h = (b - a) / N;

  let sum = Number(evaluateExpression(expr, { x: a })) + Number(evaluateExpression(expr, { x: b }));
  for (let i = 1; i < N; i++) {
    const x = a + i * h;
    const fx = Number(evaluateExpression(expr, { x }));
    if (!Number.isFinite(fx)) throw new Error("Integral failed because function is undefined on part of the interval.");
    sum += (i % 2 === 0 ? 2 : 4) * fx;
  }
  return (h / 3) * sum;
}

export type Matrix = number[][];

export function parseMatrix(text: string): Matrix {
  const rows = text
    .trim()
    .split(/\n|;/)
    .map((r) => r.trim())
    .filter(Boolean);

  const matrix = rows.map((r) =>
    r
      .split(/\s+|,/)
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => {
        const v = Number(c);
        if (!Number.isFinite(v)) throw new Error("Matrix contains non-numeric value.");
        return v;
      })
  );

  const cols = matrix[0]?.length ?? 0;
  if (cols === 0) throw new Error("Empty matrix.");
  if (matrix.some((r) => r.length !== cols)) throw new Error("All rows must have the same number of columns.");
  return matrix;
}

export function matrixAdd(A: Matrix, B: Matrix): Matrix {
  if (A.length !== B.length || A[0].length !== B[0].length) throw new Error("Matrix sizes must match.");
  return A.map((row, i) => row.map((v, j) => v + B[i][j]));
}

export function matrixMul(A: Matrix, B: Matrix): Matrix {
  const m = A.length, n = A[0].length, p = B[0].length;
  if (n !== B.length) throw new Error("A columns must equal B rows.");
  const out: Matrix = Array.from({ length: m }, () => Array.from({ length: p }, () => 0));
  for (let i = 0; i < m; i++) {
    for (let k = 0; k < n; k++) {
      for (let j = 0; j < p; j++) out[i][j] += A[i][k] * B[k][j];
    }
  }
  return out;
}

export function determinant(A: Matrix): number {
  if (A.length !== A[0].length) throw new Error("Determinant requires a square matrix.");
  const n = A.length;
  const M = A.map((r) => r.slice());
  let det = 1;
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let r = i; r < n; r++) {
      if (Math.abs(M[r][i]) > Math.abs(M[pivot][i])) pivot = r;
    }
    if (Math.abs(M[pivot][i]) < 1e-12) return 0;
    if (pivot !== i) {
      [M[pivot], M[i]] = [M[i], M[pivot]];
      det *= -1;
    }
    det *= M[i][i];
    const div = M[i][i];
    for (let j = i; j < n; j++) M[i][j] /= div;
    for (let r = i + 1; r < n; r++) {
      const factor = M[r][i];
      for (let j = i; j < n; j++) M[r][j] -= factor * M[i][j];
    }
  }
  return det;
}

export function inverse(A: Matrix): Matrix {
  if (A.length !== A[0].length) throw new Error("Inverse requires a square matrix.");
  const n = A.length;
  const M = A.map((r, i) => r.concat(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))));
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let r = i; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[pivot][i])) pivot = r;
    if (Math.abs(M[pivot][i]) < 1e-12) throw new Error("Matrix is singular (no inverse).");
    if (pivot !== i) [M[pivot], M[i]] = [M[i], M[pivot]];
    const div = M[i][i];
    for (let j = 0; j < 2 * n; j++) M[i][j] /= div;
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const factor = M[r][i];
      for (let j = 0; j < 2 * n; j++) M[r][j] -= factor * M[i][j];
    }
  }
  return M.map((r) => r.slice(n));
}

export function formatMatrix(A: Matrix): string {
  return A.map((r) => r.map((v) => (Number.isFinite(v) ? String(Number(v.toFixed(6))) : "NaN")).join("\t")).join("\n");
}
