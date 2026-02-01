import mermaid from 'mermaid';
import { diffLines } from './lib/diff.js';
import { clearDraft, loadDraft, saveDraft } from './lib/draft.js';
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
/** @type {HTMLButtonElement} */
const renderNowBtn = byId('render-now');
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
const copySourceBtn = byId('copy-source');
/** @type {HTMLButtonElement} */
const copySvgBtn = byId('copy-svg');
/** @type {HTMLButtonElement} */
const copyPngBtn = byId('copy-png');
/** @type {HTMLButtonElement} */
const resetBtn = byId('reset');
/** @type {HTMLButtonElement} */
const clearHistoryBtn = byId('clear-history');
/** @type {HTMLButtonElement} */
const downloadHistoryBtn = byId('download-history');
/** @type {HTMLButtonElement} */
const downloadSourceBtn = byId('download-source');
/** @type {HTMLSelectElement} */
const exportScaleSelect = byId('export-scale');
/** @type {HTMLSelectElement} */
const exportWidthSelect = byId('export-width');
/** @type {HTMLInputElement} */
const exportWidthCustomInput = byId('export-width-custom');
/** @type {HTMLInputElement} */
const exportTransparentToggle = byId('export-transparent');
/** @type {HTMLSelectElement} */
const exportSvgScaleSelect = byId('export-svg-scale');
/** @type {HTMLInputElement} */
const exportSvgInlineToggle = byId('export-svg-inline');
/** @type {HTMLInputElement} */
const exportSvgMinifyToggle = byId('export-svg-minify');
/** @type {HTMLDivElement} */
const exportSummary = byId('export-summary');
/** @type {HTMLSelectElement} */
const exportPresetSelect = byId('export-preset');
/** @type {HTMLInputElement} */
const exportPresetName = byId('export-preset-name');
/** @type {HTMLButtonElement} */
const savePresetBtn = byId('save-preset');
/** @type {HTMLButtonElement} */
const deletePresetBtn = byId('delete-preset');
/** @type {HTMLDivElement} */
const exportHistoryEl = byId('export-history');
/** @type {HTMLButtonElement} */
const restoreDraftBtn = byId('restore-draft');
/** @type {HTMLButtonElement} */
const clearDraftBtn = byId('clear-draft');

let lastSvg = '';
/** @type {number | null} */
let renderTimer = null;
/** @type {number | null} */
let toastTimer = null;
/** @type {HTMLElement | null} */
let lastFocusedBeforeDialog = null;
/** @type {number | null} */
let lastDraftSavedAt = null;
const EXPORT_PREFS_KEY = 'ai-mermaid-export-prefs';
const EXPORT_PRESET_KEY = 'ai-mermaid-export-presets';
const EXPORT_HISTORY_KEY = 'ai-mermaid-export-history';
const DIFF_LIMITS = { maxChars: 15000, maxLines: 800 };
const RENDER_LIMITS = { maxChars: 20000, maxLines: 1000 };

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
  const draftLabel = lastDraftSavedAt ? ' · Draft saved' : '';
  stats.textContent = `${lines} lines · ${chars} chars${draftLabel}`;
}

/**
 * @param {boolean=} force
 */
async function renderMermaid(force = false) {
  const code = editor.value.trim();
  if (!code) {
    preview.innerHTML = '';
    renderStatus.textContent = 'Empty diagram';
    exportSummary.textContent = 'Export summary updates after render.';
    return;
  }
  if (isTooLargeForRender(code) && !force) {
    renderStatus.textContent = 'Large diagram: rendering paused. Click Render now.';
    exportSummary.textContent = 'Export summary paused for large diagrams.';
    return;
  }
  try {
    renderStatus.textContent = force && isTooLargeForRender(code) ? 'Rendering large diagram…' : 'Rendering…';
    const { svg } = await mermaid.render(`diagram-${Date.now()}`, code);
    lastSvg = svg;
    preview.innerHTML = svg;
    renderStatus.textContent = 'Rendered';
    updateExportSummary();
  } catch (error) {
    preview.textContent = '';
    const message = error instanceof Error ? error.message : String(error);
    renderStatus.textContent = `Error: ${message}`;
    exportSummary.textContent = 'Export summary unavailable.';
  }
}

