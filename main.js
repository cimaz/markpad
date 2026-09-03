'use strict';

const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs/promises');

/** @type {BrowserWindow | null} */
let mainWindow = null;

/** File the app was asked to open before the window was ready. */
let pendingOpenPath = null;
/** True once the renderer has loaded and can receive 'open-path'. */
let rendererReady = false;

const TEXT_EXTENSIONS = ['md', 'markdown', 'mdown', 'mkd', 'txt', 'text'];
const TEXT_RE = /\.(md|markdown|mdown|mkd|txt|text)$/i;

/** Queue a file to open, or send it straight through if the UI is up. */
function requestOpenPath(filePath) {
  if (!filePath) return;
  const resolved = path.resolve(filePath);
  if (rendererReady && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('open-path', resolved);
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  } else {
    pendingOpenPath = resolved;
  }
}

/** Pull a file path out of argv (Windows/Linux file associations, CLI use). */
function fileFromArgv(argv) {
  return argv.slice(1).find((a) => !a.startsWith('-') && TEXT_RE.test(a)) || null;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 780,
    minHeight: 480,
    backgroundColor: '#1e1e1e',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.webContents.once('did-finish-load', () => {
    rendererReady = true;
    const target = pendingOpenPath || fileFromArgv(process.argv);
    pendingOpenPath = null;
    if (target) mainWindow.webContents.send('open-path', path.resolve(target));
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    rendererReady = false;
  });
}

function sendMenu(action) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('menu', action);
  }
}

