/* 曝光与色彩统计：检查渲染是否存在过曝/发灰
 * 用法：node tools/pngstats.js a.png [b.png ...]
 */
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'inspect.js'), 'utf8');
const modPath = path.join(__dirname, '..', '.tmp-inspect-mod.js');
fs.writeFileSync(modPath, src.replace(/function main\(\)[\s\S]*$/, 'module.exports={decodePNG};'));
const { decodePNG } = require(modPath);

process.argv.slice(2).forEach((f) => {
  const img = decodePNG(f);
  let blow = 0, bright = 0, tot = 0, sumSat = 0, sumV = 0;
  const hues = {};
  for (let y = 0; y < img.h; y += 2) {
    for (let x = 0; x < img.w; x += 2) {
      const i = (y * img.w + x) * img.channels;
      const r = img.data[i] / 255, g = img.data[i + 1] / 255, b = img.data[i + 2] / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const s = mx ? (mx - mn) / mx : 0;
      tot++; sumSat += s; sumV += mx;
      /* 真正“洗白”是又亮又没颜色；纯黄花瓣最大通道接近 1 但仍饱和 */
      if (mx > 0.92 && s < 0.30) blow++;
      if (mx > 0.6) bright++;
      if (s > 0.25 && mx > 0.3) {
        let h = 0; const d = mx - mn;
        if (mx === r) h = 60 * (((g - b) / d) % 6);
        else if (mx === g) h = 60 * ((b - r) / d + 2);
        else h = 60 * ((r - g) / d + 4);
        if (h < 0) h += 360;
        const bucket = Math.floor(h / 30) * 30;
        hues[bucket] = (hues[bucket] || 0) + 1;
      }
    }
  }
  const hueStr = Object.keys(hues).sort((a, b) => hues[b] - hues[a]).slice(0, 5)
    .map((k) => `${k}°:${Math.round(100 * hues[k] / tot)}%`).join(' ');
  console.log(`${path.basename(f)}  过曝 ${(100 * blow / tot).toFixed(1)}%  `
    + `亮部 ${(100 * bright / tot).toFixed(1)}%  均值亮度 ${(sumV / tot).toFixed(2)}  `
    + `平均饱和 ${(sumSat / tot).toFixed(2)}  主色相 ${hueStr}`);
});
