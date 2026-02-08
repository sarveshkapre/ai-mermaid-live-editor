import { describe, expect, test } from 'vitest';
import { errorToMessage, extractMermaidErrorLine } from '../src/lib/mermaid-error.js';

describe('mermaid error helpers', () => {
  test('extracts line numbers from Mermaid parser messages', () => {
    expect(extractMermaidErrorLine('Parse error on line 42: unexpected token')).toBe(42);
    expect(extractMermaidErrorLine('line 7 col 2')).toBe(7);
  });

  test('returns null when no line number exists', () => {
    expect(extractMermaidErrorLine('unexpected token')).toBe(null);
    expect(extractMermaidErrorLine('')).toBe(null);
  });

  test('converts unknown errors into readable text', () => {
    expect(errorToMessage(new Error('boom'))).toBe('boom');
    expect(errorToMessage('raw message')).toBe('raw message');
  });
});
