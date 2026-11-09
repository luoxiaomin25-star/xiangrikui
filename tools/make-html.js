/* 把 three、模型、查看器打包成：
 *   1) index.html                 免安装的独立页面（离线可用，双击即开）
 *      同时复制一份到 deploy/index.html，便于直接上传静态托管
 *   2) <可视化目录>/sunflower-3d.html  会话内嵌用的片段
 * 运行：node tools/make-html.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VIZ_DIR = process.argv[2] ||
  'C:/Users/86186/.codex/visualizations/2026/09/18/01a0b335-af18-73e3-9389-66cb075cbe54';

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const three = read('model/three.min.js');
const model = read('model/sunflower.js');
const viewer = read('model/viewer.js');
const app = read('web/app.js');
const style = read('web/style.css');

/* ------------------------------------------------------------ 独立页面 */
const standalone = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>向日葵三维模型</title>
<style>
${style}
</style>
</head>
<body>
<div id="stage"></div>
<aside id="ui">
  <header>
    <h1>向日葵 <span>三维模型</span></h1>
    <p id="stats" class="stats"></p>
  </header>
  <div class="group">
    <span class="label">视角</span>
    <div class="seg">
      <button type="button" data-view="full" class="active">全身</button>
      <button type="button" data-view="head">花头</button>
      <button type="button" data-view="side">侧面</button>
      <button type="button" data-view="back">花托</button>
    </div>
  </div>
  <div class="group">
    <span class="label">显示</span>
    <label class="check"><input type="checkbox" id="auto" checked> 自动旋转</label>
    <label class="check"><input type="checkbox" id="show-foliage" checked> 茎与叶</label>
    <label class="check"><input type="checkbox" id="show-head" checked> 花头</label>
  </div>
  <div class="group">
    <span class="label">形态</span>
    <label class="range"><span>花头倾角</span><output id="o-tilt">24°</output>
      <input type="range" id="i-tilt" min="0" max="70" step="1" value="24" data-unit="°"></label>
    <label class="range"><span>花盘直径</span><output id="o-disk">7.2 cm</output>
      <input type="range" id="i-disk" min="4.5" max="10" step="0.1" value="7.2" data-unit=" cm"></label>
    <label class="range"><span>茎高</span><output id="o-stem">56 cm</output>
      <input type="range" id="i-stem" min="30" max="80" step="1" value="56" data-unit=" cm"></label>
    <label class="range"><span>外轮花瓣</span><output id="o-petals">24</output>
      <input type="range" id="i-petals" min="10" max="40" step="1" value="24"></label>
    <label class="range"><span>花盘小花</span><output id="o-florets">700</output>
      <input type="range" id="i-florets" min="250" max="1200" step="10" value="700"></label>
    <label class="range"><span>叶片数</span><output id="o-leaves">5</output>
      <input type="range" id="i-leaves" min="0" max="5" step="1" value="5"></label>
  </div>
  <div class="actions">
    <button type="button" id="seed">换一株</button>
    <button type="button" id="dl" class="primary">下载 STL</button>
  </div>
  <p class="foot">拖动旋转 · 滚轮缩放 · Shift 拖动平移<br>STL 以毫米为单位导出，可直接切片打印</p>
</aside>
<div id="hint">拖动旋转 · 滚轮缩放 · Shift 拖动平移</div>
<script>${three}</script>
<script>${model}</script>
<script>${viewer}</script>
<script>${app}</script>
</body>
</html>
`;

/* -------------------------------------------------------------- 内嵌片段 */
const fragment = `<div id="sf-root" class="sf-wrap">
  <div id="sf-stage" class="sf-stage" role="img" aria-label="可旋转查看的向日葵三维模型"></div>
  <p class="sf-cap text-small">程序化向日葵三维模型 · 拖动旋转 · 滚轮缩放</p>
</div>
<style>
#sf-root{--sf-h:clamp(260px,42vh,460px);width:100%;margin:0 auto}
#sf-root .sf-stage{position:relative;width:100%;height:var(--sf-h);border-radius:12px;
  background:radial-gradient(115% 85% at 50% 22%,color-mix(in srgb,var(--foreground) 9%,transparent) 0%,transparent 62%)}
#sf-root .sf-stage canvas{display:block;width:100%;height:100%;border-radius:12px}
#sf-root .sf-cap{margin:6px 2px 0;color:var(--muted-foreground);text-align:center}
</style>
<script src="https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.min.js"></script>
<script>${model}</script>
<script>${viewer}</script>
<script>
(function(){
  var host=document.getElementById('sf-stage');
  if(!host||!window.THREE||!window.SunflowerViewer) return;
  try{
    var v=SunflowerViewer.create(THREE,host,{autoRotate:true});
    v.frame('full');
    var m=v.getModel(),st=m.stats;
    var cap=document.querySelector('.sf-cap');
    if(cap) cap.textContent='程序化向日葵三维模型 · '+st.parts+' 个部件 / '
      +(st.triangles/10000).toFixed(1)+' 万三角面 · 高 '+(st.size.y*10).toFixed(0)
      +' mm · 拖动旋转、滚轮缩放';
  }catch(err){
    host.innerHTML='<p class="text-small" style="padding:16px;color:var(--muted-foreground)">当前环境无法初始化 WebGL 三维视图</p>';
  }
})();
</script>
`;

fs.writeFileSync(path.join(ROOT, 'index.html'), standalone);
const deployDir = path.join(ROOT, 'deploy');
fs.mkdirSync(deployDir, { recursive: true });
fs.writeFileSync(path.join(deployDir, 'index.html'), standalone);
console.log('index.html / deploy/index.html', (standalone.length / 1024).toFixed(0) + ' KB');

if (VIZ_DIR) {
  fs.mkdirSync(VIZ_DIR, { recursive: true });
  fs.writeFileSync(path.join(VIZ_DIR, 'sunflower-3d.html'), fragment);
  console.log('fragment', path.join(VIZ_DIR, 'sunflower-3d.html'),
    (fragment.length / 1024).toFixed(0) + ' KB');
}