function scheduleRender() {
  if (renderTimer) {
    window.clearTimeout(renderTimer);
  }
  const delay = isTooLargeForRender(editor.value) ? 800 : 200;
  renderTimer = window.setTimeout(() => {
    renderMermaid();
    updateStats();
    updateDiff();
    const trimmed = editor.value.trim();
    if (!trimmed || trimmed === DEFAULT_DIAGRAM.trim()) {
      clearDraft();
      lastDraftSavedAt = null;
      updateStats();
      return;
    }
    if (saveDraft(trimmed)) {
      lastDraftSavedAt = Date.now();
    }
    updateStats();
  }, delay);
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
  if (isTooLargeForDiff(base, next)) {
    diffEl.innerHTML = '<div class="hint">Diff too large to compute automatically.</div>';
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
    const trimmed = editor.value.trim();
    if (trimmed && trimmed !== DEFAULT_DIAGRAM.trim() && saveDraft(trimmed)) {
      lastDraftSavedAt = Date.now();
    }
    updateStats();
    await writeClipboardText(url);
    showToast('Share link copied.');
  } catch {
    showToast('Copy failed. Link shown in prompt.');
    window.prompt('Copy share link', url);
  }
}

function exportSvg() {
  if (!lastSvg) return;
  const base = applySvgScale(lastSvg, Number(exportSvgScaleSelect.value) || 1);
  const scaled = applySvgWidth(base, resolveExportWidth());
  let output = exportSvgInlineToggle.checked ? inlineSvgStyles(scaled) : scaled;
  if (exportSvgMinifyToggle.checked) {
    output = minifySvg(output);
  }
  const blob = new Blob([output], { type: 'image/svg+xml' });
  downloadBlob(blob, 'diagram.svg');
  addExportHistory('SVG', output.length);
}

function exportPng() {
  if (!lastSvg) return;
  createPngBlob()
    .then((blob) => {
      if (blob) {
        downloadBlob(blob, 'diagram.png');
        addExportHistory('PNG', blob.size);
      }
    })
    .catch(() => {
      showToast('Export failed.');
    });
}

function downloadHistory() {
  const data = loadHistory();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'mermaid-history.json');
}

function updateExportSummary() {
  if (!lastSvg) {
    exportSummary.textContent = 'Export summary updates after render.';
    return;
  }
  const dims = getSvgDimensions(lastSvg);
  if (!dims) {
    exportSummary.textContent = 'Export summary unavailable.';
    return;
  }
  const widthPreset = exportWidthSelect.value;
  const widthValue = resolveExportWidth() || dims.width;
  const pngScale = Number(exportScaleSelect.value) || 1;
  const svgScale = Number(exportSvgScaleSelect.value) || 1;
  const pngWidth = Math.round(widthValue * (widthPreset === 'auto' ? pngScale : 1));
  const pngHeight = Math.round(pngWidth * (dims.height / dims.width));
  const svgWidth = Math.round(widthValue * (widthPreset === 'auto' ? svgScale : 1));
  const svgHeight = Math.round(svgWidth * (dims.height / dims.width));
  exportSummary.textContent = `PNG ${pngWidth}×${pngHeight}px · SVG ${svgWidth}×${svgHeight}px`;
}

/**
 * @param {string} label
 * @param {number} bytes
 */
function addExportHistory(label, bytes) {
  const items = loadExportHistory();
  const entry = {
    id: crypto.randomUUID(),
    label,
    bytes,
    createdAt: Date.now(),
  };
  items.unshift(entry);
  saveExportHistory(items.slice(0, 6));
  renderExportHistory();
}

function renderExportHistory() {
  const items = loadExportHistory();
  if (!items.length) {
    exportHistoryEl.textContent = 'No exports yet.';
    return;
  }
  exportHistoryEl.innerHTML = items
    .map((item) => {
      const time = new Date(item.createdAt).toLocaleTimeString();
      const size = item.bytes ? `${Math.round(item.bytes / 1024)} KB` : '—';
      return `<div>${escapeHtml(item.label)} · ${size} · ${time}</div>`;
    })
    .join('');
}

