const { app, globalShortcut, BrowserWindow, ipcMain, Menu, clipboard, Notification } = require("electron");
const path = require("path");
const textCapture = require("./src/textCapture.js");
const polishService = require("./src/polishService.js");
const modelManager = require("./src/modelManager.js");
const { SCENES } = require("./src/polishPrompts.js");

let popup = null;
let modelReady = false;
let capturedPrior = "";

function notify(msg) { try { new Notification({ title: "點睛 Dianjing", body: msg }).show(); } catch {} }

function createPopup() {
  popup = new BrowserWindow({
    width: 580, height: 560, show: false, frame: false, resizable: true,
    alwaysOnTop: true, skipTaskbar: true,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  popup.loadFile(path.join(__dirname, "src", "popup.html"));
  popup.on("close", (e) => { e.preventDefault(); popup.hide(); }); // 關閉 → 隱藏(常駐)
}

async function onHotkey() {
  try {
    const { text, prior } = await textCapture.captureSelection();
    if (!text || !text.trim()) { notify("請先選取文字,再按 Alt+I"); return; }
    capturedPrior = prior;
    if (popup) {
      popup.show();
      popup.webContents.send("polish:open", { text, ready: modelReady });
    }
  } catch (e) { notify("擷取選取文字失敗:" + e.message); }
}

app.whenReady().then(async () => {
  if (process.platform !== "darwin") Menu.setApplicationMenu(null); // 避免 Alt 觸發選單列
  textCapture.init();
  createPopup();

  const modelsDir = process.env.DIANJING_MODELS_DIR || path.join(app.getPath("userData"), "models");
  console.log("[dianjing] models dir:", modelsDir);
  modelManager.ensureModel(modelsDir)
    .then((modelPath) => { console.log("[dianjing] model:", modelPath); return polishService.load(modelPath); })
    .then(() => {
      modelReady = true;
      if (popup && !popup.isDestroyed()) popup.webContents.send("model:ready");
      console.log("[dianjing] MODEL READY");
      // 預熱:背景先跑一次小推論,吸收冷啟動成本,讓使用者第一次潤飾就快。
      polishService.polish({ text: "你好", scene: "general", onChunk: () => {} })
        .then(() => console.log("[dianjing] warmed up")).catch(() => {});
    })
    .catch((e) => { console.error("[dianjing] model load FAILED:", e && e.stack || e); });

  const ok = globalShortcut.register("Alt+I", onHotkey);
  console.log("[dianjing] Alt+I registered:", ok);
});

ipcMain.handle("polish:scenes", () => Object.keys(SCENES).map((k) => ({ key: k, label: SCENES[k].label })));
ipcMain.handle("polish:run", async (e, { scene, text }) => {
  if (!modelReady) return { error: "模型尚未就緒" };
  try {
    await polishService.polish({ text, scene, onChunk: (c) => { if (popup && !popup.isDestroyed()) popup.webContents.send("polish:chunk", c); } });
    return { done: true };
  } catch (err) { return { error: err.message }; }
});
ipcMain.handle("polish:replace", async (e, text) => {
  if (popup) popup.hide();
  await new Promise((r) => setTimeout(r, 120));
  await textCapture.pasteText(text, { prior: capturedPrior });
  return { ok: true };
});
ipcMain.handle("polish:copy", (e, text) => { clipboard.writeText(text); return { ok: true }; });
ipcMain.handle("polish:close", () => { if (popup) popup.hide(); });

app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => {}); // 背景常駐,不退出

// 開發/測試用:DIANJING_TEST=<text> 啟動後自動跑一次潤飾(不需真的全選),驗證整條鏈路。
if (process.env.DIANJING_TEST) {
  app.whenReady().then(async () => {
    const waitReady = async () => { for (let i = 0; i < 120 && !modelReady; i++) await new Promise((r) => setTimeout(r, 1000)); };
    await waitReady();
    if (!modelReady) { console.log("[dianjing][test] model not ready, abort"); return; }
    const text = process.env.DIANJING_TEST;
    for (const scene of ["boss", "line"]) {
      let acc = "";
      const t = Date.now();
      await polishService.polish({ text, scene, onChunk: (c) => { acc += c; } });
      console.log(`[dianjing][test] ${scene} (${((Date.now() - t) / 1000).toFixed(1)}s): ${acc.trim()}`);
    }
    console.log("[dianjing][test] DONE");
    app.quit();
  });
}
