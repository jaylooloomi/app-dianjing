// 點睛 Dianjing —— 場景化文字潤飾的提示詞模板(純函式)。
// buildPolishPrompt(scene, text) → { system, user };一律輸出繁體中文、只回潤飾後文字。

const SCENES = {
  general: {
    label: "一般",
    guide: "修正錯字與語法、讓語句通順自然、用詞中性專業;保留原意與所有資訊。",
  },
  line: {
    label: "LINE",
    guide: "改寫成適合 LINE 即時訊息的語氣:口語、親切、簡潔有禮,可適度使用表情符號;保留原意。",
  },
  email: {
    label: "Email",
    guide: "改寫成正式 email:有適當問候與結尾、段落條理清楚、用詞專業得體。",
  },
  post: {
    label: "社群貼文",
    guide: "改寫成吸引人的社群貼文:精煉、有節奏、易讀,可加入合適的 hashtag;不要過度浮誇。",
  },
  boss: {
    label: "正式回報(對主管)",
    guide: "改寫成對主管的正式工作回報:重點先行、客觀具體、專業有條理、語氣得體。",
  },
};

function buildPolishPrompt(scene, text) {
  const s = SCENES[scene] || SCENES.general;
  const system =
    "你是一位中文文字潤飾助理。任務:把使用者提供的文字依指定情境改寫得更好。\n" +
    "規則:\n" +
    "1. 只輸出潤飾後的文字本身,不要任何解釋、前言、引號或標註。\n" +
    "2. 一律使用繁體中文。\n" +
    "3. 保留原文的核心意思與事實,不要編造不存在的資訊。\n" +
    `情境要求:${s.guide}`;
  const user = `請依上述情境潤飾以下文字:\n\n${text}`;
  return { system, user };
}

module.exports = { SCENES, buildPolishPrompt };
