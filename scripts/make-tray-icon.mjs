// 產生系統匣圖示(32x32 PNG):點睛配色的圓角方塊 + 中央白點(象徵「點」)。
// 手刻 PNG(zlib 壓縮 + CRC32),不依賴任何影像套件。
// 用法:node scripts/make-tray-icon.mjs        → 印出 base64(貼進 main.js 的 TRAY_ICON)
//      node scripts/make-tray-icon.mjs --file → 另存 assets/tray.png
import zlib from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const W = 32, H = 32;
const px = Buffer.alloc(W * H * 4, 0); // RGBA,預設透明

const set = (x, y, r, g, b, a) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
};

// 羽毛(quill):沿對角主軸的葉形葉片 + 中央羽軸,暖橘褐色,呼應視窗標題的 🪶。
const P0 = { x: 7, y: 26 }, P1 = { x: 24, y: 6 };          // 主軸:左下 → 右上
const ax = P1.x - P0.x, ay = P1.y - P0.y, axisLen2 = ax * ax + ay * ay;
const maxW = 6.4;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const t = ((x - P0.x) * ax + (y - P0.y) * ay) / axisLen2; // 投影到主軸 0..1
  if (t < 0 || t > 1) continue;
  const projx = P0.x + t * ax, projy = P0.y + t * ay;
  const d = Math.hypot(x - projx, y - projy);               // 垂直距離
  const w = maxW * Math.sin(Math.PI * t);                   // 葉形:兩端尖、中間寬
  if (d > w + 0.4) continue;
  if (d <= 1.1) set(x, y, 156, 90, 42, 255);                // 羽軸 #9c5a2a
  else set(x, y, 226, 162, 98, 255);                        // 葉片 #e2a262
}

// ── 手刻 PNG ──
const crc32 = (buf) => {
  let c = ~0 >>> 0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
};
const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
const raw = Buffer.alloc(H * (1 + W * 4));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 4)] = 0; // filter 0
  px.copy(raw, y * (1 + W * 4) + 1, y * W * 4, (y + 1) * W * 4);
}
const png = Buffer.concat([
  sig,
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

if (process.argv.includes("--file")) {
  mkdirSync("assets", { recursive: true });
  writeFileSync("assets/tray.png", png);
  console.error("wrote assets/tray.png (" + png.length + " bytes)");
} else {
  process.stdout.write(png.toString("base64"));
}
