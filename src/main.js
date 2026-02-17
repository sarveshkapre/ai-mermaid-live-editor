import { diffLines, summarizeLargeDiff } from './lib/diff.js';
import { clearDraft, loadDraft, saveDraft } from './lib/draft.js';
import { addSnapshot, clearHistory, loadHistory } from './lib/history.js';
import { decodeHash, encodeHash } from './lib/hash.js';
import { buildPatchMessages, extractMermaidFromText, extractTextFromProviderResponse } from './lib/ai-patch.js';
import { extractChatDelta, extractResponsesDelta, extractUsage } from './lib/ai-stream.js';
import { lintMermaid } from './lib/mermaid-lint.js';
import { errorToMessage, extractMermaidErrorLine } from './lib/mermaid-error.js';
import { loadMermaid } from './lib/mermaid-loader.js';
import { createSseParser } from './lib/sse.js';
import { normalizeTabsState } from './lib/tabs.js';

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

const TEMPLATE_LIBRARY = [
  {
    id: 'product-launch',
    title: 'Product launch plan',
    category: 'Product',
    summary: 'Align scope, readiness, and rollout milestones.',
    diagram: `flowchart LR
  idea([Idea]) --> discovery[Discovery]
  discovery --> spec[Spec + PRD]
  spec --> build[Build]
  build --> review{Launch review}
  review -->|go| launch[Launch]
  review -->|hold| iterate[Iterate]
  iterate --> build
  launch --> measure[Measure impact]
`,
  },
  {
    id: 'user-onboarding',
    title: 'User onboarding funnel',
    category: 'Growth',
    summary: 'Track activation steps and drop-offs.',
    diagram: `flowchart TD
  visit[Landing page] --> signup[Signup]
  signup --> verify[Verify email]
  verify --> tour[Product tour]
  tour --> activate[First success]
  activate --> retain[Weekly habit]
  tour --> dropoff[Drop-off]
`,
  },
  {
    id: 'system-architecture',
    title: 'System architecture',
    category: 'Engineering',
    summary: 'Show services, data stores, and boundaries.',
    diagram: `flowchart LR
  subgraph Client
    web[Web app]
    mobile[Mobile app]
  end
  subgraph Services
    api[API gateway]
    auth[Auth service]
    worker[Async worker]
  end
  web --> api
  mobile --> api
  api --> auth
  api --> worker
  worker --> db[(Postgres)]
  auth --> db
`,
  },
  {
    id: 'incident-response',
    title: 'Incident response',
    category: 'Operations',
    summary: 'Coordinate detection, mitigation, and follow-up.',
    diagram: `flowchart TD
  alert[Alert fired] --> triage[On-call triage]
  triage --> severity{Severity?}
  severity -->|SEV-1| warroom[Open war room]
  severity -->|SEV-2| mitigate[Mitigate]
  warroom --> mitigate
  mitigate --> update[Stakeholder updates]
  update --> resolve[Resolve + RCA]
`,
  },
  {
    id: 'api-sequence',
    title: 'API request sequence',
    category: 'Engineering',
    summary: 'Document a critical request path.',
    diagram: `sequenceDiagram
  participant User
  participant App
  participant API
  participant DB
  User->>App: Trigger action
  App->>API: POST /resource
  API->>DB: Write record
  DB-->>API: Success
  API-->>App: 201 Created
  App-->>User: Confirmation
`,
  },
  {
    id: 'experiment-lifecycle',
    title: 'Experiment lifecycle',
    category: 'Research',
    summary: 'Track hypothesis, rollout, and learnings.',
    diagram: `stateDiagram-v2
  [*] --> Ideation
  Ideation --> Design: Validate problem
  Design --> Build: Spec approved
  Build --> Review: QA complete
  Review --> Launch: Go/no-go
  Review --> Build: Fixes
  Launch --> [*]
`,
  },
  {
    id: 'customer-journey',
    title: 'Customer journey',
    category: 'Growth',
    summary: 'Map touchpoints and experience scores.',
    diagram: `journey
  title Customer journey
  section Discover
    See landing page: 5: User
    Read case study: 4: User
  section Evaluate
    Request demo: 3: User
    Security review: 2: User
  section Adopt
    Trial kickoff: 4: User
    Team rollout: 5: User
`,
  },
  {
    id: 'release-checklist',
    title: 'Release checklist',
    category: 'Operations',
    summary: 'Ensure quality gates before launch.',
    diagram: `flowchart LR
  plan[Release plan] --> qa[QA pass]
  qa --> security[Security review]
  security --> docs[Docs update]
  docs --> comms[Customer comms]
  comms --> deploy[Deploy]
  deploy --> monitor[Monitor]
`,
  },
];

const PROMPT_RECIPES = [
  {
    id: 'swimlanes',
    title: 'Convert to swimlanes',
    prompt: 'Reorganize this diagram into swimlanes by team (Product, Engineering, Ops). Keep approvals explicit.',
  },
  {
    id: 'simplify',
    title: 'Simplify labels',
    prompt: 'Shorten node labels to 2–4 words while preserving meaning.',
  },
  {
    id: 'failure',
    title: 'Add failure handling',
    prompt: 'Add failure paths and retries for each critical step.',
  },
  {
    id: 'metrics',
    title: 'Add KPIs',
    prompt: 'Annotate key steps with KPIs like conversion, latency, or error rate.',
  },
  {
    id: 'sequence',
    title: 'Rewrite as sequence',
    prompt: 'Rewrite this flow as a sequence diagram showing the main request path.',
  },
  {
    id: 'handoffs',
    title: 'Highlight handoffs',
    prompt: 'Emphasize handoffs between teams with explicit approval checkpoints.',
  },
];

/**
 * @typedef {{id: string, title: string, diagram: string, createdAt: number, updatedAt: number, tags: string[]}} DiagramTab
 */

/**
 * @typedef {{id: string, title: string, category: string, summary: string, diagram: string}} DiagramTemplate
 */

/**
 * @typedef {{title: string, audience: string, owner: string, purpose: string, useFilenames: boolean}} ProjectPayload
 */

/**
 * @typedef {{diagram: string, tabTitle: string, project: unknown}} SnapshotPayload
 */

/**
 * @typedef {{id: string, label: string, bytes: number, createdAt: number}} ExportHistoryItem
 */

/**
 * @typedef {{
 *   id: string,
 *   severity: 'error' | 'warning',
 *   title: string,
 *   message: string,
 *   line: number | null,
 *   hasFix: boolean
 * }} MermaidLintIssue
 */

/**
 * @typedef {{issues: MermaidLintIssue[], fixedCode: string, hasFixes: boolean}} MermaidLintResult
 */

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
const previewContent = byId('preview-content');
/** @type {HTMLDivElement} */
const renderStatus = byId('render-status');
/** @type {HTMLButtonElement} */
const renderNowBtn = byId('render-now');
/** @type {HTMLButtonElement} */
const jumpErrorBtn = byId('jump-error');
/** @type {HTMLButtonElement} */
const focusToggle = byId('focus-toggle');
/** @type {HTMLButtonElement} */
const zoomOutBtn = byId('zoom-out');
/** @type {HTMLButtonElement} */
const zoomInBtn = byId('zoom-in');
/** @type {HTMLButtonElement} */
const zoomResetBtn = byId('zoom-reset');
/** @type {HTMLSpanElement} */
const zoomLabel = byId('zoom-label');
/** @type {HTMLDivElement} */
const stats = byId('stats');
/** @type {HTMLTextAreaElement} */
const instructions = byId('instructions');
/** @type {HTMLTextAreaElement} */
const proposal = byId('proposal');
/** @type {HTMLButtonElement} */
const generatePatchBtn = byId('generate-patch');
/** @type {HTMLInputElement} */
const aiApiBaseInput = byId('ai-api-base');
/** @type {HTMLInputElement} */
const aiModelInput = byId('ai-model');
/** @type {HTMLSelectElement} */
const aiApiModeSelect = byId('ai-api-mode');
/** @type {HTMLInputElement} */
const aiTemperatureInput = byId('ai-temperature');
/** @type {HTMLInputElement} */
const aiMaxTokensInput = byId('ai-max-tokens');
/** @type {HTMLInputElement} */
const aiTimeoutInput = byId('ai-timeout');
/** @type {HTMLInputElement} */
const aiApiKeyInput = byId('ai-api-key');
/** @type {HTMLInputElement} */
const aiRememberKeyToggle = byId('ai-remember-key');
/** @type {HTMLDivElement} */
const aiStatus = byId('ai-status');
/** @type {HTMLDivElement} */
const aiUsage = byId('ai-usage');
/** @type {HTMLButtonElement} */
const cancelGeneratePatchBtn = byId('cancel-generate-patch');
/** @type {HTMLDivElement} */
const patchUndoRow = byId('patch-undo');
/** @type {HTMLButtonElement} */
const undoPatchBtn = byId('undo-patch');
/** @type {HTMLDivElement} */
const diffEl = byId('diff');
/** @type {HTMLDivElement} */
const timelineEl = byId('timeline');
/** @type {HTMLButtonElement} */
const themeToggle = byId('theme-toggle');
/** @type {HTMLButtonElement} */
const copyLink = byId('copy-link');
/** @type {HTMLButtonElement} */
const copyLinkNewTab = byId('copy-link-newtab');
/** @type {HTMLButtonElement} */
const helpBtn = byId('help');
/** @type {HTMLDialogElement} */
const shortcutsDialog = byId('shortcuts-dialog');
/** @type {HTMLButtonElement} */
const shortcutsClose = byId('shortcuts-close');
/** @type {HTMLDialogElement} */
const importUrlDialog = byId('import-url-dialog');
/** @type {HTMLButtonElement} */
const importUrlClose = byId('import-url-close');
/** @type {HTMLTextAreaElement} */
const importUrlInputEl = byId('import-url-input');
/** @type {HTMLButtonElement} */
const importUrlSubmit = byId('import-url-submit');
/** @type {HTMLButtonElement} */
const importUrlCancel = byId('import-url-cancel');
/** @type {HTMLButtonElement} */
const presentationModeBtn = byId('presentation-mode');
/** @type {HTMLDialogElement} */
const presentationDialog = byId('presentation-dialog');
/** @type {HTMLButtonElement} */
const presentationClose = byId('presentation-close');
/** @type {HTMLButtonElement} */
const presentationPrev = byId('presentation-prev');
/** @type {HTMLButtonElement} */
const presentationNext = byId('presentation-next');
/** @type {HTMLButtonElement} */
const presentationFullscreen = byId('presentation-fullscreen');
/** @type {HTMLDivElement} */
const presentationMeta = byId('presentation-meta');
/** @type {HTMLDivElement} */
const presentationStatus = byId('presentation-status');
/** @type {HTMLDivElement} */
const presentationContent = byId('presentation-content');
/** @type {HTMLDivElement} */
const toast = byId('toast');
/** @type {HTMLDivElement} */
const templateGrid = byId('template-grid');
/** @type {HTMLInputElement} */
const templateSearch = byId('template-search');
/** @type {HTMLDivElement} */
const templateFilters = byId('template-filters');
/** @type {HTMLDivElement} */
const templateEmpty = byId('template-empty');
/** @type {HTMLButtonElement} */
const saveTemplateBtn = byId('save-template');
/** @type {HTMLButtonElement} */
const exportTemplatesBtn = byId('export-templates');
/** @type {HTMLButtonElement} */
const importTemplatesBtn = byId('import-templates-btn');
/** @type {HTMLInputElement} */
const importTemplatesInput = byId('import-templates-input');
/** @type {HTMLDivElement} */
const promptRecipes = byId('prompt-recipes');
/** @type {HTMLDivElement} */
const tabList = byId('tab-list');
/** @type {HTMLInputElement} */
const tabSearchInput = byId('tab-search');
/** @type {HTMLInputElement} */
const tabTagsInput = byId('tab-tags');
/** @type {HTMLButtonElement} */
const saveTabTagsBtn = byId('save-tab-tags');
/** @type {HTMLButtonElement} */
const addTabBtn = byId('add-tab');
/** @type {HTMLButtonElement} */
const duplicateTabBtn = byId('duplicate-tab');
/** @type {HTMLButtonElement} */
const renameTabBtn = byId('rename-tab');
/** @type {HTMLButtonElement} */
const deleteTabBtn = byId('delete-tab');
/** @type {HTMLInputElement} */
const projectTitleInput = byId('project-title');
/** @type {HTMLInputElement} */
const projectAudienceInput = byId('project-audience');
/** @type {HTMLInputElement} */
const projectOwnerInput = byId('project-owner');
/** @type {HTMLTextAreaElement} */
const projectPurposeInput = byId('project-purpose');
/** @type {HTMLInputElement} */
const useFilenamesToggle = byId('use-filenames');
/** @type {HTMLButtonElement} */
const copySnapshotBtn = byId('copy-snapshot');
/** @type {HTMLButtonElement} */
const copySnapshotImportBtn = byId('copy-snapshot-import');
/** @type {HTMLButtonElement} */
const downloadBundleBtn = byId('download-bundle');
/** @type {HTMLDivElement} */
const healthEl = byId('health');
/** @type {HTMLButtonElement} */
const lintMermaidBtn = byId('lint-mermaid');
/** @type {HTMLButtonElement} */
const lintStageFixesBtn = byId('lint-stage-fixes');
/** @type {HTMLDivElement} */
const lintStatus = byId('lint-status');
/** @type {HTMLDivElement} */
const lintIssues = byId('lint-issues');
/** @type {HTMLDivElement} */
const readonlyBanner = byId('readonly-banner');

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
const exportPdfBtn = byId('export-pdf');
/** @type {HTMLButtonElement} */
const formatMermaidBtn = byId('format-mermaid');
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
/** @type {HTMLButtonElement} */
const downloadExportHistoryBtn = byId('download-export-history');
/** @type {HTMLButtonElement} */
const importFileBtn = byId('import-file-btn');
/** @type {HTMLButtonElement} */
const importUrlBtn = byId('import-url-btn');
/** @type {HTMLInputElement} */
const importFileInput = byId('import-file');
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
/** @type {HTMLSelectElement} */
const pdfPageSelect = byId('pdf-page');
/** @type {HTMLSelectElement} */
const pdfOrientationSelect = byId('pdf-orientation');
/** @type {HTMLSelectElement} */
const pdfMarginSelect = byId('pdf-margin');
/** @type {HTMLInputElement} */
const pdfWhiteBgToggle = byId('pdf-white-bg');
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
/** @type {HTMLElement | null} */
let lastFocusedBeforeImportDialog = null;
/** @type {HTMLElement | null} */
let lastFocusedBeforePresentationDialog = null;
/** @type {number | null} */
let lastDraftSavedAt = null;
/** @type {number} */
let previewScale = 1;
/** @type {string | null} */
let activeTemplateId = null;
/** @type {string} */
let activeTemplateFilter = 'All';
/** @type {string} */
let templateQuery = '';
/** @type {DiagramTemplate[]} */
let customTemplates = [];
/** @type {string | null} */
let activeTabId = null;
/** @type {DiagramTab[]} */
let tabs = [];
/** @type {string} */
let tabQuery = '';
/** @type {number | null} */
let lastErrorLine = null;
/** @type {number} */
let renderSeq = 0;
/** @type {MermaidLintResult | null} */
let lastLintResult = null;
let isReadOnly = false;
/** @type {string | null} */
let lastPatchRestoreId = null;
/** @type {AbortController | null} */
let aiRequestController = null;
/** @type {number | null} */
let aiRequestTimeout = null;
/** @type {((value: string | null) => void) | null} */
let importUrlResolver = null;
/** @type {Array<{id:string, message:string, diagram:string, createdAt:number}>} */
let presentationItems = [];
/** @type {number} */
let presentationIndex = 0;
/** @type {number} */
let presentationRenderSeq = 0;
const TABS_KEY = 'ai-mermaid-tabs';
const ACTIVE_TAB_KEY = 'ai-mermaid-tabs-active';
const TEMPLATE_ACTIVE_KEY = 'ai-mermaid-template-active';
const TEMPLATE_LIBRARY_KEY = 'ai-mermaid-template-library';
const PROJECT_KEY = 'ai-mermaid-project';
const SHARE_SNAPSHOT_KEY = 'snap:';
const PREVIEW_SCALE_KEY = 'ai-mermaid-preview-scale';
const EXPORT_PREFS_KEY = 'ai-mermaid-export-prefs';
const EXPORT_PRESET_KEY = 'ai-mermaid-export-presets';
const EXPORT_HISTORY_KEY = 'ai-mermaid-export-history';
const AI_SETTINGS_KEY = 'ai-mermaid-ai-settings';
const AI_KEY_SESSION = 'ai-mermaid-ai-key-session';
const AI_KEY_PERSIST = 'ai-mermaid-ai-key-persist';
const DIFF_LIMITS = { maxChars: 15000, maxLines: 800 };
const RENDER_LIMITS = { maxChars: 20000, maxLines: 1000 };
const IMPORT_LIMITS = { maxBytes: 250_000 };

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

