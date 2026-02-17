import { describe, expect, test } from 'vitest';
import { diffLines, summarizeLargeDiff } from '../src/lib/diff.js';

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

describe('summarizeLargeDiff', () => {
  test('returns aggregate add/remove counts', () => {
    const summary = summarizeLargeDiff('a\nb\nc', 'a\nx\ny\nc');
    expect(summary.adds).toBeGreaterThan(0);
    expect(summary.removes).toBeGreaterThan(0);
    expect(summary.lines.length).toBeGreaterThan(0);
  });

  test('respects max line bound and marks truncation', () => {
    const before = Array.from({ length: 400 }, (_, i) => `left-${i}`).join('\n');
    const after = Array.from({ length: 400 }, (_, i) => `right-${i}`).join('\n');
    const summary = summarizeLargeDiff(before, after, 20);
    expect(summary.lines.length).toBe(20);
    expect(summary.truncated).toBe(true);
  });
});
