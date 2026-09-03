'use strict';

/* global DOMPurify */

const $ = (sel) => document.querySelector(sel);

const el = {
  body: document.body,
  app: $('#app'),
  sidebar: $('#sidebar'),
  splitter: $('#splitter'),
  folderName: $('#folder-name'),
  fileTree: $('#file-tree'),
  treeEmpty: $('#tree-empty'),
  editor: $('#editor'),
  preview: $('#preview'),
  workspace: $('#workspace'),
  viewToggle: $('#view-toggle'),
  fileLabel: $('#file-label'),
  dirtyDot: $('#dirty-dot'),
  cursorInfo: $('#cursor-info'),
  wordCount: $('#word-count'),
  btnTheme: $('#btn-theme'),
  btnSave: $('#btn-save'),
  btnOpenFolder: $('#btn-open-folder'),
  btnOpenFolder2: $('#btn-open-folder-2'),
  btnRefresh: $('#btn-refresh'),
  sidebarTabs: $('#sidebar-tabs'),
  graphLegend: $('#graph-legend'),
  graphStats: $('#graph-stats'),
  graphPane: $('#graph-pane'),
  graphCanvas: $('#graph-canvas'),
  graphEmpty: $('#graph-empty'),
  btnGraphRefresh: $('#btn-graph-refresh'),
  btnGraphFit: $('#btn-graph-fit'),
  btnGraphLocate: $('#btn-graph-locate')
};

const state = {
  rootDir: null,
  currentPath: null,   // null => untitled buffer
  savedContent: '',
  dirty: false,
  view: 'split',
  activeRow: null
};

/** Resolves once session restore has finished (see init at the bottom). */
let bootPromise = null;
/** Path handed to us by the CLI / a file association, if any. */
let pendingExternalOpen = null;
/** Lazily created link-graph controller (see graph.js). */
let graph = null;
/** True while the graph is showing instead of the editor. */
let graphMode = false;
/** Set when the folder changed while the graph was hidden. */
let graphStale = true;

/* ============================================================ Storage === */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } }
};

/* ============================================================== Theme === */
function applyTheme(theme) {
  el.body.dataset.theme = theme;
  el.btnTheme.innerHTML = theme === 'dark' ? '&#9788;' : '&#9789;'; // sun / moon
  el.btnTheme.title = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  store.set('theme', theme);
  if (graph) graph.refreshTheme();
}
function toggleTheme() {
  applyTheme(el.body.dataset.theme === 'dark' ? 'light' : 'dark');
}

/* =============================================================== View === */
function setView(view) {
  state.view = view;
  // classList, not className — assigning the whole thing would drop mode-graph.
  el.workspace.classList.remove('view-code', 'view-split', 'view-preview');
  el.workspace.classList.add('view-' + view);
  el.viewToggle.querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  store.set('view', view);
  if (view !== 'code') renderPreview();
}

/* ============================================================ Preview === */
let previewTimer = null;
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, 120);
}
function renderPreview() {
  if (state.view === 'code') return;
  const md = el.editor.value;
  if (!md.trim()) {
    el.preview.innerHTML = '<p class="placeholder">Nothing to preview yet.</p>';
    return;
  }
  const rawHtml = window.api.renderMarkdown(md);
  el.preview.innerHTML = DOMPurify.sanitize(rawHtml, { ADD_ATTR: ['target'] });
}

/* ========================================================= Dirty state = */
function setDirty(dirty) {
  state.dirty = dirty;
  el.dirtyDot.hidden = !dirty;
}
function currentName() {
  return state.currentPath ? state.currentPath.split(/[\\/]/).pop() : 'untitled.md';
}
function refreshFileLabel() {
  el.fileLabel.textContent = currentName();
  document.title = (state.dirty ? '• ' : '') + currentName() + ' — Markpad';
}

/* ========================================================== Word count = */
function updateCounts() {
  const text = el.editor.value;
  const words = (text.match(/[^\s]+/g) || []).length;
  el.wordCount.textContent = words + (words === 1 ? ' word' : ' words');

  const pos = el.editor.selectionStart;
  const before = text.slice(0, pos);
  const line = before.split('\n').length;
  const col = pos - before.lastIndexOf('\n');
  el.cursorInfo.textContent = `Ln ${line}, Col ${col}`;
}

