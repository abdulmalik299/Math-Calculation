import React from "react";
import AdSlot from "./components/AdSlot";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import CalculatorPage from "./pages/CalculatorPage";
import AlgebraPage from "./pages/AlgebraPage";
import CalculusPage from "./pages/CalculusPage";
import MatricesPage from "./pages/MatricesPage";
import GraphsPage from "./pages/GraphsPage";
import GraphTheoryPage from "./pages/GraphTheoryPage";
import HistoryPage from "./pages/HistoryPage";

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
