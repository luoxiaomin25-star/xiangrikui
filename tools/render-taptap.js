/* 用无头 Edge 按 TapTap 规格精确截图合成页面
 * 用法：node tools/make-taptap-assets.js && node tools/render-taptap.js
 */
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const BUILD = path.join(ROOT, 'taptap-assets', 'build');
const OUT = path.join(ROOT, 'taptap-assets');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9500 + (process.pid % 200);

const jobs = [
  { html: 'icon.html', out: '01-icon-512x512.png', w: 512, h: 512, format: 'png' },
  { html: 'logo.html', out: '02-logo-1280x720.png', w: 1280, h: 720, format: 'png', transparent: true },
  { html: 'cover-h.html', out: '03-cover-horizontal-460x215.png', w: 460, h: 215, format: 'png' },
  { html: 'cover-v.html', out: '04-cover-vertical-600x900.jpg', w: 600, h: 900, format: 'jpeg', quality: 92 },
  { html: 'library-bg.html', out: '05-library-bg-3840x1240.jpg', w: 3840, h: 1240, format: 'jpeg', quality: 92 },
  { html: 'promo-16x9.html', out: '06-promo-16x9-1920x1080.jpg', w: 1920, h: 1080, format: 'jpeg', quality: 92 },
  { html: 'promo-1x1.html', out: '07-promo-1x1-1440x1440.jpg', w: 1440, h: 1440, format: 'jpeg', quality: 92 }
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitEndpoint(url, tries = 80) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch (e) {}
    await sleep(150);
  }
  throw new Error('DevTools 未就绪');
}

function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  let id = 0;
  const ready = new Promise((res, rej) => {
    ws.addEventListener('open', () => res());
    ws.addEventListener('error', () => rej(new Error('ws error')));
  });
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  return { send, ready, close: () => ws.close() };
}

async function main() {
  const profile = path.join(ROOT, '.tmp-edge', 'taptap-' + process.pid);
  fs.mkdirSync(profile, { recursive: true });
  const child = spawn(EDGE, [
    '--headless=new', '--enable-unsafe-swiftshader', '--hide-scrollbars',
    '--no-first-run', '--no-default-browser-check', '--mute-audio',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'
  ], { stdio: 'ignore' });

  try {
    await waitEndpoint(`http://127.0.0.1:${PORT}/json/version`);
    const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const c = cdp(target.webSocketDebuggerUrl);
    await c.ready;
    await c.send('Page.enable');
    await c.send('Runtime.enable');

    for (const job of jobs) {
      await c.send('Emulation.setDeviceMetricsOverride', {
        width: job.w, height: job.h, deviceScaleFactor: 1, mobile: false
      });
      if (job.transparent) {
        await c.send('Emulation.setDefaultBackgroundColorOverride', {
          color: { r: 0, g: 0, b: 0, a: 0 }
        });
      } else {
        await c.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 255, g: 255, b: 255, a: 1 } });
      }
      const url = pathToFileURL(path.join(BUILD, job.html)).href;
      await c.send('Page.navigate', { url });
      await sleep(job.w >= 3000 ? 1800 : 900);
      const params = {
        format: job.format,
        quality: job.quality || 92,
        captureBeyondViewport: false,
        omitBackground: !!job.transparent
      };
      if (job.format === 'png') delete params.quality;
      const shot = await c.send('Page.captureScreenshot', params);
      const out = path.join(OUT, job.out);
      fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
      console.log(job.out, `${job.w}x${job.h}`, (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
    }
    c.close();
  } finally {
    try { execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); }
    catch (e) { child.kill(); }
    await sleep(300);
    for (let i = 0; i < 3; i++) {
      try { fs.rmSync(profile, { recursive: true, force: true }); break; }
      catch (e) { await sleep(400); }
    }
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