/* ========================================================= Editor sync = */
function onEditorInput() {
  setDirty(el.editor.value !== state.savedContent);
  refreshFileLabel();
  updateCounts();
  schedulePreview();
}

/* ============================================================ File I/O = */
async function confirmDiscard() {
  if (!state.dirty) return true;
  return window.confirm(`"${currentName()}" has unsaved changes.\n\nDiscard them?`);
}

async function openFolder(dirPath) {
  const dir = dirPath || (await window.api.openFolder());
  if (!dir) return;
  state.rootDir = dir;
  el.folderName.textContent = dir.split(/[\\/]/).pop().toUpperCase();
  el.folderName.title = dir;
  el.treeEmpty.hidden = true;
  el.fileTree.hidden = false;
  store.set('rootDir', dir);
  graphStale = true;
  await buildTree(dir, el.fileTree);
  if (graphMode) loadGraph();
}

async function refreshTree() {
  if (state.rootDir) await buildTree(state.rootDir, el.fileTree);
}

async function buildTree(dirPath, container) {
  let entries;
  try {
    entries = await window.api.readDir(dirPath);
  } catch (err) {
    container.innerHTML = `<li class="tree-empty">Cannot read folder</li>`;
    return;
  }
  container.innerHTML = '';
  for (const entry of entries) {
    container.appendChild(makeTreeItem(entry));
  }
}

function makeTreeItem(entry) {
  const li = document.createElement('li');
  li.className = 'tree-item ' + (entry.isDirectory ? 'dir' : 'file');
  if (!entry.isDirectory) {
    li.classList.add(entry.isMarkdown ? 'markdown' : entry.isText ? 'text' : 'non-text');
  }

  const row = document.createElement('div');
  row.className = 'tree-row';

  const twisty = document.createElement('span');
  twisty.className = 'twisty';
  twisty.textContent = entry.isDirectory ? '▶' : '';
  row.appendChild(twisty);

  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = entry.name;
  row.appendChild(label);

  li.appendChild(row);

  if (entry.isDirectory) {
    const childUl = document.createElement('ul');
    childUl.className = 'tree-children';
    childUl.hidden = true;
    li.appendChild(childUl);
    let loaded = false;
    row.addEventListener('click', async () => {
      childUl.hidden = !childUl.hidden;
      row.classList.toggle('open', !childUl.hidden);
      if (!loaded && !childUl.hidden) {
        loaded = true;
        await buildTree(entry.path, childUl);
      }
    });
  } else {
    row.addEventListener('click', () => openFile(entry.path, row));
  }
  return li;
}

async function openFile(filePath, row) {
  if (state.currentPath === filePath && !state.dirty) return;
  if (!(await confirmDiscard())) return;
  let content;
  try {
    content = await window.api.readFile(filePath);
  } catch (err) {
    window.alert('Cannot open file: ' + err.message);
    return;
  }
  state.currentPath = filePath;
  state.savedContent = content;
  el.editor.value = content;
  // Assigning .value parks the caret at the end of the text, and the focus()
  // below would then scroll there — so open files land at the top instead.
  el.editor.selectionStart = el.editor.selectionEnd = 0;
  setDirty(false);
  refreshFileLabel();
  updateCounts();
  renderPreview();
  el.editor.scrollTop = 0;
  el.editor.focus();

  if (state.activeRow) state.activeRow.classList.remove('active');
  if (row) { row.classList.add('active'); state.activeRow = row; }
  store.set('lastFile', filePath);
  syncGraphActive();
}

async function newFile() {
  if (!(await confirmDiscard())) return;
  state.currentPath = null;
  state.savedContent = '';
  el.editor.value = '';
  setDirty(false);
  refreshFileLabel();
  updateCounts();
  renderPreview();
  if (state.activeRow) { state.activeRow.classList.remove('active'); state.activeRow = null; }
  el.editor.focus();
}

async function save() {
  if (!state.currentPath) return saveAs();
  try {
    await window.api.writeFile(state.currentPath, el.editor.value);
  } catch (err) {
    window.alert('Save failed: ' + err.message);
    return;
  }
  state.savedContent = el.editor.value;
  setDirty(false);
  refreshFileLabel();
  graphStale = true;   // the edit may have added or removed links
}

