const STORAGE_KEY = 'ai-mermaid-draft';

/**
 * @typedef {{diagram: string, updatedAt: number}} Draft
 */

/**
 * @param {Storage} storage
 * @returns {Draft | null}
 */
export function loadDraft(storage = localStorage) {
  let raw = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const diagram = typeof parsed.diagram === 'string' ? parsed.diagram : '';
    const updatedAt = typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0;
    if (!diagram.trim() || !updatedAt) return null;
    return { diagram, updatedAt };
  } catch {
    return null;
  }
}

/**
 * @param {string} diagram
 * @param {Storage} storage
 */
export function saveDraft(diagram, storage = localStorage) {
  const trimmed = diagram.trim();
  if (!trimmed) return false;
  /** @type {Draft} */
  const payload = { diagram: trimmed, updatedAt: Date.now() };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {Storage} storage
 */
export function clearDraft(storage = localStorage) {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage write errors (e.g. quota/private mode).
  }
}
