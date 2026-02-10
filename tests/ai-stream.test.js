import { describe, expect, test } from 'vitest';

import { extractChatDelta, extractResponsesDelta, extractUsage } from '../src/lib/ai-stream.js';

describe('ai stream helpers', () => {
  test('extractChatDelta returns delta content', () => {
    const json = { choices: [{ delta: { content: 'flowchart TD\\n' } }] };
    expect(extractChatDelta(json)).toBe('flowchart TD\\n');
  });

  test('extractChatDelta falls back to message content', () => {
    const json = { choices: [{ message: { content: 'graph LR\\n  a-->b' } }] };
    expect(extractChatDelta(json)).toBe('graph LR\\n  a-->b');
  });

  test('extractResponsesDelta returns delta', () => {
    const json = { type: 'response.output_text.delta', delta: 'hello' };
    expect(extractResponsesDelta(json)).toBe('hello');
  });

  test('extractUsage returns usage object when present', () => {
    const json = { usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 } };
    expect(extractUsage(json)).toEqual({ prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 });
  });
});

