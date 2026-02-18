import React, { useEffect, useMemo, useRef, useState } from "react";
import Plot from "react-plotly.js";
import AdSlot from "../components/AdSlot";
import EquationEditor from "../components/EquationEditor";
import KatexBlock from "../components/KatexBlock";
import { evaluateExpression, friendlyMathError } from "../lib/math";
import { persistTabState } from "../lib/project";
import { copyShareLink, getQueryValue } from "../lib/share";
import { pushHistory } from "../lib/storage";

function linspace(a: number, b: number, n: number) {
  const out: number[] = [];
  const step = (b - a) / (n - 1);
  for (let i = 0; i < n; i++) out.push(a + i * step);
  return out;
}

type GraphLabTab = "basic" | "advanced" | "blender";
type AdvancedTab = "2dlab" | "3dlab" | "fields" | "data" | "export";
type GraphMode = "2d" | "3d";
type Graph3DType = "surface" | "scatter" | "parametric" | "isosurface";
type CameraPreset = "iso" | "top" | "front" | "side";
type BlenderSubTab = "recipe" | "studio" | "curve" | "vector" | "patterns";

type Layer = {
  id: string;
  name: string;
  expression: string;
  visible: boolean;
  width: number;
  dash: "solid" | "dash" | "dot";
  opacity: number;
  color: string;
};

type PlotPoint = { id: string; x: number; curveId?: string };

const BUILT_INS = ["x", "y", "z", "t", "sin", "cos", "tan", "sqrt", "log", "ln", "abs", "pi", "e", "exp", "min", "max", "clamp", "smoothstep"];

function detectParams(chunks: string[]) {
  const vars = new Set<string>();
  chunks.forEach((chunk) => {
    const tokens = chunk.match(/[a-zA-Z_]\w*/g) || [];
    tokens.forEach((token) => {
      if (!BUILT_INS.includes(token.toLowerCase())) vars.add(token);
    });
  });
  return Array.from(vars).slice(0, 8);
}

function cameraForPreset(preset: CameraPreset) {
  if (preset === "top") return { eye: { x: 0, y: 0.001, z: 2.2 }, up: { x: 0, y: 1, z: 0 } };
  if (preset === "front") return { eye: { x: 0, y: 2.4, z: 0.6 }, up: { x: 0, y: 0, z: 1 } };
  if (preset === "side") return { eye: { x: 2.4, y: 0, z: 0.6 }, up: { x: 0, y: 0, z: 1 } };
  return { eye: { x: 1.5, y: 1.5, z: 1.25 }, up: { x: 0, y: 0, z: 1 } };
}

function numericDerivative(fn: string, x: number, params: Record<string, number>) {
  const h = 1e-4;
  const y1 = Number(evaluateExpression(fn, { x: x - h, ...params }));
  const y2 = Number(evaluateExpression(fn, { x: x + h, ...params }));
  return Number.isFinite(y1) && Number.isFinite(y2) ? (y2 - y1) / (2 * h) : NaN;
}

function trapz(xs: number[], ys: number[]) {
  let sum = 0;
  for (let i = 1; i < xs.length; i++) {
    sum += (xs[i] - xs[i - 1]) * (ys[i] + ys[i - 1]) * 0.5;
  }
  return sum;
}

function id() {
  return Math.random().toString(36).slice(2, 10);
}

function parseDataTable(raw: string) {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => line.split(/[\s,;\t]+/).slice(0, 2).map(Number))
    .filter((row) => row.length === 2 && Number.isFinite(row[0]) && Number.isFinite(row[1]))
    .map(([x, y]) => ({ x, y }));
}

function solveLinearSystem3(a: number[][], b: number[]) {
  const m = a.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < 3; c++) {
    let pivot = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(m[r][c]) > Math.abs(m[pivot][c])) pivot = r;
    [m[c], m[pivot]] = [m[pivot], m[c]];
    const div = m[c][c] || 1e-9;
    for (let k = c; k < 4; k++) m[c][k] /= div;
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const factor = m[r][c];
      for (let k = c; k < 4; k++) m[r][k] -= factor * m[c][k];
    }
  }
  return [m[0][3], m[1][3], m[2][3]];
}

