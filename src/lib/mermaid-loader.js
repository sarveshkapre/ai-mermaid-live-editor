/**
 * Lazy-load Mermaid so the initial bundle stays small.
 * Also centralizes Mermaid initialization (theme + startOnLoad).
 */

/** @type {Promise<any> | null} */
let mermaidPromise = null;
/** @type {'dark' | 'neutral' | null} */
let lastTheme = null;

/**
 * @param {'dark' | 'neutral'} theme
 * @returns {Promise<any>}
 */
export async function loadMermaid(theme) {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => (mod && 'default' in mod ? mod.default : mod));
  }
  const mermaid = await mermaidPromise;
  if (lastTheme !== theme) {
    mermaid.initialize({
      startOnLoad: false,
      theme,
      // Ensure pasted/share-linked diagrams cannot opt into unsafe HTML/script behaviors.
      securityLevel: 'strict',
      // Prevent `%%{init: ...}%%` directives from overriding site-level security defaults.
      secure: ['securityLevel', 'startOnLoad'],
    });
    lastTheme = theme;
  }
  return mermaid;
}
