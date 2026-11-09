/* 用 Edge + DevTools 协议截图并读取页面运行时状态（无需第三方依赖）
 * 用法：node tools/shot.js <url> <输出png> [等待毫秒] [求值表达式]
 */
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9333 + (process.pid % 200);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForEndpoint(url, tries = 80) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch (e) { /* 还没起来 */ }
    await sleep(150);
  }
  throw new Error('DevTools 端点未就绪: ' + url);
}

function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  const events = [];
  let id = 0;
  const ready = new Promise((res, rej) => {
    ws.addEventListener('open', () => res());
    ws.addEventListener('error', (e) => rej(new Error('ws error')));
  });
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    } else if (msg.method) events.push(msg);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  return { send, events, ready, close: () => ws.close() };
}

async function main() {
  const url = process.argv[2];
  const out = process.argv[3];
  const wait = parseInt(process.argv[4] || '2500', 10);
  const expr = process.argv[5] || 'null';
  const dataOut = process.argv[6] || '';
  const vw = parseInt(process.env.SHOT_W || '1400', 10);
  const vh = parseInt(process.env.SHOT_H || '1000', 10);
  if (!url || !out) { console.error('用法: node tools/shot.js <url> <out.png> [waitMs] [expr]'); process.exit(1); }

  const profile = path.join(__dirname, '..', '.tmp-edge', 'prof-' + process.pid);
  fs.mkdirSync(profile, { recursive: true });
  const child = spawn(EDGE, [
    '--headless=new', '--enable-unsafe-swiftshader', '--hide-scrollbars',
    '--window-size=1400,1000', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--mute-audio',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'
  ], { stdio: 'ignore' });

  try {
    await waitForEndpoint(`http://127.0.0.1:${PORT}/json/version`);
    const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const client = cdp(target.webSocketDebuggerUrl);
    await client.ready;
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: vw, height: vh, deviceScaleFactor: 1, mobile: vw < 600
    });
    await client.send('Page.navigate', { url });
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline && !client.events.some((e) => e.method === 'Page.loadEventFired')) await sleep(120);
    await sleep(wait);

    const res = await client.send('Runtime.evaluate', {
      expression: expr, returnByValue: true, awaitPromise: true
    });
    if (res && res.result && res.result.value !== undefined && res.result.value !== null) {
      const isData = typeof res.result.value === 'string'
        && res.result.value.indexOf('data:image/') === 0;
      if (!isData || !dataOut) {
        console.log(typeof res.result.value === 'string'
          ? res.result.value : JSON.stringify(res.result.value));
      }
      if (isData && dataOut) {
        const comma = res.result.value.indexOf(',');
        fs.writeFileSync(dataOut, Buffer.from(res.result.value.slice(comma + 1), 'base64'));
        console.log('saved data ' + dataOut);
      }
    }
    if (res && res.exceptionDetails) console.error('页面异常:', JSON.stringify(res.exceptionDetails).slice(0, 400));

    const fmt = (process.env.SHOT_FORMAT || 'png').toLowerCase();
    const shotParams = {
      format: fmt === 'jpeg' ? 'jpeg' : 'png',
      captureBeyondViewport: false
    };
    if (fmt === 'jpeg') shotParams.quality = parseInt(process.env.SHOT_QUALITY || '90', 10);
    if (process.env.SHOT_TRANSPARENT === '1') shotParams.omitBackground = true;
    const shot = await client.send('Page.captureScreenshot', shotParams);
    fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
    console.log('saved ' + out + '  ' + (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
    client.close();
  } finally {
    /* Chromium 是多进程结构，必须连同子进程一起结束，否则会残留无头实例 */
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
