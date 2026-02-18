import React, { useEffect, useMemo, useState } from "react";
import AdSlot from "../components/AdSlot";
import Plot from "react-plotly.js";
import { evaluateExpression, friendlyMathError } from "../lib/math";
import { pushHistory } from "../lib/storage";
import KatexBlock from "../components/KatexBlock";
import EquationEditor from "../components/EquationEditor";
import { copyShareLink, getQueryValue } from "../lib/share";
import { persistTabState } from "../lib/project";

function linspace(a: number, b: number, n: number) {
  const out: number[] = [];
  const step = (b - a) / (n - 1);
  for (let i = 0; i < n; i++) out.push(a + i * step);
  return out;
}

type GraphMode = "2d" | "3d";
type Graph3DType = "surface" | "scatter" | "parametric";
type GraphLabTab = "basic" | "advanced" | "blender";

type CameraPreset = "iso" | "top" | "front" | "side";

const BUILT_INS = ["x", "y", "z", "t", "sin", "cos", "tan", "sqrt", "log", "ln", "abs", "pi", "e", "exp", "min", "max"];

function detectParams(chunks: string[]) {
  const vars = new Set<string>();
  chunks.forEach((chunk) => {
    const tokens = chunk.match(/[a-zA-Z_]\w*/g) || [];
    tokens.forEach((token) => {
      if (!BUILT_INS.includes(token.toLowerCase())) vars.add(token);
    });
  });
  return Array.from(vars).slice(0, 5);
}

function cameraForPreset(preset: CameraPreset) {
  if (preset === "top") return { eye: { x: 0, y: 0.0001, z: 2.2 }, up: { x: 0, y: 1, z: 0 } };
  if (preset === "front") return { eye: { x: 0, y: 2.4, z: 0.6 }, up: { x: 0, y: 0, z: 1 } };
  if (preset === "side") return { eye: { x: 2.4, y: 0, z: 0.6 }, up: { x: 0, y: 0, z: 1 } };
  return { eye: { x: 1.5, y: 1.5, z: 1.25 }, up: { x: 0, y: 0, z: 1 } };
}

