import mermaid from 'mermaid';
import { diffLines } from './lib/diff.js';
import { addSnapshot, clearHistory, loadHistory } from './lib/history.js';
import { decodeHash, encodeHash } from './lib/hash.js';

const DEFAULT_DIAGRAM = `flowchart TD
  start([Start]) --> ingest{Ingest}
  ingest -->|valid| clean[Normalize]
  ingest -->|invalid| triage[Manual triage]
  clean --> enrich[Enrich data]
  enrich --> model[Model decision]
  model --> approve{Approval?}
  approve -->|yes| ship[Ship]
  approve -->|no| revise[Revise]
  revise --> model
`;

/**
 * @template T
 * @param {string} id
 * @returns {T}
 */
function byId(id) {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing element: ${id}`);
  }
  return /** @type {T} */ (el);
}

/** @type {HTMLTextAreaElement} */
const editor = byId('editor');
/** @type {HTMLDivElement} */
const preview = byId('preview');
/** @type {HTMLDivElement} */
const renderStatus = byId('render-status');
/** @type {HTMLDivElement} */
const stats = byId('stats');
/** @type {HTMLTextAreaElement} */
const instructions = byId('instructions');
/** @type {HTMLTextAreaElement} */
const proposal = byId('proposal');
/** @type {HTMLDivElement} */
const diffEl = byId('diff');
/** @type {HTMLDivElement} */
const timelineEl = byId('timeline');
/** @type {HTMLButtonElement} */
const themeToggle = byId('theme-toggle');
/** @type {HTMLButtonElement} */
const copyLink = byId('copy-link');
/** @type {HTMLButtonElement} */
const helpBtn = byId('help');
/** @type {HTMLDialogElement} */
const shortcutsDialog = byId('shortcuts-dialog');
/** @type {HTMLButtonElement} */
const shortcutsClose = byId('shortcuts-close');
/** @type {HTMLDivElement} */
const toast = byId('toast');

/** @type {HTMLButtonElement} */
const commitBtn = byId('commit');
/** @type {HTMLButtonElement} */
const simulateBtn = byId('simulate');
/** @type {HTMLButtonElement} */
const applyPatchBtn = byId('apply-patch');
/** @type {HTMLButtonElement} */
const exportSvgBtn = byId('export-svg');
/** @type {HTMLButtonElement} */
const exportPngBtn = byId('export-png');
/** @type {HTMLButtonElement} */
const resetBtn = byId('reset');
/** @type {HTMLButtonElement} */
const clearHistoryBtn = byId('clear-history');
/** @type {HTMLButtonElement} */
const downloadHistoryBtn = byId('download-history');

let lastSvg = '';
/** @type {number | null} */
let renderTimer = null;
/** @type {number | null} */
let toastTimer = null;
/** @type {HTMLElement | null} */
let lastFocusedBeforeDialog = null;

mermaid.initialize({
  startOnLoad: false,
  theme: document.body.classList.contains('theme-dark') ? 'dark' : 'neutral'
});

/**
 * @param {string} message
 */
function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  toast.dataset.visible = 'true';
  if (toastTimer) {
    window.clearTimeout(toastTimer);
  }
  toastTimer = window.setTimeout(() => {
    toast.dataset.visible = 'false';
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 220);
  }, 2200);
}

function updateStats() {
  const text = editor.value;
  const lines = text.split('\n').length;
  const chars = text.length;
  stats.textContent = `${lines} lines · ${chars} chars`;
}

async function renderMermaid() {
  const code = editor.value.trim();
  if (!code) {
    preview.innerHTML = '';
    renderStatus.textContent = 'Empty diagram';
    return;
  }
  try {
    renderStatus.textContent = 'Rendering…';
    const { svg } = await mermaid.render(`diagram-${Date.now()}`, code);
    lastSvg = svg;
    preview.innerHTML = svg;
    renderStatus.textContent = 'Rendered';
  } catch (error) {
    preview.textContent = '';
    const message = error instanceof Error ? error.message : String(error);
    renderStatus.textContent = `Error: ${message}`;
  }
}

function scheduleRender() {
  if (renderTimer) {
    window.clearTimeout(renderTimer);
  }
  renderTimer = window.setTimeout(() => {
    renderMermaid();
    updateStats();
    updateDiff();
  }, 200);
}

function simulatePatch() {
  const base = editor.value.trim();
  const hint = instructions.value.trim().toLowerCase();
  let updated = base;

  if (!updated) {
    updated = DEFAULT_DIAGRAM.trim();
  }

  if (!updated.includes('patch_review')) {
    updated += `\n  %% AI patch\n  approve --> patch_review[AI review]\n  patch_review --> ship\n`;
  }

  if (hint.includes('swimlane') && !updated.includes('subgraph')) {
    updated += `\n  subgraph Lane A\n    clean\n    enrich\n  end\n`;
  }

  proposal.value = updated.trim();
  updateDiff();
}

function updateDiff() {
  const base = editor.value;
  const next = proposal.value;
  if (!next.trim()) {
    diffEl.innerHTML = '<div class="hint">No patch proposal yet.</div>';
    return;
  }
  const diff = diffLines(base, next);
  if (diff.every((line) => line.type === 'context')) {
    diffEl.innerHTML = '<div class="hint">No changes.</div>';
    return;
  }
  diffEl.innerHTML = diff
    .map((line) => {
      const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';
      const className = line.type === 'add' ? 'add' : line.type === 'remove' ? 'remove' : '';
      return `<div class="${className}">${prefix} ${escapeHtml(line.text)}</div>`;
    })
    .join('');
}

function applyPatch() {
  if (!proposal.value.trim()) {
    return;
  }
  editor.value = proposal.value.trim();
  scheduleRender();
}

function renderTimeline() {
  const items = loadHistory();
  timelineEl.innerHTML = '';
  if (!items.length) {
    timelineEl.innerHTML = '<div class="hint">No commits yet.</div>';
    return;
  }
  items.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'timeline-item';
    const label = document.createElement('div');
    const time = new Date(item.createdAt).toLocaleString();
    label.innerHTML = `<strong>${escapeHtml(item.message)}</strong><div class="hint">${time}</div>`;

    const actions = document.createElement('div');
    const restoreBtn = document.createElement('button');
    restoreBtn.textContent = 'Restore';
    restoreBtn.className = 'ghost';
    restoreBtn.addEventListener('click', () => {
      editor.value = item.diagram;
      scheduleRender();
    });

    const diffBtn = document.createElement('button');
    diffBtn.textContent = 'Diff';
    diffBtn.addEventListener('click', () => {
      proposal.value = item.diagram;
      updateDiff();
    });

    actions.appendChild(restoreBtn);
    actions.appendChild(diffBtn);
    row.appendChild(label);
    row.appendChild(actions);
    timelineEl.appendChild(row);
  });
}

function commitSnapshot() {
  const message = prompt('Commit message', 'Snapshot');
  if (!message) return;
  addSnapshot(editor.value, message);
  renderTimeline();
}

/**
 * @param {boolean} isDark
 * @param {{render?: boolean}=} options
 */
function applyTheme(isDark, options = {}) {
  document.body.classList.toggle('theme-dark', isDark);
  themeToggle.setAttribute('aria-pressed', String(isDark));
  themeToggle.textContent = isDark ? 'Light mode' : 'Dark mode';
  mermaid.initialize({
    startOnLoad: false,
    theme: isDark ? 'dark' : 'neutral'
  });
  if (options.render !== false) {
    renderMermaid();
  }
}

/**
 * @param {string} text
 */
async function writeClipboardText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const el = document.createElement('textarea');
  el.value = text;
  el.setAttribute('readonly', '');
  el.style.position = 'fixed';
  el.style.left = '-9999px';
  document.body.appendChild(el);
  el.select();
  const ok = document.execCommand('copy');
  el.remove();
  if (!ok) {
    throw new Error('Copy failed');
  }
}

async function copyShareLink() {
  const hash = encodeHash(editor.value);
  const url = `${window.location.origin}${window.location.pathname}#${hash}`;
  window.history.replaceState(null, '', `#${hash}`);
  try {
    await writeClipboardText(url);
    showToast('Share link copied.');
  } catch {
    showToast('Copy failed. Link shown in prompt.');
    window.prompt('Copy share link', url);
  }
}

