// 首次啟動備妥本地模型(免使用者裝任何東西)。已快取則直接回路徑,否則下載。
const MODEL_URI = "hf:Qwen/Qwen2.5-1.5B-Instruct-GGUF:Q4_K_M";

// ensureModel(dir) → 回傳本地 .gguf 路徑(必要時下載)。
async function ensureModel(dir) {
  const { resolveModelFile } = await import("node-llama-cpp");
  return await resolveModelFile(MODEL_URI, dir);
}

module.exports = { ensureModel, MODEL_URI };
