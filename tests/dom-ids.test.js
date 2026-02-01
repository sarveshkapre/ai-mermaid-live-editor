import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('index.html wiring', () => {
  test('contains IDs used by src/main.js', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf-8');
    const requiredIds = [
      'editor',
      'preview',
      'render-status',
      'render-now',
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
      'copy-source',
      'copy-svg',
      'reset',
      'clear-history',
      'download-history',
      'restore-draft',
      'clear-draft',
      'download-source',
      'export-scale',
      'export-width',
      'export-width-custom',
      'export-transparent',
      'export-svg-scale',
      'export-svg-inline',
      'export-svg-minify',
      'export-summary',
    ];

    requiredIds.forEach((id) => {
      expect(html).toContain(`id="${id}"`);
    });
  });
});
