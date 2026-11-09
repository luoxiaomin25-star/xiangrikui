/* 生成 TapTap 素材合成页面（图片全部内嵌，避免 file:// 加载问题）
 * 运行后由 tools/render-taptap.js 用无头浏览器按精确尺寸截图。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BUILD = path.join(ROOT, 'taptap-assets', 'build');
fs.mkdirSync(BUILD, { recursive: true });

function dataURI(rel) {
  const p = path.join(ROOT, 'taptap-assets', 'raw', rel);
  return 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
}
const FACE = dataURI('face-happy-1024.png');
const HERO = dataURI('hero-happy-1400.png');
const PROMO = dataURI('promo-happy-1600.png');
const WIDE = dataURI('library-wide-3840.png');

const FONT = `-apple-system,"Segoe UI","Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif`;
const BASE = `
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:transparent;font-family:${FONT}}
`;

function page(css, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}${css}</style></head><body>${body}</body></html>`;
}

function badge(size, border, cls) {
  return `<div class="${cls}" style="width:${size}px;height:${size}px;border-width:${border}px">
  <img src="${FACE}" alt="">
</div>`;
}

/* ---------------------------------------------------------------- 图标 */
const icon = page(`
.icon{position:relative;width:512px;height:512px;overflow:hidden;
  background:radial-gradient(circle at 50% 30%,#ffe9b8 0%,#f5b947 52%,#d9862b 100%)}
.bg{position:absolute;inset:0;background:
  radial-gradient(circle at 28% 16%,rgba(255,255,255,.55),transparent 42%),
  linear-gradient(160deg,rgba(255,255,255,.18),transparent 55%)}
.disc{position:absolute;left:38px;top:38px;width:436px;height:436px;border-radius:50%;
  overflow:hidden;background:#e9a23a;
  box-shadow:0 18px 40px rgba(90,45,10,.35),inset 0 0 0 9px rgba(255,246,224,.92)}
.disc img{position:absolute;width:132%;height:132%;left:-16%;top:-14%}
.shine{position:absolute;left:58px;top:22px;width:270px;height:120px;border-radius:50%;
  background:radial-gradient(ellipse,rgba(255,255,255,.34),transparent 70%);transform:rotate(-18deg)}
`, `<div class="icon"><div class="bg"></div>
<div class="disc"><img src="${FACE}" alt=""></div>
<div class="shine"></div></div>`);

/* ---------------------------------------------------------------- Logo */
const logo = page(`
body{display:flex;align-items:center;justify-content:center}
.wrap{display:flex;align-items:center;gap:56px}
.badge{position:relative;border-radius:50%;overflow:hidden;background:#f0a63a;
  border-style:solid;border-color:#fff3d6;flex:0 0 auto;
  box-shadow:0 20px 48px rgba(60,30,10,.34),inset 0 0 0 1px rgba(120,60,15,.15)}
.badge img{position:absolute;width:132%;height:132%;left:-16%;top:-14%}
.type{display:flex;flex-direction:column}
.name{font-size:150px;font-weight:800;letter-spacing:9px;line-height:1;color:#4a2b16;
  -webkit-text-stroke:5px #fff3d6;white-space:nowrap;
  text-shadow:0 12px 0 rgba(74,43,22,.16),0 24px 46px rgba(0,0,0,.30)}
.rule{width:430px;height:14px;margin-top:22px;border-radius:999px;
  background:linear-gradient(90deg,#ffd86b,#e59a2f);box-shadow:0 8px 20px rgba(120,60,10,.28)}
`, `<div class="wrap">${badge(330, 10, 'badge')}
<div class="type"><div class="name">情绪向日葵</div><div class="rule"></div></div></div>`);

