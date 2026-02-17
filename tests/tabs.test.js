import { describe, expect, test } from 'vitest';
import { createDefaultTab, normalizeTabsState } from '../src/lib/tabs.js';

function createIdFactory() {
  let index = 0;
  return () => {
    index += 1;
    return `id-${index}`;
  };
}

describe('tab state normalization', () => {
  test('creates one default tab when payload is empty', () => {
    const createId = createIdFactory();
    const state = normalizeTabsState(null, null, 'flowchart TD\n  A-->B', {
      now: 10,
      createId,
    });

    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0]).toEqual({
      id: 'id-1',
      title: 'Main diagram',
      diagram: 'flowchart TD\n  A-->B',
      createdAt: 10,
      updatedAt: 10,
      tags: [],
    });
    expect(state.activeTabId).toBe('id-1');
  });

  test('sanitizes malformed tabs and invalid active id', () => {
    const createId = createIdFactory();
    const state = normalizeTabsState(
      [
        {
          id: 'tab-a',
          title: '  Product flow  ',
          diagram: 'flowchart TD\n  Start-->Done',
          createdAt: 30,
          updatedAt: 40,
          tags: ['Product', ' Ops ', '', 42],
        },
        {
          id: 'tab-a',
          title: 'duplicate id should be dropped',
          diagram: 'flowchart TD\n  duplicate-->duplicate',
        },
        {
          title: '   ',
          diagram: '   ',
        },
      ],
      'missing-id',
      'flowchart TD\n  fallback-->diagram',
      { now: 99, createId },
    );

    expect(state.tabs).toHaveLength(2);
    expect(state.tabs[0].id).toBe('tab-a');
    expect(state.tabs[0].title).toBe('Product flow');
    expect(state.tabs[0].tags).toEqual(['product', 'ops']);
    expect(state.tabs[1]).toMatchObject({
      id: 'id-1',
      title: 'Untitled diagram',
      diagram: 'flowchart TD\n  fallback-->diagram',
      createdAt: 99,
      updatedAt: 99,
      tags: [],
    });
    expect(state.activeTabId).toBe('tab-a');
  });

  test('keeps requested active tab when it exists', () => {
    const state = normalizeTabsState(
      [
        {
          id: 'one',
          title: 'One',
          diagram: 'flowchart TD\n  one-->done',
          createdAt: 1,
          updatedAt: 1,
        },
        {
          id: 'two',
          title: 'Two',
          diagram: 'flowchart TD\n  two-->done',
          createdAt: 2,
          updatedAt: 2,
        },
      ],
      'two',
      'flowchart TD\n  fallback-->diagram',
      { now: 3 },
    );

    expect(state.activeTabId).toBe('two');
  });

  test('createDefaultTab uses supplied timestamp and id generator', () => {
    const createId = createIdFactory();
    const tab = createDefaultTab('flowchart TD\n  A-->B', { now: 77, createId });

    expect(tab).toEqual({
      id: 'id-1',
      title: 'Main diagram',
      diagram: 'flowchart TD\n  A-->B',
      createdAt: 77,
      updatedAt: 77,
      tags: [],
    });
  });
});