export default function GraphsPage() {
  const [latex, setLatex] = useState<string>(getQueryValue("latex", "y=\\sin(x)"));
  const [ascii, setAscii] = useState<string>("");
  const [graphLabTab, setGraphLabTab] = useState<GraphLabTab>((getQueryValue("lab", "basic") as GraphLabTab) || "basic");
  const [advancedTab, setAdvancedTab] = useState<AdvancedTab>((getQueryValue("adv", "2dlab") as AdvancedTab) || "2dlab");
  const [graphMode, setGraphMode] = useState<GraphMode>((getQueryValue("mode", "2d") as GraphMode) === "3d" ? "3d" : "2d");
  const [graph3DType, setGraph3DType] = useState<Graph3DType>((getQueryValue("kind", "surface") as Graph3DType) || "surface");
  const [layers, setLayers] = useState<Layer[]>([
    { id: id(), name: "f(x)", expression: "sin(x)", visible: true, width: 3, dash: "solid", opacity: 1, color: "#3B82F6" },
    { id: id(), name: "g(x)", expression: "cos(x)", visible: true, width: 3, dash: "solid", opacity: 1, color: "#F59E0B" },
  ]);
  const [breakDiscontinuities, setBreakDiscontinuities] = useState(true);
  const [showAsymptotes, setShowAsymptotes] = useState(false);
  const [showDerivative, setShowDerivative] = useState(false);
  const [showArea, setShowArea] = useState(false);
  const [areaA, setAreaA] = useState(-2);
  const [areaB, setAreaB] = useState(2);
  const [surfaceExpr, setSurfaceExpr] = useState<string>(getQueryValue("surface", "sin(x) * cos(y)"));
  const [surface2DExpr, setSurface2DExpr] = useState<string>("sin(x) * cos(y)");
  const [scatterPoints, setScatterPoints] = useState<string>(getQueryValue("points", "0,0,0\n1,1,2\n2,0,1\n-1,2,0.4"));
  const [parametricX, setParametricX] = useState<string>(getQueryValue("xt", "cos(t)"));
  const [parametricY, setParametricY] = useState<string>(getQueryValue("yt", "sin(t)"));
  const [parametricZ, setParametricZ] = useState<string>(getQueryValue("zt", "t/4"));
  const [isofExpr, setIsofExpr] = useState("x^2 + y^2 + z^2");
  const [isofValue, setIsofValue] = useState("9");
  const [showXSlice, setShowXSlice] = useState(false);
  const [showYSlice, setShowYSlice] = useState(false);
  const [sliceX, setSliceX] = useState(0);
  const [sliceY, setSliceY] = useState(0);
  const [cameraProjection, setCameraProjection] = useState<"orthographic" | "perspective">("perspective");
  const [lockAspect, setLockAspect] = useState(false);
  const [showSpikelines, setShowSpikelines] = useState(true);
  const [contourLevels, setContourLevels] = useState(12);
  const [contourSmoothing, setContourSmoothing] = useState(false);
  const [fieldPx, setFieldPx] = useState("-y");
  const [fieldQy, setFieldQy] = useState("x");
  const [fieldDensity, setFieldDensity] = useState(12);
  const [fieldScale, setFieldScale] = useState(0.4);
  const [slopeExpr, setSlopeExpr] = useState("x - y");
  const [withSolution, setWithSolution] = useState(true);
  const [x0, setX0] = useState(0);
  const [y0, setY0] = useState(1);
  const [dataRaw, setDataRaw] = useState("0,1\n1,2\n2,2.8\n3,4.2");
  const [modelType, setModelType] = useState<"linear" | "quadratic" | "exponential" | "power">("linear");
  const [animating, setAnimating] = useState(false);
  const [animSpeed, setAnimSpeed] = useState(1);
  const [sceneCamera, setSceneCamera] = useState<any>(cameraForPreset("iso"));
  const [sceneRevision, setSceneRevision] = useState(0);
  const [xmin, setXmin] = useState<string>(getQueryValue("xmin", "-10"));
  const [xmax, setXmax] = useState<string>(getQueryValue("xmax", "10"));
  const [ymin, setYmin] = useState<string>(getQueryValue("ymin", "-6"));
  const [ymax, setYmax] = useState<string>(getQueryValue("ymax", "6"));
  const [tmin, setTmin] = useState<string>(getQueryValue("tmin", "-12"));
  const [tmax, setTmax] = useState<string>(getQueryValue("tmax", "12"));
  const [result, setResult] = useState<string>("");
  const [points, setPoints] = useState<PlotPoint[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<string | null>(null);

  const [blenderSubTab, setBlenderSubTab] = useState<BlenderSubTab>("recipe");
  const [blenderExpr, setBlenderExpr] = useState<string>(getQueryValue("bexpr", "sin(t*freq)*amp"));
  const [freq, setFreq] = useState<string>(getQueryValue("freq", "1"));
  const [amp, setAmp] = useState<string>(getQueryValue("amp", "1"));
  const [fieldContext, setFieldContext] = useState("xpos");
  const [mapFromMin, setMapFromMin] = useState(0);
  const [mapFromMax, setMapFromMax] = useState(1);
  const [mapToMin, setMapToMin] = useState(0);
  const [mapToMax, setMapToMax] = useState(1);
  const [mapClamp, setMapClamp] = useState(true);
  const [smooth0, setSmooth0] = useState(0.2);
  const [smooth1, setSmooth1] = useState(0.8);
  const [curvePoints, setCurvePoints] = useState([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
  const [curveInterp, setCurveInterp] = useState<"linear" | "ease" | "bezier">("linear");
  const [vecA, setVecA] = useState("1,0,0");
  const [vecB, setVecB] = useState("0,1,0");
  const [vecOp, setVecOp] = useState<"dot" | "cross" | "normalize" | "length" | "distance" | "project">("dot");
  const plotRef = useRef<any>(null);

  const [paramValues, setParamValues] = useState<Record<string, number>>({ a: 1, b: 1, c: 1, d: 1, k: 1, freq: 1, amp: 1 });

  useEffect(() => {
    persistTabState("graphs", {
      latex,
      mode: graphMode,
      kind: graph3DType,
      layers,
      surface: surfaceExpr,
      points: scatterPoints,
      xt: parametricX,
      yt: parametricY,
      zt: parametricZ,
      xmin,
      xmax,
      ymin,
      ymax,
      tmin,
      tmax,
      lab: graphLabTab,
      adv: advancedTab,
      bexpr: blenderExpr,
      freq,
      amp,
    });
  }, [latex, graphMode, graph3DType, layers, surfaceExpr, scatterPoints, parametricX, parametricY, parametricZ, xmin, xmax, ymin, ymax, tmin, tmax, graphLabTab, advancedTab, blenderExpr, freq, amp]);

  useEffect(() => {
    if (!animating) return;
    const timer = setInterval(() => {
      setParamValues((prev) => ({ ...prev, a: ((prev.a ?? 0) + 0.03 * animSpeed) % 10 }));
    }, 30);
    return () => clearInterval(timer);
  }, [animating, animSpeed]);

  const params = useMemo(() => {
    const fnExprs = layers.map((l) => l.expression);
    return detectParams([...fnExprs, surfaceExpr, parametricX, parametricY, parametricZ, blenderExpr, fieldPx, fieldQy, slopeExpr]);
  }, [layers, surfaceExpr, parametricX, parametricY, parametricZ, blenderExpr, fieldPx, fieldQy, slopeExpr]);

  const bounds = useMemo(() => ({
    xa: Number(xmin),
    xb: Number(xmax),
    ya: Number(ymin),
    yb: Number(ymax),
    ta: Number(tmin),
    tb: Number(tmax),
  }), [xmin, xmax, ymin, ymax, tmin, tmax]);

  const plot2d = useMemo(() => {
    try {
      const { xa, xb } = bounds;
      if (![xa, xb].every(Number.isFinite) || xa >= xb) return null;
      const xs = linspace(xa, xb, 700);
      const traces: any[] = [];
      const shapes: any[] = [];
      const valuesAtHover: string[] = [];

      layers.forEach((layer) => {
        const ys: Array<number | null> = [];
        const brokenXs: number[] = [];
        const evalY = (x: number) => Number(evaluateExpression(layer.expression, { x, ...paramValues }));
        for (let i = 0; i < xs.length; i++) {
          const x = xs[i];
          const y = evalY(x);
          const prev = i > 0 ? evalY(xs[i - 1]) : y;
          const isInvalid = !Number.isFinite(y);
          const jump = Number.isFinite(prev) && Number.isFinite(y) && Math.abs(y - prev) > Math.max(10, Math.abs(prev) * 5);
          if ((isInvalid || (breakDiscontinuities && jump)) && showAsymptotes) brokenXs.push(x);
          ys.push(isInvalid || (breakDiscontinuities && jump) ? null : y);
        }

        traces.push({
          x: xs,
          y: ys,
          type: "scatter",
          mode: "lines",
          name: layer.name,
          visible: layer.visible,
          line: { width: layer.width, dash: layer.dash, color: layer.color },
          opacity: layer.opacity,
          hovertemplate: `${layer.name}: %{y:.5f}<extra></extra>`,
        });

        brokenXs.forEach((xv) => {
          shapes.push({ type: "line", x0: xv, x1: xv, y0: bounds.ya, y1: bounds.yb, line: { color: "rgba(244,63,94,0.45)", dash: "dash", width: 1.5 } });
        });

        if (layer.visible) {
          const midX = (xa + xb) / 2;
          const midY = evalY(midX);
          if (Number.isFinite(midY)) valuesAtHover.push(`${layer.name}(${midX.toFixed(2)})=${midY.toFixed(3)}`);
        }
      });

      const primary = layers.find((l) => l.visible) || layers[0];
      if (showDerivative && primary) {
        traces.push({
          x: xs,
          y: xs.map((x) => numericDerivative(primary.expression, x, paramValues)).map((v) => (Number.isFinite(v) ? v : null)),
          type: "scatter",
          mode: "lines",
          name: `${primary.name}'(x)`,
          line: { color: "#22D3EE", width: 2, dash: "dash" },
        });
      }

      if (showArea && primary) {
        const a = Math.min(areaA, areaB);
        const b = Math.max(areaA, areaB);
        const areaXs = xs.filter((x) => x >= a && x <= b);
        const areaYs = areaXs.map((x) => Number(evaluateExpression(primary.expression, { x, ...paramValues })));
        traces.push({ x: areaXs, y: areaYs, type: "scatter", mode: "lines", fill: "tozeroy", fillcolor: "rgba(59,130,246,0.2)", line: { color: "rgba(59,130,246,0.6)" }, name: `Area [${a.toFixed(2)}, ${b.toFixed(2)}]` });
      }

      points.forEach((p) => {
        const target = layers.find((l) => l.id === p.curveId) || layers.find((l) => l.visible) || layers[0];
        if (!target) return;
        const y = Number(evaluateExpression(target.expression, { x: p.x, ...paramValues }));
        if (!Number.isFinite(y)) return;
        traces.push({ x: [p.x], y: [y], type: "scatter", mode: "markers+text", marker: { size: 10, color: "#A78BFA" }, text: [p.id === selectedPoint ? "selected" : ""], textposition: "top center", name: `P(${p.x.toFixed(2)}, ${y.toFixed(2)})` });
        const slope = numericDerivative(target.expression, p.x, paramValues);
        if (Number.isFinite(slope)) {
          const x1 = p.x - 1;
          const x2 = p.x + 1;
          traces.push({ x: [x1, x2], y: [y - slope, y + slope], type: "scatter", mode: "lines", line: { dash: "dot", color: "#C4B5FD" }, showlegend: false, name: "tangent" });
        }
      });

      return { traces, shapes, valuesAtHover };
    } catch {
      return null;
    }
  }, [bounds, layers, paramValues, breakDiscontinuities, showAsymptotes, showDerivative, showArea, areaA, areaB, points, selectedPoint]);

  const mathInspector = useMemo(() => {
    const primary = layers.find((l) => l.visible) || layers[0];
    if (!primary) return null;
    try {
      const { xa, xb } = bounds;
      const xs = linspace(xa, xb, 300);
      const ys = xs.map((x) => Number(evaluateExpression(primary.expression, { x, ...paramValues })));
      const invalid = ys.filter((y) => !Number.isFinite(y)).length;
      const roots: number[] = [];
      const critical: number[] = [];
      for (let i = 1; i < xs.length; i++) {
        if (Number.isFinite(ys[i]) && Number.isFinite(ys[i - 1]) && ys[i] * ys[i - 1] < 0) roots.push(xs[i]);
        const d1 = numericDerivative(primary.expression, xs[i - 1], paramValues);
        const d2 = numericDerivative(primary.expression, xs[i], paramValues);
        if (Number.isFinite(d1) && Number.isFinite(d2) && d1 * d2 < 0) critical.push(xs[i]);
      }
      const finiteYs = ys.filter(Number.isFinite);
      return {
        invalid,
        yIntercept: Number(evaluateExpression(primary.expression, { x: 0, ...paramValues })),
        roots: roots.slice(0, 5),
        critical: critical.slice(0, 5),
        max: finiteYs.length ? Math.max(...finiteYs) : NaN,
        min: finiteYs.length ? Math.min(...finiteYs) : NaN,
      };
    } catch {
      return null;
    }
  }, [layers, bounds, paramValues]);

  const plot3d = useMemo(() => {
    try {
      const { xa, xb, ya, yb, ta, tb } = bounds;
      if (graph3DType === "surface") {
        const xs = linspace(xa, xb, 44);
        const ys = linspace(ya, yb, 44);
        const z = ys.map((y) => xs.map((x) => Number(evaluateExpression(surfaceExpr, { x, y, ...paramValues }))));
        const traces: any[] = [{ type: "surface", x: xs, y: ys, z, colorscale: "Viridis", name: `z=${surfaceExpr}` }];
        if (showXSlice) {
          traces.push({ type: "scatter3d", mode: "lines", x: ys.map(() => sliceX), y: ys, z: ys.map((y) => Number(evaluateExpression(surfaceExpr, { x: sliceX, y, ...paramValues }))), line: { color: "#F97316", width: 5 }, name: `x=${sliceX.toFixed(2)} section` });
        }
        if (showYSlice) {
          traces.push({ type: "scatter3d", mode: "lines", x: xs, y: xs.map(() => sliceY), z: xs.map((x) => Number(evaluateExpression(surfaceExpr, { x, y: sliceY, ...paramValues }))), line: { color: "#22D3EE", width: 5 }, name: `y=${sliceY.toFixed(2)} section` });
        }
        return traces;
      }
      if (graph3DType === "isosurface") {
        const xs = linspace(xa, xb, 16);
        const ys = linspace(ya, yb, 16);
        const zs = linspace(Number(ymin), Number(ymax), 16);
        const gx: number[] = [];
        const gy: number[] = [];
        const gz: number[] = [];
        const vals: number[] = [];
        xs.forEach((x) => ys.forEach((y) => zs.forEach((z) => {
          gx.push(x); gy.push(y); gz.push(z);
          vals.push(Number(evaluateExpression(isofExpr, { x, y, z, ...paramValues })));
        })));
        const target = Number(isofValue);
        return [{ type: "isosurface", x: gx, y: gy, z: gz, value: vals, isomin: target, isomax: target, caps: { x: { show: false }, y: { show: false }, z: { show: false } }, colorscale: "Turbo", opacity: 0.6, surface: { show: true, count: 1 } }];
      }
      if (graph3DType === "scatter") {
        const lines = scatterPoints.split("\n").map((line) => line.trim()).filter(Boolean);
        const pts = lines.map((line) => {
          const [px, py, pz] = line.split(",").map((s) => s.trim());
          return { x: Number(evaluateExpression(px, { ...paramValues })), y: Number(evaluateExpression(py, { ...paramValues })), z: Number(evaluateExpression(pz, { ...paramValues })) };
        }).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z));
        return [{ type: "scatter3d", mode: "markers", x: pts.map((p) => p.x), y: pts.map((p) => p.y), z: pts.map((p) => p.z), marker: { size: 4, color: pts.map((p) => p.z), colorscale: "Turbo" } }];
      }
      const ts = linspace(ta, tb, 440);
      return [{ type: "scatter3d", mode: "lines", x: ts.map((t) => Number(evaluateExpression(parametricX, { t, ...paramValues }))), y: ts.map((t) => Number(evaluateExpression(parametricY, { t, ...paramValues }))), z: ts.map((t) => Number(evaluateExpression(parametricZ, { t, ...paramValues }))), line: { width: 6, color: ts, colorscale: "Plasma" } }];
    } catch {
      return null;
    }
  }, [graph3DType, bounds, surfaceExpr, showXSlice, showYSlice, sliceX, sliceY, scatterPoints, parametricX, parametricY, parametricZ, paramValues, isofExpr, isofValue, ymin, ymax]);

  const contourHeatmap = useMemo(() => {
    try {
      const xs = linspace(bounds.xa, bounds.xb, 60);
      const ys = linspace(bounds.ya, bounds.yb, 60);
      const z = ys.map((y) => xs.map((x) => Number(evaluateExpression(surface2DExpr, { x, y, ...paramValues }))));
      return { xs, ys, z };
    } catch {
      return null;
    }
  }, [bounds, surface2DExpr, paramValues]);

  const vectorFieldPlot = useMemo(() => {
    const traces: any[] = [];
    const xs = linspace(bounds.xa, bounds.xb, fieldDensity);
    const ys = linspace(bounds.ya, bounds.yb, fieldDensity);
    xs.forEach((x) => ys.forEach((y) => {
      try {
        const u = Number(evaluateExpression(fieldPx, { x, y, ...paramValues }));
        const v = Number(evaluateExpression(fieldQy, { x, y, ...paramValues }));
        if (!Number.isFinite(u) || !Number.isFinite(v)) return;
        traces.push({ x: [x, x + u * fieldScale], y: [y, y + v * fieldScale], type: "scatter", mode: "lines", line: { color: `rgba(56,189,248,${Math.min(1, Math.hypot(u, v) / 5)})`, width: 1.5 }, hoverinfo: "skip", showlegend: false });
      } catch {
        // ignore
      }
    }));
    return traces;
  }, [bounds, fieldDensity, fieldPx, fieldQy, fieldScale, paramValues]);

  const slopeFieldPlot = useMemo(() => {
    const traces: any[] = [];
    const xs = linspace(bounds.xa, bounds.xb, fieldDensity);
    const ys = linspace(bounds.ya, bounds.yb, fieldDensity);
    xs.forEach((x) => ys.forEach((y) => {
      try {
        const m = Number(evaluateExpression(slopeExpr, { x, y, ...paramValues }));
        if (!Number.isFinite(m)) return;
        const dx = 0.3;
        traces.push({ x: [x - dx, x + dx], y: [y - m * dx, y + m * dx], type: "scatter", mode: "lines", line: { color: "rgba(249,115,22,0.65)", width: 1.4 }, hoverinfo: "skip", showlegend: false });
      } catch {
        // ignore
      }
    }));
    if (withSolution) {
      const n = 250;
      const h = (bounds.xb - bounds.xa) / n;
      const xvals: number[] = [x0];
      const yvals: number[] = [y0];
      for (let i = 1; i < n; i++) {
        const x = xvals[i - 1];
        const y = yvals[i - 1];
        const k1 = Number(evaluateExpression(slopeExpr, { x, y, ...paramValues }));
        const ynext = y + h * (Number.isFinite(k1) ? k1 : 0);
        xvals.push(x + h);
        yvals.push(ynext);
      }
      traces.push({ x: xvals, y: yvals, type: "scatter", mode: "lines", line: { color: "#F59E0B", width: 3 }, name: "solution curve" });
    }
    return traces;
  }, [bounds, fieldDensity, slopeExpr, withSolution, x0, y0, paramValues]);

  const regression = useMemo(() => {
    const pts = parseDataTable(dataRaw);
    if (pts.length < 2) return null;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    let predict = (x: number) => x;
    let equation = "";

    if (modelType === "linear") {
      const n = xs.length;
      const sx = xs.reduce((a, b) => a + b, 0);
      const sy = ys.reduce((a, b) => a + b, 0);
      const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0);
      const sxx = xs.reduce((a, x) => a + x * x, 0);
      const m = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1e-9);
      const b = (sy - m * sx) / n;
      predict = (x) => m * x + b;
      equation = `y = ${m.toFixed(4)}x + ${b.toFixed(4)}`;
    } else if (modelType === "quadratic") {
      const s1 = xs.length;
      const sx = xs.reduce((a, x) => a + x, 0);
      const sx2 = xs.reduce((a, x) => a + x * x, 0);
      const sx3 = xs.reduce((a, x) => a + x * x * x, 0);
      const sx4 = xs.reduce((a, x) => a + x * x * x * x, 0);
      const sy = ys.reduce((a, y) => a + y, 0);
      const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0);
      const sx2y = xs.reduce((a, x, i) => a + x * x * ys[i], 0);
      const [c, b, a] = solveLinearSystem3([[s1, sx, sx2], [sx, sx2, sx3], [sx2, sx3, sx4]], [sy, sxy, sx2y]);
      predict = (x) => a * x * x + b * x + c;
      equation = `y = ${a.toFixed(4)}x² + ${b.toFixed(4)}x + ${c.toFixed(4)}`;
    } else if (modelType === "exponential") {
      const valid = pts.filter((p) => p.y > 0);
      const lx = valid.map((p) => p.x);
      const ly = valid.map((p) => Math.log(p.y));
      const n = lx.length || 1;
      const sx = lx.reduce((a, b) => a + b, 0);
      const sy = ly.reduce((a, b) => a + b, 0);
      const sxy = lx.reduce((a, x, i) => a + x * ly[i], 0);
      const sxx = lx.reduce((a, x) => a + x * x, 0);
      const b = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1e-9);
      const lnA = (sy - b * sx) / n;
      const A = Math.exp(lnA);
      predict = (x) => A * Math.exp(b * x);
      equation = `y = ${A.toFixed(4)}e^(${b.toFixed(4)}x)`;
    } else {
      const valid = pts.filter((p) => p.x > 0 && p.y > 0);
      const lx = valid.map((p) => Math.log(p.x));
      const ly = valid.map((p) => Math.log(p.y));
      const n = lx.length || 1;
      const sx = lx.reduce((a, b) => a + b, 0);
      const sy = ly.reduce((a, b) => a + b, 0);
      const sxy = lx.reduce((a, x, i) => a + x * ly[i], 0);
      const sxx = lx.reduce((a, x) => a + x * x, 0);
      const b = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1e-9);
      const lnA = (sy - b * sx) / n;
      const A = Math.exp(lnA);
      predict = (x) => A * Math.pow(x, b);
      equation = `y = ${A.toFixed(4)}x^${b.toFixed(4)}`;
    }

    const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
    const pred = xs.map((x) => predict(x));
    const ssRes = ys.reduce((a, y, i) => a + (y - pred[i]) ** 2, 0);
    const ssTot = ys.reduce((a, y) => a + (y - mean) ** 2, 0);
    const r2 = 1 - ssRes / (ssTot || 1e-9);
    const residuals = ys.map((y, i) => y - pred[i]);

    return { pts, pred, equation, r2, residuals };
  }, [dataRaw, modelType]);

  const blenderPlot = useMemo(() => {
    try {
      const f = Number(freq);
      const a = Number(amp);
      const ts = linspace(-10, 10, 400);
      const xIn = ts.map((t) => (fieldContext === "distance" ? Math.abs(t) : fieldContext === "id" ? Math.round(t + 10) : t));
      const ys = xIn.map((t) => Number(evaluateExpression(blenderExpr, { t, freq: f, amp: a })));
      return [{ x: ts, y: ys, type: "scatter", mode: "lines", name: "Blender preview" }];
    } catch {
      return null;
    }
  }, [blenderExpr, freq, amp, fieldContext]);

  const mapStudioPlot = useMemo(() => {
    const xs = linspace(-0.2, 1.2, 300);
    const mapped = xs.map((x) => {
      const t = (x - mapFromMin) / ((mapFromMax - mapFromMin) || 1e-9);
      const clamped = mapClamp ? Math.min(1, Math.max(0, t)) : t;
      return mapToMin + clamped * (mapToMax - mapToMin);
    });
    const smooth = xs.map((x) => {
      const t = Math.min(1, Math.max(0, (x - smooth0) / ((smooth1 - smooth0) || 1e-9)));
      return t * t * (3 - 2 * t);
    });
    return [{ x: xs, y: mapped, type: "scatter", mode: "lines", name: "Map Range" }, { x: xs, y: smooth, type: "scatter", mode: "lines", name: "Smoothstep" }];
  }, [mapFromMin, mapFromMax, mapToMin, mapToMax, mapClamp, smooth0, smooth1]);

  const curvePlot = useMemo(() => {
    const pts = [...curvePoints].sort((a, b) => a.x - b.x);
    const xs = linspace(pts[0]?.x ?? 0, pts[pts.length - 1]?.x ?? 1, 300);
    const ys = xs.map((x) => {
      const i = Math.max(0, pts.findIndex((p) => p.x >= x) - 1);
      const p1 = pts[i] ?? pts[0];
      const p2 = pts[i + 1] ?? pts[pts.length - 1];
      const t = (x - p1.x) / ((p2.x - p1.x) || 1e-9);
      if (curveInterp === "ease") {
        const tt = t * t * (3 - 2 * t);
        return p1.y + (p2.y - p1.y) * tt;
      }
      if (curveInterp === "bezier") {
        const tt = t * t;
        return p1.y + (p2.y - p1.y) * tt;
      }
      return p1.y + (p2.y - p1.y) * t;
    });
    return [{ x: xs, y: ys, type: "scatter", mode: "lines", name: "Float Curve" }, { x: pts.map((p) => p.x), y: pts.map((p) => p.y), type: "scatter", mode: "markers", name: "Control Points" }];
  }, [curvePoints, curveInterp]);

  const vectorResult = useMemo(() => {
    const parseVec = (txt: string) => txt.split(/[\s,]+/).map(Number).slice(0, 3);
    const A = parseVec(vecA);
    const B = parseVec(vecB);
    if (A.length < 3 || B.length < 3) return "Invalid vectors";
    const dot = A[0] * B[0] + A[1] * B[1] + A[2] * B[2];
    const lenA = Math.hypot(...A);
    const lenB = Math.hypot(...B);
    if (vecOp === "dot") return `dot(A,B) = ${dot.toFixed(4)}`;
    if (vecOp === "cross") return `cross(A,B) = (${(A[1] * B[2] - A[2] * B[1]).toFixed(3)}, ${(A[2] * B[0] - A[0] * B[2]).toFixed(3)}, ${(A[0] * B[1] - A[1] * B[0]).toFixed(3)})`;
    if (vecOp === "normalize") return `normalize(A) = (${(A[0] / (lenA || 1)).toFixed(3)}, ${(A[1] / (lenA || 1)).toFixed(3)}, ${(A[2] / (lenA || 1)).toFixed(3)})`;
    if (vecOp === "length") return `|A| = ${lenA.toFixed(4)}`;
    if (vecOp === "distance") return `distance(A,B) = ${Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]).toFixed(4)}`;
    const scale = dot / ((lenB ** 2) || 1e-9);
    return `project(A onto B) = (${(B[0] * scale).toFixed(3)}, ${(B[1] * scale).toFixed(3)}, ${(B[2] * scale).toFixed(3)})`;
  }, [vecA, vecB, vecOp]);

  const nodeRecipe = useMemo(() => {
    const expr = blenderExpr.toLowerCase();
    const steps = ["Input: Value(t)"];
    if (expr.includes("clamp")) steps.push("Math: Clamp");
    if (expr.includes("smoothstep")) steps.push("Map Range/Smoothstep");
    if (expr.includes("sin")) steps.push("Math: Sine");
    if (expr.includes("cos")) steps.push("Math: Cosine");
    if (expr.includes("*freq")) steps.push("Math: Multiply(freq)");
    if (expr.includes("*amp")) steps.push("Math: Multiply(amp)");
    steps.push("Output: Float field");
    return steps;
  }, [blenderExpr]);

  function saveToHistory() {
    const txt = graphMode === "2d" ? `2D layers: ${layers.map((l) => l.expression).join(" | ")}` : `3D ${graph3DType}`;
    setResult("Saved to history.");
    pushHistory({ area: "Graphs", latex, ascii, resultText: txt });
    setTimeout(() => setResult(""), 1200);
  }

  async function onShare() {
    try {
      await copyShareLink("/graphs", { latex, mode: graphMode, kind: graph3DType, layers: JSON.stringify(layers), xmin, xmax, ymin, ymax, tmin, tmax, lab: graphLabTab, adv: advancedTab, bexpr: blenderExpr, freq, amp });
      setResult("Share link copied.");
      setTimeout(() => setResult(""), 1200);
    } catch (e) {
      setResult(friendlyMathError(e));
    }
  }

  function setCamera(preset: CameraPreset) {
    setSceneCamera(cameraForPreset(preset));
    setSceneRevision((v) => v + 1);
  }

  async function exportImage(format: "png" | "svg") {
    const gd = plotRef.current?.el;
    const plotly = (window as any).Plotly;
    if (!gd || !plotly?.toImage) {
      setResult("Export unavailable in this browser.");
      return;
    }
    const url = await plotly.toImage(gd, { format, width: 1400, height: 900, scale: 2 });
    const a = document.createElement("a");
    a.href = url;
    a.download = `graph-export.${format}`;
    a.click();
  }

  function copyCSV() {
    const { xa, xb } = bounds;
    const primary = layers.find((l) => l.visible) || layers[0];
    const xs = linspace(xa, xb, 160);
    const rows = xs.map((x) => `${x},${Number(evaluateExpression(primary.expression, { x, ...paramValues }))}`);
    navigator.clipboard.writeText(`x,y\n${rows.join("\n")}`);
    setResult("CSV copied.");
    setTimeout(() => setResult(""), 1000);
  }

  return (
    <div className="grid">
      <div className="card">
        <div className="card-header"><h2>Graphs — Pro Lab</h2><p>Basic + Advanced + Blender Nodes workflows.</p></div>
        <div className="card-body">
          <div className="row" style={{ marginBottom: 10, flexWrap: "wrap" }}>
            <button className="button" onClick={saveToHistory}>💾 Save</button>
            <button className="button" onClick={onShare}>🔗 Copy Share Link</button>
            <button className="button" onClick={() => exportImage("png")}>🖼️ Export PNG</button>
            <button className="button" onClick={() => exportImage("svg")}>🧩 Export SVG</button>
            <button className="button" onClick={() => navigator.clipboard.writeText(latex)}>📄 Copy LaTeX</button>
            <button className="button" onClick={copyCSV}>📋 Copy CSV</button>
          </div>

          <div className="row" style={{ gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <button className={`button ${graphLabTab === "basic" ? "primary" : ""}`} onClick={() => setGraphLabTab("basic")}>Basic</button>
            <button className={`button ${graphLabTab === "advanced" ? "primary" : ""}`} onClick={() => setGraphLabTab("advanced")}>Advanced</button>
            <button className={`button ${graphLabTab === "blender" ? "primary" : ""}`} onClick={() => setGraphLabTab("blender")}>Blender Nodes</button>
          </div>

          {graphLabTab !== "blender" && <EquationEditor latex={latex} onChange={({ latex: L, ascii: A }) => { setLatex(L); setAscii(A); }} />}

          {graphLabTab === "basic" && (
            <>
              <hr className="sep" />
              <div className="row" style={{ flexWrap: "wrap", alignItems: "center" }}>
                <button className={`button ${graphMode === "2d" ? "primary" : ""}`} onClick={() => setGraphMode("2d")}>2D</button>
                <button className={`button ${graphMode === "3d" ? "primary" : ""}`} onClick={() => setGraphMode("3d")}>3D</button>
                {graphMode === "3d" && (
                  <select className="input" style={{ maxWidth: 260 }} value={graph3DType} onChange={(e) => setGraph3DType(e.target.value as Graph3DType)}>
                    <option value="surface">Surface</option>
                    <option value="scatter">3D Scatter</option>
                    <option value="parametric">3D Parametric</option>
                    <option value="isosurface">Isosurface</option>
                  </select>
                )}
              </div>

              {graphMode === "2d" ? (
                <>
                  <div className="card" style={{ marginTop: 10, padding: 10 }}>
                    <div className="small">Layers panel</div>
                    {layers.map((layer) => (
                      <div key={layer.id} className="card" style={{ padding: 8, marginTop: 8 }}>
                        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                          <label className="small"><input type="checkbox" checked={layer.visible} onChange={() => setLayers((prev) => prev.map((l) => l.id === layer.id ? { ...l, visible: !l.visible } : l))} /> visible</label>
                          <input className="input mono" style={{ maxWidth: 120 }} value={layer.name} onChange={(e) => setLayers((prev) => prev.map((l) => l.id === layer.id ? { ...l, name: e.target.value } : l))} />
                          <input className="input mono" style={{ flex: 1 }} value={layer.expression} onChange={(e) => setLayers((prev) => prev.map((l) => l.id === layer.id ? { ...l, expression: e.target.value } : l))} />
                          <input type="color" value={layer.color} onChange={(e) => setLayers((prev) => prev.map((l) => l.id === layer.id ? { ...l, color: e.target.value } : l))} />
                          <select className="input" value={layer.dash} onChange={(e) => setLayers((prev) => prev.map((l) => l.id === layer.id ? { ...l, dash: e.target.value as Layer["dash"] } : l))}><option value="solid">solid</option><option value="dash">dash</option><option value="dot">dot</option></select>
                          <input type="range" min={1} max={8} value={layer.width} onChange={(e) => setLayers((prev) => prev.map((l) => l.id === layer.id ? { ...l, width: Number(e.target.value) } : l))} />
                          <input type="range" min={0.1} max={1} step={0.1} value={layer.opacity} onChange={(e) => setLayers((prev) => prev.map((l) => l.id === layer.id ? { ...l, opacity: Number(e.target.value) } : l))} />
                          <button className="button" onClick={() => setLayers((prev) => [...prev, { ...layer, id: id(), name: `${layer.name} copy` }])}>Duplicate</button>
                          <button className="button" onClick={() => setLayers((prev) => prev.filter((l) => l.id !== layer.id))}>Delete</button>
                        </div>
                      </div>
                    ))}
                    <button className="button" style={{ marginTop: 8 }} onClick={() => setLayers((prev) => [...prev, { id: id(), name: `layer ${prev.length + 1}`, expression: "x", visible: true, width: 2, dash: "solid", opacity: 1, color: "#10B981" }])}>+ Add layer</button>
                  </div>

                  <div className="row" style={{ marginTop: 8, flexWrap: "wrap" }}>
                    <label className="small"><input type="checkbox" checked={breakDiscontinuities} onChange={(e) => setBreakDiscontinuities(e.target.checked)} /> Break at discontinuities</label>
                    <label className="small"><input type="checkbox" checked={showAsymptotes} onChange={(e) => setShowAsymptotes(e.target.checked)} /> Asymptote hints</label>
                    <label className="small"><input type="checkbox" checked={showDerivative} onChange={(e) => setShowDerivative(e.target.checked)} /> Show derivative f'(x)</label>
                    <label className="small"><input type="checkbox" checked={showArea} onChange={(e) => setShowArea(e.target.checked)} /> Shade area under curve</label>
                  </div>
                  {showArea && (
                    <div className="row" style={{ marginTop: 6 }}>
                      <div style={{ flex: 1 }}><div className="small">a = {areaA.toFixed(2)}</div><input type="range" min={bounds.xa} max={bounds.xb} step={0.1} value={areaA} onChange={(e) => setAreaA(Number(e.target.value))} style={{ width: "100%" }} /></div>
                      <div style={{ flex: 1 }}><div className="small">b = {areaB.toFixed(2)}</div><input type="range" min={bounds.xa} max={bounds.xb} step={0.1} value={areaB} onChange={(e) => setAreaB(Number(e.target.value))} style={{ width: "100%" }} /></div>
                    </div>
                  )}

                  <div className="row" style={{ marginTop: 10 }}>
                    <div style={{ flex: 1 }}><div className="small">x min</div><input className="input mono" value={xmin} onChange={(e) => setXmin(e.target.value)} /></div>
                    <div style={{ flex: 1 }}><div className="small">x max</div><input className="input mono" value={xmax} onChange={(e) => setXmax(e.target.value)} /></div>
                    <div style={{ flex: 1 }}><div className="small">y min</div><input className="input mono" value={ymin} onChange={(e) => setYmin(e.target.value)} /></div>
                    <div style={{ flex: 1 }}><div className="small">y max</div><input className="input mono" value={ymax} onChange={(e) => setYmax(e.target.value)} /></div>
                  </div>

                  <div className="row" style={{ marginTop: 8, flexWrap: "wrap" }}>
                    <button className="button" onClick={() => setPoints((prev) => [...prev, { id: id(), x: (bounds.xa + bounds.xb) / 2, curveId: layers.find((l) => l.visible)?.id }])}>➕ Add point</button>
                    {selectedPoint && (
                      <button className="button" onClick={() => setPoints((prev) => prev.filter((p) => p.id !== selectedPoint))}>Remove selected point</button>
                    )}
                  </div>
                  {selectedPoint && (
                    <div className="small" style={{ marginTop: 6 }}>
                      Drag point via slider:
                      <input type="range" min={bounds.xa} max={bounds.xb} step={0.01} value={points.find((p) => p.id === selectedPoint)?.x ?? 0} onChange={(e) => setPoints((prev) => prev.map((p) => p.id === selectedPoint ? { ...p, x: Number(e.target.value) } : p))} style={{ width: "100%" }} />
                    </div>
                  )}

                  <div style={{ marginTop: 12 }}>
                    {plot2d ? (
                      <Plot
                        ref={plotRef}
                        data={plot2d.traces as any}
                        layout={{ autosize: true, height: 460, margin: { l: 40, r: 20, t: 20, b: 40 }, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", xaxis: { title: "x", gridcolor: "rgba(255,255,255,0.08)" }, yaxis: { title: "y", gridcolor: "rgba(255,255,255,0.08)", range: [bounds.ya, bounds.yb] }, font: { color: "#e9eeff" }, shapes: plot2d.shapes, hovermode: "x unified", showlegend: true }}
                        config={{ responsive: true, displaylogo: false }}
                        style={{ width: "100%" }}
                        onClick={(e: any) => {
                          const x = e?.points?.[0]?.x;
                          if (typeof x === "number") {
                            const curveId = layers.find((l) => l.visible)?.id;
                            const pid = id();
                            setPoints((prev) => [...prev, { id: pid, x, curveId }]);
                            setSelectedPoint(pid);
                          }
                        }}
                      />
                    ) : <div className="katex-wrap mono">Invalid expression or range.</div>}
                    <div className="small">Hover sample: {plot2d?.valuesAtHover.join(" • ")}</div>
                    {showArea && plot2d && <div className="small">Estimated area ≈ {(() => {
                      const primary = layers.find((l) => l.visible) || layers[0];
                      const a = Math.min(areaA, areaB);
                      const b = Math.max(areaA, areaB);
                      const xs = linspace(a, b, 400);
                      const ys = xs.map((x) => Number(evaluateExpression(primary.expression, { x, ...paramValues })));
                      return trapz(xs, ys).toFixed(6);
                    })()}</div>}
                  </div>
                </>
              ) : (
                <>
                  <div className="row" style={{ marginTop: 8 }}>
                    <div style={{ flex: 1 }}><div className="small">x min</div><input className="input mono" value={xmin} onChange={(e) => setXmin(e.target.value)} /></div>
                    <div style={{ flex: 1 }}><div className="small">x max</div><input className="input mono" value={xmax} onChange={(e) => setXmax(e.target.value)} /></div>
                    <div style={{ flex: 1 }}><div className="small">y min</div><input className="input mono" value={ymin} onChange={(e) => setYmin(e.target.value)} /></div>
                    <div style={{ flex: 1 }}><div className="small">y max</div><input className="input mono" value={ymax} onChange={(e) => setYmax(e.target.value)} /></div>
                  </div>
                  {graph3DType === "surface" && <input className="input mono" value={surfaceExpr} onChange={(e) => setSurfaceExpr(e.target.value)} />}
                  {graph3DType === "scatter" && <textarea rows={5} className="input mono" value={scatterPoints} onChange={(e) => setScatterPoints(e.target.value)} />}
                  {graph3DType === "parametric" && <div className="row"><input className="input mono" value={parametricX} onChange={(e) => setParametricX(e.target.value)} /><input className="input mono" value={parametricY} onChange={(e) => setParametricY(e.target.value)} /><input className="input mono" value={parametricZ} onChange={(e) => setParametricZ(e.target.value)} /></div>}
                  {graph3DType === "isosurface" && <div className="row"><input className="input mono" value={isofExpr} onChange={(e) => setIsofExpr(e.target.value)} /><input className="input mono" value={isofValue} onChange={(e) => setIsofValue(e.target.value)} /></div>}

                  <div className="row" style={{ marginTop: 8, flexWrap: "wrap" }}>
                    <button className="button" onClick={() => setCamera("top")}>Top</button>
                    <button className="button" onClick={() => setCamera("front")}>Front</button>
                    <button className="button" onClick={() => setCamera("side")}>Side</button>
                    <button className="button" onClick={() => setCamera("iso")}>Isometric</button>
                    <label className="small"><input type="checkbox" checked={showXSlice} onChange={(e) => setShowXSlice(e.target.checked)} /> x=a slice</label>
                    <label className="small"><input type="checkbox" checked={showYSlice} onChange={(e) => setShowYSlice(e.target.checked)} /> y=b slice</label>
                    <label className="small"><input type="checkbox" checked={lockAspect} onChange={(e) => setLockAspect(e.target.checked)} /> Lock aspect</label>
                    <label className="small"><input type="checkbox" checked={showSpikelines} onChange={(e) => setShowSpikelines(e.target.checked)} /> Spikelines</label>
                    <select className="input" value={cameraProjection} onChange={(e) => setCameraProjection(e.target.value as "orthographic" | "perspective")}><option value="perspective">Perspective</option><option value="orthographic">Orthographic</option></select>
                  </div>
                  <div className="row"><div style={{ flex: 1 }}><div className="small">a={sliceX.toFixed(2)}</div><input type="range" min={bounds.xa} max={bounds.xb} step={0.1} value={sliceX} onChange={(e) => setSliceX(Number(e.target.value))} style={{ width: "100%" }} /></div><div style={{ flex: 1 }}><div className="small">b={sliceY.toFixed(2)}</div><input type="range" min={bounds.ya} max={bounds.yb} step={0.1} value={sliceY} onChange={(e) => setSliceY(Number(e.target.value))} style={{ width: "100%" }} /></div></div>

                  <div style={{ marginTop: 12 }}>
                    {plot3d ? <Plot ref={plotRef} data={plot3d as any} layout={{ autosize: true, height: 520, margin: { l: 0, r: 0, t: 10, b: 0 }, paper_bgcolor: "rgba(0,0,0,0)", font: { color: "#e9eeff" }, scene: { camera: { ...sceneCamera, projection: { type: cameraProjection } }, aspectmode: lockAspect ? "cube" : "auto", xaxis: { title: "x", showspikes: showSpikelines }, yaxis: { title: "y", showspikes: showSpikelines }, zaxis: { title: "z", showspikes: showSpikelines } }, uirevision: sceneRevision, showlegend: true }} config={{ responsive: true, displaylogo: false }} onRelayout={(ev: any) => { const cam = ev?.["scene.camera"]; if (cam) setSceneCamera(cam); }} style={{ width: "100%" }} /> : <div className="katex-wrap mono">Invalid 3D expression/range or empty point cloud.</div>}
                  </div>
                </>
              )}

              {mathInspector && (
                <div className="card" style={{ marginTop: 12, padding: 10 }}>
                  <div className="small">Math Inspector (estimated)</div>
                  <div className="small">Domain issues: {mathInspector.invalid}</div>
                  <div className="small">y-intercept: {Number.isFinite(mathInspector.yIntercept) ? mathInspector.yIntercept.toFixed(4) : "n/a"}</div>
                  <div className="small">Roots: {mathInspector.roots.map((r) => r.toFixed(3)).join(", ") || "none"}</div>
                  <div className="small">Critical points: {mathInspector.critical.map((r) => r.toFixed(3)).join(", ") || "none"}</div>
                  <div className="small">max/min: {mathInspector.max.toFixed(3)} / {mathInspector.min.toFixed(3)}</div>
                </div>
              )}
            </>
          )}

          {graphLabTab === "advanced" && (
            <>
              <hr className="sep" />
              <div className="row" style={{ flexWrap: "wrap" }}>
                <button className={`button ${advancedTab === "2dlab" ? "primary" : ""}`} onClick={() => setAdvancedTab("2dlab")}>2D Lab</button>
                <button className={`button ${advancedTab === "3dlab" ? "primary" : ""}`} onClick={() => setAdvancedTab("3dlab")}>3D Lab</button>
                <button className={`button ${advancedTab === "fields" ? "primary" : ""}`} onClick={() => setAdvancedTab("fields")}>Fields</button>
                <button className={`button ${advancedTab === "data" ? "primary" : ""}`} onClick={() => setAdvancedTab("data")}>Data/Regression</button>
                <button className={`button ${advancedTab === "export" ? "primary" : ""}`} onClick={() => setAdvancedTab("export")}>Export/Share</button>
              </div>

              {advancedTab === "2dlab" && contourHeatmap && (
                <>
                  <div className="small" style={{ marginTop: 8 }}>z = f(x,y)</div>
                  <input className="input mono" value={surface2DExpr} onChange={(e) => setSurface2DExpr(e.target.value)} />
                  <div className="row" style={{ marginTop: 8 }}>
                    <div style={{ flex: 1 }}><div className="small">Contour Levels</div><input type="range" min={4} max={30} value={contourLevels} onChange={(e) => setContourLevels(Number(e.target.value))} style={{ width: "100%" }} /></div>
                    <label className="small"><input type="checkbox" checked={contourSmoothing} onChange={(e) => setContourSmoothing(e.target.checked)} /> Smoothing</label>
                  </div>
                  <Plot data={[{ type: "heatmap", x: contourHeatmap.xs, y: contourHeatmap.ys, z: contourHeatmap.z, colorscale: "Viridis", name: "Heatmap" }, { type: "contour", x: contourHeatmap.xs, y: contourHeatmap.ys, z: contourHeatmap.z, contours: { coloring: "lines", showlabels: true, start: -5, end: 5, size: 10 / contourLevels }, line: { smoothing: contourSmoothing ? 1 : 0 } } as any]} layout={{ autosize: true, height: 480, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", font: { color: "#e9eeff" } }} config={{ responsive: true, displaylogo: false }} style={{ width: "100%", marginTop: 10 }} />
                </>
              )}

              {advancedTab === "3dlab" && (
                <>
                  <div className="small">Advanced 3D quick controls</div>
                  <select className="input" value={graph3DType} onChange={(e) => setGraph3DType(e.target.value as Graph3DType)}><option value="surface">Surface</option><option value="isosurface">Isosurface</option><option value="scatter">Scatter</option><option value="parametric">Parametric</option></select>
                  <div style={{ marginTop: 10 }}>{plot3d && <Plot data={plot3d as any} layout={{ autosize: true, height: 500, paper_bgcolor: "rgba(0,0,0,0)", font: { color: "#e9eeff" }, scene: { camera: { ...sceneCamera, projection: { type: cameraProjection } }, aspectmode: lockAspect ? "cube" : "auto", xaxis: { showspikes: showSpikelines }, yaxis: { showspikes: showSpikelines }, zaxis: { showspikes: showSpikelines } } }} config={{ responsive: true, displaylogo: false }} style={{ width: "100%" }} />}</div>
                </>
              )}

              {advancedTab === "fields" && (
                <>
                  <div className="card" style={{ padding: 10, marginTop: 8 }}>
                    <div className="small">Vector field: dx=P(x,y), dy=Q(x,y)</div>
                    <div className="row"><input className="input mono" value={fieldPx} onChange={(e) => setFieldPx(e.target.value)} /><input className="input mono" value={fieldQy} onChange={(e) => setFieldQy(e.target.value)} /></div>
                    <div className="row"><div style={{ flex: 1 }}><div className="small">density {fieldDensity}</div><input type="range" min={5} max={24} value={fieldDensity} onChange={(e) => setFieldDensity(Number(e.target.value))} style={{ width: "100%" }} /></div><div style={{ flex: 1 }}><div className="small">scale {fieldScale.toFixed(2)}</div><input type="range" min={0.1} max={1.2} step={0.05} value={fieldScale} onChange={(e) => setFieldScale(Number(e.target.value))} style={{ width: "100%" }} /></div></div>
                    <Plot data={vectorFieldPlot as any} layout={{ autosize: true, height: 420, showlegend: false, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", font: { color: "#e9eeff" } }} config={{ responsive: true, displaylogo: false }} style={{ width: "100%", marginTop: 8 }} />
                  </div>
                  <div className="card" style={{ padding: 10, marginTop: 8 }}>
                    <div className="small">Slope field: dy/dx = f(x,y)</div>
                    <input className="input mono" value={slopeExpr} onChange={(e) => setSlopeExpr(e.target.value)} />
                    <label className="small"><input type="checkbox" checked={withSolution} onChange={(e) => setWithSolution(e.target.checked)} /> Solution curve from initial condition</label>
                    <div className="row"><input className="input mono" value={String(x0)} onChange={(e) => setX0(Number(e.target.value))} /><input className="input mono" value={String(y0)} onChange={(e) => setY0(Number(e.target.value))} /></div>
                    <Plot data={slopeFieldPlot as any} layout={{ autosize: true, height: 420, showlegend: false, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", font: { color: "#e9eeff" } }} config={{ responsive: true, displaylogo: false }} style={{ width: "100%", marginTop: 8 }} />
                  </div>
                </>
              )}

              {advancedTab === "data" && (
                <>
                  <div className="small" style={{ marginTop: 8 }}>Paste x,y table or CSV (2 columns)</div>
                  <textarea rows={6} className="input mono" value={dataRaw} onChange={(e) => setDataRaw(e.target.value)} />
                  <select className="input" value={modelType} onChange={(e) => setModelType(e.target.value as any)}>
                    <option value="linear">Linear</option><option value="quadratic">Quadratic</option><option value="exponential">Exponential</option><option value="power">Power</option>
                  </select>
                  {regression && (
                    <>
                      <div className="small" style={{ marginTop: 8 }}>Best-fit: {regression.equation}</div>
                      <div className="small">R²: {regression.r2.toFixed(6)}</div>
                      <Plot data={[{ x: regression.pts.map((p) => p.x), y: regression.pts.map((p) => p.y), type: "scatter", mode: "markers", name: "Data" }, { x: regression.pts.map((p) => p.x), y: regression.pred, type: "scatter", mode: "lines", name: "Fit" }]} layout={{ autosize: true, height: 360, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", font: { color: "#e9eeff" } }} config={{ responsive: true, displaylogo: false }} style={{ width: "100%" }} />
                      <Plot data={[{ x: regression.pts.map((p) => p.x), y: regression.residuals, type: "bar", name: "Residuals" }]} layout={{ autosize: true, height: 260, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", font: { color: "#e9eeff" } }} config={{ responsive: true, displaylogo: false }} style={{ width: "100%" }} />
                    </>
                  )}
                </>
              )}

              {advancedTab === "export" && (
                <div className="card" style={{ marginTop: 10, padding: 10 }}>
                  <div className="small">Animation mode</div>
                  <div className="row"><button className={`button ${animating ? "primary" : ""}`} onClick={() => setAnimating((v) => !v)}>{animating ? "Pause" : "Play"}</button><div style={{ flex: 1 }}><div className="small">speed {animSpeed.toFixed(1)}x</div><input type="range" min={0.2} max={4} step={0.2} value={animSpeed} onChange={(e) => setAnimSpeed(Number(e.target.value))} style={{ width: "100%" }} /></div></div>
                  <div className="small" style={{ marginTop: 8 }}>Looping parameter a = {paramValues.a?.toFixed(3)}</div>
                  <div className="small">Share includes layers + camera + tabs.</div>
                </div>
              )}
            </>
          )}

          {graphLabTab === "blender" && (
            <>
              <hr className="sep" />
              <div className="row" style={{ flexWrap: "wrap" }}>
                <button className={`button ${blenderSubTab === "recipe" ? "primary" : ""}`} onClick={() => setBlenderSubTab("recipe")}>Node Recipe</button>
                <button className={`button ${blenderSubTab === "studio" ? "primary" : ""}`} onClick={() => setBlenderSubTab("studio")}>Map/Clamp/Smoothstep</button>
                <button className={`button ${blenderSubTab === "curve" ? "primary" : ""}`} onClick={() => setBlenderSubTab("curve")}>Float Curve</button>
                <button className={`button ${blenderSubTab === "vector" ? "primary" : ""}`} onClick={() => setBlenderSubTab("vector")}>Vector Math</button>
                <button className={`button ${blenderSubTab === "patterns" ? "primary" : ""}`} onClick={() => setBlenderSubTab("patterns")}>Pattern Library</button>
              </div>

              <div className="small" style={{ marginTop: 8 }}>Field context helper</div>
              <select className="input" value={fieldContext} onChange={(e) => setFieldContext(e.target.value)}>
                <option value="xpos">X position</option><option value="ypos">Y position</option><option value="distance">Distance from center</option><option value="id">Index / ID</option><option value="random">Random per point</option>
              </select>

              {blenderSubTab === "recipe" && (
                <>
                  <input className="input mono" style={{ marginTop: 8 }} value={blenderExpr} onChange={(e) => setBlenderExpr(e.target.value)} />
                  <div className="row" style={{ marginTop: 8 }}><input className="input mono" value={freq} onChange={(e) => setFreq(e.target.value)} /><input className="input mono" value={amp} onChange={(e) => setAmp(e.target.value)} /></div>
                  <div className="katex-wrap mono" style={{ marginTop: 10 }}>
                    {nodeRecipe.map((s, i) => <div key={i}>{i + 1}. {s}</div>)}
                  </div>
                  <div className="row" style={{ marginTop: 8 }}>
                    <button className="button" onClick={() => navigator.clipboard.writeText(nodeRecipe.join("\n"))}>Copy Node Recipe</button>
                    <button className="button" onClick={() => navigator.clipboard.writeText(blenderExpr)}>Copy Expression</button>
                    <button className="button" onClick={() => navigator.clipboard.writeText(JSON.stringify({ blenderExpr, freq, amp, fieldContext }, null, 2))}>Export JSON preset</button>
                  </div>
                  {blenderPlot && <Plot data={blenderPlot as any} layout={{ autosize: true, height: 380, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", font: { color: "#e9eeff" } }} config={{ responsive: true, displaylogo: false }} style={{ width: "100%", marginTop: 10 }} />}
                </>
              )}

              {blenderSubTab === "studio" && (
                <>
                  <div className="row" style={{ marginTop: 8, flexWrap: "wrap" }}>
                    <div style={{ flex: 1 }}><div className="small">From Min</div><input className="input mono" value={String(mapFromMin)} onChange={(e) => setMapFromMin(Number(e.target.value))} /></div>
                    <div style={{ flex: 1 }}><div className="small">From Max</div><input className="input mono" value={String(mapFromMax)} onChange={(e) => setMapFromMax(Number(e.target.value))} /></div>
                    <div style={{ flex: 1 }}><div className="small">To Min</div><input className="input mono" value={String(mapToMin)} onChange={(e) => setMapToMin(Number(e.target.value))} /></div>
                    <div style={{ flex: 1 }}><div className="small">To Max</div><input className="input mono" value={String(mapToMax)} onChange={(e) => setMapToMax(Number(e.target.value))} /></div>
                  </div>
                  <label className="small"><input type="checkbox" checked={mapClamp} onChange={(e) => setMapClamp(e.target.checked)} /> Clamp</label>
                  <div className="row"><div style={{ flex: 1 }}><div className="small">edge0</div><input className="input mono" value={String(smooth0)} onChange={(e) => setSmooth0(Number(e.target.value))} /></div><div style={{ flex: 1 }}><div className="small">edge1</div><input className="input mono" value={String(smooth1)} onChange={(e) => setSmooth1(Number(e.target.value))} /></div></div>
                  <Plot data={mapStudioPlot as any} layout={{ autosize: true, height: 380, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", font: { color: "#e9eeff" } }} config={{ responsive: true, displaylogo: false }} style={{ width: "100%", marginTop: 8 }} />
                </>
              )}

              {blenderSubTab === "curve" && (
                <>
                  <div className="row" style={{ marginTop: 8 }}>
                    <select className="input" value={curveInterp} onChange={(e) => setCurveInterp(e.target.value as any)}><option value="linear">linear</option><option value="ease">ease</option><option value="bezier">bezier</option></select>
                    <button className="button" onClick={() => setCurvePoints((prev) => [...prev, { x: Math.min(1, (prev[prev.length - 1]?.x ?? 0) + 0.1), y: 0.5 }])}>Add Point</button>
                  </div>
                  {curvePoints.map((p, i) => <div className="row" key={i}><input className="input mono" value={String(p.x)} onChange={(e) => setCurvePoints((prev) => prev.map((cp, idx) => idx === i ? { ...cp, x: Number(e.target.value) } : cp))} /><input className="input mono" value={String(p.y)} onChange={(e) => setCurvePoints((prev) => prev.map((cp, idx) => idx === i ? { ...cp, y: Number(e.target.value) } : cp))} /></div>)}
                  <Plot data={curvePlot as any} layout={{ autosize: true, height: 360, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", font: { color: "#e9eeff" } }} config={{ responsive: true, displaylogo: false }} style={{ width: "100%" }} />
                  <button className="button" onClick={() => navigator.clipboard.writeText(JSON.stringify(curvePoints))}>Copy points (x,y)</button>
                </>
              )}

              {blenderSubTab === "vector" && (
                <>
                  <div className="row" style={{ marginTop: 8 }}><input className="input mono" value={vecA} onChange={(e) => setVecA(e.target.value)} /><input className="input mono" value={vecB} onChange={(e) => setVecB(e.target.value)} /></div>
                  <select className="input" value={vecOp} onChange={(e) => setVecOp(e.target.value as any)}><option value="dot">dot</option><option value="cross">cross</option><option value="normalize">normalize</option><option value="length">length</option><option value="distance">distance</option><option value="project">project</option></select>
                  <div className="katex-wrap mono" style={{ marginTop: 8 }}>{vectorResult}</div>
                  <div className="katex-wrap mono" style={{ marginTop: 8 }}>Node recipe: Vector Math ({vecOp})</div>
                </>
              )}

              {blenderSubTab === "patterns" && (
                <div className="row" style={{ marginTop: 8, flexWrap: "wrap" }}>
                  <button className="button" onClick={() => setBlenderExpr("sin(t*freq)*amp")}>Ripple / Wave</button>
                  <button className="button" onClick={() => setBlenderExpr("sin(t*freq+amp*t)")}>Spiral</button>
                  <button className="button" onClick={() => setBlenderExpr("1/(1+abs(t*freq))")}>Radial gradient</button>
                  <button className="button" onClick={() => setBlenderExpr("2*(t*freq-floor(t*freq+0.5))")}>Sawtooth/Triangle</button>
                  <button className="button" onClick={() => setBlenderExpr("(sin(t*freq)>0)*amp")}>Pulse</button>
                  <button className="button" onClick={() => setBlenderExpr("exp(-abs(t)*freq)")}>Falloff</button>
                  <button className="button" onClick={() => setBlenderExpr("t + amp*sin(t*freq)")}>Twist profile</button>
                  <button className="button" onClick={() => setBlenderExpr("sin(t*12.9898)*43758.5453-floor(sin(t*12.9898)*43758.5453)")}>Noise-like</button>
                </div>
              )}
            </>
          )}

          {params.length > 0 && (
            <>
              <hr className="sep" />
              <div className="small">Auto parameter sliders</div>
              {params.map((p) => (
                <div key={p} style={{ marginTop: 8 }}>
                  <div className="small">{p} = {paramValues[p] ?? 1}</div>
                  <input type="range" min={-10} max={10} step={0.1} value={paramValues[p] ?? 1} onChange={(e) => setParamValues((prev) => ({ ...prev, [p]: Number(e.target.value) }))} style={{ width: "100%" }} />
                </div>
              ))}
            </>
          )}

          {result && <div className="small" style={{ marginTop: 10 }}>{result}</div>}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h2>Inspector / Export</h2><p>Rendered equation + quick utilities.</p></div>
        <div className="card-body">
          <div className="hide-mobile" style={{ marginBottom: 12 }}><AdSlot slot="sidebar" /></div>
          <KatexBlock latex={latex || "\\text{ }"} />
          <div className="katex-wrap mono" style={{ marginTop: 12 }}>
            Layout: Left panel (inputs/layers), Center plot, Right inspector/export.
          </div>
        </div>
      </div>
    </div>
  );
}
