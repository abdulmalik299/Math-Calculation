export type ProjectTab = "calculator" | "algebra" | "calculus" | "matrices" | "graphs" | "graphTheory";

const TAB_KEY: Record<ProjectTab, string> = {
  calculator: "mathnexus.tab.calculator.v1",
  algebra: "mathnexus.tab.algebra.v1",
  calculus: "mathnexus.tab.calculus.v1",
  matrices: "mathnexus.tab.matrices.v1",
  graphs: "mathnexus.tab.graphs.v1",
  graphTheory: "mathnexus.tab.graphTheory.v1",
};

const PROJECT_KEY = "mathnexus.project.last.v1";

export function getTabState<T extends Record<string, unknown>>(tab: ProjectTab): T | null {
  try {
    const raw = localStorage.getItem(TAB_KEY[tab]);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function persistTabState(tab: ProjectTab, state: Record<string, unknown>) {
  localStorage.setItem(TAB_KEY[tab], JSON.stringify(state));
}

export function getInitialTabValue(tab: ProjectTab, key: string, queryValue: string | null, fallback: string) {
  if (queryValue !== null && queryValue !== undefined) return queryValue;
  const state = getTabState<Record<string, string>>(tab);
  const fromState = state?.[key];
  if (typeof fromState === "string") return fromState;
  return fallback;
}

export function saveProjectSnapshot() {
  const snapshot = {
    createdAt: Date.now(),
    tabs: {
      calculator: getTabState<Record<string, unknown>>("calculator") ?? {},
      algebra: getTabState<Record<string, unknown>>("algebra") ?? {},
      calculus: getTabState<Record<string, unknown>>("calculus") ?? {},
      matrices: getTabState<Record<string, unknown>>("matrices") ?? {},
      graphs: getTabState<Record<string, unknown>>("graphs") ?? {},
      graphTheory: getTabState<Record<string, unknown>>("graphTheory") ?? {},
    },
  };
  localStorage.setItem(PROJECT_KEY, JSON.stringify(snapshot));
  return snapshot;
}

export function buildProjectShareLink() {
  const snapshot = saveProjectSnapshot();
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(snapshot))));
  return `${window.location.origin}${window.location.pathname}?project=${encodeURIComponent(encoded)}#/calculator`;
}

export function hydrateProjectFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get("project");
  if (!encoded) return false;
  try {
    const decoded = decodeURIComponent(encoded);
    const json = decodeURIComponent(escape(atob(decoded)));
    const parsed = JSON.parse(json) as { tabs?: Record<string, Record<string, unknown>> };
    const tabs = parsed.tabs ?? {};
    if (tabs.calculator) persistTabState("calculator", tabs.calculator);
    if (tabs.algebra) persistTabState("algebra", tabs.algebra);
    if (tabs.calculus) persistTabState("calculus", tabs.calculus);
    if (tabs.matrices) persistTabState("matrices", tabs.matrices);
    if (tabs.graphs) persistTabState("graphs", tabs.graphs);
    if (tabs.graphTheory) persistTabState("graphTheory", tabs.graphTheory);
    return true;
  } catch {
    return false;
  }
}