/* ------------------------------------------------------------ 横版封面 */
const coverH = page(`
.cover{position:relative;width:460px;height:215px;overflow:hidden;
  background:linear-gradient(120deg,#2a160c 0%,#4b2a15 52%,#9a5a24 100%)}
.glow{position:absolute;right:-80px;top:-90px;width:330px;height:330px;border-radius:50%;
  background:radial-gradient(circle,rgba(255,206,120,.42),rgba(255,206,120,0) 68%)}
.head{position:absolute;right:-14px;top:-16px;height:248px;width:248px;
  filter:drop-shadow(0 10px 22px rgba(0,0,0,.35))}
.lock{position:absolute;left:24px;top:50%;transform:translateY(-50%);
  display:flex;flex-direction:column;align-items:flex-start;gap:11px}
.badge{position:relative;border-radius:50%;overflow:hidden;background:#f0a63a;
  border-style:solid;border-color:rgba(255,243,214,.92);box-shadow:0 8px 18px rgba(0,0,0,.28)}
.badge img{position:absolute;width:132%;height:132%;left:-16%;top:-14%}
.name{font-size:36px;font-weight:800;letter-spacing:2px;color:#fff3d6;white-space:nowrap;
  text-shadow:0 3px 0 rgba(60,25,8,.55),0 8px 18px rgba(0,0,0,.35)}
.rule{width:128px;height:5px;border-radius:999px;background:linear-gradient(90deg,#ffd86b,#e59a2f)}
`, `<div class="cover"><div class="glow"></div>
<img class="head" src="${FACE}" alt="">
<div class="lock">${badge(60, 3, 'badge')}<div class="name">情绪向日葵</div><div class="rule"></div></div>
</div>`);

/* ------------------------------------------------------------ 竖版封面 */
const coverV = page(`
.cover{position:relative;width:600px;height:900px;overflow:hidden;
  background:radial-gradient(circle at 50% 28%,#422613 0%,#2a160c 56%,#1b0e07 100%)}
.b1,.b2,.b3{position:absolute;border-radius:50%;filter:blur(2px)}
.b1{left:-60px;top:210px;width:260px;height:260px;
  background:radial-gradient(circle,rgba(255,214,140,.26),rgba(255,214,140,0) 70%)}
.b2{right:-40px;top:430px;width:220px;height:220px;
  background:radial-gradient(circle,rgba(255,190,110,.22),rgba(255,190,110,0) 70%)}
.b3{left:40px;bottom:80px;width:180px;height:180px;
  background:radial-gradient(circle,rgba(255,230,170,.16),rgba(255,230,170,0) 70%)}
.plant{position:absolute;left:50%;bottom:0;height:700px;transform:translateX(-50%);
  filter:drop-shadow(0 24px 38px rgba(0,0,0,.38))}
.lock{position:absolute;top:64px;left:50%;transform:translateX(-50%);
  display:flex;align-items:center;gap:18px}
.badge{position:relative;border-radius:50%;overflow:hidden;background:#f0a63a;
  border-style:solid;border-color:rgba(255,243,214,.92);box-shadow:0 12px 28px rgba(0,0,0,.32)}
.badge img{position:absolute;width:132%;height:132%;left:-16%;top:-14%}
.name{font-size:48px;font-weight:800;letter-spacing:3px;color:#fff3d6;white-space:nowrap;
  text-shadow:0 4px 0 rgba(60,25,8,.5),0 12px 26px rgba(0,0,0,.35)}
.tag{position:absolute;top:188px;width:100%;text-align:center;font-size:22px;
  letter-spacing:7px;color:rgba(255,243,214,.88)}
`, `<div class="cover"><div class="b1"></div><div class="b2"></div><div class="b3"></div>
<img class="plant" src="${HERO}" alt="">
<div class="lock">${badge(88, 4, 'badge')}<div class="name">情绪向日葵</div></div>
<div class="tag">一朵会看脸色的花</div></div>`);

/* --------------------------------------------------------- 库页面背景 */
const bokeh = [
  [120, 260, 140, .20], [420, 900, 220, .14], [780, 180, 90, .18],
  [1150, 980, 260, .12], [1540, 220, 130, .16], [2050, 160, 110, .14],
  [2450, 1020, 240, .12], [2850, 320, 100, .16], [3180, 900, 180, .12],
  [3560, 240, 150, .16], [980, 520, 70, .12], [1850, 760, 60, .10],
  [3350, 620, 80, .10]
].map(([x, y, r, a]) => `<i style="left:${x}px;top:${y}px;width:${r}px;height:${r}px;
  background:radial-gradient(circle,rgba(255,226,165,${a}),rgba(255,226,165,0) 70%)"></i>`).join('');
