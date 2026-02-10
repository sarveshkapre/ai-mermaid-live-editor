/**
 * Helpers for extracting streamed deltas and metadata from OpenAI-compatible SSE.
 *
 * We keep this tolerant because "OpenAI-compatible" providers vary a lot.
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
 * @returns {string | null}
 */
export function extractChatDelta(json) {
  if (!isRecord(json)) return null;
  const choices = json.choices;
  if (!Array.isArray(choices) || !choices.length) return null;
  const first = choices[0];
  if (!isRecord(first)) return null;
  const delta = first.delta;
  if (isRecord(delta) && typeof delta.content === 'string') return delta.content;
  // Some providers (rarely) stream final message content instead of deltas.
  const message = first.message;
  if (isRecord(message) && typeof message.content === 'string') return message.content;
  return null;
}

/**
 * @param {unknown} json
 * @returns {string | null}
 */
export function extractResponsesDelta(json) {
  if (!isRecord(json)) return null;
  if (typeof json.delta === 'string') return json.delta;

  // OpenAI Responses streaming commonly uses type names like:
  // "response.output_text.delta"
  const type = typeof json.type === 'string' ? json.type : '';
  if (type && typeof json.text === 'string') return json.text;

  return null;
}

/**
 * @param {unknown} json
 * @returns {unknown | null}
 */
export function extractUsage(json) {
  if (!isRecord(json)) return null;
  if (isRecord(json.usage)) return json.usage;
  if (isRecord(json.response) && isRecord(json.response.usage)) return json.response.usage;
  return null;
}