async function saveAs() {
  const newPath = await window.api.saveFileAs(el.editor.value);
  if (!newPath) return;
  state.currentPath = newPath;
  state.savedContent = el.editor.value;
  setDirty(false);
  refreshFileLabel();
  if (state.rootDir && newPath.startsWith(state.rootDir)) refreshTree();
}

/* ================================================= Markdown formatting = */
function getSel() {
  const ta = el.editor;
  return { start: ta.selectionStart, end: ta.selectionEnd, text: ta.value.slice(ta.selectionStart, ta.selectionEnd) };
}

function replaceRange(start, end, text, selectInserted) {
  const ta = el.editor;
  ta.focus();
  ta.setRangeText(text, start, end, selectInserted ? 'select' : 'end');
  onEditorInput();
}

function wrapInline(marker, placeholder) {
  const ta = el.editor;
  const { start, end, text } = getSel();
  if (text) {
    // toggle off if already wrapped
    const outer = ta.value.slice(start - marker.length, end + marker.length);
    if (outer === marker + text + marker) {
      replaceRange(start - marker.length, end + marker.length, text, true);
      return;
    }
    replaceRange(start, end, marker + text + marker, true);
  } else {
    const body = placeholder || '';
    replaceRange(start, end, marker + body + marker, false);
    ta.selectionStart = start + marker.length;
    ta.selectionEnd = start + marker.length + body.length;
  }
}

function toggleLinePrefix(prefixFn) {
  const ta = el.editor;
  const { start, end } = getSel();
  const value = ta.value;
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  let lineEnd = value.indexOf('\n', end);
  if (lineEnd === -1) lineEnd = value.length;
  const lines = value.slice(lineStart, lineEnd).split('\n');

  // Determine if every non-empty line already has a matching prefix
  const rx = prefixFn.match;
  const allHave = lines.every((l) => l.trim() === '' || rx.test(l));
  const newLines = lines.map((l, i) => {
    if (allHave) return l.replace(rx, '');
    return prefixFn.add(l, i);
  });
  replaceRange(lineStart, lineEnd, newLines.join('\n'), true);
}

function insertBlock(text) {
  const ta = el.editor;
  const { start, end } = getSel();
  const value = ta.value;
  const before = value.slice(0, start);
  const needsNlBefore = before.length > 0 && !before.endsWith('\n\n') && !before.endsWith('\n') ? '\n\n'
    : before.endsWith('\n') && !before.endsWith('\n\n') ? '\n' : '';
  const after = value.slice(end);
  const needsNlAfter = after.startsWith('\n') ? '' : '\n';
  replaceRange(start, end, needsNlBefore + text + needsNlAfter, false);
}

