const { app, globalShortcut, BrowserWindow, ipcMain, Menu, clipboard, Notification, Tray, nativeImage } = require("electron");
const path = require("path");
const { uIOhook, UiohookKey } = require("uiohook-napi");
const textCapture = require("./src/textCapture.js");
const polishService = require("./src/polishService.js");
const modelManager = require("./src/modelManager.js");
const { SCENES, LANGS } = require("./src/polishPrompts.js");

let popup = null;
let tray = null;
let modelReady = false;
let capturedPrior = "";
let isQuitting = false;

// 系統匣圖示(32x32 PNG,由 scripts/make-tray-icon.mjs 產生):點睛藍圓角方塊 + 中央白點。
const TRAY_ICON =
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAhElEQVR42mNgGAWjYBTQEMyJ0voPwnSz8NGipP8wDLOc5g5AthSb5SA+3SxGdwCMTzeLsfmeqg4YcpbTzQG4LKeaA8i1nOYOIGQ5VRxASnajqwPo4ntiSzq6OoCuluOrYAiVC1R3wMizHJsD6GYxsgPoUtIRalLRrIIZdG26UTAKBgIAAJiAifPIiDf2AAAAAElFTkSuQmCC";

function notify(msg) { try { new Notification({ title: "點睛 Dianjing", body: msg }).show(); } catch {} }

function createPopup() {
  popup = new BrowserWindow({
    width: 580, height: 460, show: false, frame: false, resizable: true,
    alwaysOnTop: true, skipTaskbar: true,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  popup.loadFile(path.join(__dirname, "src", "popup.html"));
  popup.on("close", (e) => { if (isQuitting) return; e.preventDefault(); popup.hide(); }); // 關閉 → 隱藏(常駐),結束時放行
}

// 用隱藏視窗的 canvas 把 🪶 算繪成「帶透明背景」的 PNG:canvas.toDataURL 會保留 alpha
// (capturePage 在 Windows 會丟失透明度 → 黑底),且同樣是 Chromium 算繪,與視窗標題的 emoji 一致。
async function renderEmojiDataUrl() {
  return await new Promise((resolve) => {
    let done = false, w = null;
    const finish = (d) => {
      if (!done) { done = true; resolve(d); }
      try { if (w && !w.isDestroyed()) w.destroy(); } catch {}
    };
    try {
      w = new BrowserWindow({ width: 80, height: 80, show: false, frame: false, transparent: true, webPreferences: {} });
    } catch { return finish(null); }
    w.webContents.once("did-finish-load", async () => {
      try {
        const url = await w.webContents.executeJavaScript(
          "(function(){var c=document.createElement('canvas');c.width=64;c.height=64;" +
          "var x=c.getContext('2d');x.clearRect(0,0,64,64);" +
          "x.font='52px \"Segoe UI Emoji\",\"Apple Color Emoji\",\"Noto Color Emoji\",sans-serif';" +
          "x.textAlign='center';x.textBaseline='middle';x.fillText('🪶',32,36);" +
          "return c.toDataURL('image/png');})()"
        );
        finish(typeof url === "string" && url.indexOf("data:image/png") === 0 ? url : null);
      } catch { finish(null); }
    });
    setTimeout(() => finish(null), 2500); // 保險:超時退回內建圖示
    w.loadURL("data:text/html;charset=utf-8,<body></body>");
  });
}

async function createTray() {
  let dataUrl = null;
  try { dataUrl = await renderEmojiDataUrl(); } catch {}
  const icon = nativeImage.createFromDataURL(dataUrl || ("data:image/png;base64," + TRAY_ICON));
  try {
    tray = new Tray(icon);
    tray.setToolTip("點睛 Dianjing — 選取文字後按右 Alt 潤飾");
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "點睛 Dianjing", enabled: false },
      { label: "用法:選取文字 → 按右 Alt", enabled: false },
      { type: "separator" },
      { label: "結束點睛", click: () => { isQuitting = true; app.quit(); } },
    ]));
    tray.on("click", () => notify("選取文字後按右 Alt 即可潤飾"));
    console.log("[dianjing] tray created (emoji=" + (dataUrl ? "yes" : "fallback") + ")");
  } catch (e) { console.error("[dianjing] tray failed:", e && e.message); }
}

async function onHotkey() {
  try {
    // 視窗若還開著(置頂並握有焦點),先隱藏,讓底下目標 app 重新取得鍵盤焦點再擷取
    if (popup && popup.isVisible()) { popup.hide(); await new Promise((r) => setTimeout(r, 80)); }
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
  createTray();

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

app.on("will-quit", () => { globalShortcut.unregisterAll(); try { uIOhook.stop(); } catch {} try { if (tray) { tray.destroy(); tray = null; } } catch {} });
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