function loadExportHistory() {
  const raw = localStorage.getItem(EXPORT_HISTORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * @param {Array<{id:string,label:string,bytes:number,createdAt:number}>} items
 */
function saveExportHistory(items) {
  localStorage.setItem(EXPORT_HISTORY_KEY, JSON.stringify(items));
}

function loadExportPresets() {
  const raw = localStorage.getItem(EXPORT_PRESET_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * @param {Record<string, unknown>} presets
 */
function saveExportPresets(presets) {
  localStorage.setItem(EXPORT_PRESET_KEY, JSON.stringify(presets));
}

function collectExportPrefs() {
  return {
    scale: Number(exportScaleSelect.value) || 1,
    transparent: exportTransparentToggle.checked,
    svgScale: Number(exportSvgScaleSelect.value) || 1,
    svgInline: exportSvgInlineToggle.checked,
    svgMinify: exportSvgMinifyToggle.checked,
    width: exportWidthSelect.value,
    customWidth: Number(exportWidthCustomInput.value) || 0,
  };
}

/**
 * @param {Record<string, unknown>} prefs
 */
function applyExportPrefs(prefs) {
  if (!prefs || typeof prefs !== 'object') return;
  if (typeof prefs.scale === 'number') exportScaleSelect.value = String(prefs.scale);
  if (typeof prefs.transparent === 'boolean') exportTransparentToggle.checked = prefs.transparent;
  if (typeof prefs.svgScale === 'number') exportSvgScaleSelect.value = String(prefs.svgScale);
  if (typeof prefs.svgInline === 'boolean') exportSvgInlineToggle.checked = prefs.svgInline;
  if (typeof prefs.svgMinify === 'boolean') exportSvgMinifyToggle.checked = prefs.svgMinify;
  if (typeof prefs.width === 'string') exportWidthSelect.value = prefs.width;
  if (typeof prefs.customWidth === 'number') exportWidthCustomInput.value = String(prefs.customWidth);
  resolveExportWidth();
  updateExportSummary();
}

function loadPresetOptions() {
  const presets = loadExportPresets();
  const keys = Object.keys(presets);
  exportPresetSelect.innerHTML = '<option value="default">Default</option>';
  keys.forEach((key) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = key;
    exportPresetSelect.appendChild(option);
  });
}

function saveCurrentPreset() {
  const name = exportPresetName.value.trim();
  if (!name) {
    showToast('Preset name required.');
    return;
  }
  const presets = loadExportPresets();
  presets[name] = collectExportPrefs();
  saveExportPresets(presets);
  loadPresetOptions();
  exportPresetSelect.value = name;
  showToast('Preset saved.');
}

function deleteCurrentPreset() {
  const name = exportPresetSelect.value;
  if (name === 'default') {
    showToast('Default preset cannot be deleted.');
    return;
  }
  const presets = loadExportPresets();
  if (!presets[name]) return;
  if (!confirm(`Delete preset "${name}"?`)) return;
  delete presets[name];
  saveExportPresets(presets);
  loadPresetOptions();
  exportPresetSelect.value = 'default';
  showToast('Preset deleted.');
}

/**
 * @param {string} svg
 * @returns {{width:number, height:number} | null}
 */
function getSvgDimensions(svg) {
  const widthMatch = svg.match(/width="([\d.]+)(px)?"/);
  const heightMatch = svg.match(/height="([\d.]+)(px)?"/);
  if (widthMatch && heightMatch) {
    const width = Number(widthMatch[1]);
    const height = Number(heightMatch[1]);
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return { width, height };
    }
  }
  const viewBoxMatch = svg.match(/viewBox="([\d.\s]+)"/);
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].trim().split(/\s+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3] };
    }
  }
  return null;
}
function resolveExportWidth() {
  const preset = exportWidthSelect.value;
  exportWidthCustomInput.disabled = preset !== 'custom';
  if (preset === 'auto') return null;
  if (preset === 'custom') {
    const value = Number(exportWidthCustomInput.value);
    if (!Number.isFinite(value) || value <= 0) return null;
    return Math.min(4000, Math.max(200, value));
  }
  const value = Number(preset);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

/**
 * @param {string} svg
 * @param {number} scale
 */
function applySvgScale(svg, scale) {
  if (!scale || scale === 1) return svg;
  const clamped = Math.max(0.5, Math.min(4, scale));
  if (!svg.includes('<svg')) return svg;
  const widthMatch = svg.match(/width="([\d.]+)(px)?"/);
  const heightMatch = svg.match(/height="([\d.]+)(px)?"/);
  const viewBoxMatch = svg.match(/viewBox="([\d.\s]+)"/);
  let next = svg;
  if (widthMatch) {
    const width = Number(widthMatch[1]) * clamped;
    next = next.replace(widthMatch[0], `width="${width}"`);
  }
  if (heightMatch) {
    const height = Number(heightMatch[1]) * clamped;
    next = next.replace(heightMatch[0], `height="${height}"`);
  }
  if (!widthMatch && !heightMatch && viewBoxMatch) {
    const parts = viewBoxMatch[1].trim().split(/\s+/).map(Number);
    if (parts.length === 4) {
      const scaled = [parts[0], parts[1], parts[2] * clamped, parts[3] * clamped];
      next = next.replace(viewBoxMatch[0], `viewBox="${scaled.join(' ')}"`);
    }
  }
  return next;
}

/**
 * @param {string} svg
 * @param {number | null} width
 */
function applySvgWidth(svg, width) {
  if (!width || !svg.includes('<svg')) return svg;
  const widthMatch = svg.match(/width="([\d.]+)(px)?"/);
  const heightMatch = svg.match(/height="([\d.]+)(px)?"/);
  if (widthMatch && heightMatch) {
    const currentWidth = Number(widthMatch[1]);
    const currentHeight = Number(heightMatch[1]);
    if (!Number.isFinite(currentWidth) || !Number.isFinite(currentHeight) || currentWidth <= 0) return svg;
    const ratio = currentHeight / currentWidth;
    const nextWidth = width;
    const nextHeight = Math.round(width * ratio);
    let next = svg.replace(widthMatch[0], `width="${nextWidth}"`);
    next = next.replace(heightMatch[0], `height="${nextHeight}"`);
    return next;
  }
  return svg;
}

/**
 * @param {string} svg
 */
function inlineSvgStyles(svg) {
  const styleMatch = svg.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  if (!styleMatch) return svg;
  const style = styleMatch[1];
  if (!style.trim()) return svg;
  let output = svg.replace(styleMatch[0], '');
  output = output.replace(/class="([^"]+)"/g, (full, classNames) => {
    const rules = classNames
      .split(/\s+/)
      .map(/** @param {string} cls */ (cls) => extractCssRule(style, cls))
      .filter(Boolean)
      .join(' ');
    if (!rules) return full;
    return `style="${rules}"`;
  });
  return output;
}

