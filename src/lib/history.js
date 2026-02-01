const STORAGE_KEY = 'ai-mermaid-history';

/**
 * @returns {Array<{id:string, message:string, diagram:string, createdAt:number}>}
 */
export function loadHistory() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * @param {Array<{id:string, message:string, diagram:string, createdAt:number}>} items
 */
export function saveHistory(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/**
 * @param {string} diagram
 * @param {string} message
 */
export function addSnapshot(diagram, message) {
  const items = loadHistory();
  items.unshift({
    id: crypto.randomUUID(),
    message,
    diagram,
    createdAt: Date.now(),
  });
  saveHistory(items.slice(0, 40));
  return items;
}

export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
}