const commands = {
  h1: () => toggleLinePrefix({ match: /^#{1}\s/, add: (l) => '# ' + l.replace(/^#+\s*/, '') }),
  h2: () => toggleLinePrefix({ match: /^#{2}\s/, add: (l) => '## ' + l.replace(/^#+\s*/, '') }),
  h3: () => toggleLinePrefix({ match: /^#{3}\s/, add: (l) => '### ' + l.replace(/^#+\s*/, '') }),
  bold: () => wrapInline('**', 'bold text'),
  italic: () => wrapInline('*', 'italic text'),
  strike: () => wrapInline('~~', 'strikethrough'),
  code: () => wrapInline('`', 'code'),
  quote: () => toggleLinePrefix({ match: /^>\s?/, add: (l) => '> ' + l }),
  ul: () => toggleLinePrefix({ match: /^[-*]\s/, add: (l) => '- ' + l }),
  ol: () => toggleLinePrefix({ match: /^\d+\.\s/, add: (l, i) => `${i + 1}. ` + l }),
  task: () => toggleLinePrefix({ match: /^[-*]\s\[[ x]\]\s/, add: (l) => '- [ ] ' + l }),
  codeblock: () => insertBlock('```\n' + (getSel().text || 'code') + '\n```'),
  hr: () => insertBlock('---'),
  table: () => insertBlock(
    '| Column A | Column B |\n| --- | --- |\n| Cell 1 | Cell 2 |\n| Cell 3 | Cell 4 |'
  ),
  link: () => {
    const { start, end, text } = getSel();
    const label = text || 'link text';
    const snippet = `[${label}](https://)`;
    replaceRange(start, end, snippet, false);
    const urlPos = start + label.length + 3;
    el.editor.selectionStart = urlPos;
    el.editor.selectionEnd = urlPos + 8; // "https://"
  },
  image: () => {
    const { start, end, text } = getSel();
    const alt = text || 'alt text';
    const snippet = `![${alt}](https://)`;
    replaceRange(start, end, snippet, false);
    const urlPos = start + alt.length + 4;
    el.editor.selectionStart = urlPos;
    el.editor.selectionEnd = urlPos + 8;
  }
};

function runCommand(cmd) {
  const fn = commands[cmd];
  if (fn) fn();
}

/* ======================================================== Link graph === */

/** Last payload from the main process, kept so we can map paths -> node ids. */
let graphData = null;

function ensureGraph() {
  if (!graph) {
    graph = window.createGraphView(el.graphCanvas, {
      // Double-click opens the note and drops back into the editor.
      onOpen: async (node) => {
        await openFile(node.path, null);
        setSidebarTab('files');
      }
    });
  }
  return graph;
}

function showGraphMessage(html) {
  el.graphEmpty.innerHTML = html;
  el.graphEmpty.hidden = !html;
}

async function loadGraph({ force = false } = {}) {
  if (!graphMode) return;
  ensureGraph();

  if (!state.rootDir) {
    graphData = null;
    graph.setData({ nodes: [], edges: [] });
    el.graphStats.textContent = '';
    showGraphMessage('<strong>No folder open</strong><span>Open a folder to map the links between its notes.</span>');
    return;
  }
  if (!force && !graphStale && graphData) { graph.redraw(); return; }

  showGraphMessage('<strong>Scanning…</strong><span>Reading the Markdown files in this folder.</span>');
  let data;
  try {
    data = await window.api.buildGraph(state.rootDir);
  } catch (err) {
    showGraphMessage('<strong>Could not build the map</strong><span>' + err.message + '</span>');
    return;
  }
  if (!graphMode) return;                      // user switched tabs mid-scan

  graphData = data;
  graphStale = false;
  graph.setData(data);
  syncGraphActive();
  graph.fit();

  const { files, links, unresolved } = data.stats;
  const orphans = data.nodes.filter((n) => n.out === 0 && n.in === 0).length;
  el.graphStats.innerHTML =
    `<b>${files}</b> note${files === 1 ? '' : 's'}<br>` +
    `<b>${links}</b> link${links === 1 ? '' : 's'}<br>` +
    `<b>${orphans}</b> orphan${orphans === 1 ? '' : 's'}` +
    (unresolved ? `<br><b>${unresolved}</b> broken link${unresolved === 1 ? '' : 's'}` : '') +
    (data.truncated ? '<br><em>(folder too large — truncated)</em>' : '');

  showGraphMessage(files === 0
    ? '<strong>No Markdown files here</strong><span>This folder has no .md files to map.</span>'
    : '');
}

/** Ring the node for whichever file is currently open. */
function syncGraphActive() {
  if (!graph || !graphData) return;
  const node = graphData.nodes.find((n) => n.path === state.currentPath);
  graph.setActive(node ? node.id : null);
}

function setSidebarTab(tab) {
  graphMode = tab === 'graph';
  el.sidebarTabs.querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  el.graphLegend.hidden = !graphMode;
  document.getElementById('file-tree-wrap').hidden = graphMode;
  el.workspace.classList.toggle('mode-graph', graphMode);
  document.body.classList.toggle('graph-mode', graphMode);
  store.set('sidebarTab', tab);

  if (graphMode) loadGraph();
  else if (state.view !== 'code') renderPreview();
}

/* ============================================================= Wiring === */

el.sidebarTabs.querySelectorAll('button').forEach((b) => {
  b.addEventListener('click', () => setSidebarTab(b.dataset.tab));
});
el.btnGraphRefresh.addEventListener('click', () => loadGraph({ force: true }));
el.btnGraphFit.addEventListener('click', () => graph && graph.fit());
el.btnGraphLocate.addEventListener('click', () => {
  if (!graph || !graphData) return;
  const node = graphData.nodes.find((n) => n.path === state.currentPath);
  if (node) graph.focusNode(node.id);
});
document.querySelectorAll('.tb-btn').forEach((btn) => {
  btn.addEventListener('click', () => runCommand(btn.dataset.cmd));
});

el.viewToggle.querySelectorAll('button').forEach((b) => {
  b.addEventListener('click', () => setView(b.dataset.view));
});

el.editor.addEventListener('input', onEditorInput);
el.editor.addEventListener('keyup', updateCounts);
el.editor.addEventListener('click', updateCounts);

// Tab inserts two spaces
el.editor.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    replaceRange(el.editor.selectionStart, el.editor.selectionEnd, '  ', false);
  }
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
    const map = { b: 'bold', i: 'italic', e: 'code', k: 'link' };
    if (map[e.key.toLowerCase()]) { e.preventDefault(); runCommand(map[e.key.toLowerCase()]); }
    if (e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
  }
});

el.btnTheme.addEventListener('click', toggleTheme);
el.btnSave.addEventListener('click', save);
el.btnOpenFolder.addEventListener('click', () => openFolder());
el.btnOpenFolder2.addEventListener('click', () => openFolder());
el.btnRefresh.addEventListener('click', refreshTree);

// Menu actions from main process
window.api.onMenu((action) => {
  switch (action) {
    case 'open-folder': openFolder(); break;
    case 'open-file': openFileDialog(); break;
    case 'new-file': newFile(); break;
    case 'save': save(); break;
    case 'save-as': saveAs(); break;
    case 'view-code': setView('code'); break;
    case 'view-split': setView('split'); break;
    case 'view-preview': setView('preview'); break;
    case 'toggle-theme': toggleTheme(); break;
    case 'toggle-sidebar': el.app.classList.toggle('sidebar-hidden'); break;
    case 'fmt-bold': runCommand('bold'); break;
    case 'fmt-italic': runCommand('italic'); break;
    case 'fmt-code': runCommand('code'); break;
    case 'fmt-link': runCommand('link'); break;
  }
});

window.api.onOpenPath(async (filePath) => {
  pendingExternalOpen = filePath;
  // Session restore races this handler for the editor buffer. Wait for it to
  // settle so the file the user actually asked for is the one that sticks.
  try { await bootPromise; } catch { /* restore failed — open anyway */ }
  if (!state.rootDir) {
    const dir = await window.api.dirname(filePath);
    await openFolder(dir);
  }
  await openFile(filePath, null);
});

async function openFileDialog() {
  const filePath = await window.api.openFile();
  if (!filePath) return;
  if (!state.rootDir) {
    const dir = await window.api.dirname(filePath);
    await openFolder(dir);
  }
  await openFile(filePath, null);
}

// Warn on close with unsaved changes
window.addEventListener('beforeunload', (e) => {
  if (state.dirty) {
    e.returnValue = false;
  }
});

/* ============================================================ Splitter = */
(function initSplitter() {
  let dragging = false;
  el.splitter.addEventListener('mousedown', () => { dragging = true; document.body.style.cursor = 'col-resize'; });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const w = Math.min(Math.max(e.clientX, 150), 520);
    document.documentElement.style.setProperty('--sidebar-w', w + 'px');
  });
  window.addEventListener('mouseup', () => {
    if (dragging) {
      dragging = false;
      document.body.style.cursor = '';
      const w = getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w').trim();
      store.set('sidebarW', w);
    }
  });
})();

/* ============================================================== Init === */
bootPromise = (async function init() {
  applyTheme(store.get('theme', 'dark'));
  setView(store.get('view', 'split'));

  const savedW = store.get('sidebarW', null);
  if (savedW) document.documentElement.style.setProperty('--sidebar-w', savedW);

  const rootDir = store.get('rootDir', null);
  if (rootDir) {
    try { await openFolder(rootDir); } catch { /* folder gone */ }
  }

  // Skip the restore entirely when a file was passed on the command line or
  // by a file association — that file is about to replace it anyway.
  const lastFile = pendingExternalOpen ? null : store.get('lastFile', null);
  if (lastFile) {
    try {
      const content = await window.api.readFile(lastFile);
      state.currentPath = lastFile;
      state.savedContent = content;
      el.editor.value = content;
      el.editor.selectionStart = el.editor.selectionEnd = 0;
    } catch { /* file gone */ }
  }

  setDirty(false);
  refreshFileLabel();
  updateCounts();
  renderPreview();
  el.editor.focus();

  setSidebarTab(store.get('sidebarTab', 'files'));
})();