/**
 * @param {string} svg
 */
function minifySvg(svg) {
  return svg
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * @param {string} css
 * @param {string} className
 */
function extractCssRule(css, className) {
  const regex = new RegExp(`\\\\.${className}\\\\s*\\\\{([^}]+)\\\\}`, 'g');
  let match = regex.exec(css);
  if (!match) return '';
  return match[1].trim().replace(/\\s+/g, ' ');
}

async function copySource() {
  const text = editor.value.trim();
  if (!text) {
    showToast('Nothing to copy yet.');
    return;
  }
  try {
    await writeClipboardText(text);
    showToast('Mermaid source copied.');
  } catch {
    showToast('Copy failed.');
  }
}

function downloadSource() {
  const text = editor.value.trim();
  if (!text) {
    showToast('Nothing to download yet.');
    return;
  }
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, 'diagram.mmd');
}

async function copySvg() {
  if (!lastSvg) {
    showToast('Render a diagram first.');
    return;
  }
  const base = applySvgScale(lastSvg, Number(exportSvgScaleSelect.value) || 1);
  const scaled = applySvgWidth(base, resolveExportWidth());
  let output = exportSvgInlineToggle.checked ? inlineSvgStyles(scaled) : scaled;
  if (exportSvgMinifyToggle.checked) {
    output = minifySvg(output);
  }
  try {
    await writeClipboardText(output);
    showToast('SVG copied.');
    addExportHistory('Copy SVG', output.length);
  } catch {
    showToast('Copy failed.');
  }
}

async function copyPng() {
  if (!lastSvg) {
    showToast('Render a diagram first.');
    return;
  }
  if (!navigator.clipboard || typeof window.ClipboardItem === 'undefined') {
    showToast('Clipboard image copy not supported.');
    return;
  }
  try {
    const blob = await createPngBlob();
    if (!blob) {
      showToast('Copy failed.');
      return;
    }
    const item = new ClipboardItem({ 'image/png': blob });
    await navigator.clipboard.write([item]);
    showToast('PNG copied.');
    addExportHistory('Copy PNG', blob.size);
  } catch {
    showToast('Copy failed.');
  }
}

function createPngBlob() {
  return new Promise((resolve, reject) => {
    const svgBlob = new Blob([lastSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Number(exportScaleSelect.value) || 1;
      const targetWidth = resolveExportWidth();
      const width = targetWidth ? targetWidth : img.width * scale;
      const ratio = img.height / img.width || 1;
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(width * ratio));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas unavailable'));
        return;
      }
      if (!exportTransparentToggle.checked) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        resolve(blob || null);
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };
    img.src = url;
  });
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

