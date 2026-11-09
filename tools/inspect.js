/* 无依赖 PNG 解码 + 造型检查：把渲染图降采样成字符图并统计色彩分布
 * 用法：node tools/inspect.js preview.png [字符宽=96]
 */
const fs = require('fs');
const zlib = require('zlib');

function decodePNG(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG');
  let off = 8, w = 0, h = 0, depth = 0, ctype = 0, interlace = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; ctype = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (depth !== 8 || interlace !== 0) throw new Error(`不支持的 PNG (depth=${depth}, interlace=${interlace})`);
  const channels = ctype === 6 ? 4 : ctype === 2 ? 3 : ctype === 0 ? 1 : ctype === 4 ? 2 : 0;
  if (!channels) throw new Error('不支持的色彩类型 ' + ctype);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * channels;
  const out = Buffer.alloc(h * stride);
  let pos = 0;
  for (let y = 0; y < h; y++) {
    const ft = raw[pos++];
    const row = raw.subarray(pos, pos + stride); pos += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = (prev && x >= channels) ? prev[x - channels] : 0;
      let v = row[x];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 255;
    }
  }
  return { w, h, channels, data: out };
}

function classify(r, g, b) {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
  const v = max, s = max === 0 ? 0 : d / max;
  let hue = 0;
  if (d !== 0) {
    if (max === R) hue = 60 * (((G - B) / d) % 6);
    else if (max === G) hue = 60 * ((B - R) / d + 2);
    else hue = 60 * ((R - G) / d + 4);
  }
  if (hue < 0) hue += 360;
  /* 背景是深色渐变（偏低饱和的绿），深褐的种子另有判定，避免与背景混淆 */
  if (v < 0.34) return (s > 0.42 && hue >= 12 && hue < 46) ? 'b' : '.';
  if (s < 0.14 && v < 0.45) return '.';
  if (hue >= 40 && hue <= 70 && s > 0.32 && v > 0.35) return 'Y';
  if (hue >= 28 && hue < 40 && s > 0.42) return 'o';
  if (hue >= 68 && hue <= 170 && s > 0.13) return 'G';
  if (hue >= 8 && hue < 40 && v < 0.58) return 'b';
  if (s < 0.22) return ':';
  return '?';
}

function main() {
  const file = process.argv[2] || 'preview-full.png';
  const width = parseInt(process.argv[3] || '96', 10);
  const img = decodePNG(file);
  const step = Math.max(1, Math.floor(img.w / width));
  const cols = Math.floor(img.w / step);
  const rows = Math.floor(img.h / (step * 2));
  const counts = {};
  let minx = cols, maxx = -1, miny = rows, maxy = -1;
  const art = [];
  for (let ry = 0; ry < rows; ry++) {
    let line = '';
    for (let rx = 0; rx < cols; rx++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = ry * step * 2; y < Math.min(img.h, (ry + 1) * step * 2); y += 2) {
        for (let x = rx * step; x < Math.min(img.w, (rx + 1) * step); x += 2) {
          const i = (y * img.w + x) * img.channels;
          r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++;
        }
      }
      if (!n) { line += ' '; continue; }
      const ch = classify(r / n, g / n, b / n);
      counts[ch] = (counts[ch] || 0) + 1;
      if (ch !== '.') {
        if (rx < minx) minx = rx; if (rx > maxx) maxx = rx;
        if (ry < miny) miny = ry; if (ry > maxy) maxy = ry;
      }
      line += ch;
    }
    art.push(line);
  }
  console.log(`图像 ${img.w}x${img.h}  字符网格 ${cols}x${rows}`);
  const total = Object.values(counts).reduce((a, b2) => a + b2, 0) || 1;
  console.log('构成: ' + Object.keys(counts).sort((a, b2) => counts[b2] - counts[a])
    .map((k) => `${k}=${Math.round(counts[k] * 100 / total)}%`).join('  '));
  if (maxx >= 0) {
    console.log(`模型占位 x ${minx}-${maxx} (${Math.round((maxx - minx) * 100 / cols)}% 宽)  `
      + `y ${miny}-${maxy} (${Math.round((maxy - miny) * 100 / rows)}% 高)`);
  }
  console.log('');
  art.forEach((l) => console.log(l.replace(/\s+$/, '')));
}

main();
