import { describe, expect, test } from 'vitest';
import { clearDraft, loadDraft, saveDraft } from '../src/lib/draft.js';

function createMemoryStorage() {
  /** @type {Map<string, string>} */
  const data = new Map();
  return {
    /** @param {string} key */
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    /** @param {string} key @param {string} value */
    setItem(key, value) {
      data.set(key, String(value));
    },
    /** @param {string} key */
    removeItem(key) {
      data.delete(key);
    },
  };
}

describe('draft storage', () => {
  test('saveDraft refuses empty input', () => {
    const storage = createMemoryStorage();
    expect(saveDraft('   ', /** @type {any} */ (storage))).toBe(false);
    expect(loadDraft(/** @type {any} */ (storage))).toBe(null);
  });

  test('saveDraft stores trimmed diagram with updatedAt', () => {
    const storage = createMemoryStorage();
    const ok = saveDraft('a-->b\n', /** @type {any} */ (storage));
    expect(ok).toBe(true);
    const draft = loadDraft(/** @type {any} */ (storage));
    expect(draft).not.toBe(null);
    expect(draft?.diagram).toBe('a-->b');
    expect(typeof draft?.updatedAt).toBe('number');
    expect(draft?.updatedAt).toBeGreaterThan(0);
  });

  test('loadDraft returns null on corrupted JSON', () => {
    const storage = createMemoryStorage();
    storage.setItem('ai-mermaid-draft', '{not json');
    expect(loadDraft(/** @type {any} */ (storage))).toBe(null);
  });

  test('clearDraft removes the stored value', () => {
    const storage = createMemoryStorage();
    saveDraft('a', /** @type {any} */ (storage));
    expect(loadDraft(/** @type {any} */ (storage))?.diagram).toBe('a');
    clearDraft(/** @type {any} */ (storage));
    expect(loadDraft(/** @type {any} */ (storage))).toBe(null);
  });
});
