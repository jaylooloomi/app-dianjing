const { app, globalShortcut, BrowserWindow, ipcMain, Menu, clipboard, Notification } = require("electron");
const path = require("path");
const { uIOhook, UiohookKey } = require("uiohook-napi");
const textCapture = require("./src/textCapture.js");
const polishService = require("./src/polishService.js");
const modelManager = require("./src/modelManager.js");
const { SCENES, LANGS } = require("./src/polishPrompts.js");

let popup = null;
let modelReady = false;
let capturedPrior = "";

function notify(msg) { try { new Notification({ title: "點睛 Dianjing", body: msg }).show(); } catch {} }

function createPopup() {
  popup = new BrowserWindow({
    width: 580, height: 460, show: false, frame: false, resizable: true,
    alwaysOnTop: true, skipTaskbar: true,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  popup.loadFile(path.join(__dirname, "src", "popup.html"));
  popup.on("close", (e) => { e.preventDefault(); popup.hide(); }); // 關閉 → 隱藏(常駐)
}

async function onHotkey() {
  try {
    const { text, prior } = await textCapture.captureSelection();
    if (!text || !text.trim()) { notify("請先選取文字,再按右 Alt"); return; }
    capturedPrior = prior;
    if (popup) {
      popup.show();
      popup.webContents.send("polish:open", { text, ready: modelReady });
    }
  } catch (e) { notify("擷取選取文字失敗:" + e.message); }
}

let _altClean = false, _lastTrigger = 0;
// 右 Alt 觸發:單獨點一下右 Alt(中間沒按其他鍵)→ 放開時觸發。
// 在 keyup 觸發是為了避免 Alt 還按著時送 ^c 變成 Ctrl+Alt+C;_altClean 排除「右 Alt+其他鍵」組合誤觸。
function startHotkey() {
  try {
    uIOhook.on("keydown", (e) => { _altClean = (e.keycode === UiohookKey.AltRight); });
    uIOhook.on("keyup", (e) => {
      if (e.keycode !== UiohookKey.AltRight) return;
      const now = Date.now();
      if (_altClean && now - _lastTrigger > 600) { _lastTrigger = now; onHotkey(); }
      _altClean = false;
    });
    uIOhook.start();
    console.log("[dianjing] right-Alt hook started");
  } catch (e) { console.error("[dianjing] uiohook start failed:", e.message); }
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

  startHotkey(); // 右 Alt(uiohook)
});

ipcMain.handle("polish:scenes", () => Object.keys(SCENES).map((k) => ({ key: k, label: SCENES[k].label })));
ipcMain.handle("polish:langs", () => Object.keys(LANGS).map((k) => ({ key: k, label: LANGS[k] })));
ipcMain.handle("polish:run", async (e, { scene, text, lang }) => {
  if (!modelReady) return { error: "模型尚未就緒" };
  try {
    await polishService.polish({ text, scene, lang, onChunk: (c) => { if (popup && !popup.isDestroyed()) popup.webContents.send("polish:chunk", c); } });
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
// 視窗高度貼齊內容(前端用 ResizeObserver 量測後送來),避免底部留白。
ipcMain.on("polish:resize", (e, h) => {
  if (!popup || popup.isDestroyed()) return;
  const w = popup.getContentSize()[0];
  popup.setContentSize(w, Math.max(160, Math.min(900, Math.round(h))));
});

app.on("will-quit", () => { globalShortcut.unregisterAll(); try { uIOhook.stop(); } catch {} });
app.on("window-all-closed", () => {}); // 背景常駐,不退出

// 開發/測試用:DIANJING_TEST=<text> 啟動後自動跑一次潤飾(不需真的全選),驗證整條鏈路。
if (process.env.DIANJING_TEST) {
  app.whenReady().then(async () => {
    const waitReady = async () => { for (let i = 0; i < 120 && !modelReady; i++) await new Promise((r) => setTimeout(r, 1000)); };
    await waitReady();
    if (!modelReady) { console.log("[dianjing][test] model not ready, abort"); return; }
    const text = process.env.DIANJING_TEST;
    const lang = process.env.DIANJING_TEST_LANG || "zh-TW";
    const scenes = (process.env.DIANJING_TEST_SCENES || "boss,line").split(",");
    for (const scene of scenes) {
      let acc = "";
      const t = Date.now();
      await polishService.polish({ text, scene, lang, onChunk: (c) => { acc += c; } });
      console.log(`[dianjing][test] ${scene}/${lang} (${((Date.now() - t) / 1000).toFixed(1)}s): ${acc.trim()}`);
    }
    console.log("[dianjing][test] DONE");
    app.quit();
  });
}
