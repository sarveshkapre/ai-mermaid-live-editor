const STORAGE_KEY = 'ai-mermaid-history';

/**
 * @param {Storage} storage
 * @returns {Array<{id:string, message:string, diagram:string, createdAt:number}>}
 */
export function loadHistory(storage = localStorage) {
  let raw = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return [];
  }
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
 * @param {Storage} storage
 */
export function saveHistory(items, storage = localStorage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage write errors (e.g. quota/private mode).
  }
}

/**
 * @param {string} diagram
 * @param {string} message
 * @param {Storage} storage
 */
export function addSnapshot(diagram, message, storage = localStorage) {
  const items = loadHistory(storage);
  items.unshift({
    id: crypto.randomUUID(),
    message,
    diagram,
    createdAt: Date.now(),
  });
  saveHistory(items.slice(0, 40), storage);
  return items;
}

export function clearHistory(storage = localStorage) {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage write errors (e.g. quota/private mode).
  }
}
