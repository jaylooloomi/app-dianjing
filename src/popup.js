const $ = (id) => document.getElementById(id);
let original = "", currentScene = "general", ready = false, polishing = false;
let lang = localStorage.getItem("dj_lang") || "zh-TW";

async function buildLangs() {
  const langs = await window.dianjing.langs();
  const sel = $("lang");
  sel.innerHTML = "";
  langs.forEach((l) => { const o = document.createElement("option"); o.value = l.key; o.textContent = l.label; sel.appendChild(o); });
  sel.value = lang;
  sel.onchange = () => { lang = sel.value; localStorage.setItem("dj_lang", lang); if (ready && !polishing) run(); };
}

const setStatus = (html) => { $("status").innerHTML = html; };
const markActive = () => document.querySelectorAll(".scene").forEach((b) => b.classList.toggle("active", b.dataset.key === currentScene));

async function buildScenes() {
  const scenes = await window.dianjing.scenes();
  const box = $("scenes");
  box.innerHTML = "";
  scenes.forEach((s) => {
    const b = document.createElement("button");
    b.className = "scene";
    b.textContent = s.label;
    b.dataset.key = s.key;
    b.onclick = () => { currentScene = s.key; markActive(); run(); };
    box.appendChild(b);
  });
  markActive();
}

async function run() {
  if (!ready || polishing || !original) return;
  polishing = true;
  $("result").value = "";
  setStatus('<span class="spin">⏳</span> 潤飾中…');
  const r = await window.dianjing.run(currentScene, original, lang);
  polishing = false;
  setStatus(r && r.error ? "⚠️ " + r.error : "✓ 完成");
}

window.dianjing.onChunk((c) => { const r = $("result"); r.value += c; r.scrollTop = r.scrollHeight; });
window.dianjing.onModelReady(() => { ready = true; if (original && !polishing && !$("result").value) run(); else if (!polishing) setStatus("模型就緒"); });
window.dianjing.onOpen((d) => {
  original = d.text || "";
  ready = !!d.ready;
  $("orig").textContent = original;
  $("result").value = "";
  setStatus(ready ? "" : "模型準備中…(首次需下載,稍候)");
  if (ready) run();
});

$("replaceBtn").onclick = () => { const t = $("result").value.trim(); if (t) window.dianjing.replace(t); };
$("copyBtn").onclick = () => { const t = $("result").value.trim(); if (t) { window.dianjing.copy(t); setStatus("✓ 已複製到剪貼簿"); } };
$("closeBtn").onclick = () => window.dianjing.close();
$("closeX").onclick = () => window.dianjing.close();
document.addEventListener("keydown", (e) => { if (e.key === "Escape") window.dianjing.close(); });

buildLangs();
buildScenes();

// 視窗高度貼齊內容,消除底部留白:量測標題列 + 內容區總高,通知主行程調整視窗。
// 內容變動(場景換行、原文、語言切換)時 ResizeObserver 會自動重新量測。
function fitHeight() {
  const bar = document.querySelector(".bar");
  const wrap = document.querySelector(".wrap");
  if (!bar || !wrap) return;
  const h = Math.ceil(bar.getBoundingClientRect().height + wrap.getBoundingClientRect().height);
  window.dianjing.resize(h);
}
const _fitRO = new ResizeObserver(() => fitHeight());
_fitRO.observe(document.querySelector(".bar"));
_fitRO.observe(document.querySelector(".wrap"));