/**
 * @param {string} code
 */
function isTooLargeForRender(code) {
  const lines = code.split('\n').length;
  return code.length > RENDER_LIMITS.maxChars || lines > RENDER_LIMITS.maxLines;
}

/**
 * @param {string} before
 * @param {string} after
 */
function isTooLargeForDiff(before, after) {
  const total = before.length + after.length;
  const lines = before.split('\n').length + after.split('\n').length;
  return total > DIFF_LIMITS.maxChars || lines > DIFF_LIMITS.maxLines;
}

function init() {
  const rawPrefs = localStorage.getItem(EXPORT_PREFS_KEY);
  if (rawPrefs) {
    try {
      const prefs = JSON.parse(rawPrefs);
      if (prefs && typeof prefs === 'object') {
        applyExportPrefs(prefs);
      }
    } catch {
      localStorage.removeItem(EXPORT_PREFS_KEY);
    }
  }
  resolveExportWidth();
  loadPresetOptions();
  renderExportHistory();

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
  if (decoded) {
    editor.value = decoded;
  } else {
    const draft = loadDraft();
    const now = Date.now();
    const maxAgeMs = 1000 * 60 * 60 * 24 * 7;
    if (draft && now - draft.updatedAt <= maxAgeMs) {
      editor.value = draft.diagram;
      lastDraftSavedAt = draft.updatedAt;
      queueMicrotask(() => showToast('Restored last draft.'));
    } else {
      editor.value = DEFAULT_DIAGRAM.trim();
    }
  }

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
copySourceBtn.addEventListener('click', copySource);
copySvgBtn.addEventListener('click', copySvg);
copyPngBtn.addEventListener('click', copyPng);
renderNowBtn.addEventListener('click', () => renderMermaid(true));

document.querySelectorAll('[data-action]').forEach((button) => {
  if (!(button instanceof HTMLButtonElement)) return;
  const action = button.dataset.action;
  if (action === 'export-svg') button.addEventListener('click', exportSvg);
  if (action === 'export-png') button.addEventListener('click', exportPng);
  if (action === 'copy-svg') button.addEventListener('click', copySvg);
  if (action === 'copy-png') button.addEventListener('click', copyPng);
});

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
downloadSourceBtn.addEventListener('click', downloadSource);

function persistExportPrefs() {
  const prefs = collectExportPrefs();
  localStorage.setItem(EXPORT_PREFS_KEY, JSON.stringify(prefs));
  updateExportSummary();
}

exportScaleSelect.addEventListener('change', persistExportPrefs);
exportWidthSelect.addEventListener('change', persistExportPrefs);
exportWidthCustomInput.addEventListener('input', persistExportPrefs);
exportTransparentToggle.addEventListener('change', persistExportPrefs);
exportSvgScaleSelect.addEventListener('change', persistExportPrefs);
exportSvgInlineToggle.addEventListener('change', persistExportPrefs);
exportSvgMinifyToggle.addEventListener('change', persistExportPrefs);
exportPresetSelect.addEventListener('change', () => {
  if (exportPresetSelect.value === 'default') {
    const rawPrefs = localStorage.getItem(EXPORT_PREFS_KEY);
    if (rawPrefs) {
      try {
        applyExportPrefs(JSON.parse(rawPrefs));
      } catch {
        return;
      }
    }
    return;
  }
  const presets = loadExportPresets();
  applyExportPrefs(presets[exportPresetSelect.value]);
});
savePresetBtn.addEventListener('click', saveCurrentPreset);
deletePresetBtn.addEventListener('click', deleteCurrentPreset);

restoreDraftBtn.addEventListener('click', () => {
  const draft = loadDraft();
  if (!draft) {
    showToast('No draft found.');
    return;
  }
  if (!confirm('Restore the last draft? This will replace the editor content.')) return;
  editor.value = draft.diagram;
  lastDraftSavedAt = draft.updatedAt;
  scheduleRender();
  showToast('Draft restored.');
});

clearDraftBtn.addEventListener('click', () => {
  if (!confirm('Clear the saved draft?')) return;
  clearDraft();
  lastDraftSavedAt = null;
  updateStats();
  showToast('Draft cleared.');
});

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
