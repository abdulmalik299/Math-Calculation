import React, { useEffect, useState } from "react";
import AdSlot from "./components/AdSlot";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import CalculatorPage from "./pages/CalculatorPage";
import AlgebraPage from "./pages/AlgebraPage";
import CalculusPage from "./pages/CalculusPage";
import MatricesPage from "./pages/MatricesPage";
import GraphsPage from "./pages/GraphsPage";
import GraphTheoryPage from "./pages/GraphTheoryPage";
import HistoryPage from "./pages/HistoryPage";
import { buildProjectShareLink, hydrateProjectFromUrl, saveProjectSnapshot } from "./lib/project";

const tabs = [
  { to: "/calculator", label: "🧮 Calculator" },
  { to: "/algebra", label: "ƒ Algebra" },
  { to: "/calculus", label: "∫ Calculus" },
  { to: "/matrices", label: "▦ Matrices" },
  { to: "/graphs", label: "📈 Graphs" },
  { to: "/graph-theory", label: "🕸 Graph Theory" },
  { to: "/history", label: "🕒 History" },
];

export default function App() {
  const [status, setStatus] = useState("");

  useEffect(() => {
    const ok = hydrateProjectFromUrl();
    if (ok) {
      setStatus("Project loaded from link.");
      setTimeout(() => setStatus(""), 2000);
    }
  }, []);

  async function onShareProject() {
    const link = buildProjectShareLink();
    await navigator.clipboard.writeText(link);
    setStatus("Project share link copied.");
    setTimeout(() => setStatus(""), 1500);
  }

  function onSaveProject() {
    saveProjectSnapshot();
    setStatus("Project snapshot saved.");
    setTimeout(() => setStatus(""), 1500);
  }


  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        onSaveProject();
      }
      if (key === "k") {
        event.preventDefault();
        onShareProject();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <div className="topbar">
        <div className="container">
          <div className="brand">
            <div className="logo" aria-hidden />
            <div>
              <h1>MathNexus</h1>
              <div className="tag">Equations • Calculations • Graphs • Graph Theory</div>
            </div>
          </div>

          <div className="row" style={{ marginBottom: 10 }}>
            <button className="button" onClick={onSaveProject}>💾 Save Project</button>
            <button className="button" onClick={onShareProject}>🔗 Share Project</button>
            {status && <span className="small">{status}</span>}
          </div>

          <nav className="nav" aria-label="Primary">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) => `tab ${isActive ? "active" : ""}`}
              >
                {t.label}
              </NavLink>
            ))}
          </nav>

          <div style={{ paddingBottom: 14 }}>
            <AdSlot slot="header" />
          </div>
        </div>
      </div>

      <div className="container">
        <Routes>
          <Route path="/" element={<Navigate to="/calculator" replace />} />
          <Route path="/calculator" element={<CalculatorPage />} />
          <Route path="/algebra" element={<AlgebraPage />} />
          <Route path="/calculus" element={<CalculusPage />} />
          <Route path="/matrices" element={<MatricesPage />} />
          <Route path="/graphs" element={<GraphsPage />} />
          <Route path="/graph-theory" element={<GraphTheoryPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="*" element={<Navigate to="/calculator" replace />} />
        </Routes>

        <div style={{ marginTop: 16 }}>
          <AdSlot slot="footer" />
        </div>

        <div className="footer">
          Built for students worldwide. Phase 1 = browser-only (GitHub Pages ready).
        </div>
      </div>
    </>
  );
}
