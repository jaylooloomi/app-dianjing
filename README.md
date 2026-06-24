<div align="center">

# 點睛 Dianjing

### The finishing touch for anything you write — a local AI that polishes your text in place.

**Select text · press `Right Alt` · pick a scene — rewritten to fit the moment, fully offline, no API key.**

[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-0078D6?style=flat-square)](#system-requirements)
[![Built with Electron](https://img.shields.io/badge/built%20with-Electron-47848F?style=flat-square)](https://www.electronjs.org)
[![Local LLM](https://img.shields.io/badge/LLM-Qwen2.5--1.5B%20(local)-6f42c1?style=flat-square)](#how-it-works)
[![License: MIT](https://img.shields.io/badge/license-MIT-green?style=flat-square)](#license)

🌐 &nbsp; **English** &nbsp;·&nbsp; [繁體中文](README.zh-TW.md)

</div>

---

> 點睛 (*Dianjing* — from 畫龍點睛, "dotting the dragon's eyes," the finishing stroke that brings a work to life) is a cross-platform desktop utility. Select text in **any** app, press a hotkey, and a **local small language model** rewrites it to fit the moment — a casual LINE message, a polished email, a formal report to your manager, a punchy social post, or an optimized AI prompt. It runs **entirely on your machine** (no Ollama, no daemon, no API key), so your words are never sent anywhere. The model downloads itself on first run; after that it works **100% offline**.

---

## The problem

The "AI rewrite" features that exist today are fenced in:

- **They live inside one app.** A specific editor or webmail has a "polish" button — but the text you type in chat, forms, tickets, and notes is on its own.
- **Cloud rewriting means handing over your words.** Polishing a work report or a personal message usually means pasting it into someone else's server.
- **"Make it better" ignores context.** A note to a friend and a report to your boss need different tone — one knob doesn't fit both.
- **Constant context-switching.** Leave your work → open a chatbot → paste → copy the result back → replace it yourself.

## The solution

**Dianjing collapses all of that into one hotkey, on your own machine.**

```
Select text  →  Right Alt  →  choose a scene  →  Replace
                       ↓
        a local AI rewrites it, offline, in seconds.
```

No terminal. No API key. No cloud. The model installs itself on first run and every rewrite happens **in-process on your CPU** — then drops the result straight back where you were typing.

---

## Key features

- 🎯 **Works in any app.** A global `Right Alt` grabs whatever you've selected — chat, browser, editor, form — no copy/paste dance.
- 🏠 **100% local & private.** Runs `Qwen2.5-1.5B-Instruct` in-process via `node-llama-cpp`. No Ollama, no daemon, no API key. Offline after the one-time model download. **Your text never leaves the machine.**
- 🎬 **Scene-aware tone.** Six built-in scenes — General, LINE, Email, Social post, Formal report, and Prompt optimization — each with its own voice.
- 🌐 **Output language selector.** Polish into 繁體中文 / 简体中文 / English, independent of the UI.
- ✍️ **Fixes typos + adjusts tone — without making things up.** Prompts are tuned to correct errors and match the scene, not to invent recipients, names, or facts.
- 🔁 **Replace in place or copy.** The result is editable; click **取代原文** to paste it back over your selection, or **複製** to grab it.
- 🪶 **Lightweight & out of the way.** Frameless, always-on-top popup that **auto-fits its content**; lives in the background and hides on close.
- 🔒 **Zero telemetry.** Nothing about your usage is collected.

---

## Why Dianjing

|  | Built-in app "rewrite" | Cloud AI chatbots | **Dianjing** |
|---|---|---|---|
| **Works in any app** | ❌ One app only | ⚠️ In a browser tab | ✅ **Anywhere, via hotkey** |
| **Privacy** | Varies (often cloud) | ❌ Text leaves your PC | ✅ **Fully local** |
| **Scene-aware tone** | Usually one style | Re-prompt each time | ✅ **One click per scene** |
| **Works offline** | ❌ | ❌ | ✅ **After first download** |
| **Cost / keys** | Subscription / built-in | Account or subscription | ✅ **Free, no key** |
| **Replaces text in place** | Sometimes | ❌ Copy back yourself | ✅ **One click** |

---

## How it works

```
Select text in any app
        │  Right Alt
        ▼
┌─────────────────────────────────┐   pick a scene + output language
│  Dianjing popup (Electron)      │ ──────────────┐
└─────────────────────────────────┘               │
        ▲ streamed result                          │ capture selection
        │                                          ▼ (clipboard, then restored)
┌──────────────────────────────────────────────────────────┐
│  Local LLM, in-process (node-llama-cpp)                    │
│  Qwen2.5-1.5B-Instruct · CPU · no daemon · fully offline   │
└──────────────────────────────────────────────────────────┘
        │
        ▼
   Replace in place   /   Copy
```

The global `Right Alt` is captured with `uiohook-napi`. Dianjing copies your selection (briefly, then restores your previous clipboard), sends only that text to a GGUF model loaded **inside the app process**, streams the polished result into an editable box, and pastes it back over your selection when you confirm. On first run the model (~1.1 GB) is fetched automatically from Hugging Face; everything after that is offline.

---

## Scenes

| Scene | What it's for |
|---|---|
| **一般 · General** | Fix typos, punctuation, and grammar; keep it neutral and natural, close to the original. |
| **LINE** | Casual, friendly instant-message tone; emoji where it fits. |
| **Email** | Professional email tone with a generic (non-fabricated) greeting and sign-off. |
| **社群貼文 · Social post** | Punchy, rhythmic, readable; hashtags where appropriate. |
| **正式回報 · Formal report** | Reporting to a manager: lead with the point, concise and specific, no stiff salutations. |
| **提示詞優化 · Prompt optimize** | Rewrites a rough/vague instruction into a clearer, more effective AI prompt (rewrite mode, not minimal polish). |

Output language (繁中 / 簡中 / English) is chosen separately in the popup's title bar.

---

## Install

> No signed installer yet — run from source, or build a local app bundle.

**Run from source**

```bash
git clone https://github.com/jaylooloomi/app-dianjing.git
cd app-dianjing
npm install
npm start            # first launch downloads the model (~1.1 GB) and warms it up
```

**Build a desktop app**

```bash
npm run dist:win     # Windows (unpacked app in dist/)
npm run dist:mac     # macOS (.dmg)
```

`node-llama-cpp` ships prebuilt binaries for Windows and macOS, so no native toolchain is required for a normal install.

---

## Usage

1. Launch Dianjing — it stays resident in the background (no window until you summon it).
2. In any app, **select** the text you want to polish.
3. Press **`Right Alt`**. The popup appears with your text as the original.
4. Pick a **scene** and **output language** (defaults to 繁體中文).
5. Review/edit the result, then **取代原文** (replace) or **複製** (copy).

| Shortcut | Action |
|---|---|
| `Right Alt` (global) | Capture the current selection → open the popup |
| Click a scene | Switch scene and re-polish |
| `Esc` | Close the popup |

> Press `Right Alt` with **nothing** selected and it simply notifies you to select text first.

---

## Settings

| Option | Description |
|---|---|
| Output language | 繁體中文 (default) / 简体中文 / English — chosen per polish in the title bar |
| Model location | Defaults to the app's user-data folder. Override with the `DIANJING_MODELS_DIR` environment variable (e.g. to share one download across builds) |

---

## Privacy & security

- **Fully local inference.** Text is sent to a model running inside the app process — never to any server. No account, no API key.
- **Offline after first run.** The only network access is the one-time model download.
- **Clipboard is borrowed, not clobbered.** Capturing your selection saves your existing clipboard and restores it afterward.
- **Zero telemetry.** No usage data is collected or transmitted.

---

## Engineering highlights

- **In-process GGUF inference** via `node-llama-cpp` (N-API, ABI-stable under Electron) — no Ollama, no sidecar daemon, CPU-capable; the model auto-downloads from Hugging Face on first run.
- **Lone `Right Alt` global hotkey** with `uiohook-napi` — Electron's `globalShortcut` can't bind a bare right-Alt; triggered on key-*up* with clean-press detection so it never fires on `Alt`-combos.
- **Cross-platform capture & replace** — Windows uses a persistent PowerShell host (foreground-window save/restore + simulated `Ctrl+C`/`Ctrl+V`), macOS uses `osascript`, Linux uses `xdotool`; your prior clipboard is preserved.
- **Auto-fitting popup** — a `ResizeObserver` measures the content and the window resizes to match (`setContentSize`), so there's never dead space; frameless, always-on-top, hides instead of quitting.
- **Pure-function prompt builder** with unit tests covering output language and the polish/rewrite modes.

---

## Roadmap

- [ ] Larger / user-selectable models (better quality; fixes the small-model limits below)
- [ ] User dictionary / 熱詞 — force fixed corrections for domain terms (e.g. brand and product names)
- [ ] System-tray icon and settings window
- [ ] More scenes and per-scene tuning
- [ ] Code-signed builds + a Releases page
- [ ] Linux packaging

---

## Known limitations

- **It's a 1.5B model.** Two known rough edges: the **提示詞優化** scene sometimes *answers* the instruction instead of *rewriting* it, and **English output can occasionally drift back to Chinese** on some scenes. A larger/selectable model (roadmap) is the fix.
- **First run downloads ~1.1 GB.** Needs internet once; offline thereafter.
- **Cross-app capture relies on the clipboard** + a simulated copy keystroke — a few apps with non-standard copy handling may not capture cleanly.
- **macOS** needs Accessibility permission (for the global hotkey + keystroke simulation); **Linux** capture uses `xdotool` (X11).

---

## Development

```
app-dianjing/
├── main.js                 ← Electron main: hotkey, popup, IPC, model lifecycle
├── preload.js              ← contextBridge API for the popup
└── src/
    ├── popup.html / popup.js   ← the polish UI (scenes, language, result)
    ├── polishPrompts.js        ← scene definitions + prompt builder (pure)
    ├── polishService.js        ← node-llama-cpp load + streaming polish
    ├── modelManager.js         ← first-run model download (resolveModelFile)
    └── textCapture.js          ← cross-platform select-capture / paste-back
```

```bash
npm start      # run in dev
npm test       # unit tests (node --test)
```

## System requirements

- **Windows 10/11** or **macOS** (Apple Silicon or Intel); **Linux** (X11) for capture.
- **~1.5 GB free disk** (model is ~1.1 GB).
- **Internet** for the first-run model download; offline afterward.
- A modern CPU is enough — no GPU required.

---

## Disclaimer

Dianjing is an independent, open-source project and is **not affiliated with, endorsed by, or sponsored by Alibaba/Qwen or the `node-llama-cpp` project**. "Qwen" is a trademark of its respective owner. The bundled model runs locally under its own license.

## License

MIT
