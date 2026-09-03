'use strict';

const { contextBridge, ipcRenderer } = require('electron');
const { marked } = require('marked');

marked.setOptions({
  gfm: true,
  breaks: false,
  headerIds: true,
  mangle: false
});

contextBridge.exposeInMainWorld('api', {
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFileAs: (content) => ipcRenderer.invoke('dialog:saveFileAs', content),

  readDir: (dirPath) => ipcRenderer.invoke('fs:readDir', dirPath),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', filePath, content),

  dirname: (p) => ipcRenderer.invoke('path:dirname', p),
  basename: (p) => ipcRenderer.invoke('path:basename', p),

  buildGraph: (rootDir) => ipcRenderer.invoke('graph:build', rootDir),

  onMenu: (callback) => ipcRenderer.on('menu', (_e, action) => callback(action)),
  onOpenPath: (callback) => ipcRenderer.on('open-path', (_e, filePath) => callback(filePath)),

  renderMarkdown: (md) => marked.parse(md ?? '')
});