const library = page(`
.scene{position:relative;width:3840px;height:1240px;overflow:hidden;background:#1b120c}
.base{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.sun{position:absolute;left:2%;top:-220px;width:1400px;height:1400px;border-radius:50%;
  background:radial-gradient(circle,rgba(255,214,140,.34),rgba(255,214,140,0) 66%);
  mix-blend-mode:screen}
.bokeh i{position:absolute;border-radius:50%;filter:blur(3px)}
.vignette{position:absolute;inset:0;box-shadow:inset 0 0 420px 140px rgba(26,13,5,.58)}
`, `<div class="scene"><img class="base" src="${WIDE}" alt="">
<div class="sun"></div><div class="bokeh">${bokeh}</div><div class="vignette"></div></div>`);

/* ------------------------------------------------------------ 16:9 宣传 */
const promo16 = page(`
.promo{position:relative;width:1920px;height:1080px;overflow:hidden;
  background:radial-gradient(90% 85% at 72% 32%,#5d3418 0%,#2c180d 56%,#190d07 100%)}
.sun{position:absolute;right:80px;top:40px;width:1100px;height:1100px;border-radius:50%;
  background:radial-gradient(circle,rgba(255,206,120,.34),rgba(255,206,120,0) 66%)}
.face{position:absolute;right:-100px;top:40px;height:1000px;width:1000px;
  filter:drop-shadow(0 40px 60px rgba(0,0,0,.45))}
.title{position:absolute;left:250px;top:330px;font-size:132px;font-weight:800;
  letter-spacing:12px;line-height:1;color:#fff3d6;white-space:nowrap;
  text-shadow:0 14px 0 rgba(70,32,10,.35),0 28px 54px rgba(0,0,0,.42)}
.rule{position:absolute;left:260px;top:510px;width:470px;height:16px;border-radius:999px;
  background:linear-gradient(90deg,#ffd86b,#e59a2f);box-shadow:0 12px 26px rgba(0,0,0,.28)}
`, `<div class="promo"><div class="sun"></div>
<img class="face" src="${FACE}" alt="">
<div class="title">情绪向日葵</div><div class="rule"></div></div>`);

/* ------------------------------------------------------------- 1:1 宣传 */
const promo1 = page(`
.promo{position:relative;width:1440px;height:1440px;overflow:hidden;
  background:radial-gradient(85% 70% at 50% 30%,#5d3418 0%,#2c180d 56%,#190d07 100%)}
.sun{position:absolute;left:50%;top:-80px;width:1100px;height:1100px;transform:translateX(-50%);
  border-radius:50%;background:radial-gradient(circle,rgba(255,206,120,.30),rgba(255,206,120,0) 66%)}
.face{position:absolute;left:50%;top:340px;height:1000px;width:1000px;transform:translateX(-50%);
  filter:drop-shadow(0 36px 54px rgba(0,0,0,.42))}
.title{position:absolute;left:0;top:130px;width:100%;text-align:center;
  font-size:128px;font-weight:800;letter-spacing:12px;line-height:1;color:#fff3d6;
  text-shadow:0 12px 0 rgba(70,32,10,.35),0 24px 48px rgba(0,0,0,.42)}
`, `<div class="promo"><div class="sun"></div>
<img class="face" src="${FACE}" alt="">
<div class="title">情绪向日葵</div></div>`);

[
  ['icon.html', icon],
  ['logo.html', logo],
  ['cover-h.html', coverH],
  ['cover-v.html', coverV],
  ['library-bg.html', library],
  ['promo-16x9.html', promo16],
  ['promo-1x1.html', promo1]
].forEach(([name, html]) => fs.writeFileSync(path.join(BUILD, name), html));

console.log('generated', fs.readdirSync(BUILD).join(', '));
