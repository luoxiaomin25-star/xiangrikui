/* ============================================================================
 * 情绪向日葵 v0.1 — 养成版
 * 一盆会看脸色的向日葵：观察表情 → 判断需求 → 照顾 → 成长
 * ==========================================================================*/
(function () {
  'use strict';

  var THREE = window.THREE;
  var Model = window.SunflowerModel;
  var Face = window.SunflowerFace;
  if (!THREE || !Model || !Face) {
    document.body.innerHTML = '<p style="padding:24px;color:#fff">三维引擎加载失败</p>';
    return;
  }

  var $ = function (id) { return document.getElementById(id); };
  var IS_ART = /[?&]art=1/.test(location.search);
  function lin(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function damp(cur, target, lambda, dt) {
    return cur + (target - cur) * (1 - Math.exp(-lambda * dt));
  }
  function choose(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /* ---------------------------------------------------------------- 存档 */
  var SAVE_KEY = 'sunflower-pet-v1';
  var DEFAULTS = {
    water: 66, light: 60, bond: 34, energy: 74,
    growth: 10, lastSeen: Date.now(), introSeen: false, seed: 20251107
  };
  var state = (function () {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return Object.assign({}, DEFAULTS, { lastSeen: Date.now() });
      return Object.assign({}, DEFAULTS, JSON.parse(raw));
    } catch (e) {
      return Object.assign({}, DEFAULTS, { lastSeen: Date.now() });
    }
  })();

  var offlineHours = 0;
  (function applyOffline() {
    var now = Date.now();
    var hours = Math.max(0, Math.min(48, (now - (state.lastSeen || now)) / 3600000));
    offlineHours = hours;
    if (hours < 0.05) return;
    state.water = clamp(state.water - hours * 1.6, 8, 100);
    state.light = clamp(state.light - hours * 0.9, 8, 100);
    state.energy = clamp(state.energy - hours * 0.7, 12, 100);
    state.bond = clamp(state.bond - hours * 0.12, 5, 100);
  })();

  function save() {
    state.lastSeen = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* 隐私模式 */ }
  }
  save();

  /* ------------------------------------------------------------ 情绪定义 */
  var FACE_BASE = {
    eyeOpen: 0.88, eyeCurve: 0, pupilX: 0, pupilY: 0,
    mouthOpen: 0, smile: 0.22, blush: 0.1,
    tears: 0, anger: 0, sleep: 0, sparkle: 0,
    brow: 0, browTilt: 0, browRaise: 0, blink: 1
  };
  var BODY_BASE = {
    pitch: 0, roll: 0, petal: 0.04, twist: 0,
    tint: [1, 1, 1], light: 1, bob: 0.5, lean: 0
  };

  var EMOTIONS = {
    happy: {
      label: '开心', icon: '☀️',
      face: { eyeOpen: 0.02, eyeCurve: 1, mouthOpen: 0.55, smile: 1, blush: 0.4, sparkle: 0.9 },
      body: { pitch: -0.05, roll: 0.02, petal: 0.12, tint: [1.04, 1.0, 0.92], light: 1.08, bob: 1.0 }
    },
    angry: {
      label: '生气', icon: '💢',
      face: { eyeOpen: 0.55, pupilY: 0.05, brow: 1, browTilt: 1, smile: -0.8, anger: 0.9, blush: 0.2 },
      body: { pitch: 0.12, roll: -0.04, petal: 0.18, twist: 0.08, tint: [1.06, 0.88, 0.78], light: 0.95, bob: 0.35 }
    },
    sad: {
      label: '难过', icon: '💧',
      face: { eyeOpen: 0.78, pupilY: 0.45, brow: 0.6, browTilt: -0.8, smile: -0.9, tears: 0.9, blush: 0.05 },
      body: { pitch: 0.2, roll: 0.03, petal: -0.22, tint: [0.82, 0.86, 0.96], light: 0.72, bob: 0.2, lean: 0.05 }
    },
    sleepy: {
      label: '困倦', icon: '😴',
      face: { eyeOpen: 0.16, pupilY: 0.2, mouthOpen: 0.3, smile: 0.05, sleep: 1, blush: 0.08 },
      body: { pitch: 0.1, roll: 0.09, petal: -0.1, tint: [0.9, 0.9, 0.84], light: 0.7, bob: 0.35 }
    },
    shy: {
      label: '害羞', icon: '☺️',
      face: { eyeOpen: 0.02, eyeCurve: 0.9, smile: 0.55, blush: 0.95, sparkle: 0.15 },
      body: { pitch: -0.01, roll: -0.12, petal: 0.22, tint: [1.05, 0.94, 0.94], light: 1.0, bob: 0.5 }
    },
    curious: {
      label: '好奇', icon: '👀',
      face: {
        eyeOpen: 1, pupilX: 0.4, pupilY: -0.2, mouthOpen: 0.22, smile: 0.15,
        brow: 0.5, browTilt: -0.4, browRaise: 0.8, blush: 0.1, sparkle: 0.2
      },
      body: { pitch: -0.03, roll: 0.12, petal: 0.14, tint: [1.02, 0.99, 0.92], light: 1.05, bob: 0.7 }
    },
    calm: {
      label: '平静', icon: '🌿',
      face: {},
      body: {}
    }
  };

  var IDLE_LINES = {
    happy: ['今天的光刚刚好。', '你在的时候，花瓣都轻一点。', '要不要陪我待一会儿？'],
    angry: ['哼。', '我现在不太想说话。', '水有点多了。'],
    sad: ['有点蔫……', '可以陪陪我吗？', '我好像需要一点水。'],
    sleepy: ['眼皮好重……', '天黑了，我想睡了。', '晚安的时候记得叫我。'],
    shy: ['别一直看我……', '再摸一下也可以。', '花瓣有点烫。'],
    curious: ['你在做什么？', '刚刚那是什么声音？', '今天会发生什么？'],
    calm: ['风很轻。', '我在这里。', '慢慢来就好。']
  };

  var REPLY = {
    happy: ['我也是！', '和你在一起真开心。', '今天的花瓣都亮起来了。'],
    sad: ['我在这里陪着你。', '难过的时候，可以靠一会儿。', '不用急着好起来。'],
    sleepy: ['那我们一起休息吧。', '晚安，明天见。', '先闭上眼睛，好不好？'],
    curious: ['然后呢？', '我在听。', '你今天发生了什么？']
  };

  /* ---------------------------------------------------------------- 场景 */
  var stage = $('stage');
  var renderer = new THREE.WebGLRenderer({
    antialias: true, alpha: true, preserveDrawingBuffer: IS_ART
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.touchAction = 'none';
  stage.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(38, 1, 0.5, 3000);

  var hemi = new THREE.HemisphereLight(0xdfeaff, 0x6f6a48, 0.55);
  scene.add(hemi);
  var keyLight = new THREE.DirectionalLight(0xfff2da, 1.6);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  keyLight.shadow.bias = -0.0008;
  keyLight.position.set(55, 95, 75);
  scene.add(keyLight);
  scene.add(keyLight.target);
  var fill = new THREE.DirectionalLight(0xcfe0ff, 0.38);
  fill.position.set(-70, 40, 30);
  scene.add(fill);
  var rim = new THREE.DirectionalLight(0xffe2b0, 0.55);
  rim.position.set(-30, 45, -70);
  scene.add(rim);
  var bounce = new THREE.DirectionalLight(0x9fae6a, 0.32);
  bounce.position.set(30, -20, 20);
  scene.add(bounce);
  var lamp = new THREE.PointLight(0xffc98a, 0.9, 140, 2);
  lamp.position.set(18, 26, 28);
  lamp.visible = false;
  scene.add(lamp);

  /* 木桌面 */
  var table = new THREE.Mesh(
    new THREE.CylinderGeometry(140, 140, 2.4, 64),
    new THREE.MeshStandardMaterial({ color: lin(0x6d4b33), roughness: 0.92, metalness: 0 })
  );
  table.position.y = -11.4;
  table.receiveShadow = true;
  scene.add(table);

  /* 花盆：土壤面在 y=0，花茎从这里长出 */
  var pot = new THREE.Group();
  pot.name = 'Pot';
  var potMat = new THREE.MeshStandardMaterial({ color: lin(0xb96545), roughness: 0.92, metalness: 0 });
  var potBody = new THREE.Mesh(new THREE.CylinderGeometry(10, 7.6, 10, 48, 1), potMat);
  potBody.position.y = -5;
  potBody.castShadow = true;
  potBody.receiveShadow = true;
  pot.add(potBody);
  var rim = new THREE.Mesh(new THREE.TorusGeometry(10.05, 0.55, 12, 48),
    new THREE.MeshStandardMaterial({ color: lin(0xc97756), roughness: 0.85 }));
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.1;
  rim.castShadow = true;
  rim.receiveShadow = true;
  pot.add(rim);
  var soil = new THREE.Mesh(new THREE.CylinderGeometry(9.4, 9.4, 0.9, 48),
    new THREE.MeshStandardMaterial({ color: lin(0x3a2a1c), roughness: 1, metalness: 0 }));
  soil.position.y = -0.32;
  soil.receiveShadow = true;
  pot.add(soil);
  for (var peb = 0; peb < 9; peb++) {
    var pebble = new THREE.Mesh(
      new THREE.SphereGeometry(0.32 + Math.random() * 0.28, 6, 5),
      new THREE.MeshStandardMaterial({ color: lin(0x6b5a45), roughness: 1 })
    );
    var a = Math.random() * Math.PI * 2;
    var rr = 2 + Math.random() * 6.2;
    pebble.position.set(Math.cos(a) * rr, 0.18, Math.sin(a) * rr);
    pebble.scale.y = 0.55;
    pebble.castShadow = true;
    pot.add(pebble);
  }
  scene.add(pot);

  /* 向日葵（骨架模式） */
  var PLANT = {
    rig: true,
    seed: state.seed,
    stemHeight: 30,
    headTilt: 68,
    headAzimuth: 90,
    florets: 900,
    hairs: 60
  };
  var model = Model.buildSunflower(THREE, PLANT);
  scene.add(model.group);
  model.parts.forEach(function (p) {
    p.mesh.castShadow = true;
    p.mesh.receiveShadow = true;
  });

  var neckBase = model.rig.pivot.position.clone();

  /* 花盘上的脸 */
  var faceCanvas = Face.createCanvas();
  var faceCtx = faceCanvas.getContext('2d');
  var faceTex = new THREE.CanvasTexture(faceCanvas);
  if ('encoding' in faceTex) faceTex.encoding = THREE.sRGBEncoding;
  var faceMat = new THREE.MeshBasicMaterial({
    map: faceTex, transparent: true, depthWrite: false,
    side: THREE.DoubleSide, toneMapped: false
  });
  var faceMesh = new THREE.Mesh(new THREE.PlaneGeometry(11.2, 11.2), faceMat);
  faceMesh.rotation.x = -Math.PI / 2;
  faceMesh.position.set(0, 1.12, 0);
  faceMesh.renderOrder = 6;
  model.rig.head.add(faceMesh);

  /* 水滴粒子 */
  var dropMat = new THREE.MeshStandardMaterial({
    color: lin(0x9fd8ff), roughness: 0.15, metalness: 0, transparent: true, opacity: 0.85
  });
  var dropGeo = new THREE.SphereGeometry(0.34, 8, 6);
  var drops = [];
  for (var di = 0; di < 16; di++) {
    var dm = new THREE.Mesh(dropGeo, dropMat);
    dm.visible = false;
    scene.add(dm);
    drops.push({ mesh: dm, vy: 0, life: 0 });
  }
  function spawnDrops() {
    drops.forEach(function (d) {
      d.mesh.visible = true;
      d.mesh.position.set(
        (Math.random() - 0.5) * 13,
        9 + Math.random() * 8,
        (Math.random() - 0.5) * 11
      );
      d.vy = -20 - Math.random() * 12;
      d.life = 1.4;
    });
  }
  function updateDrops(dt) {
    drops.forEach(function (d) {
      if (!d.mesh.visible) return;
      d.life -= dt;
      d.mesh.position.y += d.vy * dt;
      if (d.mesh.position.y < 0.25 || d.life <= 0) d.mesh.visible = false;
    });
  }

  /* ------------------------------------------------------------ 相机控制 */
  var bbox = new THREE.Box3().setFromObject(model.group);
  bbox.expandByObject(pot);
  var size = new THREE.Vector3();
  bbox.getSize(size);
  var center = new THREE.Vector3();
  bbox.getCenter(center);

  var cam = {
    theta: 0, phi: 1.32,
    dist: Math.max(62, size.y * 1.58),
    distBase: Math.max(62, size.y * 1.58),
    target: new THREE.Vector3(0, center.y + size.y * 0.02, 0)
  };
  var camGoal = {
    theta: cam.theta, phi: cam.phi, dist: cam.dist,
    target: cam.target.clone()
  };

  function applyCamera() {
    var sp = Math.sin(cam.phi), cp = Math.cos(cam.phi);
    camera.position.set(
      cam.target.x + cam.dist * sp * Math.sin(cam.theta),
      cam.target.y + cam.dist * cp,
      cam.target.z + cam.dist * sp * Math.cos(cam.theta)
    );
    camera.lookAt(cam.target);
  }

  /* 气泡浮在花头上方，避免不同屏幕比例下挡住花瓣 */
  function positionBubble() {
    camera.updateMatrixWorld();
    var headBox = new THREE.Box3().setFromObject(model.rig.head);
    var p = new THREE.Vector3(0, headBox.max.y + 4.5, 0).project(camera);
    var y = (-p.y * 0.5 + 0.5) * window.innerHeight;
    $('bubble').style.top = Math.max(72, Math.round(y - 52)) + 'px';
  }

  var drag = null;
  var downAt = 0;
  var moved = 0;
  renderer.domElement.addEventListener('pointerdown', function (e) {
    drag = { x: e.clientX, y: e.clientY };
    moved = 0;
    downAt = Date.now();
    renderer.domElement.style.cursor = 'grabbing';
    renderer.domElement.setPointerCapture(e.pointerId);
  });
  renderer.domElement.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    camGoal.theta = clamp(camGoal.theta - dx * 0.005, -0.62, 0.62);
    camGoal.phi = clamp(camGoal.phi - dy * 0.0045, 1.05, 1.56);
  });
  function endDrag(e) {
    if (!drag) return;
    drag = null;
    renderer.domElement.style.cursor = 'grab';
    if (moved < 7 && Date.now() - downAt < 500) hitFlower(e);
  }
  renderer.domElement.addEventListener('pointerup', endDrag);
  renderer.domElement.addEventListener('pointercancel', endDrag);
  renderer.domElement.addEventListener('wheel', function (e) {
    e.preventDefault();
    camGoal.dist = clamp(camGoal.dist * Math.exp(e.deltaY * 0.001),
      cam.distBase * 0.72, cam.distBase * 1.35);
  }, { passive: false });
  renderer.domElement.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  var raycaster = new THREE.Raycaster();
  function hitFlower(e) {
    var rect = renderer.domElement.getBoundingClientRect();
    var ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(ndc, camera);
    var hits = raycaster.intersectObject(model.group, true);
    if (hits.length) actPet();
  }

  /* -------------------------------------------------------------- 状态机 */
  var temp = null;
  var currentName = 'calm';
  var targetName = 'calm';
  var targetPose = null;
  var pose = null;
  var flutter = 0;
  var time = 0;
  var bubbleTimer = null;
  var idleTimer = 14 + Math.random() * 12;
  var talkOpen = false;
  var forcedTime = null;
  var lastActionAt = { water: 0, sun: 0, pet: 0 };

  function emotionPose(name) {
    var e = EMOTIONS[name] || EMOTIONS.calm;
    var face = Object.assign({}, FACE_BASE, e.face);
    var body = Object.assign({}, BODY_BASE, e.body);
    body.tint = (e.body && e.body.tint) ? e.body.tint.slice() : [1, 1, 1];
    return { face: face, body: body };
  }

  function setTemp(name, ms) {
    temp = { name: name, until: Date.now() + (ms || 4000) };
    refreshPoseTarget();
  }

  function isNight() {
    if (forcedTime) return forcedTime === 'night';
    var h = new Date().getHours();
    return h >= 20 || h < 6;
  }

  function evaluateEmotion() {
    if (temp && Date.now() < temp.until) return temp.name;
    var s = state;
    if (s.energy < 30 || (isNight() && s.energy < 52)) return 'sleepy';
    if (s.water < 30 || s.bond < 18) return 'sad';
    if (s.water > 93 || s.light > 96) return 'angry';
    if (s.water > 60 && s.light > 55 && s.bond > 35 && s.energy > 45) return 'happy';
    return s.bond > 30 ? 'curious' : 'calm';
  }

  function refreshPoseTarget() {
    var next = evaluateEmotion();
    if (next !== targetName || !targetPose) {
      targetName = next;
      targetPose = emotionPose(next);
    }
  }

  pose = emotionPose('calm');
  targetPose = emotionPose(evaluateEmotion());
  targetName = evaluateEmotion();
  currentName = targetName;

  /* ---------------------------------------------------------------- 交互 */
  function say(text, ms) {
    var b = $('bubble');
    b.textContent = text;
    b.classList.add('show');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () { b.classList.remove('show'); }, ms || 4200);
  }

  function canAct(key) {
    var now = Date.now();
    if (now - lastActionAt[key] < 900) return false;
    lastActionAt[key] = now;
    return true;
  }

  function addGrowth(n) {
    var before = state.growth;
    state.growth = clamp(state.growth + n, 0, 100);
    [25, 50, 75, 100].forEach(function (m) {
      if (before < m && state.growth >= m) {
        toast(m === 100 ? '它完全盛开了 🌻' : '它长大了一点');
      }
    });
  }

  function toast(text) {
    var el = $('toast');
    el.textContent = text;
    el.classList.add('show');
    setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  function actWater() {
    if (!canAct('water')) return;
    if (state.water > 90) {
      state.water = clamp(state.water + 3, 0, 100);
      setTemp('angry', 4200);
      say('有点撑……下次少一点。');
      bump('water');
    } else {
      state.water = clamp(state.water + 24, 0, 100);
      state.energy = clamp(state.energy + 3, 0, 100);
      state.bond = clamp(state.bond + 2, 0, 100);
      addGrowth(2.5);
      setTemp('happy', 3500);
      spawnDrops();
      bump('water');
      say(state.water < 40 ? '咕嘟咕嘟，终于喝到水了。' : '咕嘟咕嘟，好舒服。');
    }
    save(); updateUI();
  }

  function actSun() {
    if (!canAct('sun')) return;
    state.light = clamp(state.light + 26, 0, 100);
    state.energy = clamp(state.energy + 7, 0, 100);
    state.bond = clamp(state.bond + 1, 0, 100);
    addGrowth(1.6);
    setTemp(isNight() ? 'sleepy' : 'happy', 4000);
    $('sunGlow').classList.add('on');
    setTimeout(function () { $('sunGlow').classList.remove('on'); }, 900);
    bump('light');
    say(isNight() ? '晚上的光有点晃眼……不过暖暖的。' : '光落在花瓣上，暖暖的。');
    save(); updateUI();
  }

  function actPet() {
    if (!canAct('pet')) return;
    state.bond = clamp(state.bond + 9, 0, 100);
    state.energy = clamp(state.energy + 2, 0, 100);
    addGrowth(1.2);
    flutter = 1;
    setTemp('shy', 4200);
    bump('bond');
    say(choose(['唔……有点痒。', '再摸一下也可以。', '别、别一直看我……']));
    save(); updateUI();
  }

  function bump(kind) {
    var el = document.querySelector('.meters');
    if (!el) return;
    el.classList.remove('bump-water', 'bump-light', 'bump-bond');
    void el.offsetWidth;
    el.classList.add('bump-' + (kind === 'bond' ? 'bond' : kind));
  }

  /* ---------------------------------------------------------------- 说话 */
  function openTalk() {
    talkOpen = true;
    $('talkPanel').classList.add('open');
    setTimeout(function () { $('talkInput').focus(); }, 120);
  }
  function closeTalk() {
    talkOpen = false;
    $('talkPanel').classList.remove('open');
  }
  function sentiment(text) {
    var t = text || '';
    if (/(累|困|睡|熬夜|晚安)/.test(t)) return 'sleepy';
    if (/(难过|伤心|哭|烦|压力|焦虑|孤单|讨厌|生气|不好|失望)/.test(t)) return 'sad';
    if (/(开心|喜欢|爱你|漂亮|谢谢|棒|可爱|想你|陪你|好耶)/.test(t)) return 'happy';
    return 'curious';
  }
  function sendTalk(text) {
    var t = (text || '').trim();
    if (!t) return;
    closeTalk();
    state.bond = clamp(state.bond + 7, 0, 100);
    state.energy = clamp(state.energy + 1, 0, 100);
    addGrowth(1.2);
    var mood = sentiment(t);
    setTemp(mood, 6500);
    bump('bond');
    say('……', 1200);
    setTimeout(function () { say(choose(REPLY[mood] || REPLY.curious), 5200); }, 800);
    save(); updateUI();
  }

  /* -------------------------------------------------------------- 时间/UI */
  function applyTime() {
    document.body.classList.toggle('night', isNight());
    $('timeBtn').textContent = isNight() ? '🌙' : '☀️';
    $('timeBtn').title = isNight() ? '现在是夜晚，点一下切到白天' : '现在是白天，点一下切到夜晚';
  }

  function updateUI() {
    $('mWater').style.width = state.water + '%';
    $('mLight').style.width = state.light + '%';
    $('mBond').style.width = state.bond + '%';
    $('mEnergy').style.width = state.energy + '%';
    $('growthBar').style.width = state.growth + '%';
    $('growthText').textContent = '成长 ' + Math.round(state.growth) + '%';
    var e = EMOTIONS[currentName] || EMOTIONS.calm;
    $('moodIcon').textContent = e.icon;
    $('moodLabel').textContent = e.label;
  }

  /* ------------------------------------------------------------ 渲染循环 */
  var lastT = performance.now();
  var faceClock = 0;
  var blinkT = 3 + Math.random() * 4;
  var blinkPhase = 0;
  var tint = [1, 1, 1];
  var qA = new THREE.Quaternion();
  var qB = new THREE.Quaternion();
  var AXIS_Z = new THREE.Vector3(0, 0, 1);
  var AXIS_X = new THREE.Vector3(1, 0, 0);
  var DAY_KEY = new THREE.Color(0xfff2da);
  var NIGHT_KEY = new THREE.Color(0xaec4ff);

  function updatePose(dt) {
    refreshPoseTarget();
    currentName = targetName;
    var f = pose.face, tf = targetPose.face;
    Object.keys(tf).forEach(function (k) {
      f[k] = damp(f[k] === undefined ? tf[k] : f[k], tf[k], 7, dt);
    });
    var b = pose.body, tb = targetPose.body;
    ['pitch', 'roll', 'petal', 'twist', 'light', 'bob', 'lean'].forEach(function (k) {
      b[k] = damp(b[k], tb[k], 5.5, dt);
    });
    for (var i = 0; i < 3; i++) {
      b.tint[i] = damp(b.tint[i], tb.tint[i], 4, dt);
    }

    /* 呼吸/摇摆/抚摸后的颤瓣 */
    var breathe = Math.sin(time * 1.45) * 0.035;
    var nod = Math.sin(time * 0.85) * 0.014 * (b.bob || 0.5);
    model.rig.pivot.position.y = neckBase.y + Math.sin(time * 1.6) * 0.06 * (b.bob || 0.5);
    model.rig.pivot.rotation.x = b.pitch + nod;
    model.rig.pivot.rotation.z = b.roll + Math.sin(time * 0.66) * 0.012;
    model.rig.pivot.rotation.y = Math.sin(time * 0.43) * 0.02;

    model.group.rotation.z = Math.sin(time * 0.58) * 0.007;
    model.group.rotation.x = b.lean + Math.sin(time * 0.76) * 0.004;

    var flutterWave = flutter;
    model.rig.petals.forEach(function (pr, idx) {
      var layer = pr.layer === 0 ? 1 : 0.72;
      var phase = idx * 0.43;
      var wave = Math.sin(time * 1.3 + phase) * 0.014;
      var shake = flutterWave * Math.sin(time * 17 + phase * 2.0) * 0.07;
      var delta = b.petal * layer + breathe * layer + wave + shake;
      qA.setFromAxisAngle(AXIS_Z, delta);
      pr.pivot.quaternion.copy(pr.quat).multiply(qA);
      if (Math.abs(b.twist) > 0.001) {
        qB.setFromAxisAngle(AXIS_X, b.twist * layer + wave * 0.4);
        pr.pivot.quaternion.multiply(qB);
      }
    });
    flutter = Math.max(0, flutter - dt * 2.2);

    model.materials.petal.color.setRGB(b.tint[0], b.tint[1], b.tint[2]);

    var scaleGoal = 0.86 + state.growth / 100 * 0.16;
    var sc = damp(model.group.scale.x, scaleGoal, 1.5, dt);
    model.group.scale.setScalar(sc);

    /* 灯光随情绪与昼夜变化 */
    keyLight.intensity = damp(keyLight.intensity,
      (isNight() ? 0.78 : 1.62) * b.light, 4, dt);
    keyLight.color.lerp(isNight() ? NIGHT_KEY : DAY_KEY, 1 - Math.exp(-3 * dt));
    hemi.intensity = damp(hemi.intensity, isNight() ? 0.35 : 0.55, 3, dt);
    lamp.visible = isNight();

    /* 眨眼 */
    blinkT -= dt;
    if (blinkT <= 0) {
      blinkT = 2.6 + Math.random() * 4.2;
      blinkPhase = 0.14;
    }
    var blink = 1;
    if (blinkPhase > 0) {
      blinkPhase -= dt;
      blink = blinkPhase > 0.055 ? 0.03 : 1;
    }
    pose.face.blink = pose.face.eyeOpen > 0.25 ? blink : 1;

    /* 数值缓慢消耗 */
    state.water = clamp(state.water - dt * 0.010, 0, 100);
    state.light = clamp(state.light - dt * 0.007, 0, 100);
    state.energy = clamp(state.energy - dt * 0.005, 0, 100);
    state.bond = clamp(state.bond - dt * 0.0012, 0, 100);
  }

  function tick(now) {
    requestAnimationFrame(tick);
    var dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    time += dt;

    updatePose(dt);
    updateDrops(dt);

    /* 视角阻尼 */
    cam.theta = damp(cam.theta, camGoal.theta, 7, dt);
    cam.phi = damp(cam.phi, camGoal.phi, 7, dt);
    cam.dist = damp(cam.dist, camGoal.dist, 7, dt);
    cam.target.lerp(camGoal.target, 1 - Math.exp(-6 * dt));
    applyCamera();

    /* 表情画布 12fps 更新 */
    faceClock += dt;
    if (faceClock > 0.08) {
      faceClock = 0;
      Face.draw(faceCtx, pose.face, time);
      faceTex.needsUpdate = true;
    }

    /* 闲置台词 */
    idleTimer -= dt;
    if (idleTimer <= 0) {
      idleTimer = 22 + Math.random() * 16;
      if (!talkOpen && !$('bubble').classList.contains('show')) {
        say(choose(IDLE_LINES[currentName] || IDLE_LINES.calm), 3600);
      }
    }

    /* UI 数值每 0.5s 刷新一次 */
    uiClock += dt;
    if (uiClock > 0.5) {
      uiClock = 0;
      updateUI();
      positionBubble();
    }
    saveClock += dt;
    if (saveClock > 5) {
      saveClock = 0;
      save();
    }

    renderer.render(scene, camera);
  }
  var uiClock = 0;
  var saveClock = 0;

  function resize() {
    var w = Math.max(1, stage.clientWidth);
    var h = Math.max(1, stage.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  /* -------------------------------------------------------------- 事件绑定 */
  document.querySelectorAll('[data-act]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var act = btn.dataset.act;
      if (act === 'water') actWater();
      else if (act === 'sun') actSun();
      else if (act === 'pet') actPet();
      else if (act === 'talk') openTalk();
    });
  });
  $('talkClose').addEventListener('click', closeTalk);
  $('talkSend').addEventListener('click', function () {
    sendTalk($('talkInput').value);
    $('talkInput').value = '';
  });
  $('talkInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      sendTalk($('talkInput').value);
      $('talkInput').value = '';
    }
  });
  document.querySelectorAll('[data-text]').forEach(function (chip) {
    chip.addEventListener('click', function () { sendTalk(chip.dataset.text); });
  });
  $('timeBtn').addEventListener('click', function () {
    forcedTime = isNight() ? 'day' : 'night';
    applyTime();
    refreshPoseTarget();
  });
  $('helpBtn').addEventListener('click', function () { $('intro').classList.remove('hidden'); });
  $('startBtn').addEventListener('click', function () {
    $('intro').classList.add('hidden');
    state.introSeen = true;
    save();
    say('今天也请多关照。', 3600);
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) save();
  });
  window.addEventListener('beforeunload', save);

  /* 首次进入 / 隔天回来 */
  var skipIntro = /[?&]skipIntro=1/.test(location.search);
  if (state.introSeen || skipIntro) $('intro').classList.add('hidden');
  if (offlineHours >= 6) {
    setTimeout(function () { say('你回来啦……我等了好久。', 5000); }, 1200);
  }

  /* 调试接口：?debug=1 显示情绪按钮 */
  if (/[?&]debug=1/.test(location.search)) {
    $('debug').classList.remove('hidden');
    document.querySelectorAll('[data-emotion]').forEach(function (b) {
      b.addEventListener('click', function () {
        setTemp(b.dataset.emotion, 3600000);
      });
    });
  }
  window.__game = {
    state: state,
    scene: scene,
    camera: camera,
    renderer: renderer,
    model: model,
    faceCanvas: faceCanvas,
    getPose: function () { return pose; },
    getTargetPose: function () { return targetPose; },
    setEmotion: function (name) { setTemp(name, 3600000); },
    clearEmotion: function () { temp = null; refreshPoseTarget(); },
    setTime: function (mode) { forcedTime = mode; applyTime(); refreshPoseTarget(); },
    actions: { water: actWater, sun: actSun, pet: actPet, talk: sendTalk },
    say: say,
    save: save,
    reset: function () {
      try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
      location.reload();
    }
  };

  /* ------------------------------------------------------------ 素材模式 */
  var Q = new URLSearchParams(location.search);
  var ART = Q.get('art') === '1';

  function setCamPreset(name) {
    var headY = PLANT.stemHeight;
    var headDirY = Math.cos(PLANT.headTilt * Math.PI / 180);
    if (name === 'face') {
      camGoal.target.set(0, headY, 0);
      camGoal.theta = 0;
      camGoal.phi = Math.acos(headDirY);
      camGoal.dist = 27;
    } else if (name === 'square') {
      camGoal.target.set(0, headY, 0);
      camGoal.theta = 0.10;
      camGoal.phi = Math.acos(headDirY);
      camGoal.dist = 34;
    } else if (name === 'wide') {
      camGoal.target.set(0, 17, 0);
      camGoal.theta = 0.16;
      camGoal.phi = 1.28;
      camGoal.dist = 76;
    } else if (name === 'vertical') {
      camGoal.target.set(0, 16, 0);
      camGoal.theta = 0.08;
      camGoal.phi = 1.30;
      camGoal.dist = 76;
    } else if (name === 'hero') {
      camGoal.target.set(0, 16, 0);
      camGoal.theta = 0.22;
      camGoal.phi = 1.29;
      camGoal.dist = 74;
    } else if (name === 'promo') {
      camGoal.target.set(0, 27, 0);
      camGoal.theta = 0.20;
      camGoal.phi = 1.24;
      camGoal.dist = 56;
    }
    cam.target.copy(camGoal.target);
    cam.theta = camGoal.theta;
    cam.phi = camGoal.phi;
    cam.dist = camGoal.dist;
    applyCamera();
  }

  function setupArtMode() {
    if (ART) {
      ['hud', 'bubble', 'bottom', 'talkPanel', 'intro', 'toast', 'debug', 'sunGlow']
        .forEach(function (id) {
          var el = $(id);
          if (el) el.style.display = 'none';
        });
      document.body.classList.add('art');
    }
    if (Q.get('bg') === 'transparent') {
      document.documentElement.style.background = 'transparent';
      document.body.style.background = 'transparent';
      var vg = $('vignette');
      if (vg) vg.style.display = 'none';
      table.visible = false;
      renderer.setClearColor(0x000000, 0);
    }
    if (Q.get('time')) {
      forcedTime = Q.get('time');
      applyTime();
    }
    if (Q.get('cam')) setCamPreset(Q.get('cam'));
    if (Q.get('emotion') && EMOTIONS[Q.get('emotion')]) {
      setTemp(Q.get('emotion'), 3600000);
    }
  }

  applyTime();
  updateUI();
  resize();
  applyCamera();
  setupArtMode();
  positionBubble();
  requestAnimationFrame(tick);
})();
