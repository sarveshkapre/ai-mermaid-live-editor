import { beforeEach, describe, expect, test, vi } from 'vitest';

const initialize = vi.fn();

vi.mock('mermaid', () => ({
  default: {
    initialize,
    render: vi.fn(),
  },
}));

beforeEach(() => {
  vi.resetModules();
  initialize.mockClear();
});

describe('loadMermaid', () => {
  test('initializes Mermaid with strict security settings', async () => {
    const { loadMermaid } = await import('../src/lib/mermaid-loader.js');
    await loadMermaid('neutral');

    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        startOnLoad: false,
        theme: 'neutral',
        securityLevel: 'strict',
        secure: expect.arrayContaining(['securityLevel', 'startOnLoad']),
      }),
    );
  });

  test('reinitializes only when theme changes', async () => {
    const { loadMermaid } = await import('../src/lib/mermaid-loader.js');
    await loadMermaid('neutral');
    await loadMermaid('neutral');
    await loadMermaid('dark');

    expect(initialize).toHaveBeenCalledTimes(2);
  });
});