/**
 * @param {string} text
 */
function encodeBase64Url(text) {
  const encoded = btoa(unescape(encodeURIComponent(text)));
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * @param {string} encoded
 */
function decodeBase64Url(encoded) {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  const base64 = padded + '='.repeat(padLength);
  try {
    return decodeURIComponent(escape(atob(base64)));
  } catch {
    return null;
  }
}

/**
 * @param {unknown} payload
 */
function encodeSnapshot(payload) {
  return `${SHARE_SNAPSHOT_KEY}${encodeBase64Url(JSON.stringify(payload))}`;
}

/**
 * @param {string} hash
 * @returns {unknown | null}
 */
function decodeSnapshot(hash) {
  if (!hash.startsWith(SHARE_SNAPSHOT_KEY)) return null;
  const decoded = decodeBase64Url(hash.slice(SHARE_SNAPSHOT_KEY.length));
  if (!decoded) return null;
  try {
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * @param {string} title
 * @param {string} message
 */
function setPreviewMessage(title, message) {
  previewContent.innerHTML = `
    <div class="empty-state">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

/**
 * @returns {ProjectPayload | null}
 */
function loadProject() {
  const raw = localStorage.getItem(PROJECT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const data = /** @type {Record<string, unknown>} */ (parsed);
    return {
      title: typeof data.title === 'string' ? data.title : '',
      audience: typeof data.audience === 'string' ? data.audience : '',
      owner: typeof data.owner === 'string' ? data.owner : '',
      purpose: typeof data.purpose === 'string' ? data.purpose : '',
      useFilenames: typeof data.useFilenames === 'boolean' ? data.useFilenames : false,
    };
  } catch {
    return null;
  }
}

/**
 * @param {ProjectPayload} payload
 */
function saveProject(payload) {
  localStorage.setItem(PROJECT_KEY, JSON.stringify(payload));
}

/**
 * @returns {ProjectPayload}
 */
function getProjectPayload() {
  return {
    title: projectTitleInput.value.trim(),
    audience: projectAudienceInput.value.trim(),
    owner: projectOwnerInput.value.trim(),
    purpose: projectPurposeInput.value.trim(),
    useFilenames: useFilenamesToggle.checked,
  };
}

/**
 * @typedef {{apiBase: string, model: string, mode: 'chat' | 'responses', rememberKey: boolean, temperature: number | null, maxTokens: number | null, timeoutSec: number}} AiSettings
 */

/**
 * @returns {AiSettings}
 */
function loadAiSettings() {
  /** @type {AiSettings} */
  const defaults = {
    apiBase: '',
    model: '',
    mode: 'chat',
    rememberKey: false,
    temperature: null,
    maxTokens: null,
    timeoutSec: 45,
  };
  const raw = localStorage.getItem(AI_SETTINGS_KEY);
  if (!raw) return defaults;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaults;
    const data = /** @type {Record<string, unknown>} */ (parsed);
    const apiBase = typeof data.apiBase === 'string' ? data.apiBase : defaults.apiBase;
    const model = typeof data.model === 'string' ? data.model : defaults.model;
    const mode = data.mode === 'responses' ? 'responses' : 'chat';
    const rememberKey = typeof data.rememberKey === 'boolean' ? data.rememberKey : defaults.rememberKey;
    const temperatureInput =
      typeof data.temperature === 'number' && Number.isFinite(data.temperature) ? data.temperature : null;
    const temperature =
      temperatureInput === null ? null : Math.min(2, Math.max(0, temperatureInput));
    const maxTokensInput = typeof data.maxTokens === 'number' && Number.isFinite(data.maxTokens) ? data.maxTokens : null;
    const maxTokens = maxTokensInput && maxTokensInput > 0 ? Math.floor(maxTokensInput) : null;
    const timeoutInput =
      typeof data.timeoutSec === 'number' && Number.isFinite(data.timeoutSec) ? data.timeoutSec : defaults.timeoutSec;
    const timeoutSec = Math.min(180, Math.max(5, Math.floor(timeoutInput)));
    return { apiBase, model, mode, rememberKey, temperature, maxTokens, timeoutSec };
  } catch {
    return defaults;
  }
}

/**
 * @param {AiSettings} settings
 */
function saveAiSettings(settings) {
  localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings));
}

/**
 * @param {boolean} remember
 */
function loadAiKey(remember) {
  const key = remember ? AI_KEY_PERSIST : AI_KEY_SESSION;
  const storage = remember ? localStorage : sessionStorage;
  try {
    return storage.getItem(key) || '';
  } catch {
    return '';
  }
}

/**
 * @param {string} apiKey
 * @param {boolean} remember
 */
function saveAiKey(apiKey, remember) {
  const trimmed = apiKey.trim();
  try {
    if (remember) {
      localStorage.setItem(AI_KEY_PERSIST, trimmed);
      sessionStorage.removeItem(AI_KEY_SESSION);
    } else {
      sessionStorage.setItem(AI_KEY_SESSION, trimmed);
      localStorage.removeItem(AI_KEY_PERSIST);
    }
  } catch {
    // Ignore storage failures (e.g. disabled localStorage).
  }
}

/**
 * @param {string} message
 */
function setAiStatus(message) {
  aiStatus.textContent = message;
}

/**
 * @param {unknown | null} usage
 */
function setAiUsage(usage) {
  if (!usage) {
    aiUsage.textContent = '';
    return;
  }
  if (!usage || typeof usage !== 'object') {
    aiUsage.textContent = '';
    return;
  }
  const u = /** @type {Record<string, unknown>} */ (usage);
  const promptTokens = typeof u.prompt_tokens === 'number' ? u.prompt_tokens : null;
  const completionTokens = typeof u.completion_tokens === 'number' ? u.completion_tokens : null;
  const totalTokens = typeof u.total_tokens === 'number' ? u.total_tokens : null;
  const inputTokens = typeof u.input_tokens === 'number' ? u.input_tokens : null;
  const outputTokens = typeof u.output_tokens === 'number' ? u.output_tokens : null;
  const total =
    typeof totalTokens === 'number'
      ? totalTokens
      : typeof u.total === 'number'
        ? /** @type {number} */ (u.total)
        : inputTokens !== null && outputTokens !== null
          ? inputTokens + outputTokens
          : promptTokens !== null && completionTokens !== null
            ? promptTokens + completionTokens
            : null;

  const inTok = inputTokens !== null ? inputTokens : promptTokens;
  const outTok = outputTokens !== null ? outputTokens : completionTokens;
  const parts = [];
  if (typeof inTok === 'number') parts.push(`in ${inTok}`);
  if (typeof outTok === 'number') parts.push(`out ${outTok}`);
  if (typeof total === 'number') parts.push(`total ${total}`);

  aiUsage.textContent = parts.length ? `Usage: ${parts.join(' / ')} tokens` : 'Usage metadata received.';
}

/**
 * @param {string} apiBase
 */
function normalizeApiBase(apiBase) {
  return apiBase.trim().replace(/\/+$/, '');
}

/**
 * @returns {AiSettings}
 */
function getAiSettingsFromForm() {
  const mode = aiApiModeSelect.value === 'responses' ? 'responses' : 'chat';
  const temperatureRaw = aiTemperatureInput.value.trim();
  const temperatureValue = temperatureRaw ? Number(temperatureRaw) : null;
  const temperature =
    temperatureValue !== null && Number.isFinite(temperatureValue) ? Math.min(2, Math.max(0, temperatureValue)) : null;
  const maxTokensRaw = aiMaxTokensInput.value.trim();
  const maxTokensValue = maxTokensRaw ? Number(maxTokensRaw) : null;
  const maxTokens =
    maxTokensValue !== null && Number.isFinite(maxTokensValue) && maxTokensValue > 0 ? Math.floor(maxTokensValue) : null;
  const timeoutRaw = aiTimeoutInput.value.trim();
  const timeoutValue = timeoutRaw ? Number(timeoutRaw) : 45;
  const timeoutSec = Number.isFinite(timeoutValue) ? Math.min(180, Math.max(5, Math.floor(timeoutValue))) : 45;
  return {
    apiBase: aiApiBaseInput.value.trim(),
    model: aiModelInput.value.trim(),
    mode,
    rememberKey: aiRememberKeyToggle.checked,
    temperature,
    maxTokens,
    timeoutSec,
  };
}

/**
 * @param {AiSettings} settings
 */
function applyAiSettingsToForm(settings) {
  aiApiBaseInput.value = settings.apiBase || '';
  aiModelInput.value = settings.model || 'gpt-4.1';
  aiApiModeSelect.value = settings.mode || 'chat';
  aiTemperatureInput.value = typeof settings.temperature === 'number' ? String(settings.temperature) : '';
  aiMaxTokensInput.value = typeof settings.maxTokens === 'number' ? String(settings.maxTokens) : '';
  aiTimeoutInput.value = String(settings.timeoutSec || 45);
  aiRememberKeyToggle.checked = Boolean(settings.rememberKey);
  aiApiKeyInput.value = loadAiKey(aiRememberKeyToggle.checked);
}

function persistAiSettingsFromForm() {
  const settings = getAiSettingsFromForm();
  saveAiSettings(settings);
  saveAiKey(aiApiKeyInput.value, settings.rememberKey);
}

/**
 * @param {unknown} payload
 */
function applyProjectPayload(payload) {
  if (!payload || typeof payload !== 'object') return;
  const data = /** @type {Record<string, unknown>} */ (payload);
  if (typeof data.title === 'string') projectTitleInput.value = data.title;
  if (typeof data.audience === 'string') projectAudienceInput.value = data.audience;
  if (typeof data.owner === 'string') projectOwnerInput.value = data.owner;
  if (typeof data.purpose === 'string') projectPurposeInput.value = data.purpose;
  if (typeof data.useFilenames === 'boolean') useFilenamesToggle.checked = data.useFilenames;
}

/**
 * @returns {DiagramTemplate[]}
 */
function loadCustomTemplates() {
  const raw = localStorage.getItem(TEMPLATE_LIBRARY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const data = /** @type {Record<string, unknown>} */ (item);
        const id = typeof data.id === 'string' ? data.id.trim() : '';
        const title = typeof data.title === 'string' ? data.title.trim() : '';
        const summary = typeof data.summary === 'string' ? data.summary.trim() : '';
        const diagram = typeof data.diagram === 'string' ? data.diagram : '';
        if (!id || !title || !diagram.trim()) return null;
        /** @type {DiagramTemplate} */
        const template = {
          id,
          title: title.slice(0, 50),
          category: 'Custom',
          summary: summary || 'Saved from your current diagram.',
          diagram,
        };
        return template;
      })
      .filter((item) => Boolean(item));
  } catch {
    return [];
  }
}

function saveCustomTemplates() {
  const payload = customTemplates.map((template) => ({
    id: template.id,
    title: template.title,
    summary: template.summary,
    diagram: template.diagram,
  }));
  localStorage.setItem(TEMPLATE_LIBRARY_KEY, JSON.stringify(payload));
}

/**
 * @returns {DiagramTemplate[]}
 */
function getTemplateLibrary() {
  return [...TEMPLATE_LIBRARY, ...customTemplates];
}

function exportCustomTemplates() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    templates: customTemplates.map((template) => ({
      id: template.id,
      title: template.title,
      summary: template.summary,
      diagram: template.diagram,
    })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `mermaid-custom-templates-${new Date().toISOString().slice(0, 10)}.json`);
  showToast(`Exported ${customTemplates.length} custom template${customTemplates.length === 1 ? '' : 's'}.`);
}

/**
 * @param {string} text
 * @returns {number}
 */
function importCustomTemplatesFromJson(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object') return 0;
  const data = /** @type {Record<string, unknown>} */ (parsed);
  const templatesInput = Array.isArray(data.templates) ? data.templates : [];
  let added = 0;
  templatesInput.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const row = /** @type {Record<string, unknown>} */ (item);
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    const summary = typeof row.summary === 'string' ? row.summary.trim() : '';
    const diagram = typeof row.diagram === 'string' ? row.diagram.trim() : '';
    if (!title || !diagram) return;
    const exists = customTemplates.some((template) => template.title.toLowerCase() === title.toLowerCase());
    if (exists) return;
    customTemplates.push({
      id: `custom-${crypto.randomUUID()}`,
      title: title.slice(0, 50),
      category: 'Custom',
      summary: summary || 'Imported template.',
      diagram,
    });
    added += 1;
  });
  if (added) {
    customTemplates = customTemplates.slice(-40);
    saveCustomTemplates();
    renderTemplateFilters();
    renderTemplates();
  }
  return added;
}

/**
 * @param {unknown} payload
 * @returns {SnapshotPayload | null}
 */
function normalizeSnapshotPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const data = /** @type {Record<string, unknown>} */ (payload);
  return {
    diagram: typeof data.diagram === 'string' ? data.diagram : '',
    tabTitle: typeof data.tabTitle === 'string' && data.tabTitle.trim() ? data.tabTitle : 'Snapshot',
    project: data.project,
  };
}

/**
 * @param {string} value
 */
function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

/**
 * @returns {DiagramTab | null}
 */
function getActiveTab() {
  return tabs.find((tab) => tab.id === activeTabId) || null;
}

function getExportBaseName() {
  const project = projectTitleInput.value.trim();
  const tab = getActiveTab()?.title || 'diagram';
  if (!useFilenamesToggle.checked) return 'diagram';
  const parts = [project, tab].filter(Boolean).map(slugify).filter(Boolean);
  return parts.length ? parts.join('_') : 'diagram';
}

/**
 * @param {string} filename
 */
function tabTitleFromFilename(filename) {
  const trimmed = filename.trim();
  if (!trimmed) return 'Imported diagram';
  const base = trimmed.replace(/\.[^.]+$/, '');
  const cleaned = base.trim().slice(0, 40);
  return cleaned || 'Imported diagram';
}

/**
 * @param {string} title
 * @param {string} diagram
 */
function addImportedTab(title, diagram) {
  const now = Date.now();
  const nextDiagram = diagram.trim() || DEFAULT_DIAGRAM.trim();
  const newTab = {
    id: crypto.randomUUID(),
    title: title.trim().slice(0, 40) || `Diagram ${tabs.length + 1}`,
    diagram: nextDiagram,
    createdAt: now,
    updatedAt: now,
    tags: [],
  };
  tabs.push(newTab);
  setActiveTab(newTab.id);
  renderTabs();
  showToast(`Imported "${newTab.title}".`);
}

async function importMermaidFromFile() {
  if (isReadOnly) return;
  const file = importFileInput.files && importFileInput.files[0] ? importFileInput.files[0] : null;
  if (!file) return;
  importFileInput.value = '';

  if (file.size > IMPORT_LIMITS.maxBytes) {
    showToast(`File too large to import (max ${Math.round(IMPORT_LIMITS.maxBytes / 1000)}kB).`);
    return;
  }

  try {
    const text = await file.text();
    addImportedTab(tabTitleFromFilename(file.name), text);
  } catch {
    showToast('Import failed. Could not read file.');
  }
}

/**
 * @param {string} text
 * @returns {number}
 */
function utf8ByteLength(text) {
  return new TextEncoder().encode(text).length;
}

/**
 * @param {unknown} payload
 * @returns {boolean}
 */
function isEmptyProjectPayload(payload) {
  if (!payload || typeof payload !== 'object') return true;
  const data = /** @type {Record<string, unknown>} */ (payload);
  const fields = ['title', 'audience', 'owner', 'purpose'];
  return fields.every((key) => typeof data[key] !== 'string' || !data[key].trim());
}

function isProjectFormEmpty() {
  return (
    !projectTitleInput.value.trim() &&
    !projectAudienceInput.value.trim() &&
    !projectOwnerInput.value.trim() &&
    !projectPurposeInput.value.trim()
  );
}

/**
 * @typedef {{title: string, diagram: string, project: unknown | null}} ImportFromUrlResult
 */

/**
 * @param {string} input
 * @returns {Promise<ImportFromUrlResult>}
 */
async function resolveImportFromUrlInput(input) {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Missing URL.');
  }

  const rawHash =
    trimmed.startsWith('#') ? trimmed.slice(1) : trimmed.startsWith('snap:') ? trimmed : '';
  if (rawHash) {
    const snapshot = normalizeSnapshotPayload(decodeSnapshot(rawHash));
    if (snapshot) return { title: snapshot.tabTitle, diagram: snapshot.diagram, project: snapshot.project || null };
    const decoded = decodeHash(rawHash);
    if (!decoded) throw new Error('Hash did not decode to Mermaid text.');
    return { title: 'Imported share link', diagram: decoded, project: null };
  }

  /** @type {URL | null} */
  let url = null;
  try {
    if (trimmed.startsWith('/')) {
      url = new URL(trimmed, window.location.origin);
    } else if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
      url = new URL(trimmed);
    }
  } catch {
    url = null;
  }

  if (!url) {
    throw new Error('Invalid URL. Include https:// (or paste a share-link hash).');
  }

  const hash = url.hash.replace('#', '');
  if (hash) {
    const snapshot = normalizeSnapshotPayload(decodeSnapshot(hash));
    if (snapshot) {
      return { title: snapshot.tabTitle, diagram: snapshot.diagram, project: snapshot.project || null };
    }
    const decoded = decodeHash(hash);
    if (decoded) {
      const filename = decodeURIComponent(url.pathname.split('/').pop() || 'share-link');
      return { title: tabTitleFromFilename(filename), diagram: decoded, project: null };
    }
  }

  const fetchUrl = new URL(url.toString());
  fetchUrl.hash = '';
  const res = await fetch(fetchUrl.toString(), { method: 'GET' });
  if (!res.ok) {
    throw new Error(`Fetch failed (HTTP ${res.status}).`);
  }
  const text = await res.text();
  const filename = decodeURIComponent(fetchUrl.pathname.split('/').pop() || 'imported.mmd');
  return { title: tabTitleFromFilename(filename), diagram: text, project: null };
}

async function importMermaidFromUrl() {
  if (isReadOnly) return;
  const input = await requestImportUrlInput();
  if (!input) return;

  try {
    const resolved = await resolveImportFromUrlInput(input);
    const bytes = utf8ByteLength(resolved.diagram);
    if (bytes > IMPORT_LIMITS.maxBytes) {
      showToast(`URL content too large to import (max ${Math.round(IMPORT_LIMITS.maxBytes / 1000)}kB).`);
      return;
    }
    const diagram = resolved.diagram.trim() || DEFAULT_DIAGRAM.trim();
    const validation = await validatePatchProposal(diagram);
    addImportedTab(resolved.title, diagram);
    if (!validation.ok) {
      const line = validation.line ? ` (line ${validation.line})` : '';
      showToast(`Imported diagram has Mermaid errors${line}.`);
    }
    if (resolved.project && isProjectFormEmpty() && !isEmptyProjectPayload(resolved.project)) {
      applyProjectPayload(resolved.project);
      saveProject(getProjectPayload());
    }
  } catch (error) {
    showToast(`Import failed: ${errorToMessage(error)}`);
  }
}

function requestImportUrlInput() {
  if (typeof importUrlDialog.showModal !== 'function') {
    return Promise.resolve(
      window.prompt(
        'Import from URL',
        'https://example.com/diagram.mmd\n\nTip: you can also paste a share link or hash from this app.',
      ) || null,
    );
  }

  if (importUrlResolver) {
    // Only one dialog at a time.
    try {
      importUrlDialog.close();
    } catch {
      importUrlDialog.removeAttribute('open');
    }
    importUrlResolver(null);
    importUrlResolver = null;
  }

  importUrlInputEl.value = '';
  lastFocusedBeforeImportDialog = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  importUrlDialog.showModal();
  queueMicrotask(() => importUrlInputEl.focus());

  return new Promise((resolve) => {
    importUrlResolver = resolve;
  });
}

/**
 * @param {string | null} value
 */
function settleImportUrlDialog(value) {
  if (!importUrlResolver) return;
  const resolve = importUrlResolver;
  importUrlResolver = null;
  try {
    importUrlDialog.close();
  } catch {
    importUrlDialog.removeAttribute('open');
  }
  resolve(value);
  (lastFocusedBeforeImportDialog || importUrlBtn).focus();
}

function loadTabs() {
  const raw = localStorage.getItem(TABS_KEY);
  let parsedTabs = null;
  if (raw) {
    try {
      parsedTabs = JSON.parse(raw);
    } catch {
      localStorage.removeItem(TABS_KEY);
    }
  }
  const state = normalizeTabsState(
    parsedTabs,
    localStorage.getItem(ACTIVE_TAB_KEY),
    DEFAULT_DIAGRAM.trim(),
  );
  tabs = state.tabs;
  activeTabId = state.activeTabId;
  persistTabs();
}

function persistTabs() {
  localStorage.setItem(TABS_KEY, JSON.stringify(tabs));
  if (activeTabId) {
    localStorage.setItem(ACTIVE_TAB_KEY, activeTabId);
  }
}

function renderTabs() {
  tabList.innerHTML = '';
  const visibleTabs = getVisibleTabs();
  if (!visibleTabs.length) {
    tabList.innerHTML = '<div class="hint">No tabs match this search.</div>';
    return;
  }
  visibleTabs.forEach((tab) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `tab${tab.id === activeTabId ? ' is-active' : ''}`;
    const tagSuffix = Array.isArray(tab.tags) && tab.tags.length ? ` · ${tab.tags.map((tag) => `#${tag}`).join(' ')}` : '';
    btn.textContent = `${tab.title}${tagSuffix}`;
    btn.title = tab.title;
    btn.addEventListener('click', () => setActiveTab(tab.id));
    tabList.appendChild(btn);
  });
}

/**
 * @returns {DiagramTab[]}
 */
function getVisibleTabs() {
  const query = tabQuery.trim().toLowerCase();
  return query
    ? tabs.filter((tab) => {
        const tags = Array.isArray(tab.tags) ? tab.tags : [];
        return (
          tab.title.toLowerCase().includes(query) ||
          tags.some((tag) => tag.toLowerCase().includes(query))
        );
      })
    : tabs;
}

/**
 * @param {string} tabId
 */
function setActiveTab(tabId) {
  if (activeTabId === tabId) return;
  if (!isReadOnly) updateActiveTabFromEditor();
  activeTabId = tabId;
  const next = getActiveTab();
  if (next) {
    editor.value = next.diagram;
    tabTagsInput.value = Array.isArray(next.tags) ? next.tags.join(', ') : '';
    scheduleRender();
  }
  renderTabs();
}

function updateActiveTabFromEditor() {
  const active = getActiveTab();
  if (!active) return;
  active.diagram = editor.value;
  active.updatedAt = Date.now();
  persistTabs();
}

function parseTagInput() {
  return Array.from(
    new Set(
      tabTagsInput.value
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 8),
    ),
  );
}

function saveActiveTabTags() {
  const active = getActiveTab();
  if (!active || isReadOnly) return;
  active.tags = parseTagInput();
  persistTabs();
  renderTabs();
  showToast(`Saved ${active.tags.length} tag${active.tags.length === 1 ? '' : 's'} for "${active.title}".`);
}

function addTab() {
  if (isReadOnly) return;
  const now = Date.now();
  const title = `Diagram ${tabs.length + 1}`;
  const newTab = {
    id: crypto.randomUUID(),
    title,
    diagram: DEFAULT_DIAGRAM.trim(),
    createdAt: now,
    updatedAt: now,
    tags: [],
  };
  tabs.push(newTab);
  setActiveTab(newTab.id);
  renderTabs();
}

function duplicateTab() {
  if (isReadOnly) return;
  const active = getActiveTab();
  if (!active) return;
  const now = Date.now();
  const newTab = {
    id: crypto.randomUUID(),
    title: `${active.title} copy`,
    diagram: active.diagram,
    createdAt: now,
    updatedAt: now,
    tags: Array.isArray(active.tags) ? [...active.tags] : [],
  };
  tabs.push(newTab);
  setActiveTab(newTab.id);
  renderTabs();
}

function renameTab() {
  if (isReadOnly) return;
  const active = getActiveTab();
  if (!active) return;
  const name = prompt('Rename tab', active.title);
  if (!name) return;
  active.title = name.trim().slice(0, 40) || active.title;
  persistTabs();
  renderTabs();
}

function deleteTab() {
  if (isReadOnly) return;
  if (tabs.length <= 1) {
    showToast('Keep at least one tab.');
    return;
  }
  const active = getActiveTab();
  if (!active) return;
  if (!confirm(`Delete "${active.title}"? This cannot be undone.`)) return;
  tabs = tabs.filter((tab) => tab.id !== active.id);
  activeTabId = tabs[0]?.id || null;
  persistTabs();
  renderTabs();
  if (activeTabId) {
    editor.value = getActiveTab()?.diagram || '';
    scheduleRender();
  }
}

/**
 * @param {string} code
 */
function updateHealth(code) {
  if (!code.trim()) {
    healthEl.textContent = 'Health: waiting for diagram content.';
    return;
  }
  const lines = code.split('\n');
  const edgeCount = lines.filter((line) => line.includes('-->') || line.includes('---') || line.includes('==>')).length;
  const nodeMatches = code.match(/([A-Za-z0-9_]+)\s*(?:\(|\[|\{)/g) || [];
  const nodeCount = new Set(nodeMatches.map((match) => match.split(/\s/)[0])).size;
  const density = nodeCount ? Math.round((edgeCount / nodeCount) * 10) / 10 : 0;
  healthEl.textContent = `Health: ${nodeCount} nodes · ${edgeCount} edges · ${density} connections/node`;
}

function updateStats() {
  const text = editor.value;
  const lines = text.split('\n').length;
  const chars = text.length;
  const draftLabel = lastDraftSavedAt ? ' · Draft saved' : '';
  stats.textContent = `${lines} lines · ${chars} chars${draftLabel}`;
  updateHealth(text);
}

/**
 * @param {MermaidLintIssue} issue
 */
function lintIssueLabel(issue) {
  const line = typeof issue.line === 'number' && issue.line > 0 ? `Line ${issue.line}` : 'General';
  return `${line} · ${issue.severity === 'error' ? 'Error' : 'Warning'}`;
}

/**
 * @param {boolean=} showToastSummary
 */
function updateLintReport(showToastSummary = false) {
  const result = lintMermaid(editor.value);
  lastLintResult = result;

  if (!result.issues.length) {
    lintStatus.textContent = 'Lint: no common Mermaid issues detected.';
    lintIssues.innerHTML = '<div class="hint">No findings.</div>';
    lintStageFixesBtn.disabled = true;
    if (showToastSummary) {
      showToast('No lint issues found.');
    }
    return;
  }

  const errorCount = result.issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = result.issues.length - errorCount;
  const statusParts = [];
  if (errorCount) statusParts.push(`${errorCount} error${errorCount === 1 ? '' : 's'}`);
  if (warningCount) statusParts.push(`${warningCount} warning${warningCount === 1 ? '' : 's'}`);
  lintStatus.textContent = `Lint: ${statusParts.join(' · ')}.`;
  lintIssues.innerHTML = result.issues
    .map((issue) => {
      const badge = lintIssueLabel(issue);
      const fixHint = issue.hasFix ? 'Quick fix available.' : 'Manual fix required.';
      return `<div class="lint-item lint-${issue.severity}">
  <strong>${escapeHtml(issue.title)}</strong>
  <div class="hint">${escapeHtml(badge)}</div>
  <div>${escapeHtml(issue.message)}</div>
  <div class="hint">${escapeHtml(fixHint)}</div>
</div>`;
    })
    .join('');

  lintStageFixesBtn.disabled = isReadOnly || !result.hasFixes;
  if (showToastSummary) {
    showToast(`Lint found ${result.issues.length} issue${result.issues.length === 1 ? '' : 's'}.`);
  }
}

function loadPreviewScale() {
  const raw = localStorage.getItem(PREVIEW_SCALE_KEY);
  if (!raw) return 1;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 1;
}

/**
 * @param {number} next
 */
function setPreviewScale(next) {
  const clamped = Math.max(0.5, Math.min(2.5, Math.round(next * 10) / 10));
  previewScale = clamped;
  preview.style.setProperty('--preview-scale', String(clamped));
  zoomLabel.textContent = `${Math.round(clamped * 100)}%`;
  try {
    localStorage.setItem(PREVIEW_SCALE_KEY, String(clamped));
  } catch {
    // Ignore storage failures (e.g. disabled cookies/localStorage).
  }
}

/**
 * @param {unknown} target
 */
function isTypingElement(target) {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) return true;
  return target.isContentEditable;
}

/** @type {{active: boolean, pointerId: number | null, startX: number, startY: number, startLeft: number, startTop: number}} */
const panState = {
  active: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  startLeft: 0,
  startTop: 0,
};

let isSpaceDown = false;

function stopPreviewPan() {
  if (!panState.active) return;
  panState.active = false;
  preview.classList.remove('panning');
  const pointerId = panState.pointerId;
  panState.pointerId = null;
  if (pointerId !== null) {
    try {
      preview.releasePointerCapture(pointerId);
    } catch {
      // Ignore if capture was already released.
    }
  }
}

/**
 * @param {number | null} line
 */
function setErrorLine(line) {
  lastErrorLine = line;
  if (line) {
    jumpErrorBtn.hidden = false;
    jumpErrorBtn.textContent = `Jump to line ${line}`;
  } else {
    jumpErrorBtn.hidden = true;
  }
}

function jumpToError() {
  if (!lastErrorLine) return;
  const lines = editor.value.split('\n');
  const targetIndex = Math.min(lines.length, Math.max(1, lastErrorLine)) - 1;
  const start = lines.slice(0, targetIndex).join('\n').length + (targetIndex ? 1 : 0);
  const end = start + lines[targetIndex].length;
  editor.focus();
  editor.setSelectionRange(start, end);
  const lineHeight = 18;
  editor.scrollTop = Math.max(0, targetIndex * lineHeight - editor.clientHeight / 3);
}

/**
 * @param {boolean=} force
 */
function toggleFocusMode(force) {
  const next =
    typeof force === 'boolean' ? force : !document.body.classList.contains('focus-mode');
  document.body.classList.toggle('focus-mode', next);
  focusToggle.textContent = next ? 'Exit focus' : 'Focus';
  focusToggle.setAttribute('aria-pressed', String(next));
  if (next) {
    preview.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
}

function applyReadOnlyMode() {
  document.body.classList.toggle('read-only', isReadOnly);
  readonlyBanner.hidden = !isReadOnly;
  editor.readOnly = isReadOnly;
  instructions.readOnly = isReadOnly;
  proposal.readOnly = isReadOnly;
  const buttons = [
    commitBtn,
    generatePatchBtn,
    cancelGeneratePatchBtn,
    simulateBtn,
    applyPatchBtn,
    exportSvgBtn,
    exportPngBtn,
    exportPdfBtn,
    formatMermaidBtn,
    lintMermaidBtn,
    lintStageFixesBtn,
    copySourceBtn,
    copySvgBtn,
    copyPngBtn,
    resetBtn,
    clearHistoryBtn,
    downloadHistoryBtn,
    restoreDraftBtn,
    clearDraftBtn,
    downloadSourceBtn,
    importFileBtn,
    importUrlBtn,
    saveTemplateBtn,
    importTemplatesBtn,
    addTabBtn,
    duplicateTabBtn,
    renameTabBtn,
    deleteTabBtn,
    saveTabTagsBtn,
    undoPatchBtn,
  ];
  buttons.forEach((btn) => {
    btn.disabled = isReadOnly;
  });
  projectTitleInput.disabled = isReadOnly;
  projectAudienceInput.disabled = isReadOnly;
  projectOwnerInput.disabled = isReadOnly;
  projectPurposeInput.disabled = isReadOnly;
  useFilenamesToggle.disabled = isReadOnly;
  tabTagsInput.disabled = isReadOnly;
  aiApiBaseInput.disabled = isReadOnly;
  aiModelInput.disabled = isReadOnly;
  aiApiModeSelect.disabled = isReadOnly;
  aiTemperatureInput.disabled = isReadOnly;
  aiMaxTokensInput.disabled = isReadOnly;
  aiTimeoutInput.disabled = isReadOnly;
  aiApiKeyInput.disabled = isReadOnly;
  aiRememberKeyToggle.disabled = isReadOnly;
  if (isReadOnly) {
    patchUndoRow.hidden = true;
  }
}

function renderPromptRecipes() {
  promptRecipes.innerHTML = '';
  PROMPT_RECIPES.forEach((recipe) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.textContent = recipe.title;
    btn.title = recipe.prompt;
    btn.addEventListener('click', () => {
      const current = instructions.value.trim();
      instructions.value = current ? `${current}\n${recipe.prompt}` : recipe.prompt;
      instructions.focus();
      showToast(`Prompt added: ${recipe.title}.`);
    });
    promptRecipes.appendChild(btn);
  });
}

function getTemplateFilters() {
  const categories = Array.from(new Set(getTemplateLibrary().map((item) => item.category)));
  return ['All', ...categories];
}

function renderTemplateFilters() {
  templateFilters.innerHTML = '';
  getTemplateFilters().forEach((filter) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `chip${activeTemplateFilter === filter ? ' is-active' : ''}`;
    btn.textContent = filter;
    btn.setAttribute('aria-pressed', String(activeTemplateFilter === filter));
    btn.addEventListener('click', () => {
      activeTemplateFilter = filter;
      renderTemplateFilters();
      renderTemplates();
    });
    templateFilters.appendChild(btn);
  });
}

/**
 * @param {string} diagram
 */
function getTemplatePreview(diagram) {
  return diagram.trim().split('\n').slice(0, 6).join('\n');
}

/**
 * @param {DiagramTemplate} template
 */
function applyTemplate(template) {
  if (isReadOnly) return;
  const current = editor.value.trim();
  const next = template.diagram.trim();
  const isDefault = current === DEFAULT_DIAGRAM.trim();
  if (current && current !== next && !isDefault) {
    if (!confirm(`Replace the current diagram with "${template.title}"?`)) return;
  }
  editor.value = next;
  activeTemplateId = template.id;
  localStorage.setItem(TEMPLATE_ACTIVE_KEY, template.id);
  scheduleRender();
  renderTemplates();
  showToast(`Loaded template: ${template.title}.`);
}

function saveCurrentAsTemplate() {
  if (isReadOnly) return;
  const active = getActiveTab();
  if (!active) return;
  const diagram = editor.value.trim();
  if (!diagram) {
    showToast('Write a diagram before saving a template.');
    return;
  }
  const title = (prompt('Template name', active.title) || '').trim();
  if (!title) return;
  const summary = (prompt('Template summary', `Saved from "${active.title}"`) || '').trim();
  /** @type {DiagramTemplate} */
  const template = {
    id: `custom-${crypto.randomUUID()}`,
    title: title.slice(0, 50),
    category: 'Custom',
    summary: summary.slice(0, 100) || 'Saved from your current diagram.',
    diagram,
  };
  customTemplates.unshift(template);
  customTemplates = customTemplates.slice(0, 40);
  saveCustomTemplates();
  activeTemplateId = template.id;
  renderTemplateFilters();
  renderTemplates();
  showToast(`Saved template: ${template.title}.`);
}

/**
 * @param {string} templateId
 */
function updateCustomTemplateFromEditor(templateId) {
  if (isReadOnly) return;
  const diagram = editor.value.trim();
  if (!diagram) {
    showToast('Write a diagram before updating a template.');
    return;
  }
  const index = customTemplates.findIndex((item) => item.id === templateId);
  if (index < 0) return;
  customTemplates[index] = {
    ...customTemplates[index],
    diagram,
    summary: `Updated from "${getActiveTab()?.title || 'diagram'}"`,
  };
  saveCustomTemplates();
  renderTemplates();
  showToast(`Updated template: ${customTemplates[index].title}.`);
}

/**
 * @param {string} templateId
 */
function renameCustomTemplate(templateId) {
  if (isReadOnly) return;
  const index = customTemplates.findIndex((item) => item.id === templateId);
  if (index < 0) return;
  const next = (prompt('Rename template', customTemplates[index].title) || '').trim();
  if (!next) return;
  customTemplates[index] = {
    ...customTemplates[index],
    title: next.slice(0, 50),
  };
  saveCustomTemplates();
  renderTemplates();
  showToast(`Renamed template: ${customTemplates[index].title}.`);
}

/**
 * @param {string} templateId
 */
function deleteCustomTemplate(templateId) {
  if (isReadOnly) return;
  const index = customTemplates.findIndex((item) => item.id === templateId);
  if (index < 0) return;
  const item = customTemplates[index];
  if (!confirm(`Delete template "${item.title}"?`)) return;
  customTemplates.splice(index, 1);
  if (activeTemplateId === templateId) {
    activeTemplateId = null;
    localStorage.removeItem(TEMPLATE_ACTIVE_KEY);
  }
  saveCustomTemplates();
  renderTemplateFilters();
  renderTemplates();
  showToast(`Deleted template: ${item.title}.`);
}

/**
 * @param {DiagramTemplate} template
 */
function matchesTemplate(template) {
  const query = templateQuery.trim().toLowerCase();
  const matchesFilter =
    activeTemplateFilter === 'All' || template.category === activeTemplateFilter;
  if (!matchesFilter) return false;
  if (!query) return true;
  return (
    template.title.toLowerCase().includes(query) ||
    template.summary.toLowerCase().includes(query) ||
    template.category.toLowerCase().includes(query)
  );
}

function renderTemplates() {
  const items = getTemplateLibrary().filter(matchesTemplate);
  templateGrid.innerHTML = '';
  templateEmpty.hidden = items.length > 0;
  items.forEach((template) => {
    const card = document.createElement('div');
    card.className = `template-card${activeTemplateId === template.id ? ' is-active' : ''}`;
    card.innerHTML = `
      <div class="template-meta">
        <div>
          <h3>${escapeHtml(template.title)}</h3>
          <div class="hint">${escapeHtml(template.summary)}</div>
        </div>
        <span class="template-pill">${escapeHtml(template.category)}</span>
      </div>
      <pre>${escapeHtml(getTemplatePreview(template.diagram))}</pre>
    `;
    const actions = document.createElement('div');
    actions.className = 'template-actions';
    const useBtn = document.createElement('button');
    useBtn.type = 'button';
    useBtn.className = 'ghost';
    useBtn.textContent = 'Use template';
    useBtn.addEventListener('click', () => applyTemplate(template));
    actions.appendChild(useBtn);
    if (template.category === 'Custom') {
      const updateBtn = document.createElement('button');
      updateBtn.type = 'button';
      updateBtn.className = 'ghost';
      updateBtn.textContent = 'Update';
      updateBtn.addEventListener('click', () => updateCustomTemplateFromEditor(template.id));
      actions.appendChild(updateBtn);

      const renameBtn = document.createElement('button');
      renameBtn.type = 'button';
      renameBtn.className = 'ghost';
      renameBtn.textContent = 'Rename';
      renameBtn.addEventListener('click', () => renameCustomTemplate(template.id));
      actions.appendChild(renameBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'ghost';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => deleteCustomTemplate(template.id));
      actions.appendChild(deleteBtn);
    }
    card.appendChild(actions);
    templateGrid.appendChild(card);
  });
}

/**
 * @param {boolean=} force
 */
async function renderMermaid(force = false) {
  const seq = (renderSeq += 1);
  const code = editor.value.trim();
  if (!code) {
    lastSvg = '';
    setPreviewMessage('Start with a template', 'Choose a starter above or begin typing Mermaid.');
    renderStatus.textContent = 'Empty diagram';
    exportSummary.textContent = 'Export summary updates after render.';
    setErrorLine(null);
    return;
  }
  if (isTooLargeForRender(code) && !force) {
    lastSvg = '';
    renderStatus.textContent = 'Large diagram: rendering paused. Click Render now.';
    exportSummary.textContent = 'Export summary paused for large diagrams.';
    setPreviewMessage('Rendering paused', 'This diagram is large. Click Render now to preview it.');
    setErrorLine(null);
    return;
  }
  try {
    const mermaid = await loadMermaid(document.body.classList.contains('theme-dark') ? 'dark' : 'neutral');
    renderStatus.textContent = force && isTooLargeForRender(code) ? 'Rendering large diagram…' : 'Rendering…';
    const { svg } = await mermaid.render(`diagram-${Date.now()}`, code);
    if (seq !== renderSeq) return;
    lastSvg = svg;
    previewContent.innerHTML = svg;
    renderStatus.textContent = 'Rendered';
    updateExportSummary();
    setErrorLine(null);
  } catch (error) {
    if (seq !== renderSeq) return;
    lastSvg = '';
    previewContent.innerHTML = '';
    const message = errorToMessage(error);
    renderStatus.textContent = `Error: ${message}`;
    exportSummary.textContent = 'Export summary unavailable.';
    setPreviewMessage('Rendering error', 'Fix the Mermaid syntax to see the preview.');
    setErrorLine(extractMermaidErrorLine(message));
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
    updateLintReport();
    updateDiff();
    if (!isReadOnly) {
      updateActiveTabFromEditor();
    }
    const trimmed = editor.value.trim();
    if (isReadOnly) return;
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

async function generatePatch() {
  if (isReadOnly) return;
  if (aiRequestController) {
    showToast('Patch generation already in progress.');
    return;
  }
  const settings = getAiSettingsFromForm();
  const apiBase = normalizeApiBase(settings.apiBase);
  const mode = settings.mode;
  const model = settings.model || 'gpt-4.1';
  const apiKey = aiApiKeyInput.value.trim();

  saveAiSettings({ ...settings, apiBase, model });
  saveAiKey(apiKey, settings.rememberKey);

  if (!apiBase) {
    showToast('Set an AI API base URL first.');
    return;
  }

  generatePatchBtn.disabled = true;
  cancelGeneratePatchBtn.disabled = false;
  setAiStatus('Generating patch…');
  setAiUsage(null);
  proposal.readOnly = true;

  const { system, user } = buildPatchMessages({
    tabTitle: getActiveTab()?.title || 'Diagram',
    project: getProjectPayload(),
    diagram: editor.value,
    instructions: instructions.value,
  });

  const controller = new AbortController();
  aiRequestController = controller;
  aiRequestTimeout = window.setTimeout(() => controller.abort(), Math.max(5, settings.timeoutSec || 45) * 1000);

  /**
   * @param {{stream: boolean}} opts
   * @returns {Promise<{text: string, usage: unknown | null, streamed: boolean}>}
   */
  async function requestAiPatch(opts) {
    const url = mode === 'responses' ? `${apiBase}/responses` : `${apiBase}/chat/completions`;
    const headers = {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    };
    const maybeTemperature =
      typeof settings.temperature === 'number' && Number.isFinite(settings.temperature)
        ? { temperature: settings.temperature }
        : {};
    const maybeMaxTokens =
      typeof settings.maxTokens === 'number' && Number.isFinite(settings.maxTokens) && settings.maxTokens > 0
        ? { maxTokens: Math.floor(settings.maxTokens) }
        : { maxTokens: null };

    const body =
      mode === 'responses'
        ? {
            model,
            instructions: system,
            input: user,
            text: { format: { type: 'text' } },
            store: false,
            ...(maybeMaxTokens.maxTokens ? { max_output_tokens: maybeMaxTokens.maxTokens } : {}),
            ...maybeTemperature,
            ...(opts.stream ? { stream: true } : {}),
          }
        : {
            model,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
            ...(maybeMaxTokens.maxTokens ? { max_tokens: maybeMaxTokens.maxTokens } : {}),
            ...maybeTemperature,
            ...(opts.stream ? { stream: true } : {}),
          };

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const contentType = (res.headers.get('content-type') || '').toLowerCase();

    if (!res.ok) {
      // Try JSON first, but keep a safe fallback for text responses.
      const json = await res.json().catch(() => null);
      const message =
        json && typeof json === 'object'
          ? /** @type {any} */ (json)?.error?.message || `HTTP ${res.status}`
          : `HTTP ${res.status}`;
      throw new Error(String(message));
    }

    if (opts.stream && contentType.includes('text/event-stream') && res.body) {
      let acc = '';
      /** @type {unknown | null} */
      let usage = null;
      let sawDone = false;
      /** @type {Error | null} */
      let streamError = null;

      let pendingText = '';
      /** @type {number | null} */
      let uiTimer = null;
      let lastDiffAt = 0;

      function scheduleUi() {
        pendingText = acc;
        if (uiTimer) return;
        uiTimer = window.setTimeout(() => {
          uiTimer = null;
          proposal.value = pendingText;
          const now = Date.now();
          if (now - lastDiffAt > 250) {
            lastDiffAt = now;
            updateDiff();
          }
        }, 80);
      }

      const parser = createSseParser((msg) => {
        if (streamError) return;
        const data = msg.data.trim();
        if (!data) return;
        if (data === '[DONE]') {
          sawDone = true;
          return;
        }
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          return;
        }

        if (parsed && typeof parsed === 'object') {
          const err = /** @type {any} */ (parsed)?.error;
          if (err && typeof err === 'object' && typeof err.message === 'string') {
            streamError = new Error(String(err.message));
            sawDone = true;
            return;
          }
        }

        const nextUsage = extractUsage(parsed);
        if (nextUsage) {
          usage = nextUsage;
          setAiUsage(usage);
        }

        const delta = mode === 'responses' ? extractResponsesDelta(parsed) : extractChatDelta(parsed);
        if (typeof delta === 'string' && delta) {
          acc += delta;
          setAiStatus(`Streaming… (${Math.max(1, acc.length)} chars)`);
          scheduleUi();
        }
      });

      const decoder = new TextDecoder();
      const reader = res.body.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          parser.push(decoder.decode(value, { stream: true }));
          if (streamError) break;
          if (sawDone) {
            try {
              await reader.cancel();
            } catch {
              // Ignore cancellation failures.
            }
            break;
          }
        }
      } finally {
        try {
          parser.push(decoder.decode());
        } catch {
          // ignore decoder flush errors
        }
        parser.finish();
        if (uiTimer) {
          window.clearTimeout(uiTimer);
          uiTimer = null;
        }
        if (pendingText && proposal.value !== pendingText) {
          proposal.value = pendingText;
        }
      }

      if (streamError) throw streamError;
      return { text: acc.trim(), usage, streamed: true };
    }

    const json = await res.json().catch(() => null);
    const text = extractTextFromProviderResponse(json, mode);
    if (!text) {
      throw new Error('Provider response did not include text output.');
    }
    return { text: text.trim(), usage: extractUsage(json), streamed: false };
  }

  try {
    // Prefer streaming when supported, but fall back to non-streaming if a provider
    // rejects `stream: true` (common among "compatible" endpoints).
    let result = null;
    try {
      result = await requestAiPatch({ stream: true });
    } catch (error) {
      const message = errorToMessage(error).toLowerCase();
      const shouldRetry =
        message.includes('stream') && (message.includes('unknown') || message.includes('unsupported') || message.includes('invalid'));
      if (!shouldRetry) throw error;
      setAiStatus('Streaming unsupported; retrying non-streaming…');
      result = await requestAiPatch({ stream: false });
    }

    setAiUsage(result.usage);
    const mermaid = extractMermaidFromText(result.text);
    if (mermaid) {
      proposal.value = mermaid;
      setAiStatus(result.streamed ? 'Patch generated (streamed).' : 'Patch generated.');
    } else {
      proposal.value = result.text.trim();
      setAiStatus('AI output was not recognized as Mermaid. Raw output pasted into proposal.');
    }

    updateDiff();
    showToast('AI patch ready.');
  } catch (error) {
    if (controller.signal.aborted) {
      setAiStatus('Patch generation cancelled.');
      showToast('AI patch cancelled.');
    } else {
      const message = errorToMessage(error);
      setAiStatus(`Patch generation failed: ${message}`);
      showToast('AI patch failed.');
    }
  } finally {
    if (aiRequestTimeout) {
      window.clearTimeout(aiRequestTimeout);
      aiRequestTimeout = null;
    }
    aiRequestController = null;
    cancelGeneratePatchBtn.disabled = true;
    generatePatchBtn.disabled = isReadOnly;
    proposal.readOnly = false;
  }
}

function simulatePatch() {
  if (isReadOnly) return;
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
    const fallback = summarizeLargeDiff(base, next);
    if (!fallback.lines.length) {
      diffEl.innerHTML = '<div class="hint">Large diff summary: no line-level deltas detected.</div>';
      return;
    }
    const summary = `<div class="hint">Large diff summary: +${fallback.adds} / -${fallback.removes}${fallback.truncated ? ' (truncated preview)' : ''}</div>`;
    const rows = fallback.lines
      .map((line) => {
        const prefix = line.type === 'add' ? '+' : '-';
        const className = line.type === 'add' ? 'add' : 'remove';
        return `<div class="${className}">${prefix} ${escapeHtml(line.text)}</div>`;
      })
      .join('');
    diffEl.innerHTML = `${summary}${rows}`;
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

/**
 * @param {string} code
 * @returns {Promise<{ok: true} | {ok: false, message: string, line: number | null}>}
 */
async function validatePatchProposal(code) {
  try {
    const mermaid = await loadMermaid(document.body.classList.contains('theme-dark') ? 'dark' : 'neutral');
    await mermaid.parse(code);
    return { ok: true };
  } catch (error) {
    const message = errorToMessage(error);
    return { ok: false, message, line: extractMermaidErrorLine(message) };
  }
}

async function applyPatch() {
  if (isReadOnly) return;
  const next = proposal.value.trim();
  if (!next) {
    return;
  }
  const validation = await validatePatchProposal(next);
  if (!validation.ok) {
    renderStatus.textContent = `Patch invalid: ${validation.message}`;
    setPreviewMessage('Patch validation failed', 'Fix Mermaid errors in the proposal before applying.');
    setErrorLine(validation.line);
    showToast('Patch contains Mermaid errors.');
    return;
  }
  // Create a restore point so "Apply patch" is never irreversible.
  const items = addSnapshot(editor.value, 'Auto: before patch');
  lastPatchRestoreId = items[0]?.id || null;
  patchUndoRow.hidden = !lastPatchRestoreId;
  renderTimeline();
  editor.value = next;
  scheduleRender();
  showToast('Patch applied. Restore point saved in timeline.');
}

function undoLastPatch() {
  if (isReadOnly) return;
  if (!lastPatchRestoreId) return;
  const items = loadHistory();
  const item = items.find((entry) => entry.id === lastPatchRestoreId) || null;
  if (!item) {
    patchUndoRow.hidden = true;
    lastPatchRestoreId = null;
    showToast('Undo unavailable (snapshot missing).');
    return;
  }
  editor.value = item.diagram;
  scheduleRender();
  patchUndoRow.hidden = true;
  lastPatchRestoreId = null;
  showToast('Patch undone.');
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

    const presentBtn = document.createElement('button');
    presentBtn.textContent = 'Present';
    presentBtn.className = 'ghost';
    presentBtn.addEventListener('click', () => openPresentationMode(item.id));

    actions.appendChild(restoreBtn);
    actions.appendChild(diffBtn);
    actions.appendChild(presentBtn);
    row.appendChild(label);
    row.appendChild(actions);
    timelineEl.appendChild(row);
  });
}

function commitSnapshot() {
  if (isReadOnly) return;
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
  void loadMermaid(isDark ? 'dark' : 'neutral');
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

async function copyShareLinkNewTab() {
  const hash = encodeHash(editor.value);
  const url = `${window.location.origin}${window.location.pathname}?tab=new#${hash}`;
  window.history.replaceState(null, '', `#${hash}`);
  try {
    await writeClipboardText(url);
    showToast('New-tab share link copied.');
  } catch {
    showToast('Copy failed. Link shown in prompt.');
    window.prompt('Copy share link (new tab)', url);
  }
}

async function copySnapshotLink() {
  const active = getActiveTab();
  if (!active) return;
  const payload = {
    diagram: editor.value,
    tabTitle: active.title,
    project: getProjectPayload(),
    createdAt: Date.now(),
  };
  const hash = encodeSnapshot(payload);
  const url = `${window.location.origin}${window.location.pathname}?mode=readonly#${hash}`;
  try {
    await writeClipboardText(url);
    showToast('Snapshot link copied.');
  } catch {
    showToast('Copy failed. Link shown in prompt.');
    window.prompt('Copy snapshot link', url);
  }
}

async function copySnapshotImportLink() {
  const active = getActiveTab();
  if (!active) return;
  const payload = {
    diagram: editor.value,
    tabTitle: active.title,
    project: getProjectPayload(),
    createdAt: Date.now(),
  };
  const hash = encodeSnapshot(payload);
  const url = `${window.location.origin}${window.location.pathname}?tab=new&import=1#${hash}`;
  try {
    await writeClipboardText(url);
    showToast('Importable snapshot link copied.');
  } catch {
    showToast('Copy failed. Link shown in prompt.');
    window.prompt('Copy snapshot import link', url);
  }
}

/**
 * Safe, low-risk formatting: normalize line endings, trim trailing whitespace, and replace tabs.
 * @param {string} input
 */
function formatMermaidWhitespace(input) {
  const normalized = input.replace(/\r\n/g, '\n').replace(/\t/g, '  ');
  const lines = normalized.split('\n').map((line) => line.replace(/\s+$/g, ''));
  // Avoid over-opinionated formatting; just cap excessive blank lines.
  const compacted = [];
  let blankRun = 0;
  for (const line of lines) {
    if (!line.trim()) {
      blankRun += 1;
      if (blankRun <= 2) compacted.push('');
      continue;
    }
    blankRun = 0;
    compacted.push(line);
  }
  return `${compacted.join('\n').trimEnd()}\n`;
}

function stageFormattedMermaid() {
  if (isReadOnly) return;
  const current = editor.value;
  const formatted = formatMermaidWhitespace(current);
  if (formatted === current) {
    showToast('Already formatted.');
    return;
  }
  proposal.value = formatted;
  updateDiff();
  document.getElementById('workspace-ai')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  proposal.focus();
  showToast('Formatted output staged in Patch proposal. Review diff, then Apply patch.');
}

function stageLintFixes() {
  if (isReadOnly) return;
  const result = lastLintResult || lintMermaid(editor.value);
  lastLintResult = result;
  if (!result.hasFixes || result.fixedCode === editor.value) {
    showToast('No safe lint quick fixes available.');
    return;
  }
  proposal.value = result.fixedCode;
  updateDiff();
  document.getElementById('workspace-ai')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  proposal.focus();
  const fixCount = result.issues.filter((issue) => issue.hasFix).length;
  showToast(`Staged ${fixCount} lint quick fix${fixCount === 1 ? '' : 'es'} in Patch proposal.`);
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
  downloadBlob(blob, `${getExportBaseName()}.svg`);
  addExportHistory('SVG', output.length);
}

function exportPng() {
  if (!lastSvg) return;
  createPngBlob()
    .then((blob) => {
      if (blob) {
        downloadBlob(blob, `${getExportBaseName()}.png`);
        addExportHistory('PNG', blob.size);
      }
    })
    .catch(() => {
      showToast('Export failed.');
    });
}

function exportPdf() {
  if (!lastSvg) {
    showToast('Render a diagram first.');
    return;
  }
  const page = pdfPageSelect.value === 'a4' ? 'A4' : pdfPageSelect.value === 'letter' ? 'letter' : '';
  const orientation =
    pdfOrientationSelect.value === 'portrait' ? 'portrait' : pdfOrientationSelect.value === 'landscape' ? 'landscape' : '';
  const marginMm = Math.max(0, Math.min(40, Number(pdfMarginSelect.value) || 12));
  const base = applySvgScale(lastSvg, Number(exportSvgScaleSelect.value) || 1);
  const scaled = applySvgWidth(base, resolveExportWidth());
  const svg = exportSvgInlineToggle.checked ? inlineSvgStyles(scaled) : scaled;
  const bg = pdfWhiteBgToggle.checked ? '#ffffff' : 'transparent';
  const sizeRule = page ? `${page}${orientation ? ` ${orientation}` : ''}` : '';
  const pageCss = sizeRule ? `@page{size:${sizeRule};margin:${marginMm}mm;}` : `@page{margin:${marginMm}mm;}`;
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Export PDF</title>
  <style>
    ${pageCss}
    html,body{height:100%;}
    body{margin:0;background:${bg};font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
    .wrap{box-sizing:border-box;min-height:100%;display:flex;align-items:center;justify-content:center;padding:${marginMm}mm;}
    .wrap svg{width:100% !important;height:auto !important;max-height:100%;}
    @media print{
      body{background:${bg};}
      .wrap{padding:0;}
    }
  </style>
</head>
<body>
  <div class="wrap">${svg}</div>
  <script>
    window.addEventListener('load', () => {
      setTimeout(() => window.print(), 200);
    });
    window.addEventListener('afterprint', () => {
      try { window.close(); } catch {}
    });
  </script>
</body>
</html>`;

  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) {
    showToast('Popup blocked. Allow popups to export PDF.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  addExportHistory('PDF (print)', svg.length);
}

async function downloadBundle() {
  if (!editor.value.trim()) {
    showToast('Nothing to bundle yet.');
    return;
  }
  const base = getExportBaseName();
  const payload = {
    project: getProjectPayload(),
    tab: getActiveTab()?.title || 'Diagram',
    createdAt: new Date().toISOString(),
  };
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  zip.file(`${base}.mmd`, editor.value || '');
  zip.file(`${base}.json`, JSON.stringify(payload, null, 2));
  if (lastSvg) {
    const baseSvg = applySvgScale(lastSvg, Number(exportSvgScaleSelect.value) || 1);
    const scaledSvg = applySvgWidth(baseSvg, resolveExportWidth());
    zip.file(`${base}.svg`, scaledSvg);
    try {
      const pngBlob = await createPngBlob();
      if (pngBlob) {
        zip.file(`${base}.png`, pngBlob);
      }
    } catch {
      showToast('PNG export skipped.');
    }
  }
  const content = await zip.generateAsync({ type: 'blob' });
  downloadBlob(content, `${base}_bundle.zip`);
  addExportHistory('Bundle', content.size);
}

function downloadHistory() {
  const data = loadHistory();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'mermaid-history.json');
}

function downloadExportHistory() {
  const data = loadExportHistory();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'mermaid-export-history.json');
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
  const pdfPage = pdfPageSelect.value === 'auto' ? 'PDF print' : `PDF ${pdfPageSelect.value.toUpperCase()}`;
  const pdfOrientation = pdfOrientationSelect.value === 'auto' ? '' : ` ${pdfOrientationSelect.value}`;
  exportSummary.textContent = `PNG ${pngWidth}×${pngHeight}px · SVG ${svgWidth}×${svgHeight}px · ${pdfPage}${pdfOrientation}`;
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
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const data = /** @type {Record<string, unknown>} */ (item);
        /** @type {ExportHistoryItem} */
        const normalizedItem = {
          id: typeof data.id === 'string' ? data.id : crypto.randomUUID(),
          label: typeof data.label === 'string' ? data.label : 'Export',
          bytes: typeof data.bytes === 'number' && Number.isFinite(data.bytes) ? data.bytes : 0,
          createdAt: typeof data.createdAt === 'number' && Number.isFinite(data.createdAt) ? data.createdAt : 0,
        };
        return normalizedItem;
      })
      .filter((item) => item && item.createdAt > 0);
    return normalized.filter(isExportHistoryItem);
  } catch {
    return [];
  }
}

/**
 * @param {unknown} value
 * @returns {value is ExportHistoryItem}
 */
function isExportHistoryItem(value) {
  if (!value || typeof value !== 'object') return false;
  const data = /** @type {Record<string, unknown>} */ (value);
  return (
    typeof data.id === 'string' &&
    typeof data.label === 'string' &&
    typeof data.bytes === 'number' &&
    typeof data.createdAt === 'number' &&
    Number.isFinite(data.createdAt) &&
    data.createdAt > 0
  );
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
    pdfPage: pdfPageSelect.value,
    pdfOrientation: pdfOrientationSelect.value,
    pdfMargin: Number(pdfMarginSelect.value) || 12,
    pdfWhiteBg: pdfWhiteBgToggle.checked,
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
  if (typeof prefs.pdfPage === 'string') pdfPageSelect.value = prefs.pdfPage;
  if (typeof prefs.pdfOrientation === 'string') pdfOrientationSelect.value = prefs.pdfOrientation;
  if (typeof prefs.pdfMargin === 'number') pdfMarginSelect.value = String(prefs.pdfMargin);
  if (typeof prefs.pdfWhiteBg === 'boolean') pdfWhiteBgToggle.checked = prefs.pdfWhiteBg;
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
  downloadBlob(blob, `${getExportBaseName()}.mmd`);
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

function clearImportUrlState() {
  const url = new URL(window.location.href);
  url.hash = '';
  ['tab', 'newTab', 'import', 'mode', 'ro'].forEach((key) => url.searchParams.delete(key));
  const next = `${url.pathname}${url.search}`;
  window.history.replaceState(null, '', next);
}

function init() {
  loadTabs();
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
  renderPromptRecipes();
  customTemplates = loadCustomTemplates();
  activeTemplateId = localStorage.getItem(TEMPLATE_ACTIVE_KEY);
  renderTemplateFilters();
  renderTemplates();
  setPreviewScale(loadPreviewScale());
  const storedProject = loadProject();
  if (storedProject) {
    applyProjectPayload(storedProject);
  }
  applyAiSettingsToForm(loadAiSettings());
  setAiStatus('');

  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash.replace('#', '');
  const snapshot = normalizeSnapshotPayload(decodeSnapshot(hash));
  const importAsNewTab = params.get('tab') === 'new' || params.get('newTab') === '1' || params.get('import') === '1';
  const forcedReadOnly = params.get('mode') === 'readonly' || params.get('ro') === '1';
  isReadOnly = forcedReadOnly || (Boolean(snapshot) && !importAsNewTab);
  applyReadOnlyMode();

  if (snapshot && importAsNewTab) {
    const diagram = snapshot.diagram.trim() || DEFAULT_DIAGRAM.trim();
    addImportedTab(snapshot.tabTitle, diagram);
    if (snapshot.project && isProjectFormEmpty()) {
      applyProjectPayload(snapshot.project);
    }
    clearImportUrlState();
  } else if (snapshot) {
    const now = Date.now();
    tabs = [
      {
        id: crypto.randomUUID(),
        title: snapshot.tabTitle,
        diagram: snapshot.diagram,
        createdAt: now,
        updatedAt: now,
      },
    ];
    activeTabId = tabs[0].id;
    renderTabs();
    if (snapshot.project) {
      applyProjectPayload(snapshot.project);
    }
    editor.value = tabs[0].diagram;
  } else {
    renderTabs();
    const decoded = hash ? decodeHash(hash) : null;
    if (decoded) {
      if (importAsNewTab) {
        addImportedTab('Imported share link', decoded);
        clearImportUrlState();
      } else {
        const active = getActiveTab();
        if (active) {
          active.diagram = decoded;
          active.updatedAt = Date.now();
          editor.value = decoded;
          persistTabs();
        }
      }
    } else {
      const draft = loadDraft();
      const now = Date.now();
      const maxAgeMs = 1000 * 60 * 60 * 24 * 7;
      const active = getActiveTab();
      if (draft && now - draft.updatedAt <= maxAgeMs && active) {
        active.diagram = draft.diagram;
        active.updatedAt = now;
        editor.value = draft.diagram;
        lastDraftSavedAt = draft.updatedAt;
        persistTabs();
        queueMicrotask(() => showToast('Restored last draft.'));
      } else if (active) {
        editor.value = active.diagram || DEFAULT_DIAGRAM.trim();
      }
    }
  }

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

  const activeTab = getActiveTab();
  tabTagsInput.value = activeTab && Array.isArray(activeTab.tags) ? activeTab.tags.join(', ') : '';
  updateStats();
  updateLintReport();
  renderMermaid();
  renderTimeline();
  updateDiff();
}

editor.addEventListener('input', scheduleRender);
proposal.addEventListener('input', updateDiff);
templateSearch.addEventListener('input', () => {
  templateQuery = templateSearch.value;
  renderTemplates();
});
tabSearchInput.addEventListener('input', () => {
  tabQuery = tabSearchInput.value;
  renderTabs();
});
saveTemplateBtn.addEventListener('click', saveCurrentAsTemplate);
exportTemplatesBtn.addEventListener('click', exportCustomTemplates);
importTemplatesBtn.addEventListener('click', () => importTemplatesInput.click());
importTemplatesInput.addEventListener('change', async () => {
  const file = importTemplatesInput.files && importTemplatesInput.files[0] ? importTemplatesInput.files[0] : null;
  importTemplatesInput.value = '';
  if (!file) return;
  try {
    const text = await file.text();
    const added = importCustomTemplatesFromJson(text);
    if (!added) {
      showToast('No new templates imported.');
      return;
    }
    showToast(`Imported ${added} template${added === 1 ? '' : 's'}.`);
  } catch {
    showToast('Template import failed.');
  }
});

addTabBtn.addEventListener('click', addTab);
duplicateTabBtn.addEventListener('click', duplicateTab);
renameTabBtn.addEventListener('click', renameTab);
deleteTabBtn.addEventListener('click', deleteTab);
saveTabTagsBtn.addEventListener('click', saveActiveTabTags);
tabTagsInput.addEventListener('keydown', (event) => {
  const isCmd = event.metaKey || event.ctrlKey;
  if (event.key === 'Enter' && !isCmd) {
    event.preventDefault();
    saveActiveTabTags();
  }
});

function persistProject() {
  saveProject(getProjectPayload());
}

projectTitleInput.addEventListener('input', persistProject);
projectAudienceInput.addEventListener('input', persistProject);
projectOwnerInput.addEventListener('input', persistProject);
projectPurposeInput.addEventListener('input', persistProject);
useFilenamesToggle.addEventListener('change', persistProject);

commitBtn.addEventListener('click', commitSnapshot);
lintMermaidBtn.addEventListener('click', () => updateLintReport(true));
lintStageFixesBtn.addEventListener('click', stageLintFixes);
generatePatchBtn.addEventListener('click', () => {
  void generatePatch();
});
cancelGeneratePatchBtn.addEventListener('click', () => {
  if (!aiRequestController) return;
  setAiStatus('Cancelling…');
  aiRequestController.abort();
});
simulateBtn.addEventListener('click', simulatePatch);
applyPatchBtn.addEventListener('click', () => {
  void applyPatch();
});
undoPatchBtn.addEventListener('click', undoLastPatch);
exportSvgBtn.addEventListener('click', exportSvg);
exportPngBtn.addEventListener('click', exportPng);
exportPdfBtn.addEventListener('click', exportPdf);
formatMermaidBtn.addEventListener('click', stageFormattedMermaid);
copySourceBtn.addEventListener('click', copySource);
copySvgBtn.addEventListener('click', copySvg);
copyPngBtn.addEventListener('click', copyPng);
renderNowBtn.addEventListener('click', () => renderMermaid(true));
focusToggle.addEventListener('click', () => toggleFocusMode());
zoomOutBtn.addEventListener('click', () => setPreviewScale(previewScale - 0.1));
zoomInBtn.addEventListener('click', () => setPreviewScale(previewScale + 0.1));
zoomResetBtn.addEventListener('click', () => setPreviewScale(1));
jumpErrorBtn.addEventListener('click', jumpToError);
copySnapshotBtn.addEventListener('click', copySnapshotLink);
copySnapshotImportBtn.addEventListener('click', copySnapshotImportLink);
downloadBundleBtn.addEventListener('click', downloadBundle);

aiApiBaseInput.addEventListener('input', persistAiSettingsFromForm);
aiModelInput.addEventListener('input', persistAiSettingsFromForm);
aiApiModeSelect.addEventListener('change', persistAiSettingsFromForm);
aiTemperatureInput.addEventListener('input', persistAiSettingsFromForm);
aiMaxTokensInput.addEventListener('input', persistAiSettingsFromForm);
aiTimeoutInput.addEventListener('input', persistAiSettingsFromForm);
aiApiKeyInput.addEventListener('input', persistAiSettingsFromForm);
aiRememberKeyToggle.addEventListener('change', persistAiSettingsFromForm);

window.addEventListener('keydown', (event) => {
  if (event.code !== 'Space') return;
  if (isTypingElement(event.target)) return;
  isSpaceDown = true;
  preview.classList.add('pan-ready');
  if (event.target instanceof HTMLElement && preview.contains(event.target)) {
    event.preventDefault();
  }
});

window.addEventListener('keyup', (event) => {
  if (event.code !== 'Space') return;
  isSpaceDown = false;
  preview.classList.remove('pan-ready');
  stopPreviewPan();
});

window.addEventListener('blur', () => {
  isSpaceDown = false;
  preview.classList.remove('pan-ready');
  stopPreviewPan();
});

preview.addEventListener('pointerdown', (event) => {
  if (!isSpaceDown) return;
  if (event.button !== 0) return;
  panState.active = true;
  panState.pointerId = event.pointerId;
  panState.startX = event.clientX;
  panState.startY = event.clientY;
  panState.startLeft = preview.scrollLeft;
  panState.startTop = preview.scrollTop;
  preview.classList.add('panning');
  preview.setPointerCapture(event.pointerId);
  event.preventDefault();
});

preview.addEventListener('pointermove', (event) => {
  if (!panState.active || panState.pointerId !== event.pointerId) return;
  const dx = event.clientX - panState.startX;
  const dy = event.clientY - panState.startY;
  preview.scrollLeft = panState.startLeft - dx;
  preview.scrollTop = panState.startTop - dy;
});

preview.addEventListener('pointerup', stopPreviewPan);
preview.addEventListener('pointercancel', stopPreviewPan);

document.querySelectorAll('[data-action]').forEach((button) => {
  if (!(button instanceof HTMLButtonElement)) return;
  const action = button.dataset.action;
  if (action === 'export-svg') button.addEventListener('click', exportSvg);
  if (action === 'export-png') button.addEventListener('click', exportPng);
  if (action === 'export-pdf') button.addEventListener('click', exportPdf);
  if (action === 'copy-svg') button.addEventListener('click', copySvg);
  if (action === 'copy-png') button.addEventListener('click', copyPng);
});

resetBtn.addEventListener('click', () => {
  if (!confirm('Reset editor to the starter diagram?')) return;
  editor.value = DEFAULT_DIAGRAM.trim();
  activeTemplateId = null;
  localStorage.removeItem(TEMPLATE_ACTIVE_KEY);
  renderTemplates();
  scheduleRender();
});

clearHistoryBtn.addEventListener('click', () => {
  if (!confirm('Clear all snapshots? This cannot be undone.')) return;
  clearHistory();
  renderTimeline();
});

downloadHistoryBtn.addEventListener('click', downloadHistory);
downloadExportHistoryBtn.addEventListener('click', downloadExportHistory);
downloadSourceBtn.addEventListener('click', downloadSource);
importFileBtn.addEventListener('click', () => importFileInput.click());
importUrlBtn.addEventListener('click', () => {
  void importMermaidFromUrl();
});
presentationModeBtn.addEventListener('click', () => openPresentationMode());
importFileInput.addEventListener('change', () => {
  void importMermaidFromFile();
});

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
pdfPageSelect.addEventListener('change', persistExportPrefs);
pdfOrientationSelect.addEventListener('change', persistExportPrefs);
pdfMarginSelect.addEventListener('change', persistExportPrefs);
pdfWhiteBgToggle.addEventListener('change', persistExportPrefs);
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
copyLinkNewTab.addEventListener('click', copyShareLinkNewTab);

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

function isAnyModalOpen() {
  return Boolean(shortcutsDialog.open || importUrlDialog.open || presentationDialog.open);
}

/**
 * @param {string | null=} startId
 */
function openPresentationMode(startId = null) {
  const items = loadHistory();
  if (!items.length) {
    showToast('No snapshots to present yet.');
    return;
  }

  // Present oldest -> newest so "Next" moves forward in time.
  presentationItems = items.slice().reverse();
  if (startId) {
    const index = presentationItems.findIndex((entry) => entry.id === startId);
    presentationIndex = index >= 0 ? index : 0;
  } else {
    presentationIndex = 0;
  }

  lastFocusedBeforePresentationDialog = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  if (typeof presentationDialog.showModal === 'function') {
    presentationDialog.showModal();
  } else {
    presentationDialog.setAttribute('open', '');
  }

  presentationClose.focus();
  void renderPresentationSlide();
}

function closePresentationMode() {
  if (typeof presentationDialog.close === 'function') {
    presentationDialog.close();
    return;
  }
  presentationDialog.removeAttribute('open');
  (lastFocusedBeforePresentationDialog || presentationModeBtn).focus();
}

function updatePresentationControls() {
  presentationPrev.disabled = presentationIndex <= 0;
  presentationNext.disabled = presentationIndex >= presentationItems.length - 1;
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/**
 * @param {number} delta
 */
function stepPresentation(delta) {
  if (!presentationItems.length) return;
  const next = clampNumber(presentationIndex + delta, 0, presentationItems.length - 1);
  if (next === presentationIndex) return;
  presentationIndex = next;
  void renderPresentationSlide();
}

async function renderPresentationSlide() {
  const item = presentationItems[presentationIndex] || null;
  updatePresentationControls();
  if (!item) {
    presentationMeta.textContent = 'No snapshots available.';
    presentationStatus.textContent = '';
    presentationContent.innerHTML = '';
    return;
  }

  const seq = (presentationRenderSeq += 1);
  const time = new Date(item.createdAt).toLocaleString();
  presentationMeta.textContent = `${presentationIndex + 1} / ${presentationItems.length} • ${item.message} • ${time}`;

  const code = item.diagram.trim();
  if (!code) {
    presentationStatus.textContent = 'Empty snapshot.';
    presentationContent.innerHTML = '';
    return;
  }

  presentationStatus.textContent = 'Rendering…';
  presentationContent.innerHTML = '';

  try {
    const mermaid = await loadMermaid(document.body.classList.contains('theme-dark') ? 'dark' : 'neutral');
    const { svg } = await mermaid.render(`present-${item.id}-${Date.now()}`, code);
    if (seq !== presentationRenderSeq) return;
    presentationContent.innerHTML = svg;
    presentationStatus.textContent = '';
  } catch (error) {
    if (seq !== presentationRenderSeq) return;
    presentationContent.innerHTML = '';
    presentationStatus.textContent = `Error: ${errorToMessage(error)}`;
  } finally {
    if (seq === presentationRenderSeq) {
      updatePresentationControls();
    }
  }
}

async function togglePresentationFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    if (typeof presentationDialog.requestFullscreen === 'function') {
      await presentationDialog.requestFullscreen();
      return;
    }
    if (typeof document.documentElement.requestFullscreen === 'function') {
      await document.documentElement.requestFullscreen();
    }
  } catch {
    showToast('Fullscreen unavailable.');
  }
}

function syncPresentationFullscreenLabel() {
  presentationFullscreen.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
}

function closeShortcuts() {
  if (typeof shortcutsDialog.close === 'function') {
    shortcutsDialog.close();
  } else {
    shortcutsDialog.removeAttribute('open');
    (lastFocusedBeforeDialog || helpBtn).focus();
  }
}

helpBtn.addEventListener('click', openShortcuts);
shortcutsClose.addEventListener('click', closeShortcuts);
shortcutsDialog.addEventListener('close', () => {
  (lastFocusedBeforeDialog || helpBtn).focus();
});

presentationClose.addEventListener('click', closePresentationMode);
presentationPrev.addEventListener('click', () => stepPresentation(-1));
presentationNext.addEventListener('click', () => stepPresentation(1));
presentationFullscreen.addEventListener('click', () => {
  void togglePresentationFullscreen();
});
presentationDialog.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
    event.preventDefault();
    stepPresentation(-1);
  }
  if (event.key === 'ArrowRight' || event.key === 'PageDown') {
    event.preventDefault();
    stepPresentation(1);
  }
  if (event.key === 'Home') {
    event.preventDefault();
    presentationIndex = 0;
    void renderPresentationSlide();
  }
  if (event.key === 'End') {
    event.preventDefault();
    presentationIndex = Math.max(0, presentationItems.length - 1);
    void renderPresentationSlide();
  }
});
presentationDialog.addEventListener('close', () => {
  (lastFocusedBeforePresentationDialog || presentationModeBtn).focus();
});
document.addEventListener('fullscreenchange', syncPresentationFullscreenLabel);
syncPresentationFullscreenLabel();

importUrlClose.addEventListener('click', () => settleImportUrlDialog(null));
importUrlCancel.addEventListener('click', () => settleImportUrlDialog(null));
importUrlSubmit.addEventListener('click', () => settleImportUrlDialog(importUrlInputEl.value));
importUrlInputEl.addEventListener('keydown', (event) => {
  const isCmd = event.metaKey || event.ctrlKey;
  if (isCmd && event.key === 'Enter') {
    event.preventDefault();
    settleImportUrlDialog(importUrlInputEl.value);
  }
});
importUrlDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  settleImportUrlDialog(null);
});
importUrlDialog.addEventListener('close', () => {
  if (!importUrlResolver) return;
  const resolve = importUrlResolver;
  importUrlResolver = null;
  resolve(null);
  (lastFocusedBeforeImportDialog || importUrlBtn).focus();
});

window.addEventListener('keydown', (event) => {
  const isCmd = event.metaKey || event.ctrlKey;
  const isEditableTarget =
    event.target instanceof HTMLTextAreaElement ||
    event.target instanceof HTMLInputElement ||
    (event.target instanceof HTMLElement && event.target.isContentEditable);

  if (isCmd && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    tabSearchInput.focus();
    tabSearchInput.select();
    return;
  }

  if (event.altKey && !isCmd && /^[1-9]$/.test(event.key) && !isEditableTarget) {
    const index = Number(event.key) - 1;
    const visibleTabs = getVisibleTabs();
    const targetTab = visibleTabs[index] || null;
    if (targetTab) {
      event.preventDefault();
      setActiveTab(targetTab.id);
    }
  }

  if (!isCmd && event.key === '/' && !isEditableTarget && !isAnyModalOpen()) {
    event.preventDefault();
    tabSearchInput.focus();
    tabSearchInput.select();
    return;
  }

  if (isCmd && event.key === 'Enter') {
    event.preventDefault();
    void applyPatch();
  }
  if (isCmd && event.key.toLowerCase() === 's') {
    event.preventDefault();
    commitSnapshot();
  }
  if (!isCmd && event.key.toLowerCase() === 'f') {
    if (!isEditableTarget) {
      event.preventDefault();
      toggleFocusMode();
    }
  }
  if (event.key === 'Escape' && document.body.classList.contains('focus-mode')) {
    event.preventDefault();
    toggleFocusMode(false);
  }
  if (!isCmd && event.key === '?' && !shortcutsDialog.open) {
    if (!isEditableTarget) {
      event.preventDefault();
      openShortcuts();
    }
  }

  if (!isCmd && event.key.toLowerCase() === 'p' && !isAnyModalOpen()) {
    if (!isEditableTarget) {
      event.preventDefault();
      openPresentationMode();
    }
  }
});

init();
