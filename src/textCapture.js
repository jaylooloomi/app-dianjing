// 跨平台「抓取選取文字 / 貼回」。機制移植自 SpeakSlow clipboard.js。
//  Windows:常駐 PowerShell —— 存前景視窗 hwnd → WScript.Shell SendKeys(^c/^v)→ Restore-Fg 還原焦點。
//  macOS  :osascript —— 記住前景 app → keystroke c/v(cmd)→ activate 還原(需「輔助使用」權限)。
//  Linux  :xdotool。
const { spawn, execFileSync } = require("child_process");

let psShell = null, psReady = false, savedMacApp = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clip = () => require("electron").clipboard;

function ensurePs() {
  if (process.platform !== "win32") return null;
  if (psShell) return psShell;
  try {
    const ps = spawn("powershell", ["-NoProfile", "-NoLogo"], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    psShell = ps; psReady = false;
    ps.stdout.on("data", () => {});
    ps.stderr.on("data", () => {});
    const cleanup = () => { psShell = null; psReady = false; };
    ps.on("exit", cleanup); ps.on("error", cleanup);
    const init = [
      `Add-Type -Namespace Native -Name Fg -MemberDefinition '[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")][return: MarshalAs(UnmanagedType.Bool)] public static extern bool SetForegroundWindow(IntPtr hWnd); [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool c); [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, IntPtr p); [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId(); [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);'`,
      `$ws = New-Object -ComObject WScript.Shell`,
      `function Restore-Fg { param($hwnd) $ft=[Native.Fg]::GetWindowThreadProcessId($hwnd,[IntPtr]::Zero); $ct=[Native.Fg]::GetCurrentThreadId(); if($ft -ne $ct){[Native.Fg]::AttachThreadInput($ct,$ft,$true)|Out-Null}; [Native.Fg]::SetForegroundWindow($hwnd)|Out-Null; if($ft -ne $ct){[Native.Fg]::AttachThreadInput($ct,$ft,$false)|Out-Null} }`,
      // 送 Ctrl+C/V 前先把 Alt(含左/右/AltGr)放開,避免觸發用的右 Alt 殘留 → 變成 Ctrl+Alt+C 被忽略。
      `function Send-DjCopy { [Native.Fg]::keybd_event(0xA5,0,2,[UIntPtr]::Zero); [Native.Fg]::keybd_event(0xA4,0,2,[UIntPtr]::Zero); [Native.Fg]::keybd_event(0x12,0,2,[UIntPtr]::Zero); Start-Sleep -Milliseconds 15; [Native.Fg]::keybd_event(0x11,0,0,[UIntPtr]::Zero); [Native.Fg]::keybd_event(0x43,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 30; [Native.Fg]::keybd_event(0x43,0,2,[UIntPtr]::Zero); [Native.Fg]::keybd_event(0x11,0,2,[UIntPtr]::Zero) }`,
      `function Send-DjPaste { [Native.Fg]::keybd_event(0xA5,0,2,[UIntPtr]::Zero); [Native.Fg]::keybd_event(0xA4,0,2,[UIntPtr]::Zero); [Native.Fg]::keybd_event(0x12,0,2,[UIntPtr]::Zero); Start-Sleep -Milliseconds 15; [Native.Fg]::keybd_event(0x11,0,0,[UIntPtr]::Zero); [Native.Fg]::keybd_event(0x56,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 30; [Native.Fg]::keybd_event(0x56,0,2,[UIntPtr]::Zero); [Native.Fg]::keybd_event(0x11,0,2,[UIntPtr]::Zero) }`,
      `$savedHwnd = [IntPtr]::Zero`,
    ];
    for (const l of init) ps.stdin.write(l + "\r\n");
    psReady = true;
    return ps;
  } catch (e) { psShell = null; psReady = false; return null; }
}
function psSend(line) {
  if (psShell && psReady) { try { psShell.stdin.write(line + "\r\n"); return true; } catch { return false; } }
  return false;
}

function init() { if (process.platform === "win32") ensurePs(); }

// 抓選取:存前景視窗 + 送複製 → 讀剪貼簿。回傳 { text, prior }(text 空 = 沒選取)。
async function captureSelection() {
  const prior = clip().readText();
  const sentinel = "__dj_empty__" + Date.now();
  clip().writeText(sentinel);
  await sleep(120); // 讓觸發用的右 Alt 完全放開,避免 Ctrl+C 變 Ctrl+Alt+C
  if (process.platform === "win32") {
    ensurePs();
    psSend(`$savedHwnd = [Native.Fg]::GetForegroundWindow(); Send-DjCopy`);
  } else if (process.platform === "darwin") {
    try { savedMacApp = execFileSync("osascript", ["-e", 'tell application "System Events" to get name of first process whose frontmost is true'], { timeout: 1500 }).toString().trim(); } catch { savedMacApp = null; }
    try { spawn("osascript", ["-e", 'tell application "System Events" to keystroke "c" using command down']); } catch {}
  } else {
    try { spawn("xdotool", ["key", "ctrl+c"]); } catch {}
  }
  // 送出 ^c 後輪詢剪貼簿:等內容從 sentinel 變成真正的選取文字。
  // 固定 200ms 不夠 —— SendKeys 經由背景 PowerShell REPL 執行有延遲,加上 Chrome
  // 複製網頁選取常 > 200ms。改成最多約 640ms、每 40ms 檢查一次,一旦變了就立刻取用。
  let text = "";
  for (let i = 0; i < 16; i++) {
    await sleep(40);
    const cur = clip().readText();
    if (cur && cur !== sentinel) { text = cur; break; }
  }
  if (!text || text === sentinel) { clip().writeText(prior); return { text: "", prior }; }
  return { text, prior };
}

// 貼回:寫剪貼簿 → 還原前景視窗 → 送貼上。done 後還原使用者原本剪貼簿。
async function pasteText(text, opts = {}) {
  clip().writeText(text);
  await sleep(40);
  if (process.platform === "win32") {
    ensurePs();
    psSend(`if ($savedHwnd -ne [IntPtr]::Zero) { Restore-Fg $savedHwnd; Start-Sleep -Milliseconds 45 }; Send-DjPaste`);
  } else if (process.platform === "darwin") {
    if (savedMacApp) { try { execFileSync("osascript", ["-e", `tell application "${savedMacApp}" to activate`], { timeout: 1500 }); } catch {} await sleep(80); }
    try { spawn("osascript", ["-e", 'tell application "System Events" to keystroke "v" using command down']); } catch {}
  } else {
    try { spawn("xdotool", ["key", "ctrl+v"]); } catch {}
  }
  await sleep(150);
  if (opts.prior != null) clip().writeText(opts.prior);
}

module.exports = { init, captureSelection, pasteText };
