/**
 * @param {string} before
 * @param {string} after
 * @returns {{type: 'context'|'add'|'remove', text: string}[]}
 */
export function diffLines(before, after) {
  if (before === after) {
    return before.split('\n').map((text) => ({ type: 'context', text }));
  }
  const left = before.split('\n');
  const right = after.split('\n');

  /**
   * @param {string} text
   * @returns {{type: 'context', text: string}}
   */
  function context(text) {
    return { type: 'context', text };
  }

  // Trim common prefix/suffix to reduce the DP matrix size for typical edits.
  let start = 0;
  while (start < left.length && start < right.length && left[start] === right[start]) {
    start += 1;
  }

  let endLeft = left.length - 1;
  let endRight = right.length - 1;
  while (endLeft >= start && endRight >= start && left[endLeft] === right[endRight]) {
    endLeft -= 1;
    endRight -= 1;
  }

  const prefix = left.slice(0, start).map(context);
  const suffix = left.slice(endLeft + 1).map(context);
  const midLeft = left.slice(start, endLeft + 1);
  const midRight = right.slice(start, endRight + 1);

  const n = midLeft.length;
  const m = midRight.length;
  const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      if (midLeft[i] === midRight[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  /** @type {{type: 'context'|'add'|'remove', text: string}[]} */
  const output = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (midLeft[i] === midRight[j]) {
      output.push({ type: 'context', text: midLeft[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      output.push({ type: 'remove', text: midLeft[i] });
      i += 1;
    } else {
      output.push({ type: 'add', text: midRight[j] });
      j += 1;
    }
  }
  while (i < n) {
    output.push({ type: 'remove', text: midLeft[i] });
    i += 1;
  }
  while (j < m) {
    output.push({ type: 'add', text: midRight[j] });
    j += 1;
  }

  return [...prefix, ...output, ...suffix];
}

/**
 * Bounded fallback diff for very large texts where full DP is too expensive.
 * @param {string} before
 * @param {string} after
 * @param {number=} maxLines
 * @returns {{lines: {type: 'add'|'remove', text: string}[], truncated: boolean, adds: number, removes: number}}
 */
export function summarizeLargeDiff(before, after, maxLines = 160) {
  const left = before.split('\n');
  const right = after.split('\n');
  const lookahead = 8;
  let i = 0;
  let j = 0;
  let adds = 0;
  let removes = 0;
  /** @type {{type: 'add'|'remove', text: string}[]} */
  const lines = [];

  while ((i < left.length || j < right.length) && lines.length < maxLines) {
    const leftLine = i < left.length ? left[i] : null;
    const rightLine = j < right.length ? right[j] : null;

    if (leftLine === rightLine) {
      i += 1;
      j += 1;
      continue;
    }

    const leftWindow = left.slice(i, Math.min(left.length, i + lookahead));
    const rightWindow = right.slice(j, Math.min(right.length, j + lookahead));
    const rightExistsSoon = rightLine !== null && leftWindow.includes(rightLine);
    const leftExistsSoon = leftLine !== null && rightWindow.includes(leftLine);

    if (rightLine !== null && (!rightExistsSoon || leftLine === null)) {
      lines.push({ type: 'add', text: rightLine });
      adds += 1;
      j += 1;
      continue;
    }

    if (leftLine !== null && (!leftExistsSoon || rightLine === null)) {
      lines.push({ type: 'remove', text: leftLine });
      removes += 1;
      i += 1;
      continue;
    }

    if (leftLine !== null) {
      lines.push({ type: 'remove', text: leftLine });
      removes += 1;
      i += 1;
    }
    if (rightLine !== null && lines.length < maxLines) {
      lines.push({ type: 'add', text: rightLine });
      adds += 1;
      j += 1;
    }
  }

  while (i < left.length) {
    removes += 1;
    i += 1;
  }
  while (j < right.length) {
    adds += 1;
    j += 1;
  }

  return {
    lines,
    truncated: lines.length >= maxLines,
    adds,
    removes,
  };
}
