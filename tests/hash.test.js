import { describe, expect, test } from 'vitest';
import { decodeHash, encodeHash } from '../src/lib/hash.js';

describe('hash utils', () => {
  test('round trips', () => {
    const input = 'flowchart TD\n  a-->b';
    const encoded = encodeHash(input);
    const decoded = decodeHash(encoded);
    expect(decoded).toBe(input);
  });
});
