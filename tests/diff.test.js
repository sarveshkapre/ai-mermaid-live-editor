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

  test('preserves common prefix and suffix as context', () => {
    const diff = diffLines('a\nb\nc\nd\ne', 'a\nb\nX\nd\ne');
    expect(diff[0]).toEqual({ type: 'context', text: 'a' });
    expect(diff[1]).toEqual({ type: 'context', text: 'b' });
    expect(diff.some((line) => line.type === 'remove' && line.text === 'c')).toBe(true);
    expect(diff.some((line) => line.type === 'add' && line.text === 'X')).toBe(true);
    expect(diff[diff.length - 2]).toEqual({ type: 'context', text: 'd' });
    expect(diff[diff.length - 1]).toEqual({ type: 'context', text: 'e' });
  });
});
