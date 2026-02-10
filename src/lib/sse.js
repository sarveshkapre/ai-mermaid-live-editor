/**
 * Minimal Server-Sent Events (SSE) parser.
 *
 * This intentionally implements only what we need for OpenAI-compatible
 * `text/event-stream` responses.
 */

/**
 * @typedef {{event: string, data: string}} SseMessage
 */

/**
 * @param {(msg: SseMessage) => void} onMessage
 */
export function createSseParser(onMessage) {
  /** @type {string} */
  let buffer = '';
  /** @type {string} */
  let eventName = '';
  /** @type {string[]} */
  let dataLines = [];

  function dispatch() {
    if (!eventName && !dataLines.length) return;
    const msg = { event: eventName || 'message', data: dataLines.join('\n') };
    eventName = '';
    dataLines = [];
    onMessage(msg);
  }

  /**
   * @param {string} chunk
   */
  function push(chunk) {
    buffer += chunk;
    while (true) {
      const idx = buffer.indexOf('\n');
      if (idx === -1) break;
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);

      if (!line) {
        dispatch();
        continue;
      }

      if (line.startsWith(':')) continue; // comment

      if (line.startsWith('event:')) {
        eventName = line.slice('event:'.length).trim();
        continue;
      }

      if (line.startsWith('data:')) {
        // SSE allows one optional leading space after ":".
        dataLines.push(line.slice('data:'.length).replace(/^\s/, ''));
      }
    }
  }

  function finish() {
    // If there's a trailing partial line without a newline, treat it as a line.
    if (buffer) {
      push('\n');
    }
    dispatch();
  }

  return { push, finish };
}

