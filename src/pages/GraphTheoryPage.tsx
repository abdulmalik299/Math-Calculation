import React, { useMemo, useRef, useState } from "react";
import AdSlot from "../components/AdSlot";
import * as d3 from "d3";
import { pushHistory } from "../lib/storage";
import KatexBlock from "../components/KatexBlock";

type Node = { id: string };
type Link = { source: string; target: string };

function bfsDistances(nodes: Node[], links: Link[], startId: string) {
  const adj = new Map<string, string[]>();
  nodes.forEach((n) => adj.set(n.id, []));
  links.forEach((e) => {
    adj.get(e.source)?.push(e.target);
    adj.get(e.target)?.push(e.source);
  });

  const dist = new Map<string, number>();
  nodes.forEach((n) => dist.set(n.id, Infinity));
  dist.set(startId, 0);

  const q: string[] = [startId];
  while (q.length) {
    const u = q.shift()!;
    const du = dist.get(u)!;
    for (const v of adj.get(u) ?? []) {
      if (dist.get(v)! === Infinity) {
        dist.set(v, du + 1);
        q.push(v);
      }
    }
  }
  return dist;
}

function distanceMatrix(nodes: Node[], links: Link[]) {
  const ids = nodes.map((n) => n.id);
  const mat: number[][] = ids.map(() => ids.map(() => Infinity));
  ids.forEach((id, i) => {
    const dist = bfsDistances(nodes, links, id);
    ids.forEach((jId, j) => {
      mat[i][j] = dist.get(jId) ?? Infinity;
    });
  });
  return { ids, mat };
}

function graphMetrics(nodes: Node[], links: Link[]) {
  const { ids, mat } = distanceMatrix(nodes, links);
  let diameter = 0;
  const ecc: number[] = ids.map(() => 0);
  for (let i = 0; i < ids.length; i++) {
    let maxd = 0;
    for (let j = 0; j < ids.length; j++) {
      const d = mat[i][j];
      if (Number.isFinite(d) && d > maxd) maxd = d;
    }
    ecc[i] = maxd;
    if (maxd > diameter) diameter = maxd;
  }
  const radius = ecc.length ? Math.min(...ecc) : 0;

  let sum = 0;
  let count = 0;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const d = mat[i][j];
      if (Number.isFinite(d)) { sum += d; count += 1; }
    }
  }
  const avg = count ? sum / count : 0;
  return { ids, mat, diameter, radius, avgDistance: avg };
}

