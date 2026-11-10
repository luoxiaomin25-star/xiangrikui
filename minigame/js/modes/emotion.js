'use strict';

/* ============================================================================
 * modes/emotion.js — 情绪向日葵（小游戏版）
 * 玩法、数值、情绪系统与网页版一致；界面改为 Canvas 绘制。
 * ==========================================================================*/

var T = require('../theme.js');
var data = require('../emotion-data.js');
var createFace = require('../face.js').createFace;
var createEmotionScene = require('../emotion-scene.js').createEmotionScene;

var MOOD_COLOR = {
  happy: '#e2a42e',
  angry: '#d9675a',
  sad: '#6f9fd8',
  sleepy: '#9a8fd0',
  shy: '#e08f89',
  curious: '#7fb36a',
  calm: '#b3a488'
};

function createEmotionMode(app) {
  var platform = app.platform;
  var host = app.host;
  var W = platform.W;
  var H = platform.H;
  var s = platform.scale;

  var face = createFace(platform);
  var scene = null;

  var state = null;
  var pose = null;
  var targetPose = null;
  var currentName = 'calm';
  var targetName = 'calm';
  var offlineHours = 0;

  var temp = null;
  var forcedTime = null;
  var lastActionAt = { water: 0, sun: 0, pet: 0 };

  var time = 0;
  var uiClock = 0;
  var saveClock = 0;
  var idleTimer = 14 + Math.random() * 12;

  var bubble = null;
  var toast = null;

  var introOpen = false;
  var helpOpen = false;
  var talkOpen = false;
  var talkText = '';
  var lastSendAt = 0;

  var touch = null;
  var moved = 0;

  var timers = [];

  function schedule(fn, ms) {
    var id = setTimeout(function () {
      var idx = timers.indexOf(id);
      if (idx >= 0) timers.splice(idx, 1);
      fn();
    }, ms);
    timers.push(id);
    return id;
  }

  function clearTimers() {
    for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
    timers.length = 0;
  }

  /* ------------------------------------------------------------- 存档 */
  function loadState() {
    var raw = platform.readJSON(data.SAVE_KEY);
    var st = {};
    var k;
    for (k in data.DEFAULTS) {
      if (Object.prototype.hasOwnProperty.call(data.DEFAULTS, k)) st[k] = data.DEFAULTS[k];
    }
    st.lastSeen = Date.now();
    if (raw) {
      for (k in raw) {
        if (Object.prototype.hasOwnProperty.call(raw, k)) st[k] = raw[k];
      }
    }
    var hours = data.applyOffline(st, Date.now());
    return { state: st, hours: hours };
  }

  function saveState() {
    if (!state) return;
    state.lastSeen = Date.now();
    platform.writeJSON(data.SAVE_KEY, state);
  }

  /* ------------------------------------------------------------- 时间 */
  function isNight() {
    if (forcedTime) return forcedTime === 'night';
    var h = new Date().getHours();
    return h >= 20 || h < 6;
  }

  function evaluateEmotion() {
    if (temp && Date.now() < temp.until) return temp.name;
    if (state.energy < 30 || (isNight() && state.energy < 52)) return 'sleepy';
    if (state.water < 30 || state.bond < 18) return 'sad';
    if (state.water > 93 || state.light > 96) return 'angry';
    if (state.water > 60 && state.light > 55 && state.bond > 35 && state.energy > 45) return 'happy';
    return state.bond > 30 ? 'curious' : 'calm';
  }

  function refreshTarget() {
    var next = evaluateEmotion();
    if (next !== targetName || !targetPose) {
      targetName = next;
      currentName = next;
      targetPose = data.emotionPose(next);
      app.requestDraw();
    }
  }

  function setTemp(name, ms) {
    temp = { name: name, until: Date.now() + (ms || 4000) };
    targetName = name;
    currentName = name;
    targetPose = data.emotionPose(name);
    app.requestDraw();
  }

  /* ------------------------------------------------------------- 说话 */
  function say(text, ms) {
    bubble = { text: text, until: Date.now() + (ms || 4200) };
    app.requestDraw();
  }

  function showToast(text, ms) {
    toast = { text: text, until: Date.now() + (ms || 2200) };
    app.requestDraw();
  }

  function addGrowth(n) {
    var before = state.growth;
    state.growth = data.clamp(state.growth + n, 0, 100);
    var milestones = [25, 50, 75, 100];
    for (var i = 0; i < milestones.length; i++) {
      var m = milestones[i];
      if (before < m && state.growth >= m) {
        showToast(m === 100 ? '它完全盛开了' : '它长大了一点');
      }
    }
  }

  function canAct(key) {
    var now = Date.now();
    if (now - lastActionAt[key] < 900) return false;
    lastActionAt[key] = now;
    return true;
  }

  /* ------------------------------------------------------------- 互动 */
  function actWater() {
    if (!canAct('water')) return;
    if (state.water > 90) {
      state.water = data.clamp(state.water + 3, 0, 100);
      setTemp('angry', 4200);
      say('有点撑……下次少一点。');
    } else {
      state.water = data.clamp(state.water + 24, 0, 100);
      state.energy = data.clamp(state.energy + 3, 0, 100);
      state.bond = data.clamp(state.bond + 2, 0, 100);
      addGrowth(2.5);
      setTemp('happy', 3500);
      if (scene) scene.spawnDrops();
      say(state.water < 40 ? '咕嘟咕嘟，终于喝到水了。' : '咕嘟咕嘟，好舒服。');
    }
    platform.vibrate();
    saveState();
    app.requestDraw();
  }

  function actSun() {
    if (!canAct('sun')) return;
    state.light = data.clamp(state.light + 26, 0, 100);
    state.energy = data.clamp(state.energy + 7, 0, 100);
    state.bond = data.clamp(state.bond + 1, 0, 100);
    addGrowth(1.6);
    setTemp(isNight() ? 'sleepy' : 'happy', 4000);
    say(isNight() ? '晚上的光有点晃眼……不过暖暖的。' : '光落在花瓣上，暖暖的。');
    platform.vibrate();
    saveState();
    app.requestDraw();
  }

  function actPet() {
    if (!canAct('pet')) return;
    state.bond = data.clamp(state.bond + 9, 0, 100);
    state.energy = data.clamp(state.energy + 2, 0, 100);
    addGrowth(1.2);
    if (scene) scene.pet();
    setTemp('shy', 4200);
    say(data.choose(['唔……有点痒。', '再摸一下也可以。', '别、别一直看我……']));
    platform.vibrate();
    saveState();
    app.requestDraw();
  }

  /* ------------------------------------------------------------- 说话面板 */
  function openTalk() {
    talkOpen = true;
    talkText = '';
    platform.showKeyboard({ defaultValue: '', maxLength: 24 });
    app.requestDraw();
  }

  function closeTalk() {
    talkOpen = false;
    talkText = '';
    platform.hideKeyboard();
    app.requestDraw();
  }

  function sendTalk(text) {
    var t = (text || '').trim();
    if (!t) {
      showToast('先写一句想说的话吧');
      return;
    }
    if (Date.now() - lastSendAt < 500) return;
    lastSendAt = Date.now();

    talkOpen = false;
    talkText = '';
    platform.hideKeyboard();

    state.bond = data.clamp(state.bond + 7, 0, 100);
    state.energy = data.clamp(state.energy + 1, 0, 100);
    addGrowth(1.2);

    var mood = data.sentiment(t);
    setTemp(mood, 6500);
    say('……', 1200);
    schedule(function () {
      say(data.choose(data.REPLY[mood] || data.REPLY.curious), 5200);
    }, 800);

    saveState();
    app.requestDraw();
  }

  /* ------------------------------------------------------------- 场景 */
  function ensureScene() {
    if (!scene) {
      scene = createEmotionScene(host, platform, state, face);
    }
  }

  function drawBackdrop() {
    var night = isNight();
    host.drawBackdrop(function (ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, 0, h);
      if (night) {
        g.addColorStop(0, '#263149');
        g.addColorStop(0.55, '#131a2b');
        g.addColorStop(1, '#0b1018');
      } else {
        g.addColorStop(0, '#fff8e9');
        g.addColorStop(0.45, '#f7dfbb');
        g.addColorStop(1, '#e8c496');
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      if (night) {
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        for (var i = 0; i < 46; i++) {
          var x = ((i * 73.7) % 100) / 100 * w;
          var y = ((i * 37.3) % 55) / 100 * h;
          var r = (i % 3 === 0) ? 1.2 : 0.7;
          ctx.globalAlpha = 0.25 + (i % 4) * 0.16;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        var moon = ctx.createRadialGradient(w * 0.82, h * 0.12, 4, w * 0.82, h * 0.12, h * 0.4);
        moon.addColorStop(0, 'rgba(210,225,255,0.32)');
        moon.addColorStop(1, 'rgba(210,225,255,0)');
        ctx.fillStyle = moon;
        ctx.fillRect(0, 0, w, h);
      } else {
        var sun = ctx.createRadialGradient(w * 0.5, h * 0.02, 8, w * 0.5, h * 0.02, h * 0.55);
        sun.addColorStop(0, 'rgba(255,242,205,0.95)');
        sun.addColorStop(1, 'rgba(255,242,205,0)');
        ctx.fillStyle = sun;
        ctx.fillRect(0, 0, w, h);
      }
    });
  }

  /* ------------------------------------------------------------- 生命周期 */
  function enter() {
    var loaded = loadState();
    state = loaded.state;
    offlineHours = loaded.hours;
    saveState();

    pose = data.emotionPose('calm');
    targetName = evaluateEmotion();
    currentName = targetName;
    targetPose = data.emotionPose(targetName);

    temp = null;
    forcedTime = null;
    bubble = null;
    toast = null;
    introOpen = !state.introSeen;
    helpOpen = false;
    talkOpen = false;
    talkText = '';
    idleTimer = 14 + Math.random() * 12;
    time = 0;
    uiClock = 0;
    saveClock = 0;
    touch = null;

    ensureScene();
    scene.mount();
    drawBackdrop();
    app.requestDraw();

    if (offlineHours >= 6) {
      schedule(function () {
        say('你回来啦……我等了好久。', 5000);
      }, 1200);
    }
  }

  function leave() {
    saveState();
    if (scene) scene.unmount();
    platform.hideKeyboard();
    clearTimers();
    introOpen = false;
    helpOpen = false;
    talkOpen = false;
    bubble = null;
    toast = null;
  }

  function onHide() {
    saveState();
    platform.hideKeyboard();
    if (talkOpen) {
      talkOpen = false;
    }
  }

  function onShow() {
    if (!state) return;
    data.applyOffline(state, Date.now());
    refreshTarget();
    app.requestDraw();
  }

  /* ------------------------------------------------------------- 更新 */
  function update(dt) {
    if (!state) return;
    time += dt;
    refreshTarget();

    if (scene) scene.update(dt, pose, targetPose, isNight(), state);

    /* 数值缓慢消耗 */
    state.water = data.clamp(state.water - dt * 0.010, 0, 100);
    state.light = data.clamp(state.light - dt * 0.007, 0, 100);
    state.energy = data.clamp(state.energy - dt * 0.005, 0, 100);
    state.bond = data.clamp(state.bond - dt * 0.0012, 0, 100);

    if (bubble && Date.now() > bubble.until) {
      bubble = null;
      app.requestDraw();
    }
    if (toast && Date.now() > toast.until) {
      toast = null;
      app.requestDraw();
    }

    idleTimer -= dt;
    if (idleTimer <= 0) {
      idleTimer = 22 + Math.random() * 16;
      if (!talkOpen && !introOpen && !helpOpen && !bubble) {
        say(data.choose(data.IDLE_LINES[currentName] || data.IDLE_LINES.calm), 3600);
      }
    }

    uiClock += dt;
    if (uiClock > 0.5) {
      uiClock = 0;
      app.requestDraw();
    }
    saveClock += dt;
    if (saveClock > 5) {
      saveClock = 0;
      saveState();
    }
  }

  /* ------------------------------------------------------------- 绘制工具 */
  function drawBar(ctx, x, y, w, h, pct, color, bg) {
    T.fillRound(ctx, x, y, w, h, h / 2, bg);
    var fw = Math.max(0, Math.min(1, pct / 100)) * w;
    if (fw > 1) T.fillRound(ctx, x, y, Math.max(h, fw), h, h / 2, color);
  }

  function drawCircleButton(ctx, pal, cx, cy, r, icon, onTap) {
    ctx.fillStyle = pal.night ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.62)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal.cardBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    icon(ctx, cx, cy, r * 0.52);
    if (onTap) app.ui.hit(cx - r, cy - r, r * 2, r * 2, onTap);
  }

  /* ------------------------------------------------------------- 弹窗 */
  function drawIntro(ctx, pal, contentW, left) {
    ctx.fillStyle = 'rgba(28,16,6,0.44)';
    ctx.fillRect(0, 0, W, H);
    /* 吞掉卡片外的点击，避免误触底部按钮 */
    app.ui.hit(0, 0, W, H, function () {});

    var cardW = Math.min(contentW, 332 * s);
    var cardH = 306 * s;
    var cx = (W - cardW) / 2;
    var cy = Math.max(platform.safeTop + 64 * s, (H - cardH) / 2);

    T.fillRound(ctx, cx, cy, cardW, cardH, 24 * s, pal.cream);
    T.strokeRound(ctx, cx, cy, cardW, cardH, 24 * s, 'rgba(238,177,61,0.5)', 1);

    T.iconFlower(ctx, W / 2, cy + 52 * s, 27 * s, '#eeb13d', '#5b3a1e');

    T.text(ctx, '一朵会看脸色的向日葵', W / 2, cy + 108 * s, 18 * s, pal.ink, 600, 'center');

    var lines = [
      '观察它的表情和姿态，判断它需要什么。',
      '浇水、晒太阳、摸摸它，或者陪它说说话。',
      '它会记住你的照顾，也会在第二天等你回来。'
    ];
    for (var i = 0; i < lines.length; i++) {
      T.text(ctx, lines[i], W / 2, cy + 140 * s + i * 22 * s, 12 * s, pal.muted, 400, 'center');
    }

    var bw = cardW - 48 * s;
    var bh = 46 * s;
    var bx = cx + 24 * s;
    var by = cy + cardH - bh - 22 * s;
    T.fillRound(ctx, bx, by, bw, bh, 14 * s, pal.gold);
    T.text(ctx, '开始照顾它', W / 2, by + bh / 2 + 5 * s, 14 * s, '#2b1f08', 600, 'center');
    app.ui.hit(bx, by, bw, bh, function () {
      introOpen = false;
      state.introSeen = true;
      saveState();
      say('今天也请多关照。', 3600);
      app.requestDraw();
    });
  }

  function drawHelp(ctx, pal, contentW, left) {
    ctx.fillStyle = 'rgba(28,16,6,0.48)';
    ctx.fillRect(0, 0, W, H);
    app.ui.hit(0, 0, W, H, function () {});

    var cardW = Math.min(contentW, 380 * s);
    var maxH = H - platform.safeTop - platform.safeBottom - 40 * s;
    var cardH = Math.min(maxH, 430 * s);
    var cx = (W - cardW) / 2;
    var cy = (H - cardH) / 2;

    T.fillRound(ctx, cx, cy, cardW, cardH, 22 * s, pal.cream);
    T.strokeRound(ctx, cx, cy, cardW, cardH, 22 * s, 'rgba(238,177,61,0.45)', 1);

    T.text(ctx, '它会怎么表达', cx + 24 * s, cy + 36 * s, 17 * s, pal.ink, 600);
    var closeR = 15 * s;
    var closeX = cx + cardW - 26 * s;
    var closeY = cy + 32 * s;
    ctx.strokeStyle = pal.muted;
    ctx.lineWidth = 2 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(closeX - 6 * s, closeY - 6 * s);
    ctx.lineTo(closeX + 6 * s, closeY + 6 * s);
    ctx.moveTo(closeX + 6 * s, closeY - 6 * s);
    ctx.lineTo(closeX - 6 * s, closeY + 6 * s);
    ctx.stroke();
    app.ui.hit(closeX - closeR, closeY - closeR, closeR * 2, closeR * 2, function () {
      helpOpen = false;
      app.requestDraw();
    });

    var keys = ['happy', 'angry', 'sad', 'sleepy', 'shy', 'curious'];
    var listTop = cy + 68 * s;
    var rowH = (cardH - 132 * s) / keys.length;
    for (var i = 0; i < keys.length; i++) {
      var name = keys[i];
      var e = data.EMOTIONS[name];
      var y = listTop + i * rowH;
      ctx.fillStyle = MOOD_COLOR[name] || '#b3a488';
      ctx.beginPath();
      ctx.arc(cx + 30 * s, y + 7 * s, 4 * s, 0, Math.PI * 2);
      ctx.fill();
      T.text(ctx, e.label, cx + 44 * s, y + 11 * s, 12.5 * s, pal.ink, 600);
      T.text(ctx, e.tip, cx + 44 * s, y + 26 * s, 10 * s, pal.muted, 400);
    }

    var resetW = 70 * s;
    var resetY = cy + cardH - 26 * s;
    T.text(ctx, '清空存档', cx + cardW - 24 * s, resetY, 10.5 * s, pal.faint, 400, 'right');
    app.ui.hit(cx + cardW - 24 * s - resetW, resetY - 14 * s, resetW, 22 * s, function () {
      resetGame();
    });
  }

  function resetGame() {
    function doReset() {
      var st = {};
      for (var k in data.DEFAULTS) {
        if (Object.prototype.hasOwnProperty.call(data.DEFAULTS, k)) st[k] = data.DEFAULTS[k];
      }
      st.lastSeen = Date.now();
      st.introSeen = true;
      st.seed = state.seed;
      state = st;
      temp = null;
      helpOpen = false;
      bubble = null;
      toast = null;
      saveState();
      refreshTarget();
      app.requestDraw();
      say('我们重新认识一下吧。', 3600);
    }
    if (wx.showModal) {
      try {
        wx.showModal({
          title: '清空存档',
          content: '它会忘记成长进度和心情，确定吗？',
          success: function (res) { if (res && res.confirm) doReset(); }
        });
        return;
      } catch (e) { /* 继续直接重置 */ }
    }
    doReset();
  }

  function drawTalk(ctx, pal, contentW, left) {
    ctx.fillStyle = 'rgba(28,16,6,0.46)';
    ctx.fillRect(0, 0, W, H);
    app.ui.hit(0, 0, W, H, closeTalk);

    var kb = platform.getKeyboardHeight();
    var sheetW = Math.min(contentW + 12 * s, W - 16 * s);
    var sheetH = 204 * s;
    var sheetX = (W - sheetW) / 2;
    var sheetY = H - Math.max(platform.safeBottom, kb) - sheetH - 10 * s;
    if (sheetY < platform.safeTop + 90 * s) sheetY = platform.safeTop + 90 * s;

    T.fillRound(ctx, sheetX, sheetY, sheetW, sheetH, 20 * s, pal.cream);
    T.strokeRound(ctx, sheetX, sheetY, sheetW, sheetH, 20 * s, 'rgba(238,177,61,0.4)', 1);
    /* 面板区域吞掉点击，避免点空白关闭 */
    app.ui.hit(sheetX, sheetY, sheetW, sheetH, function () {});

    T.text(ctx, '和它说点什么', sheetX + 20 * s, sheetY + 32 * s, 15 * s, pal.ink, 600);

    var closeX = sheetX + sheetW - 24 * s;
    var closeY = sheetY + 26 * s;
    ctx.strokeStyle = pal.muted;
    ctx.lineWidth = 2 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(closeX - 6 * s, closeY - 6 * s);
    ctx.lineTo(closeX + 6 * s, closeY + 6 * s);
    ctx.moveTo(closeX + 6 * s, closeY - 6 * s);
    ctx.lineTo(closeX - 6 * s, closeY + 6 * s);
    ctx.stroke();
    app.ui.hit(closeX - 16 * s, closeY - 16 * s, 32 * s, 32 * s, closeTalk);

    var chips = data.QUICK_LINES;
    var chipGap = 6 * s;
    var chipW = (sheetW - 40 * s - chipGap * (chips.length - 1)) / chips.length;
    var chipY = sheetY + 50 * s;
    for (var i = 0; i < chips.length; i++) {
      var x = sheetX + 20 * s + i * (chipW + chipGap);
      T.fillRound(ctx, x, chipY, chipW, 30 * s, 9 * s, pal.night ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.6)');
      T.strokeRound(ctx, x, chipY, chipW, 30 * s, 9 * s, pal.cardBorder, 1);
      T.text(ctx, chips[i], x + chipW / 2, chipY + 20 * s, 10.5 * s, pal.muted, 400, 'center');
      (function (text) {
        app.ui.hit(x, chipY, chipW, 30 * s, function () { sendTalk(text); });
      })(chips[i]);
    }

    var inputW = sheetW - 40 * s - 84 * s;
    var inputY = sheetY + 92 * s;
    var inputH = 42 * s;
    T.fillRound(ctx, sheetX + 20 * s, inputY, inputW, inputH, 11 * s, pal.night ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.75)');
    T.strokeRound(ctx, sheetX + 20 * s, inputY, inputW, inputH, 11 * s, pal.cardBorder, 1);
    var shown = talkText || '点这里输入…';
    T.text(ctx, shown, sheetX + 32 * s, inputY + 26 * s, 12 * s, talkText ? pal.ink : pal.faint, 400);
    app.ui.hit(sheetX + 20 * s, inputY, inputW, inputH, function () {
      platform.showKeyboard({ defaultValue: talkText, maxLength: 24 });
    });

    var sendW = 72 * s;
    var sendX = sheetX + sheetW - 20 * s - sendW;
    T.fillRound(ctx, sendX, inputY, sendW, inputH, 11 * s, pal.gold);
    T.text(ctx, '发送', sendX + sendW / 2, inputY + 26 * s, 12.5 * s, '#2b1f08', 600, 'center');
    app.ui.hit(sendX, inputY, sendW, inputH, function () { sendTalk(talkText); });

    T.text(ctx, '也可以直接点上面的短语', sheetX + sheetW / 2, sheetY + sheetH - 14 * s, 9.5 * s, pal.faint, 400, 'center');
  }

  function drawBubble(ctx, pal, contentW, left, top) {
    var maxW = Math.min(contentW - 28 * s, 320 * s);
    var lines = T.wrapText(ctx, bubble.text, maxW - 28 * s, 12.5 * s, 400);
    if (lines.length > 3) lines = lines.slice(0, 3);
    var tw = 0;
    for (var i = 0; i < lines.length; i++) {
      tw = Math.max(tw, T.measure(ctx, lines[i], 12.5 * s, 400));
    }
    var bw = Math.max(126 * s, tw + 28 * s);
    var bh = 18 * s + lines.length * 17 * s;
    var bx = W / 2 - bw / 2;
    var by = top + 52 * s;

    T.fillRound(ctx, bx, by, bw, bh, 13 * s, pal.night ? 'rgba(30,38,58,0.96)' : 'rgba(255,250,240,0.97)');
    T.strokeRound(ctx, bx, by, bw, bh, 13 * s, 'rgba(238,177,61,0.4)', 1);
    ctx.fillStyle = pal.night ? 'rgba(30,38,58,0.96)' : 'rgba(255,250,240,0.97)';
    ctx.beginPath();
    ctx.moveTo(W / 2 - 6 * s, by + bh - 1);
    ctx.lineTo(W / 2 + 6 * s, by + bh - 1);
    ctx.lineTo(W / 2, by + bh + 8 * s);
    ctx.closePath();
    ctx.fill();

    for (var j = 0; j < lines.length; j++) {
      T.text(ctx, lines[j], bx + 14 * s, by + 17 * s + j * 17 * s, 12.5 * s, pal.ink, 400);
    }
  }

  function drawToast(ctx, pal) {
    var tw = T.measure(ctx, toast.text, 12 * s, 400);
    var w = tw + 34 * s;
    var h = 32 * s;
    var x = W / 2 - w / 2;
    var y = H * 0.36;
    T.fillRound(ctx, x, y, w, h, h / 2, 'rgba(40,28,14,0.82)');
    T.text(ctx, toast.text, W / 2, y + h / 2 + 4 * s, 12 * s, '#fff6e6', 400, 'center');
  }

  /* ------------------------------------------------------------- UI */
  function drawUI(ui) {
    var ctx = ui.begin();
    var pal = T.palette(isNight());
    var contentW = Math.min(W - 32 * s, 520);
    var left = (W - contentW) / 2;
    /* 顶部留出状态栏 + 胶囊按钮的高度 */
    var top = platform.safeTop + 44 * s;
    var headerR = 17 * s;

    /* 返回 */
    drawCircleButton(ctx, pal, left + headerR, top + headerR, headerR, function (c, x, y, r) {
      T.iconBack(c, x, y, r, pal.ink);
    }, function () {
      app.switchMode('home');
    });

    /* 标题 + 心情 */
    var titleX = left + headerR * 2 + 12 * s;
    T.text(ctx, '向日葵', titleX, top + 20 * s, 18 * s, pal.ink, 600);
    var e = data.EMOTIONS[currentName] || data.EMOTIONS.calm;
    ctx.fillStyle = MOOD_COLOR[currentName] || '#b3a488';
    ctx.beginPath();
    ctx.arc(titleX + 4 * s, top + 34 * s, 3.2 * s, 0, Math.PI * 2);
    ctx.fill();
    T.text(ctx, e.label + ' · 成长 ' + Math.round(state.growth) + '%', titleX + 12 * s, top + 38 * s, 11 * s, pal.muted, 400);

    /* 右上按钮 */
    var timeX = left + contentW - headerR;
    var helpX = timeX - headerR * 2 - 10 * s;
    drawCircleButton(ctx, pal, timeX, top + headerR, headerR, function (c, x, y, r) {
      if (isNight()) T.iconMoon(c, x, y, r * 0.9, pal.gold);
      else T.iconSun(c, x, y, r * 0.9, pal.goldDeep);
    }, function () {
      forcedTime = isNight() ? 'day' : 'night';
      drawBackdrop();
      refreshTarget();
      app.requestDraw();
    });
    drawCircleButton(ctx, pal, helpX, top + headerR, headerR, function (c, x, y, r) {
      T.iconHelp(c, x, y, r, pal.muted);
    }, function () {
      helpOpen = true;
      app.requestDraw();
    });

    /* 气泡 */
    if (bubble && !introOpen && !helpOpen && !talkOpen) {
      drawBubble(ctx, pal, contentW, left, top);
    }

    /* 底部面板 */
    var panelH = 172 * s + platform.safeBottom + 10 * s;
    var panelY = H - panelH;
    T.fillRound(ctx, -12, panelY, W + 24, panelH + 30, 22 * s, pal.panel);
    T.strokeRound(ctx, -12, panelY, W + 24, panelH + 30, 22 * s, pal.panelBorder, 1);

    var gy = panelY + 18 * s;
    T.text(ctx, '成长', left, gy + 10 * s, 10.5 * s, pal.muted, 500);
    T.text(ctx, Math.round(state.growth) + '%', left + contentW, gy + 10 * s, 10.5 * s, pal.goldDeep, 600, 'right');
    drawBar(ctx, left, gy + 16 * s, contentW, 5 * s, state.growth, pal.gold, pal.night ? 'rgba(255,255,255,0.10)' : 'rgba(90,60,30,0.12)');

    var meters = [
      { label: '水分', value: state.water, color: pal.water },
      { label: '光照', value: state.light, color: pal.light },
      { label: '亲密', value: state.bond, color: pal.bond },
      { label: '精力', value: state.energy, color: pal.energy }
    ];
    var mTop = gy + 34 * s;
    var colW = (contentW - 10 * s) / 2;
    for (var i = 0; i < meters.length; i++) {
      var col = i % 2;
      var row = Math.floor(i / 2);
      var mx = left + col * (colW + 10 * s);
      var my = mTop + row * 28 * s;
      T.text(ctx, meters[i].label, mx, my + 8 * s, 10 * s, pal.muted, 500);
      T.text(ctx, Math.round(meters[i].value), mx + colW, my + 8 * s, 9 * s, pal.faint, 400, 'right');
      drawBar(ctx, mx, my + 13 * s, colW, 6 * s, meters[i].value, meters[i].color,
        pal.night ? 'rgba(255,255,255,0.10)' : 'rgba(90,60,30,0.10)');
    }

    /* 底部四个按钮 */
    var btnH = 52 * s;
    var btnGap = 8 * s;
    var btnW = (contentW - btnGap * 3) / 4;
    var btnY = H - platform.safeBottom - 10 * s - btnH;
    var actions = [
      { label: '浇水', icon: T.iconDrop, color: pal.water, act: actWater },
      { label: '晒太阳', icon: T.iconSun, color: pal.goldDeep, act: actSun },
      { label: '摸摸', icon: T.iconHeart, color: pal.bond, act: actPet },
      { label: '说话', icon: T.iconChat, color: pal.energy, act: openTalk }
    ];
    for (var ai = 0; ai < actions.length; ai++) {
      var ax = left + ai * (btnW + btnGap);
      T.fillRound(ctx, ax, btnY, btnW, btnH, 13 * s, pal.night ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.58)');
      T.strokeRound(ctx, ax, btnY, btnW, btnH, 13 * s, pal.cardBorder, 1);
      actions[ai].icon(ctx, ax + btnW / 2, btnY + 17 * s, 8 * s, actions[ai].color);
      T.text(ctx, actions[ai].label, ax + btnW / 2, btnY + 41 * s, 11 * s, pal.ink, 500, 'center');
      (function (fn) {
        app.ui.hit(ax, btnY, btnW, btnH, fn);
      })(actions[ai].act);
    }

    if (toast) drawToast(ctx, pal);
    if (introOpen) drawIntro(ctx, pal, contentW, left);
    if (helpOpen) drawHelp(ctx, pal, contentW, left);
    if (talkOpen) drawTalk(ctx, pal, contentW, left);

    ui.end();
  }

  /* ------------------------------------------------------------- 触摸 */
  function touchStart(points) {
    if (!points.length) return;
    if (introOpen || helpOpen || talkOpen) {
      touch = null;
      return;
    }
    touch = { x: points[0].x, y: points[0].y, t: Date.now() };
    moved = 0;
  }

  function touchMove(points) {
    if (!touch || !points.length) return;
    if (introOpen || helpOpen || talkOpen) return;
    var dx = points[0].x - touch.x;
    var dy = points[0].y - touch.y;
    moved += Math.abs(dx) + Math.abs(dy);
    touch.x = points[0].x;
    touch.y = points[0].y;
    if (scene) scene.orbit(dx, dy);
  }

  function touchEnd() {
    if (!touch) return;
    if (moved < 8 && Date.now() - touch.t < 500) {
      if (scene && scene.hitFlower(touch.x, touch.y)) actPet();
    }
    touch = null;
  }

  /* ------------------------------------------------------------- 键盘 */
  function onKeyboardInput(value) {
    if (!talkOpen) return;
    talkText = value || '';
    app.requestDraw();
  }

  function onKeyboardConfirm(value) {
    if (!talkOpen) return;
    talkText = value || '';
    sendTalk(talkText);
  }

  function onKeyboardComplete(value) {
    if (!talkOpen) return;
    talkText = value || '';
    app.requestDraw();
  }

  return {
    name: 'emotion',
    needsFrame: true,
    enter: enter,
    leave: leave,
    update: update,
    drawUI: drawUI,
    touchStart: touchStart,
    touchMove: touchMove,
    touchEnd: touchEnd,
    onHide: onHide,
    onShow: onShow,
    onKeyboardInput: onKeyboardInput,
    onKeyboardConfirm: onKeyboardConfirm,
    onKeyboardComplete: onKeyboardComplete
  };
}

module.exports = { createEmotionMode: createEmotionMode };
