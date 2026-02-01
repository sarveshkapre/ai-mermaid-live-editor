import { describe, expect, test } from 'vitest';
import { diffLines } from '../src/lib/diff.js';

describe('diffLines', () => {
  test('marks additions and removals', () => {
    const diff = diffLines('a\nb', 'a\nc');
    expect(diff.some((line) => line.type === 'remove' && line.text === 'b')).toBe(true);
    expect(diff.some((line) => line.type === 'add' && line.text === 'c')).toBe(true);
  });

  test('keeps context lines', () => {
    const diff = diffLines('a\nb', 'a\nb');
    expect(diff.every((line) => line.type === 'context')).toBe(true);
  });
});
