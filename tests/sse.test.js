import { describe, expect, test } from 'vitest';

import { createSseParser } from '../src/lib/sse.js';

describe('sse parser', () => {
  test('parses single message', () => {
    /** @type {Array<{event: string, data: string}>} */
    const messages = [];
    const parser = createSseParser((msg) => messages.push(msg));
    parser.push('data: hello\n\n');
    parser.finish();
    expect(messages).toEqual([{ event: 'message', data: 'hello' }]);
  });

  test('parses event name and multi-line data', () => {
    /** @type {Array<{event: string, data: string}>} */
    const messages = [];
    const parser = createSseParser((msg) => messages.push(msg));
    parser.push('event: foo\n');
    parser.push('data: a\n');
    parser.push('data: b\n\n');
    parser.finish();
    expect(messages).toEqual([{ event: 'foo', data: 'a\nb' }]);
  });

  test('handles chunk boundaries mid-line', () => {
    /** @type {Array<{event: string, data: string}>} */
    const messages = [];
    const parser = createSseParser((msg) => messages.push(msg));
    parser.push('data: he');
    parser.push('llo\n\n');
    parser.finish();
    expect(messages).toEqual([{ event: 'message', data: 'hello' }]);
  });

  test('finish flushes trailing partial message', () => {
    /** @type {Array<{event: string, data: string}>} */
    const messages = [];
    const parser = createSseParser((msg) => messages.push(msg));
    parser.push('data: trailing');
    parser.finish();
    expect(messages).toEqual([{ event: 'message', data: 'trailing' }]);
  });
});
