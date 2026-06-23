// 本地 LLM 潤飾服務(node-llama-cpp v3,ESM-only → 用動態 import)。
// load() 載入模型一次;polish() 每次建 context + session,串流 token。
const { buildPolishPrompt } = require("./polishPrompts.js");

let _nlc = null, llama = null, model = null, ready = false;
async function nlc() { if (!_nlc) _nlc = await import("node-llama-cpp"); return _nlc; }

async function load(modelPath, opts = {}) {
  const { getLlama } = await nlc();
  llama = await getLlama(opts.gpu === false ? { gpu: false } : {});
  model = await llama.loadModel({ modelPath });
  ready = true;
  return true;
}

function isReady() { return ready; }

// polish({ text, scene, onChunk, signal }) → 回傳完整潤飾後文字。
async function polish({ text, scene, onChunk, signal }) {
  if (!ready) throw new Error("模型尚未載入");
  const { LlamaChatSession } = await nlc();
  const { system, user } = buildPolishPrompt(scene, text);
  const ctx = await model.createContext({ contextSize: 2048 });
  try {
    const session = new LlamaChatSession({ contextSequence: ctx.getSequence(), systemPrompt: system });
    const out = await session.prompt(user, {
      temperature: 0.4,
      maxTokens: 400,
      signal,
      onTextChunk: (chunk) => { if (onChunk) onChunk(chunk); },
    });
    return (out || "").trim();
  } finally {
    try { await ctx.dispose(); } catch {}
  }
}

module.exports = { load, polish, isReady };