export default function GraphTheoryPage() {
  const [nodes, setNodes] = useState<Node[]>([{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }]);
  const [links, setLinks] = useState<Link[]>([
    { source: "1", target: "2" },
    { source: "2", target: "3" },
    { source: "3", target: "4" },
  ]);
  const [newNodeId, setNewNodeId] = useState<string>("5");
  const [src, setSrc] = useState<string>("1");
  const [dst, setDst] = useState<string>("2");
  const [status, setStatus] = useState<string>("");
  const svgRef = useRef<SVGSVGElement | null>(null);

  const metrics = useMemo(() => {
    try {
      return graphMetrics(nodes, links);
    } catch {
      return null;
    }
  }, [nodes, links]);

  const latex = useMemo(() => {
    const n = nodes.length;
    return `M(G)=\\frac{1}{\\binom{${n}}{2}}\\sum_{u<v} d(u,v)`;
  }, [nodes.length]);

  // Draw with d3
  React.useEffect(() => {
    const svg = d3.select(svgRef.current);
    if (!svgRef.current) return;

    svg.selectAll("*").remove();
    const width = svgRef.current.clientWidth || 520;
    const height = 420;

    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const sim = d3
      .forceSimulation(nodes as any)
      .force("link", d3.forceLink(links as any).id((d: any) => d.id).distance(90))
      .force("charge", d3.forceManyBody().strength(-260))
      .force("center", d3.forceCenter(width / 2, height / 2));

    const g = svg.append("g");

    const link = g
      .append("g")
      .attr("stroke", "rgba(233,238,255,0.25)")
      .attr("stroke-width", 2)
      .selectAll("line")
      .data(links)
      .enter()
      .append("line");

    const node = g
      .append("g")
      .selectAll("g")
      .data(nodes)
      .enter()
      .append("g")
      .call(
        d3
          .drag<SVGGElement, any>()
          .on("start", (event, d) => {
            if (!event.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) sim.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    node
      .append("circle")
      .attr("r", 18)
      .attr("fill", "rgba(122,162,255,0.35)")
      .attr("stroke", "rgba(122,162,255,0.75)")
      .attr("stroke-width", 2);

    node
      .append("text")
      .text((d: any) => d.id)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("fill", "#e9eeff")
      .attr("font-size", 12)
      .attr("font-family", "ui-monospace, Menlo, Consolas, monospace");

    sim.on("tick", () => {
      link
        .attr("x1", (d: any) => (d.source.x ?? 0))
        .attr("y1", (d: any) => (d.source.y ?? 0))
        .attr("x2", (d: any) => (d.target.x ?? 0))
        .attr("y2", (d: any) => (d.target.y ?? 0));

      node.attr("transform", (d: any) => `translate(${d.x ?? 0}, ${d.y ?? 0})`);
    });

    // zoom
    svg.call(
      d3.zoom<SVGSVGElement, any>().on("zoom", (event) => {
        g.attr("transform", event.transform.toString());
      }) as any
    );

    return () => {
      sim.stop();
    };
  }, [nodes, links]);

  function addNode() {
    const id = newNodeId.trim();
    if (!id) return;
    if (nodes.some((n) => n.id === id)) {
      setStatus("Node already exists.");
      return;
    }
    setNodes([...nodes, { id }]);
    setNewNodeId(String(Number(id) + 1 || nodes.length + 1));
    setStatus("");
  }

  function addEdge() {
    const s = src.trim(), t = dst.trim();
    if (!s || !t) return;
    if (s === t) { setStatus("No self-loop in Phase 1."); return; }
    if (!nodes.some((n) => n.id === s) || !nodes.some((n) => n.id === t)) {
      setStatus("Source/target must be existing node IDs.");
      return;
    }
    const exists = links.some((e) => (e.source === s && e.target === t) || (e.source === t && e.target === s));
    if (exists) { setStatus("Edge already exists."); return; }
    setLinks([...links, { source: s, target: t }]);
    setStatus("");
  }

  function resetExample() {
    setNodes([{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }]);
    setLinks([{ source: "1", target: "2" }, { source: "2", target: "3" }, { source: "3", target: "4" }]);
    setSrc("1");
    setDst("2");
    setNewNodeId("5");
    setStatus("");
  }

  function save() {
    if (!metrics) return;
    const txt = `n=${nodes.length}, m=${links.length}, diameter=${metrics.diameter}, radius=${metrics.radius}, avgDist=${metrics.avgDistance}`;
    pushHistory({ area: "Graph Theory", latex, ascii: "", resultText: txt });
    setStatus("Saved to history.");
    setTimeout(() => setStatus(""), 1200);
  }

  return (
    <div className="grid">
      <div className="card">
        <div className="card-header">
          <h2>Graph Theory Lab</h2>
          <p>Build a graph, visualize it, and compute distance metrics (diameter, radius, average distance).</p>
        </div>
        <div className="card-body">
          <div className="row">
            <button className="button" onClick={resetExample}>Load Path Graph Example</button>
            <button className="button primary" onClick={save}>Save</button>
            {status && <span className="small">{status}</span>}
          </div>

          <hr className="sep" />

          <div className="row" style={{ alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <div className="small">Add node id</div>
              <input className="input mono" value={newNodeId} onChange={(e) => setNewNodeId(e.target.value)} />
            </div>
            <button className="button primary" onClick={addNode}>Add Node</button>

            <div style={{ flex: 1 }}>
              <div className="small">Edge source</div>
              <input className="input mono" value={src} onChange={(e) => setSrc(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="small">Edge target</div>
              <input className="input mono" value={dst} onChange={(e) => setDst(e.target.value)} />
            </div>
            <button className="button primary" onClick={addEdge}>Add Edge</button>
          </div>

          <div style={{ marginTop: 14 }}>
            <svg ref={svgRef} style={{ width: "100%", height: 420, borderRadius: 14, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.18)" }} />
          </div>

          <hr className="sep" />

          <div className="row">
            <div className="pill">Nodes: {nodes.length}</div>
            <div className="pill">Edges: {links.length}</div>
            <div className="pill">Diameter: {metrics?.diameter ?? "—"}</div>
            <div className="pill">Radius: {metrics?.radius ?? "—"}</div>
            <div className="pill">Avg Dist: {metrics ? metrics.avgDistance.toFixed(4) : "—"}</div>
          </div>

          <div className="small" style={{ marginTop: 12 }}>
            In Phase 2 we can add: adjacency matrix input, shortest path highlight, connectivity, blocks/articulation points, etc.
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Average Distance Formula (preview)</h2>
          <p>This updates automatically based on n. (You can connect it to computed distance sum in Phase 2.)</p>
        </div>
        <div className="card-body">
          <div className="hide-mobile" style={{ marginBottom: 12 }}>
            <AdSlot slot="sidebar" />
          </div>
          <KatexBlock latex={latex} />
          {metrics && (
            <>
              <div className="small" style={{ marginTop: 12 }}>Distance Matrix</div>
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th></th>
                      {metrics.ids.map((id) => <th key={id}>{id}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.mat.map((row, i) => (
                      <tr key={metrics.ids[i]}>
                        <th>{metrics.ids[i]}</th>
                        {row.map((v, j) => (
                          <td key={j}>{Number.isFinite(v) ? v : "∞"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
