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
