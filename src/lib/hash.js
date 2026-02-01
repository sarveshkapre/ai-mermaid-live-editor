/**
 * @param {string} text
 */
export function encodeHash(text) {
  const encoded = btoa(unescape(encodeURIComponent(text)));
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * @param {string} hash
 */
export function decodeHash(hash) {
  const padded = hash.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  const base64 = padded + '='.repeat(padLength);
  try {
    return decodeURIComponent(escape(atob(base64)));
  } catch {
    return null;
  }
}
