// 點睛 Dianjing —— 場景化文字潤飾的提示詞模板(純函式)。
// 兩種模式:
//   polish (預設):最小幅度潤飾 —— 只修錯別字/語法 + 調整語氣,盡量保留原文、不擴寫。
//   rewrite       :重構改寫 —— 例如「提示詞優化」,允許補結構/角色/限制等。
// 兩種模式都「最優先」要求以指定語言輸出(原文若是其他語言則翻譯過去)。
// buildPolishPrompt(scene, text, lang) → { system, user }。

const SCENES = {
  general: {
    label: "一般",
    guide: "修正錯別字、標點與語法,讓語句通順、用詞中性自然;盡量貼近原文,不要擴寫或加料。",
  },
  line: {
    label: "LINE",
    guide: "口語、親切、簡潔有禮的即時訊息語氣,可適度使用表情符號;修好錯字後不要過度改寫。",
  },
  email: {
    label: "Email",
    guide: "正式 email 語氣:條理清楚、用詞專業得體;可使用不具名的通用問候與結尾(如「您好」「敬祝順心」),但不要編造收件人姓名。",
  },
  post: {
    label: "社群貼文",
    guide: "吸引人的社群貼文語氣:精煉、有節奏、易讀,可加入合適的 hashtag;不要過度浮誇。",
  },
  boss: {
    label: "正式回報(對主管)",
    guide: "對主管回報的語氣:重點先行、客觀具體、專業精簡得體;直接寫回報內容,不要加開頭稱謂或客套開場白。",
  },
  prompt: {
    label: "提示詞優化",
    mode: "rewrite",
    guide: "把口語、含糊或簡略的指令,改寫成結構清楚、能讓 AI 產出更好結果的有效提示詞。",
  },
};

const LANGS = { "zh-TW": "繁體中文", "zh-CN": "简体中文", "en": "English" };
const DEFAULT_LANG = "zh-TW";

function buildPolishPrompt(scene, text, lang = DEFAULT_LANG) {
  const s = SCENES[scene] || SCENES.general;
  const langName = LANGS[lang] || LANGS[DEFAULT_LANG];
  // 最優先的語言規則:輸出語言由使用者選定,原文若是其他語言就翻譯過去。
  // 放在最前面、講最重,避免被「保留原文」類規則壓過(小模型常因此不翻譯)。
  const langRule =
    `最重要的規則:整段輸出必須使用「${langName}」。` +
    `如果原文(或草稿)是其他語言,請「翻譯」成「${langName}」再處理;輸出中不可混用其他語言。`;
  let system;
  let action;

  if (s.mode === "rewrite") {
    // 提示詞優化:可重構/補強,但不編造使用者沒說的具體需求。
    system =
      "你是一位提示詞工程師。\n" +
      langRule + "\n" +
      "在符合上述語言要求下,任務:把使用者的「草稿提示詞」改寫成更清楚、更有效、能讓 AI 產出更好結果的提示詞。" +
      "視需要補上角色設定、任務說明、必要背景、限制條件與期望的輸出格式;結構清楚、精簡。\n" +
      "規則:\n" +
      "1. 只輸出優化後的提示詞本身,不要任何解釋、評論、前言或標註。\n" +
      "2. 忠於使用者原本的意圖,不要替他決定他沒提到的具體需求(不要編造特定數字、技術或規格)。\n" +
      `重點:${s.guide}`;
    action = "請把以下草稿提示詞優化:";
  } else {
    // 最小幅度潤飾。保留的是「意思」,不是原文的語言。
    system =
      "你是一位文字潤飾助理。\n" +
      langRule + "\n" +
      "在符合上述語言要求下,核心任務有兩件:(1) 修正錯別字、標點與語法錯誤;(2) 把語氣調整成符合指定情境。" +
      "保留原文的「意思」即可,不必逐字保留原文的語言或寫法;不要改變原意、不要擴寫或加入額外內容。\n" +
      "規則:\n" +
      "1. 只輸出潤飾後的文字本身,不要任何解釋、前言、引號或標註。\n" +
      "2. 不要編造原文沒有的資訊(人名、收件人、數字、時間等)。\n" +
      "3. 不要自行加上原文沒有的開頭稱謂或署名(Email 情境可用不具名的通用問候)。\n" +
      `情境語氣:${s.guide}`;
    action = "請依上述要求潤飾以下文字:";
  }
  const user = `${action}\n\n${text}`;
  return { system, user };
}

module.exports = { SCENES, LANGS, DEFAULT_LANG, buildPolishPrompt };