export default function GraphsPage() {
  const [latex, setLatex] = useState<string>(getQueryValue("latex", "y=\\sin(x)"));
  const [ascii, setAscii] = useState<string>("");
  const [graphLabTab, setGraphLabTab] = useState<GraphLabTab>((getQueryValue("lab", "basic") as GraphLabTab) || "basic");
  const [graphMode, setGraphMode] = useState<GraphMode>((getQueryValue("mode", "2d") as GraphMode) === "3d" ? "3d" : "2d");
  const [graph3DType, setGraph3DType] = useState<Graph3DType>((getQueryValue("kind", "surface") as Graph3DType) || "surface");
  const [functionsText, setFunctionsText] = useState<string>(getQueryValue("fns", "sin(x)\ncos(x)"));
  const [surfaceExpr, setSurfaceExpr] = useState<string>(getQueryValue("surface", "sin(x) * cos(y)"));
  const [scatterPoints, setScatterPoints] = useState<string>(getQueryValue("points", "0,0,0\n1,1,2\n2,0,1\n-1,2,0.4"));
  const [parametricX, setParametricX] = useState<string>(getQueryValue("xt", "cos(t)"));
  const [parametricY, setParametricY] = useState<string>(getQueryValue("yt", "sin(t)"));
  const [parametricZ, setParametricZ] = useState<string>(getQueryValue("zt", "t/4"));
  const [xmin, setXmin] = useState<string>(getQueryValue("xmin", "-10"));
  const [xmax, setXmax] = useState<string>(getQueryValue("xmax", "10"));
  const [ymin, setYmin] = useState<string>(getQueryValue("ymin", "-6"));
  const [ymax, setYmax] = useState<string>(getQueryValue("ymax", "6"));
  const [tmin, setTmin] = useState<string>(getQueryValue("tmin", "-12"));
  const [tmax, setTmax] = useState<string>(getQueryValue("tmax", "12"));
  const [result, setResult] = useState<string>(getQueryValue("result", ""));

  const [blenderExpr, setBlenderExpr] = useState<string>(getQueryValue("bexpr", "sin(t*freq)*amp"));
  const [freq, setFreq] = useState<string>(getQueryValue("freq", "1"));
  const [amp, setAmp] = useState<string>(getQueryValue("amp", "1"));
  const [sceneCamera, setSceneCamera] = useState<any>(cameraForPreset("iso"));
  const [sceneRevision, setSceneRevision] = useState<number>(0);

  useEffect(() => {
    persistTabState("graphs", {
      latex,
      mode: graphMode,
      kind: graph3DType,
      fns: functionsText,
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
      bexpr: blenderExpr,
      freq,
      amp,
    });
  }, [latex, graphMode, graph3DType, functionsText, surfaceExpr, scatterPoints, parametricX, parametricY, parametricZ, xmin, xmax, ymin, ymax, tmin, tmax, graphLabTab, blenderExpr, freq, amp]);


  const functions = useMemo(() => functionsText.split("\n").map((s) => s.trim()).filter(Boolean), [functionsText]);

  const params = useMemo(() => {
    if (graphMode === "2d") return detectParams(functions);
    if (graph3DType === "surface") return detectParams([surfaceExpr]);
    if (graph3DType === "parametric") return detectParams([parametricX, parametricY, parametricZ]);
    return detectParams([scatterPoints]);
  }, [functions, graphMode, graph3DType, surfaceExpr, parametricX, parametricY, parametricZ, scatterPoints]);

  const [paramValues, setParamValues] = useState<Record<string, number>>({ a: 1, b: 1, c: 1, d: 1, k: 1 });

  const plot2d = useMemo(() => {
    try {
      const a = Number(xmin);
      const b = Number(xmax);
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

  const plot3d = useMemo(() => {
    try {
      if (graph3DType === "surface") {
        const xa = Number(xmin);
        const xb = Number(xmax);
        const ya = Number(ymin);
        const yb = Number(ymax);
        if (![xa, xb, ya, yb].every(Number.isFinite) || xa >= xb || ya >= yb) return null;
        const xs = linspace(xa, xb, 44);
        const ys = linspace(ya, yb, 44);
        const z = ys.map((y) => xs.map((x) => Number(evaluateExpression(surfaceExpr, { x, y, ...paramValues }))));
        return [{ type: "surface", x: xs, y: ys, z, colorscale: "Viridis", name: `z=${surfaceExpr}` }];
      }

      if (graph3DType === "scatter") {
        const lines = scatterPoints.split("\n").map((line) => line.trim()).filter(Boolean);
        const points = lines.map((line) => {
          const [px, py, pz] = line.split(",").map((s) => s.trim());
          return {
            x: Number(evaluateExpression(px, { ...paramValues })),
            y: Number(evaluateExpression(py, { ...paramValues })),
            z: Number(evaluateExpression(pz, { ...paramValues })),
          };
        }).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z));
        if (!points.length) return null;
        return [{ type: "scatter3d", mode: "markers", x: points.map((p) => p.x), y: points.map((p) => p.y), z: points.map((p) => p.z), marker: { size: 4, color: points.map((p) => p.z), colorscale: "Turbo", opacity: 0.95 } }];
      }

      const ta = Number(tmin);
      const tb = Number(tmax);
      if (![ta, tb].every(Number.isFinite) || ta >= tb) return null;
      const ts = linspace(ta, tb, 440);
      const xvals = ts.map((t) => Number(evaluateExpression(parametricX, { t, ...paramValues })));
      const yvals = ts.map((t) => Number(evaluateExpression(parametricY, { t, ...paramValues })));
      const zvals = ts.map((t) => Number(evaluateExpression(parametricZ, { t, ...paramValues })));
      return [{ type: "scatter3d", mode: "lines", x: xvals, y: yvals, z: zvals, line: { width: 6, color: ts, colorscale: "Plasma" }, name: "parametric curve" }];
    } catch {
      return null;
    }
  }, [graph3DType, xmin, xmax, ymin, ymax, tmin, tmax, surfaceExpr, scatterPoints, parametricX, parametricY, parametricZ, paramValues]);

  const blenderPlot = useMemo(() => {
    try {
      const f = Number(freq);
      const a = Number(amp);
      if (!Number.isFinite(f) || !Number.isFinite(a)) return null;
      const ts = linspace(-10, 10, 400);
      const ys = ts.map((t) => Number(evaluateExpression(blenderExpr, { t, freq: f, amp: a })));
      return [{ x: ts, y: ys, type: "scatter", mode: "lines", name: "Blender preview" }];
    } catch {
      return null;
    }
  }, [blenderExpr, freq, amp]);

  function saveToHistory() {
    const txt = graphMode === "2d"
      ? `2D plot functions: ${functions.join(" | ")}`
      : graph3DType === "surface"
        ? `3D surface: z=${surfaceExpr}`
        : graph3DType === "scatter"
          ? `3D scatter (${scatterPoints.split("\n").filter(Boolean).length} points)`
          : `3D parametric: (${parametricX}, ${parametricY}, ${parametricZ})`;
    setResult("Saved to history.");
    pushHistory({ area: "Graphs", latex, ascii, resultText: txt });
    setTimeout(() => setResult(""), 1200);
  }

  async function onShare() {
    try {
      await copyShareLink("/graphs", {
        latex,
        mode: graphMode,
        kind: graph3DType,
        fns: functionsText,
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
        bexpr: blenderExpr,
        freq,
        amp,
      });
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

  function resetView() {
    setCamera("iso");
  }

  function autoFit() {
    setSceneCamera({
      ...cameraForPreset("iso"),
      projection: { type: "perspective" },
    });
    setSceneRevision((v) => v + 1);
  }

  function loadExample() {
    if (graphMode === "2d") {
      setLatex("y=\\sin(x)");
      setFunctionsText("sin(x)\ncos(x)");
      setXmin("-10");
      setXmax("10");
      return;
    }

    if (graph3DType === "surface") {
      setLatex("z=a\\sin(x)+b\\cos(y)");
      setSurfaceExpr("a*sin(x) + b*cos(y)");
      setXmin("-6");
      setXmax("6");
      setYmin("-6");
      setYmax("6");
      return;
    }

    if (graph3DType === "scatter") {
      setLatex("(x,y,z)");
      setScatterPoints("0,0,0\n1,2,1\n2,1,3\n3,4,2\n4,2,5");
      return;
    }

    setLatex("(x(t),y(t),z(t))");
    setParametricX("cos(t)");
    setParametricY("sin(t)");
    setParametricZ("t/3");
    setTmin("-14");
    setTmax("14");
  }

  return (
    <div className="grid">
      <div className="card">
        <div className="card-header"><h2>Graphs (2D + real 3D mode)</h2><p>Surface/point-cloud/parametric 3D plotting with camera presets and sliders.</p></div>
        <div className="card-body">
          <div className="row" style={{ marginBottom: 10 }}>
            <button className="button" onClick={loadExample}>✨ Load Example</button>
            <button className="button primary" onClick={saveToHistory}>💾 Save</button>
            <button className="button" onClick={onShare}>🔗 Copy Share Link</button>
          </div>

          <div className="row" style={{ gap: 8, marginBottom: 8 }}>
            <button className={`button ${graphLabTab === "basic" ? "primary" : ""}`} onClick={() => setGraphLabTab("basic")}>Basic</button>
            <button className={`button ${graphLabTab === "advanced" ? "primary" : ""}`} onClick={() => setGraphLabTab("advanced")}>Advanced</button>
            <button className={`button ${graphLabTab === "blender" ? "primary" : ""}`} onClick={() => setGraphLabTab("blender")}>Blender Nodes</button>
            <button className={`button ${graphMode === "2d" ? "primary" : ""}`} onClick={() => setGraphMode("2d")}>2D</button>
            <button className={`button ${graphMode === "3d" ? "primary" : ""}`} onClick={() => setGraphMode("3d")}>3D</button>
            {graphMode === "3d" && (
              <select className="input" style={{ maxWidth: 220 }} value={graph3DType} onChange={(e) => setGraph3DType(e.target.value as Graph3DType)}>
                <option value="surface">Surface: z = f(x, y)</option>
                <option value="scatter">3D Scatter / Point Cloud</option>
                <option value="parametric">Parametric Curve (3D)</option>
              </select>
            )}
          </div>

          {graphLabTab === "blender" ? (
            <div className="card" style={{ padding: 12 }}>
              <div className="small">Blender Function Playground</div>
              <input className="input mono" value={blenderExpr} onChange={(e) => setBlenderExpr(e.target.value)} />
              <div className="row" style={{ marginTop: 10 }}>
                <div style={{ flex: 1 }}><div className="small">freq</div><input className="input mono" value={freq} onChange={(e) => setFreq(e.target.value)} /></div>
                <div style={{ flex: 1 }}><div className="small">amp</div><input className="input mono" value={amp} onChange={(e) => setAmp(e.target.value)} /></div>
              </div>
              <div className="katex-wrap mono" style={{ marginTop: 10 }}>Node Recipe: Value(t) → Multiply(freq) → Sine → Multiply(amp)</div>
              <div className="row" style={{ marginTop: 8 }}>
                <button className="button" onClick={() => { setBlenderExpr("sin(t*freq)*amp"); setFreq("2"); setAmp("1.2"); }}>Pattern: Ripple</button>
                <button className="button" onClick={() => { setBlenderExpr("sin(t*freq)/(1+abs(t))*amp"); }}>Pattern: Wave falloff</button>
              </div>
            </div>
          ) : (
            <EquationEditor latex={latex} onChange={({ latex: L, ascii: A }) => { setLatex(L); setAscii(A); }} />
          )}

          <hr className="sep" />
          {graphLabTab === "blender" ? (
              blenderPlot ? (
                <Plot
                  data={blenderPlot as any}
                  layout={{ autosize: true, height: 420, margin: { l: 40, r: 20, t: 20, b: 40 }, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", xaxis: { title: "t" }, yaxis: { title: "y" }, font: { color: "#e9eeff" } }}
                  config={{ responsive: true, displaylogo: false }}
                  style={{ width: "100%" }}
                />
              ) : <div className="katex-wrap mono">Invalid Blender expression.</div>
            ) : graphMode === "2d" ? (
            <>
              <div className="small">Functions (one per line):</div>
              <textarea rows={4} className="input mono" value={functionsText} onChange={(e) => setFunctionsText(e.target.value)} />
            </>
          ) : graph3DType === "surface" ? (
            <>
              <div className="small">Surface expression</div>
              <input className="input mono" value={surfaceExpr} onChange={(e) => setSurfaceExpr(e.target.value)} placeholder="e.g. a*sin(x) + b*cos(y)" />
            </>
          ) : graph3DType === "scatter" ? (
            <>
              <div className="small">Point cloud (x, y, z per line)</div>
              <textarea rows={5} className="input mono" value={scatterPoints} onChange={(e) => setScatterPoints(e.target.value)} />
            </>
          ) : (
            <>
              <div className="small">Parametric expressions (t)</div>
              <div className="row" style={{ marginTop: 8 }}>
                <div style={{ flex: 1 }}><div className="small">x(t)</div><input className="input mono" value={parametricX} onChange={(e) => setParametricX(e.target.value)} /></div>
                <div style={{ flex: 1 }}><div className="small">y(t)</div><input className="input mono" value={parametricY} onChange={(e) => setParametricY(e.target.value)} /></div>
                <div style={{ flex: 1 }}><div className="small">z(t)</div><input className="input mono" value={parametricZ} onChange={(e) => setParametricZ(e.target.value)} /></div>
              </div>
            </>
          )}

          <div className="row" style={{ marginTop: 10 }}>
            <div style={{ flex: 1 }}><div className="small">x min</div><input className="input mono" value={xmin} onChange={(e) => setXmin(e.target.value)} /></div>
            <div style={{ flex: 1 }}><div className="small">x max</div><input className="input mono" value={xmax} onChange={(e) => setXmax(e.target.value)} /></div>
            {graphMode === "3d" && graph3DType === "surface" && (
              <>
                <div style={{ flex: 1 }}><div className="small">y min</div><input className="input mono" value={ymin} onChange={(e) => setYmin(e.target.value)} /></div>
                <div style={{ flex: 1 }}><div className="small">y max</div><input className="input mono" value={ymax} onChange={(e) => setYmax(e.target.value)} /></div>
              </>
            )}
            {graphMode === "3d" && graph3DType === "parametric" && (
              <>
                <div style={{ flex: 1 }}><div className="small">t min</div><input className="input mono" value={tmin} onChange={(e) => setTmin(e.target.value)} /></div>
                <div style={{ flex: 1 }}><div className="small">t max</div><input className="input mono" value={tmax} onChange={(e) => setTmax(e.target.value)} /></div>
              </>
            )}
          </div>

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

          {graphMode === "3d" && (
            <div className="row" style={{ marginTop: 12, gap: 6, flexWrap: "wrap" }}>
              <button className="button" onClick={() => setCamera("top")}>Top</button>
              <button className="button" onClick={() => setCamera("front")}>Front</button>
              <button className="button" onClick={() => setCamera("side")}>Side</button>
              <button className="button" onClick={() => setCamera("iso")}>Isometric</button>
              <button className="button" onClick={resetView}>Reset View</button>
              <button className="button" onClick={autoFit}>Auto Fit</button>
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            {graphLabTab === "blender" ? (
              blenderPlot ? (
                <Plot
                  data={blenderPlot as any}
                  layout={{ autosize: true, height: 420, margin: { l: 40, r: 20, t: 20, b: 40 }, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", xaxis: { title: "t" }, yaxis: { title: "y" }, font: { color: "#e9eeff" } }}
                  config={{ responsive: true, displaylogo: false }}
                  style={{ width: "100%" }}
                />
              ) : <div className="katex-wrap mono">Invalid Blender expression.</div>
            ) : graphMode === "2d" ? (
              plot2d ? (
                <Plot
                  data={plot2d as any}
                  layout={{ autosize: true, height: 440, margin: { l: 40, r: 20, t: 20, b: 40 }, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", xaxis: { title: "x", gridcolor: "rgba(255,255,255,0.08)" }, yaxis: { title: "y", gridcolor: "rgba(255,255,255,0.08)" }, font: { color: "#e9eeff" }, showlegend: true }}
                  config={{ responsive: true, displaylogo: false }}
                  style={{ width: "100%" }}
                />
              ) : <div className="katex-wrap mono">Invalid expression or range.</div>
            ) : (
              plot3d ? (
                <Plot
                  data={plot3d as any}
                  layout={{
                    autosize: true,
                    height: 500,
                    margin: { l: 0, r: 0, t: 10, b: 0 },
                    paper_bgcolor: "rgba(0,0,0,0)",
                    font: { color: "#e9eeff" },
                    scene: {
                      camera: sceneCamera,
                      xaxis: { title: "x", backgroundcolor: "rgba(255,255,255,0.02)", gridcolor: "rgba(255,255,255,0.08)" },
                      yaxis: { title: "y", backgroundcolor: "rgba(255,255,255,0.02)", gridcolor: "rgba(255,255,255,0.08)" },
                      zaxis: { title: "z", backgroundcolor: "rgba(255,255,255,0.02)", gridcolor: "rgba(255,255,255,0.08)" },
                    },
                    uirevision: sceneRevision,
                    showlegend: false,
                  }}
                  config={{ responsive: true, displaylogo: false }}
                  onRelayout={(event: Readonly<Record<string, unknown>>) => {
                    const cam = (event as any)["scene.camera"];
                    if (cam) setSceneCamera(cam);
                  }}
                  style={{ width: "100%" }}
                />
              ) : <div className="katex-wrap mono">Invalid 3D expression/range or empty point cloud.</div>
            )}
          </div>

          {result && <div className="small" style={{ marginTop: 10 }}>{result}</div>}
        </div>
      </div>

      <div className="card"><div className="card-header"><h2>Rendered Equation</h2><p>Use this for sharing and exporting later.</p></div><div className="card-body"><div className="hide-mobile" style={{ marginBottom: 12 }}><AdSlot slot="sidebar" /></div><KatexBlock latex={latex || "\\text{ }"} /><div className="row" style={{ marginTop: 12 }}><button className="button" onClick={() => navigator.clipboard.writeText(latex)}>📄 Copy LaTeX</button><button className="button" onClick={() => navigator.clipboard.writeText(functionsText)}>📋 Copy Expressions</button></div></div></div>
    </div>
  );
}