function buildMenu() {
  const isMac = process.platform === 'darwin';

  /** @type {Electron.MenuItemConstructorOptions[]} */
  const template = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
          ]
        }]
      : []),
    {
      label: 'File',
      submenu: [
        { label: 'New File', accelerator: 'CmdOrCtrl+N', click: () => sendMenu('new-file') },
        { type: 'separator' },
        { label: 'Open Folder…', accelerator: 'CmdOrCtrl+Shift+O', click: () => sendMenu('open-folder') },
        { label: 'Open File…', accelerator: 'CmdOrCtrl+O', click: () => sendMenu('open-file') },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => sendMenu('save') },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: () => sendMenu('save-as') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'Format',
      submenu: [
        { label: 'Bold', accelerator: 'CmdOrCtrl+B', click: () => sendMenu('fmt-bold') },
        { label: 'Italic', accelerator: 'CmdOrCtrl+I', click: () => sendMenu('fmt-italic') },
        { label: 'Inline Code', accelerator: 'CmdOrCtrl+E', click: () => sendMenu('fmt-code') },
        { label: 'Link', accelerator: 'CmdOrCtrl+K', click: () => sendMenu('fmt-link') }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Editor Only', accelerator: 'CmdOrCtrl+1', click: () => sendMenu('view-code') },
        { label: 'Split', accelerator: 'CmdOrCtrl+2', click: () => sendMenu('view-split') },
        { label: 'Preview Only', accelerator: 'CmdOrCtrl+3', click: () => sendMenu('view-preview') },
        { type: 'separator' },
        { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+\\', click: () => sendMenu('toggle-sidebar') },
        { label: 'Toggle Light/Dark Theme', accelerator: 'CmdOrCtrl+T', click: () => sendMenu('toggle-theme') },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' },
        { role: 'reload' }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ---------------------------------------------------------------- IPC ---- */

ipcMain.handle('dialog:openFolder', async () => {
  const res = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (res.canceled || res.filePaths.length === 0) return null;
  return res.filePaths[0];
});

ipcMain.handle('dialog:openFile', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Markdown / Text', extensions: TEXT_EXTENSIONS },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (res.canceled || res.filePaths.length === 0) return null;
  return res.filePaths[0];
});

ipcMain.handle('dialog:saveFileAs', async (_e, content) => {
  const res = await dialog.showSaveDialog(mainWindow, {
    defaultPath: 'untitled.md',
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  });
  if (res.canceled || !res.filePath) return null;
  await fs.writeFile(res.filePath, content ?? '', 'utf-8');
  return res.filePath;
});

ipcMain.handle('fs:readDir', async (_e, dirPath) => {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((en) => !en.name.startsWith('.'))
    .map((en) => {
      const isDirectory = en.isDirectory();
      const ext = path.extname(en.name).slice(1).toLowerCase();
      return {
        name: en.name,
        path: path.join(dirPath, en.name),
        isDirectory,
        isMarkdown: !isDirectory && ['md', 'markdown', 'mdown', 'mkd'].includes(ext),
        isText: !isDirectory && TEXT_EXTENSIONS.includes(ext)
      };
    })
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
});

ipcMain.handle('fs:readFile', async (_e, filePath) => {
  return fs.readFile(filePath, 'utf-8');
});

ipcMain.handle('fs:writeFile', async (_e, filePath, content) => {
  await fs.writeFile(filePath, content, 'utf-8');
  return true;
});

ipcMain.handle('path:dirname', (_e, p) => path.dirname(p));
ipcMain.handle('path:basename', (_e, p) => path.basename(p));

/* ------------------------------------------------------------ link graph -- */

const MD_EXTS = ['md', 'markdown', 'mdown', 'mkd'];
const GRAPH_SKIP_DIRS = new Set([
  'node_modules', 'dist', 'distro', 'out', 'build', 'vendor', 'target',
  '.git', '.svn', '.hg', '.obsidian', '.trash'
]);
const GRAPH_MAX_FILES = 4000;
const GRAPH_MAX_BYTES = 1024 * 1024;

const isMarkdown = (name) => MD_EXTS.includes(path.extname(name).slice(1).toLowerCase());
/** Drop the extension, but only if it is a Markdown one. */
const stripMdExt = (p) => (isMarkdown(p) ? p.slice(0, p.length - path.extname(p).length) : p);

/** Walk the tree collecting Markdown files. Symlinks are skipped (isDirectory()
 *  is false for them), so cyclic links cannot trap us. */
async function collectMarkdown(dir, acc) {
  if (acc.length >= GRAPH_MAX_FILES) return;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return; // unreadable directory — skip it rather than fail the whole graph
  }
  for (const en of entries) {
    if (acc.length >= GRAPH_MAX_FILES) return;
    if (en.name.startsWith('.')) continue;
    const full = path.join(dir, en.name);
    if (en.isDirectory()) {
      if (!GRAPH_SKIP_DIRS.has(en.name)) await collectMarkdown(full, acc);
    } else if (en.isFile() && isMarkdown(en.name)) {
      acc.push(full);
    }
  }
}

/** Remove fenced and inline code so `[[not a link]]` in a snippet is ignored. */
function stripCode(text) {
  return text
    .replace(/```[\s\S]*?(?:```|$)/g, ' ')
    .replace(/^~~~[\s\S]*?(?:^~~~|$)/gm, ' ')
    .replace(/`[^`\n]*`/g, ' ');
}

const WIKI_RE = /\[\[([^\][\n|#]+)(?:#[^\]\n|]*)?(?:\|[^\]\n]*)?\]\]/g;
const MDLINK_RE = /\[[^\]\n]*\]\(\s*<?([^)>\s]+)>?(?:\s+["'][^"'\n]*["'])?\s*\)/g;

/** Pull out every internal link target, as written in the document. */
function extractTargets(text) {
  const body = stripCode(text);
  const out = [];
  let m;
  WIKI_RE.lastIndex = 0;
  while ((m = WIKI_RE.exec(body)) !== null) out.push({ raw: m[1].trim(), wiki: true });
  MDLINK_RE.lastIndex = 0;
  while ((m = MDLINK_RE.exec(body)) !== null) out.push({ raw: m[1].trim(), wiki: false });
  return out;
}

ipcMain.handle('graph:build', async (_e, rootDir) => {
  if (!rootDir) return { nodes: [], edges: [], stats: { files: 0, links: 0, unresolved: 0 }, truncated: false };

  const files = [];
  await collectMarkdown(rootDir, files);
  const truncated = files.length >= GRAPH_MAX_FILES;

  // id === path relative to the root, with forward slashes.
  const ids = files.map((f) => path.relative(rootDir, f).split(path.sep).join('/'));

  const byPath = new Map();   // 'notes/foo.md' and 'notes/foo' -> id
  const byName = new Map();   // 'foo' -> [id, ...]   (Obsidian-style bare wikilinks)
  ids.forEach((id) => {
    byPath.set(id.toLowerCase(), id);
    byPath.set(stripMdExt(id).toLowerCase(), id);
    const base = stripMdExt(path.posix.basename(id)).toLowerCase();
    if (!byName.has(base)) byName.set(base, []);
    byName.get(base).push(id);
  });

  /** Resolve one link target.
   *  Returns a node id, `null` when the target is not a note at all (external
   *  URL, bare anchor, image or other asset — those are not broken links), or
   *  MISSING when it does look like a note but no such file exists. */
  const MISSING = Symbol('missing');
  function resolve(fromId, raw, isWiki) {
    let t = raw.replace(/\\/g, '/').split('#')[0].trim();
    if (!t) return null;                                                    // "#section"
    if (/^[a-z][a-z0-9+.-]*:/i.test(t) || t.startsWith('//')) return null;  // http:, mailto:, …
    try { t = decodeURIComponent(t); } catch { /* keep it as written */ }

    const ext = path.posix.extname(t).slice(1).toLowerCase();
    if (ext && !MD_EXTS.includes(ext)) return null;                         // pic.png, doc.pdf …

    const tries = [];
    if (!isWiki || t.includes('/')) {
      // Relative to the linking file.
      const rel = path.posix.normalize(path.posix.join(path.posix.dirname(fromId), t));
      if (!rel.startsWith('..')) tries.push(rel, rel + '.md');
    }
    // Relative to the vault root.
    const fromRoot = path.posix.normalize(t).replace(/^\.\//, '');
    if (!fromRoot.startsWith('..')) tries.push(fromRoot, fromRoot + '.md');

    for (const cand of tries) {
      const hit = byPath.get(cand.toLowerCase());
      if (hit) return hit;
    }
    // Bare name, the common wikilink case.
    const named = byName.get(stripMdExt(path.posix.basename(t)).toLowerCase());
    return named ? named[0] : MISSING;
  }

  const edgeKeys = new Set();
  const edges = [];
  const outDeg = new Map();
  const inDeg = new Map();
  let unresolved = 0;

  // Read in batches so a big vault does not open thousands of handles at once.
  for (let i = 0; i < files.length; i += 32) {
    const batch = files.slice(i, i + 32);
    const texts = await Promise.all(batch.map(async (f) => {
      try {
        const st = await fs.stat(f);
        if (st.size > GRAPH_MAX_BYTES) return '';
        return await fs.readFile(f, 'utf-8');
      } catch { return ''; }
    }));

    texts.forEach((text, j) => {
      const fromId = ids[i + j];
      for (const { raw, wiki } of extractTargets(text)) {
        const toId = resolve(fromId, raw, wiki);
        if (toId === null) continue;                   // not a note reference
        if (toId === MISSING) { unresolved++; continue; }
        if (toId === fromId) continue;                 // ignore self-links
        const key = fromId + ' ' + toId;
        if (edgeKeys.has(key)) continue;               // collapse duplicates
        edgeKeys.add(key);
        edges.push({ source: fromId, target: toId });
        outDeg.set(fromId, (outDeg.get(fromId) || 0) + 1);
        inDeg.set(toId, (inDeg.get(toId) || 0) + 1);
      }
    });
  }

  const nodes = ids.map((id) => ({
    id,
    label: stripMdExt(path.posix.basename(id)),
    dir: path.posix.dirname(id) === '.' ? '' : path.posix.dirname(id),
    path: path.join(rootDir, id.split('/').join(path.sep)),
    out: outDeg.get(id) || 0,
    in: inDeg.get(id) || 0
  }));

  return {
    nodes,
    edges,
    truncated,
    stats: { files: nodes.length, links: edges.length, unresolved }
  };
});

/* -------------------------------------------------------------- lifecycle */

// macOS delivers file-association / "Open With" targets through this event,
// which can fire before the app is ready — hence the pending queue.
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  requestOpenPath(filePath);
});

// One instance only: a second launch (e.g. double-clicking a .md on Linux)
// hands its argv to the running app instead of starting a new copy.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    requestOpenPath(fileFromArgv(argv));
  });

  app.whenReady().then(() => {
    buildMenu();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