function exportSvg() {
  if (!lastSvg) return;
  const blob = new Blob([lastSvg], { type: 'image/svg+xml' });
  downloadBlob(blob, 'diagram.svg');
}

function exportPng() {
  if (!lastSvg) return;
  const svgBlob = new Blob([lastSvg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        downloadBlob(blob, 'diagram.png');
      }
      URL.revokeObjectURL(url);
    }, 'image/png');
  };
  img.src = url;
}

function downloadHistory() {
  const data = loadHistory();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'mermaid-history.json');
}

/**
 * @param {Blob} blob
 * @param {string} filename
 */
function downloadBlob(blob, filename) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

/**
 * @param {string} value
 */
function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function init() {
  const storedTheme = localStorage.getItem('theme');
  const prefersDark =
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = storedTheme ? storedTheme === 'dark' : prefersDark;
  applyTheme(isDark, { render: false });

  if (!storedTheme && typeof window.matchMedia === 'function') {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', (event) => {
      applyTheme(event.matches);
    });
  }

  const hash = window.location.hash.replace('#', '');
  const decoded = hash ? decodeHash(hash) : null;
  editor.value = decoded || DEFAULT_DIAGRAM.trim();

  updateStats();
  renderMermaid();
  renderTimeline();
  updateDiff();
}

