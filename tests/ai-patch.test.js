import { describe, expect, test } from 'vitest';

import { extractMermaidFromText, extractTextFromProviderResponse } from '../src/lib/ai-patch.js';

describe('ai patch helpers', () => {
  test('extractMermaidFromText returns raw Mermaid when already clean', () => {
    const input = 'flowchart TD\n  a-->b\n';
    expect(extractMermaidFromText(input)).toBe('flowchart TD\n  a-->b');
  });

  test('extractMermaidFromText prefers fenced mermaid blocks', () => {
    const input = [
      'Here you go:',
      '```mermaid',
      'flowchart TD',
      '  a-->b',
      '```',
      '',
      'extra text',
    ].join('\n');
    expect(extractMermaidFromText(input)).toBe('flowchart TD\n  a-->b');
  });

  test('extractMermaidFromText clips from first Mermaid header when no fences', () => {
    const input = ['Some preface', 'flowchart LR', '  start-->end', 'Thanks'].join('\n');
    expect(extractMermaidFromText(input)).toBe('flowchart LR\n  start-->end\nThanks');
  });

  test('extractTextFromProviderResponse handles chat responses', () => {
    const json = { choices: [{ message: { content: 'flowchart TD\n  a-->b' } }] };
    expect(extractTextFromProviderResponse(json, 'chat')).toBe('flowchart TD\n  a-->b');
  });

  test('extractTextFromProviderResponse handles responses output', () => {
    const json = {
      output: [
        {
          type: 'message',
          content: [{ type: 'output_text', text: 'flowchart TD\n  a-->b' }],
        },
      ],
    };
    expect(extractTextFromProviderResponse(json, 'responses')).toBe('flowchart TD\n  a-->b');
  });
});
