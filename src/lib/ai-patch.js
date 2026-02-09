/**
 * Helpers for turning AI provider responses into a clean Mermaid proposal.
 *
 * This module is intentionally provider-agnostic: it supports OpenAI's
 * Chat Completions + Responses response shapes, and works with many
 * OpenAI-compatible providers that return similar payloads.
 */

/**
 * @typedef {'chat' | 'responses'} AiApiMode
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return Boolean(value) && typeof value === 'object';
}

/**
 * @param {unknown} json
 * @param {AiApiMode} mode
 * @returns {string | null}
 */
export function extractTextFromProviderResponse(json, mode) {
  if (!isRecord(json)) return null;

  if (typeof json.output_text === 'string' && json.output_text.trim()) {
    return json.output_text.trim();
  }

  if (mode === 'chat') {
    const choices = json.choices;
    if (!Array.isArray(choices) || !choices.length) return null;
    const first = choices[0];
    if (!isRecord(first)) return null;
    const message = first.message;
    if (!isRecord(message)) return null;
    const content = message.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      const parts = content
        .map((part) => (isRecord(part) && typeof part.text === 'string' ? part.text : ''))
        .filter(Boolean);
      return parts.length ? parts.join('') : null;
    }
    return null;
  }

  const output = json.output;
  if (!Array.isArray(output) || !output.length) return null;
  const chunks = [];
  for (const item of output) {
    if (!isRecord(item)) continue;
    if (item.type !== 'message') continue;
    const content = item.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!isRecord(part)) continue;
      if (part.type !== 'output_text') continue;
      if (typeof part.text !== 'string') continue;
      chunks.push(part.text);
    }
  }
  return chunks.length ? chunks.join('') : null;
}

/**
 * Extract Mermaid text from a model output that may include markdown fences
 * or preamble text. Returns null if no plausible Mermaid block is found.
 *
 * @param {string} text
 * @returns {string | null}
 */
export function extractMermaidFromText(text) {
  const raw = text.trim();
  if (!raw) return null;

  // Prefer fenced code blocks when present.
  const fenced = extractBestFencedBlock(raw);
  if (fenced) return fenced;

  // Otherwise, try to clip from the first Mermaid-ish header line.
  const clipped = clipFromMermaidHeader(raw);
  return clipped || null;
}

/**
 * @param {string} raw
 * @returns {string | null}
 */
function extractBestFencedBlock(raw) {
  const blocks = [];
  const re = /```([^\n`]*)\n([\s\S]*?)```/g;
  let match;
  while ((match = re.exec(raw))) {
    const lang = (match[1] || '').trim().toLowerCase();
    const body = (match[2] || '').trim();
    if (!body) continue;
    blocks.push({ lang, body });
  }
  if (!blocks.length) return null;
  const mermaidTagged = blocks.filter((b) => b.lang === 'mermaid');
  const candidates = mermaidTagged.length ? mermaidTagged : blocks;
  const best = candidates.find((b) => hasMermaidHeader(b.body)) || candidates[0];
  const clipped = clipFromMermaidHeader(best.body);
  return (clipped || best.body).trim() || null;
}

/**
 * @param {string} raw
 * @returns {string | null}
 */
function clipFromMermaidHeader(raw) {
  const lines = raw.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (hasMermaidHeader(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;
  const clipped = lines.slice(start).join('\n').trim();
  return clipped || null;
}

/**
 * @param {string} line
 * @returns {boolean}
 */
function hasMermaidHeader(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('%%{init:')) return true;
  return /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|gantt|journey|pie|mindmap|timeline|gitGraph|quadrantChart)\b/i.test(
    trimmed,
  );
}

/**
 * @param {{tabTitle: string, project: {title: string, audience: string, owner: string, purpose: string}, diagram: string, instructions: string}} ctx
 * @returns {{system: string, user: string}}
 */
export function buildPatchMessages(ctx) {
  const system = [
    'You are an expert Mermaid diagram editor.',
    'Return ONLY the full updated Mermaid source. No Markdown. No backticks. No explanations.',
    'Preserve the diagram type unless the user explicitly asks to change it.',
    'Keep the diagram valid Mermaid syntax.',
  ].join(' ');

  const projectLines = [
    `Project title: ${ctx.project.title || '-'}`,
    `Audience: ${ctx.project.audience || '-'}`,
    `Owner: ${ctx.project.owner || '-'}`,
    `Purpose: ${ctx.project.purpose || '-'}`,
  ].join('\n');

  const user = [
    `Active tab: ${ctx.tabTitle || 'Diagram'}`,
    'Project brief:',
    projectLines,
    '',
    'Current Mermaid:',
    ctx.diagram.trim() || '(empty)',
    '',
    'User instructions:',
    ctx.instructions.trim() || '(none)',
    '',
    'Output requirements:',
    '- Output must be a complete Mermaid diagram.',
    '- Do not wrap in code fences.',
    '- Do not include any commentary.',
  ].join('\n');

  return { system, user };
}