editor.addEventListener('input', scheduleRender);
proposal.addEventListener('input', updateDiff);

commitBtn.addEventListener('click', commitSnapshot);
simulateBtn.addEventListener('click', simulatePatch);
applyPatchBtn.addEventListener('click', applyPatch);
exportSvgBtn.addEventListener('click', exportSvg);
exportPngBtn.addEventListener('click', exportPng);

resetBtn.addEventListener('click', () => {
  if (!confirm('Reset editor to the starter diagram?')) return;
  editor.value = DEFAULT_DIAGRAM.trim();
  scheduleRender();
});

clearHistoryBtn.addEventListener('click', () => {
  if (!confirm('Clear all snapshots? This cannot be undone.')) return;
  clearHistory();
  renderTimeline();
});

downloadHistoryBtn.addEventListener('click', downloadHistory);

copyLink.addEventListener('click', copyShareLink);

themeToggle.addEventListener('click', () => {
  const next = !document.body.classList.contains('theme-dark');
  localStorage.setItem('theme', next ? 'dark' : 'light');
  applyTheme(next);
});

function openShortcuts() {
  lastFocusedBeforeDialog = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (typeof shortcutsDialog.showModal === 'function') {
    shortcutsDialog.showModal();
  } else {
    shortcutsDialog.setAttribute('open', '');
  }
  shortcutsClose.focus();
}

function closeShortcuts() {
  shortcutsDialog.close();
}

helpBtn.addEventListener('click', openShortcuts);
shortcutsClose.addEventListener('click', closeShortcuts);
shortcutsDialog.addEventListener('close', () => {
  (lastFocusedBeforeDialog || helpBtn).focus();
});

window.addEventListener('keydown', (event) => {
  const isCmd = event.metaKey || event.ctrlKey;
  if (isCmd && event.key === 'Enter') {
    event.preventDefault();
    applyPatch();
  }
  if (isCmd && event.key.toLowerCase() === 's') {
    event.preventDefault();
    commitSnapshot();
  }
  if (!isCmd && event.key === '?' && !shortcutsDialog.open) {
    const target = event.target;
    const isEditable =
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLInputElement ||
      (target instanceof HTMLElement && target.isContentEditable);
    if (!isEditable) {
      event.preventDefault();
      openShortcuts();
    }
  }
});

init();
