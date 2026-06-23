const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("dianjing", {
  onOpen: (cb) => ipcRenderer.on("polish:open", (e, d) => cb(d)),
  onChunk: (cb) => ipcRenderer.on("polish:chunk", (e, c) => cb(c)),
  onModelReady: (cb) => ipcRenderer.on("model:ready", () => cb()),
  scenes: () => ipcRenderer.invoke("polish:scenes"),
  run: (scene, text) => ipcRenderer.invoke("polish:run", { scene, text }),
  replace: (text) => ipcRenderer.invoke("polish:replace", text),
  copy: (text) => ipcRenderer.invoke("polish:copy", text),
  close: () => ipcRenderer.invoke("polish:close"),
});
