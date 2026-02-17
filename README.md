# MathNexus (Phase 1)

A public, global math website foundation:
- **Beautiful equation typing** (MathLive)
- **High-quality rendering** (KaTeX)
- **Accurate evaluation** (math.js)
- **2D + 3D graphs** (Plotly)
- **Graph theory visualizer + metrics** (D3)
- **Tabs/pages + History** (React Router + localStorage)
- **GitHub Pages ready** (auto deploy workflow included)

> Phase 1 is **browser-only**, perfect for GitHub Pages.  
> Phase 2 can add symbolic step-by-step solving via a backend (SymPy / CAS).

---

## Requirements
- Node.js 18+ (recommended 20)

## Run locally
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

---

## Deploy to GitHub Pages (recommended)
1. Create a new GitHub repository (example: `mathnexus`)
2. Upload **all** files from this project into the repo.
3. Ensure the default branch is `main`.
4. In GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**
5. Push to `main` → the included workflow deploys automatically.

Your site becomes:
`https://<your-username>.github.io/<repo-name>/`

---

## Notes (important)
- Equation typing is **LaTeX-quality**.
- Computation in Phase 1 uses a separate **math.js expression field**, because converting *any* LaTeX to a safe computable form perfectly is a Phase 2 job.
- Graph Theory currently supports: distance matrix, diameter, radius, average distance.

---

## Next upgrades (Phase 2 ideas)
- LaTeX → expression auto-translation for common patterns
- Step-by-step solutions (symbolic)
- Adjacency matrix input + more graph algorithms (blocks, articulation points, etc.)
- SEO tool pages with content blocks & FAQ
- Ads slots and analytics


---

## Ads (Phase 1.1)
This version includes **ad placeholders** (Header / Sidebar / Inline / Footer).
- Search for `AdSlot` components in `src/components/AdSlot.tsx` and pages.
- When you get AdSense approval, replace the placeholder block with the official AdSense snippet.

Tip: Keep sizes similar to avoid layout shift.
