/**
 * @param {unknown} error
 * @returns {string}
 */
export function errorToMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}

/**
 * @param {string} message
 * @returns {number | null}
 */
export function extractMermaidErrorLine(message) {
  if (!message) return null;
  const match = message.match(/line\s+(\d+)/i);
  if (!match) return null;
  const line = Number(match[1]);
  if (!Number.isFinite(line) || line < 1) return null;
  return line;
}
