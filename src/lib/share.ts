export function getHashQueryParams() {
  const hash = window.location.hash || "";
  const idx = hash.indexOf("?");
  if (idx === -1) return new URLSearchParams();
  return new URLSearchParams(hash.slice(idx + 1));
}

export function getQueryValue(key: string, fallback: string) {
  const params = getHashQueryParams();
  return params.get(key) ?? fallback;
}

export function buildShareLink(path: string, params: Record<string, string | number | boolean | undefined>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined) return;
    const s = String(v);
    if (!s.trim()) return;
    qs.set(k, s);
  });
  const query = qs.toString();
  const hash = query ? `#${path}?${query}` : `#${path}`;
  return `${window.location.origin}${window.location.pathname}${hash}`;
}

export async function copyShareLink(path: string, params: Record<string, string | number | boolean | undefined>) {
  const link = buildShareLink(path, params);
  await navigator.clipboard.writeText(link);
  return link;
}
