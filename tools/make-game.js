/* 打包情绪向日葵 v0.1 为单文件网页（离线可玩）
 * 运行：node tools/make-game.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const three = read('model/three.min.js');
const model = read('model/sunflower.js');
const face = read('game/face.js');
const game = read('game/game.js');
const css = read('game/style.css');

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta name="theme-color" content="#f7dfbb">
<title>情绪向日葵 · 一朵会看脸色的花</title>
<style>
${css}
</style>
</head>
<body>
<div id="stage"></div>
<div id="vignette"></div>
<div id="sunGlow"></div>

<div id="hud">
  <div class="brand">
    <div class="name">向日葵</div>
    <div class="mood"><span id="moodIcon">👀</span><span id="moodLabel">好奇</span></div>
  </div>
  <div class="hud-right">
    <div class="growth"><span id="growthText">成长 10%</span><div class="growth-bar"><i id="growthBar"></i></div></div>
    <button class="icon-btn" id="timeBtn" title="切换昼夜">☀️</button>
    <button class="icon-btn" id="helpBtn" title="玩法说明">?</button>
  </div>
</div>

<div id="bubble"></div>

<div id="bottom">
  <div class="meters">
    <div class="meter"><span class="mico">💧</span><span class="bar"><i id="mWater"></i></span><em>水</em></div>
    <div class="meter"><span class="mico">☀️</span><span class="bar"><i id="mLight"></i></span><em>光</em></div>
    <div class="meter"><span class="mico">💛</span><span class="bar"><i id="mBond"></i></span><em>亲密</em></div>
    <div class="meter"><span class="mico">⚡</span><span class="bar"><i id="mEnergy"></i></span><em>精力</em></div>
  </div>
  <div class="actions">
    <button class="act" data-act="water"><span>💧</span>浇水</button>
    <button class="act" data-act="sun"><span>☀️</span>晒太阳</button>
    <button class="act" data-act="pet"><span>🤚</span>摸摸</button>
    <button class="act" data-act="talk"><span>💬</span>说话</button>
  </div>
</div>

<div id="talkPanel">
  <div class="sheet-head"><span>和它说点什么</span><button id="talkClose" aria-label="关闭">×</button></div>
  <div class="quick">
    <button data-text="今天很开心">今天很开心</button>
    <button data-text="有点累了">有点累了</button>
    <button data-text="想你了">想你了</button>
  </div>
  <div class="talk-row">
    <input id="talkInput" maxlength="60" placeholder="它会认真听…">
    <button id="talkSend">说</button>
  </div>
</div>

<div id="intro">
  <div class="card">
    <div class="big">🌻</div>
    <h1>一朵会看脸色的向日葵</h1>
    <p>观察它的表情和姿态，判断它需要什么。<br>浇水、晒太阳、摸摸它，或者陪它说说话。</p>
    <p class="dim">它会记住你的照顾，也会在第二天等你回来。</p>
    <button id="startBtn">开始照顾它</button>
  </div>
</div>

<div id="toast"></div>

<div id="debug" class="hidden">
  <button data-emotion="happy">开心</button>
  <button data-emotion="angry">生气</button>
  <button data-emotion="sad">难过</button>
  <button data-emotion="sleepy">困倦</button>
  <button data-emotion="shy">害羞</button>
  <button data-emotion="curious">好奇</button>
  <button data-emotion="calm">平静</button>
</div>

<script>${three}</script>
<script>${model}</script>
<script>${face}</script>
<script>${game}</script>
</body>
</html>
`;

const out = path.join(ROOT, 'emotion-sunflower.html');
fs.writeFileSync(out, html);
console.log('emotion-sunflower.html', (html.length / 1024).toFixed(0) + ' KB');
