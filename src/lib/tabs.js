/**
 * @typedef {{id: string, title: string, diagram: string, createdAt: number, updatedAt: number}} DiagramTab
 */

/**
 * @typedef {{now?: number, createId?: () => string}} TabNormalizeOptions
 */

/**
 * @param {string} defaultDiagram
 * @param {TabNormalizeOptions=} options
 * @returns {DiagramTab}
 */
export function createDefaultTab(defaultDiagram, options = {}) {
  const now = typeof options.now === 'number' && Number.isFinite(options.now) ? options.now : Date.now();
  const createId = typeof options.createId === 'function' ? options.createId : () => crypto.randomUUID();
  return {
    id: createId(),
    title: 'Main diagram',
    diagram: defaultDiagram,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * @param {unknown} value
 * @param {string} defaultDiagram
 * @param {number} now
 * @param {() => string} createId
 * @returns {DiagramTab | null}
 */
function normalizeTab(value, defaultDiagram, now, createId) {
  if (!value || typeof value !== 'object') return null;
  const raw = /** @type {Record<string, unknown>} */ (value);

  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : createId();
  const titleInput = typeof raw.title === 'string' ? raw.title.trim() : '';
  const title = (titleInput || 'Untitled diagram').slice(0, 40);

  const rawDiagram = typeof raw.diagram === 'string' ? raw.diagram : '';
  const diagram = rawDiagram.trim() ? rawDiagram : defaultDiagram;

  const createdAt =
    typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) && raw.createdAt > 0
      ? raw.createdAt
      : now;
  const updatedAtInput =
    typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) && raw.updatedAt > 0
      ? raw.updatedAt
      : createdAt;

  return {
    id,
    title,
    diagram,
    createdAt,
    updatedAt: Math.max(createdAt, updatedAtInput),
  };
}

/**
 * @param {unknown} tabsPayload
 * @param {unknown} activeTabId
 * @param {string} defaultDiagram
 * @param {TabNormalizeOptions=} options
 * @returns {{tabs: DiagramTab[], activeTabId: string}}
 */
export function normalizeTabsState(tabsPayload, activeTabId, defaultDiagram, options = {}) {
  const now = typeof options.now === 'number' && Number.isFinite(options.now) ? options.now : Date.now();
  const createId = typeof options.createId === 'function' ? options.createId : () => crypto.randomUUID();
  const fallbackDiagram = defaultDiagram.trim() || 'flowchart TD\n  start([Start]) --> end([End])';
  const rawTabs = Array.isArray(tabsPayload) ? tabsPayload : [];

  /** @type {DiagramTab[]} */
  const tabs = [];
  /** @type {Set<string>} */
  const seenIds = new Set();

  rawTabs.forEach((value) => {
    const tab = normalizeTab(value, fallbackDiagram, now, createId);
    if (!tab || seenIds.has(tab.id)) return;
    seenIds.add(tab.id);
    tabs.push(tab);
  });

  if (!tabs.length) {
    const tab = createDefaultTab(fallbackDiagram, { now, createId });
    return { tabs: [tab], activeTabId: tab.id };
  }

  const activeId = typeof activeTabId === 'string' ? activeTabId.trim() : '';
  const hasActive = activeId && tabs.some((tab) => tab.id === activeId);

  return {
    tabs,
    activeTabId: hasActive ? activeId : tabs[0].id,
  };
}
