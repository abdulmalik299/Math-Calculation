export type HistoryItem = {
  id: string;
  createdAt: number;
  area: string; // Calculator/Algebra/...
  latex: string;
  ascii: string;
  resultText: string;
};

const KEY = "mathnexus.history.v1";

export function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export function saveHistory(items: HistoryItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items.slice(0, 200)));
}

export function pushHistory(item: Omit<HistoryItem, "id" | "createdAt">) {
  const items = loadHistory();
  const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
  items.unshift({ ...item, id, createdAt: Date.now() });
  saveHistory(items);
}

export function clearHistory() {
  localStorage.removeItem(KEY);
}
