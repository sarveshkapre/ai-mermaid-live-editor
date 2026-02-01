/**
 * @param {string} before
 * @param {string} after
 * @returns {{type: 'context'|'add'|'remove', text: string}[]}
 */
export function diffLines(before, after) {
  const left = before.split('\n');
  const right = after.split('\n');
  const n = left.length;
  const m = right.length;
  const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      if (left[i] === right[j]) {
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
    if (left[i] === right[j]) {
      output.push({ type: 'context', text: left[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      output.push({ type: 'remove', text: left[i] });
      i += 1;
    } else {
      output.push({ type: 'add', text: right[j] });
      j += 1;
    }
  }
  while (i < n) {
    output.push({ type: 'remove', text: left[i] });
    i += 1;
  }
  while (j < m) {
    output.push({ type: 'add', text: right[j] });
    j += 1;
  }

  return output;
}
