export type ToolArea = "Calculator" | "Algebra" | "Calculus" | "Matrices" | "Graphs" | "Graph Theory";

export type HistoryItem = {
  id: string;
  createdAt: number;
  area: ToolArea;
  latex: string;
  ascii: string;
  resultText: string;
  pinned?: boolean;
  favorite?: boolean;
  tags?: string[];
};

const KEY = "mathnexus.history.v2";

export function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem("mathnexus.history.v1");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((it) => ({ ...it, pinned: Boolean(it.pinned), favorite: Boolean(it.favorite), tags: Array.isArray(it.tags) ? it.tags : [] }))
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.createdAt - a.createdAt;
      });
  } catch {
    return [];
  }
}

export function saveHistory(items: HistoryItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items.slice(0, 200)));
}

export function pushHistory(item: Omit<HistoryItem, "id" | "createdAt" | "pinned" | "favorite">) {
  const items = loadHistory();
  const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
  items.unshift({ ...item, id, createdAt: Date.now(), pinned: false, favorite: false, tags: [] });
  saveHistory(items);
}

export function setHistoryFlag(id: string, key: "pinned" | "favorite", value: boolean) {
  const items = loadHistory();
  const updated = items.map((it) => (it.id === id ? { ...it, [key]: value } : it));
  saveHistory(updated);
}

export function clearHistory() {
  localStorage.removeItem(KEY);
}


export function setHistoryTags(id: string, tags: string[]) {
  const items = loadHistory();
  const normalized = tags.map((t) => t.trim()).filter(Boolean).slice(0, 6);
  saveHistory(items.map((it) => (it.id === id ? { ...it, tags: normalized } : it)));
}
