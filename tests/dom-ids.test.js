import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('index.html wiring', () => {
  test('contains IDs used by src/main.js', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf-8');
    const requiredIds = [
      'editor',
      'preview',
      'render-status',
      'stats',
      'instructions',
      'proposal',
      'diff',
      'timeline',
      'theme-toggle',
      'copy-link',
      'help',
      'shortcuts-dialog',
      'shortcuts-close',
      'toast',
      'commit',
      'simulate',
      'apply-patch',
      'export-svg',
      'export-png',
      'reset',
      'clear-history',
      'download-history',
    ];

    requiredIds.forEach((id) => {
      expect(html).toContain(`id="${id}"`);
    });
  });
});

