/**
 * @typedef {'error' | 'warning'} MermaidLintSeverity
 */

/**
 * @typedef {{
 *   id: string,
 *   severity: MermaidLintSeverity,
 *   title: string,
 *   message: string,
 *   line: number | null,
 *   hasFix: boolean
 * }} MermaidLintIssue
 */

/**
 * @typedef {{
 *   issues: MermaidLintIssue[],
 *   fixedCode: string,
 *   hasFixes: boolean
 * }} MermaidLintResult
 */

const SMART_QUOTES_RE = /[\u2018\u2019\u201C\u201D]/;
const TABS_RE = /\t/;

/**
 * @param {string} code
 * @returns {'flowchart' | 'other'}
 */
function detectDiagramKind(code) {
  const lines = code.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('%%')) continue;
    if (trimmed.startsWith('---')) continue;
    if (trimmed.startsWith('title ')) continue;
    const keyword = trimmed.toLowerCase();
    if (keyword.startsWith('flowchart ') || keyword === 'flowchart') return 'flowchart';
    if (keyword.startsWith('graph ') || keyword === 'graph') return 'flowchart';
    return 'other';
  }
  return 'other';
}

/**
 * @param {string} code
 * @returns {{code: string, changed: boolean}}
 */
function unwrapCodeFence(code) {
  const trimmed = code.trim();
  const fenced = trimmed.match(/^```(?:mermaid)?\s*\n([\s\S]*?)\n```$/i);
  if (!fenced) return { code, changed: false };
  const inner = fenced[1].replace(/\r\n/g, '\n');
  return { code: `${inner.trimEnd()}\n`, changed: true };
}

/**
 * @param {string} line
 * @returns {boolean}
 */
function hasSingleArrow(line) {
  for (let i = 0; i < line.length - 1; i += 1) {
    if (line[i] !== '-' || line[i + 1] !== '>') continue;
    const prev = i > 0 ? line[i - 1] : '';
    const next = i + 2 < line.length ? line[i + 2] : '';
    if (prev !== '-' && next !== '>') {
      return true;
    }
  }
  return false;
}

/**
 * @param {string} line
 * @returns {string}
 */
function replaceSingleArrows(line) {
  return line.replace(/(^|[^-])->(?!>)/g, '$1-->');
}

/**
 * @param {string} code
 * @returns {MermaidLintResult}
 */
export function lintMermaid(code) {
  const input = typeof code === 'string' ? code : '';
  /** @type {MermaidLintIssue[]} */
  const issues = [];
  let working = input;

  const unwrapped = unwrapCodeFence(working);
  if (unwrapped.changed) {
    issues.push({
      id: 'fenced-code',
      severity: 'error',
      title: 'Fenced Markdown block detected',
      message: 'Pasted content is wrapped in ``` fences. Mermaid parser expects raw diagram text.',
      line: 1,
      hasFix: true,
    });
    working = unwrapped.code;
  }

  const lines = working.split('\n');

  const tabLineIndex = lines.findIndex((line) => TABS_RE.test(line));
  if (tabLineIndex >= 0) {
    issues.push({
      id: 'tabs',
      severity: 'warning',
      title: 'Tabs found',
      message: 'Tabs can produce inconsistent indentation across tools. Convert to spaces.',
      line: tabLineIndex + 1,
      hasFix: true,
    });
    working = working.replace(/\t/g, '  ');
  }

  const quoteLineIndex = lines.findIndex((line) => SMART_QUOTES_RE.test(line));
  if (quoteLineIndex >= 0) {
    issues.push({
      id: 'smart-quotes',
      severity: 'error',
      title: 'Smart quotes found',
      message: 'Curly quotes often break Mermaid parsing. Replace with plain ASCII quotes.',
      line: quoteLineIndex + 1,
      hasFix: true,
    });
    working = working
      .replace(/\u2018/g, "'")
      .replace(/\u2019/g, "'")
      .replace(/\u201C/g, '"')
      .replace(/\u201D/g, '"');
  }

  const normalizedLines = working.split('\n');
  if (detectDiagramKind(working) === 'flowchart') {
    const singleArrowLineIndex = normalizedLines.findIndex((line) => hasSingleArrow(line));
    if (singleArrowLineIndex >= 0) {
      issues.push({
        id: 'single-arrow',
        severity: 'error',
        title: 'Single arrow (`->`) found',
        message: 'Flowcharts usually need `-->` arrows. Single arrows are commonly paste/edit typos.',
        line: singleArrowLineIndex + 1,
        hasFix: true,
      });
      working = working
        .split('\n')
        .map((line) => replaceSingleArrows(line))
        .join('\n');
    }

    const flowLines = working.split('\n');
    const subgraphCount = flowLines.filter((line) => /^\s*subgraph\b/i.test(line)).length;
    const endCount = flowLines.filter((line) => /^\s*end\s*$/i.test(line)).length;
    if (subgraphCount > endCount) {
      const missing = subgraphCount - endCount;
      issues.push({
        id: 'missing-end',
        severity: 'error',
        title: 'Unclosed subgraph block',
        message: `Found ${subgraphCount} subgraph blocks but only ${endCount} \`end\` lines.`,
        line: flowLines.length || null,
        hasFix: true,
      });
      working = `${working.trimEnd()}\n${Array(missing).fill('end').join('\n')}\n`;
    } else if (endCount > subgraphCount) {
      issues.push({
        id: 'extra-end',
        severity: 'warning',
        title: 'Extra `end` detected',
        message: `Found ${endCount} \`end\` lines for ${subgraphCount} subgraph blocks.`,
        line: null,
        hasFix: false,
      });
    }
  }

  return {
    issues,
    fixedCode: working,
    hasFixes: working !== input,
  };
}
