import { describe, expect, test } from 'vitest';
import { addSnapshot, clearHistory, loadHistory, saveHistory } from '../src/lib/history.js';

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

function createThrowingStorage() {
  return {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
    removeItem() {
      throw new Error('blocked');
    },
  };
}

describe('history storage', () => {
  test('stores and loads snapshots', () => {
    const storage = createMemoryStorage();
    const items = addSnapshot('flowchart TD\n  A-->B', 'Snapshot', /** @type {any} */ (storage));
    expect(items).toHaveLength(1);
    expect(loadHistory(/** @type {any} */ (storage))).toHaveLength(1);
  });

  test('saveHistory and clearHistory are resilient', () => {
    const storage = createMemoryStorage();
    saveHistory([{ id: '1', message: 'x', diagram: 'a', createdAt: 1 }], /** @type {any} */ (storage));
    expect(loadHistory(/** @type {any} */ (storage))).toHaveLength(1);
    clearHistory(/** @type {any} */ (storage));
    expect(loadHistory(/** @type {any} */ (storage))).toHaveLength(0);
  });

  test('handles storage failures gracefully', () => {
    const storage = createThrowingStorage();
    expect(loadHistory(/** @type {any} */ (storage))).toEqual([]);
    expect(() => saveHistory([], /** @type {any} */ (storage))).not.toThrow();
    expect(() => clearHistory(/** @type {any} */ (storage))).not.toThrow();
    const items = addSnapshot('a', 'msg', /** @type {any} */ (storage));
    expect(items[0]?.diagram).toBe('a');
  });
});
