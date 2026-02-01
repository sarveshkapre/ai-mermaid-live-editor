const STORAGE_KEY = 'ai-mermaid-draft';

/**
 * @typedef {{diagram: string, updatedAt: number}} Draft
 */

/**
 * @param {Storage} storage
 * @returns {Draft | null}
 */
export function loadDraft(storage = localStorage) {
  const raw = storage.getItem(STORAGE_KEY);
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
  storage.setItem(STORAGE_KEY, JSON.stringify(payload));
  return true;
}

/**
 * @param {Storage} storage
 */
export function clearDraft(storage = localStorage) {
  storage.removeItem(STORAGE_KEY);
}
