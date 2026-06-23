import { fileURLToPath } from "url";
import path from "path";
import { createRequire } from "module";
import { getLlama, resolveModelFile, LlamaChatSession } from "node-llama-cpp";

const require = createRequire(import.meta.url);
const { buildPolishPrompt, SCENES } = require("./src/polishPrompts.js");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelsDir = path.join(__dirname, "models");
const MODEL_URI = "hf:Qwen/Qwen2.5-1.5B-Instruct-GGUF:Q4_K_M";
const SAMPLE = "今天弄好了公司的 ci cd 等等要跟老闆報告一下";

console.log("[1] 下載/解析模型:", MODEL_URI);
let t0 = Date.now();
const modelPath = await resolveModelFile(MODEL_URI, modelsDir);
console.log(`    模型:${modelPath}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

console.log("[2] 載入模型(強制 CPU,gpu:false)...");
const llama = await getLlama({ gpu: false });
const model = await llama.loadModel({ modelPath });
console.log("    OK. CPU 執行緒 =", llama.cpuMathCores ?? "?", "/ GPU =", llama.gpu);

console.log(`\n原文:「${SAMPLE}」`);
for (const scene of ["boss", "line", "email"]) {
  const { system, user } = buildPolishPrompt(scene, SAMPLE);
  const ctx = await model.createContext({ contextSize: 2048 });
  const session = new LlamaChatSession({ contextSequence: ctx.getSequence(), systemPrompt: system });
  const t = Date.now();
  const out = await session.prompt(user, { temperature: 0.4, maxTokens: 256 });
  console.log(`\n===== ${SCENES[scene].label}  (${((Date.now() - t) / 1000).toFixed(1)}s) =====`);
  console.log(out.trim());
  await ctx.dispose();
}
process.exit(0);
