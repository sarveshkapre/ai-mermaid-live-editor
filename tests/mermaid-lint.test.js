import { describe, expect, test } from 'vitest';

import { lintMermaid } from '../src/lib/mermaid-lint.js';

describe('lintMermaid', () => {
  test('detects and fixes common flowchart paste mistakes', () => {
    const input = `\`\`\`mermaid
flowchart TD
\tA -> B
subgraph Team
  B[“Done”]
\`\`\`
`;

    const result = lintMermaid(input);

    expect(result.issues.map((issue) => issue.id)).toEqual([
      'fenced-code',
      'tabs',
      'smart-quotes',
      'single-arrow',
      'missing-end',
    ]);
    expect(result.hasFixes).toBe(true);
    expect(result.fixedCode).toBe(`flowchart TD
  A --> B
subgraph Team
  B["Done"]
end
`);
  });

  test('does not rewrite sequence diagram arrows', () => {
    const input = `sequenceDiagram
A->>B: Ping
`;

    const result = lintMermaid(input);
    expect(result.issues.map((issue) => issue.id)).toEqual([]);
    expect(result.fixedCode).toBe(input);
    expect(result.hasFixes).toBe(false);
  });

  test('reports extra end blocks without applying destructive fixes', () => {
    const input = `flowchart TD
A --> B
end
`;

    const result = lintMermaid(input);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        id: 'extra-end',
        hasFix: false,
        severity: 'warning',
      }),
    );
    expect(result.fixedCode).toBe(input);
    expect(result.hasFixes).toBe(false);
  });
});
