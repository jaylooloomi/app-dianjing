import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { SCENES, buildPolishPrompt } = require("../src/polishPrompts.js");

test("每個場景都有 label + guide", () => {
  for (const k of Object.keys(SCENES)) {
    assert.ok(SCENES[k].label, `${k} 缺 label`);
    assert.ok(SCENES[k].guide, `${k} 缺 guide`);
  }
});

test("buildPolishPrompt 含原文 + 繁中規則 + 場景 guide", () => {
  const { system, user } = buildPolishPrompt("boss", "今天弄好 ci cd");
  assert.match(system, /繁體中文/);
  assert.match(system, /只輸出潤飾後的文字/);
  assert.ok(system.includes(SCENES.boss.guide));
  assert.match(user, /今天弄好 ci cd/);
});

test("未知場景 → 退回 general", () => {
  const { system } = buildPolishPrompt("不存在的場景", "x");
  assert.ok(system.includes(SCENES.general.guide));
});

test("場景齊全:line/email/post/boss/general", () => {
  for (const k of ["line", "email", "post", "boss", "general"]) assert.ok(SCENES[k], `缺場景 ${k}`);
});

test("lang 控制輸出語言(預設繁中 / 簡中 / 英文)", () => {
  assert.match(buildPolishPrompt("general", "x").system, /繁體中文/);
  assert.match(buildPolishPrompt("general", "x", "zh-CN").system, /简体中文/);
  assert.match(buildPolishPrompt("general", "x", "en").system, /English/);
});

test("規則禁止編造原文沒有的人名/稱謂", () => {
  assert.match(buildPolishPrompt("boss", "x").system, /不要編造.*人名|人名.*稱謂/);
});

test("提示詞優化 = rewrite 模式:提示詞工程師、允許重構(不受『不要擴寫』限制)", () => {
  const { system, user } = buildPolishPrompt("prompt", "幫我寫個爬蟲");
  assert.match(system, /提示詞工程師/);
  assert.ok(!system.includes("不要擴寫"), "rewrite 模式不該有『不要擴寫』");
  assert.match(user, /優化/);
  // 一般潤飾場景仍是 polish 模式(保守、不擴寫)
  assert.match(buildPolishPrompt("line", "x").system, /不要過度改寫|不要擴寫/);
});
