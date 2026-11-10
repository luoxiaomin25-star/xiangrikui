'use strict';

/* ============================================================================
 * emotion-scene.js — 情绪向日葵的 3D 场景
 * 花盆、木桌、骨架向日葵、花盘表情、水滴粒子、昼夜灯光、轨道相机
 * ==========================================================================*/

var SunflowerModel = require('./lib/sunflower.js');
var makeCanvasTexture = require('./texture.js').makeCanvasTexture;

function createEmotionScene(host, platform, state, face) {
  var THREE = host.THREE;
  var scene = host.scene;
  var camera = host.camera;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function damp(cur, target, lambda, dt) {
    return cur + (target - cur) * (1 - Math.exp(-lambda * dt));
  }
  function lin(hex) {
    var c = new THREE.Color(hex);
    if (c.convertSRGBToLinear) return c.convertSRGBToLinear();
    function f(v) { return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    c.r = f(c.r); c.g = f(c.g); c.b = f(c.b);
    return c;
  }

  var root = new THREE.Group();

  /* ------------------------------------------------------------ 灯光 */
  var hemi = new THREE.HemisphereLight(0xdfeaff, 0x6f6a48, 0.55);
  root.add(hemi);
  var keyLight = new THREE.DirectionalLight(0xfff2da, 1.6);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  keyLight.shadow.bias = -0.0008;
  keyLight.position.set(55, 95, 75);
  root.add(keyLight);
  root.add(keyLight.target);
  var fill = new THREE.DirectionalLight(0xcfe0ff, 0.38);
  fill.position.set(-70, 40, 30);
  root.add(fill);
  var rim = new THREE.DirectionalLight(0xffe2b0, 0.55);
  rim.position.set(-30, 45, -70);
  root.add(rim);
  var bounce = new THREE.DirectionalLight(0x9fae6a, 0.32);
  bounce.position.set(30, -20, 20);
  root.add(bounce);
  var lamp = new THREE.PointLight(0xffc98a, 0.9, 140, 2);
  lamp.position.set(18, 26, 28);
  lamp.visible = false;
  root.add(lamp);

  /* ------------------------------------------------------------ 桌面 */
  var table = new THREE.Mesh(
    new THREE.CylinderGeometry(140, 140, 2.4, 64),
    new THREE.MeshStandardMaterial({ color: lin(0x6d4b33), roughness: 0.92, metalness: 0 })
  );
  table.position.y = -11.4;
  table.receiveShadow = true;
  root.add(table);

  /* ------------------------------------------------------------ 花盆 */
  var pot = new THREE.Group();
  pot.name = 'Pot';
  var potBody = new THREE.Mesh(
    new THREE.CylinderGeometry(10, 7.6, 10, 48, 1),
    new THREE.MeshStandardMaterial({ color: lin(0xb96545), roughness: 0.92, metalness: 0 })
  );
  potBody.position.y = -5;
  potBody.castShadow = true;
  potBody.receiveShadow = true;
  pot.add(potBody);

  var potRim = new THREE.Mesh(
    new THREE.TorusGeometry(10.05, 0.55, 12, 48),
    new THREE.MeshStandardMaterial({ color: lin(0xc97756), roughness: 0.85 })
  );
  potRim.rotation.x = -Math.PI / 2;
  potRim.position.y = 0.1;
  potRim.castShadow = true;
  potRim.receiveShadow = true;
  pot.add(potRim);

  var soil = new THREE.Mesh(
    new THREE.CylinderGeometry(9.4, 9.4, 0.9, 48),
    new THREE.MeshStandardMaterial({ color: lin(0x3a2a1c), roughness: 1, metalness: 0 })
  );
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
  root.add(pot);

  /* ------------------------------------------------------------ 向日葵 */
  var PLANT = {
    rig: true,
    seed: state.seed,
    stemHeight: 30,
    headTilt: 68,
    headAzimuth: 90,
    florets: 900,
    hairs: 60
  };
  var model = SunflowerModel.buildSunflower(THREE, PLANT);
  model.parts.forEach(function (p) {
    p.mesh.castShadow = true;
    p.mesh.receiveShadow = true;
  });
  root.add(model.group);

  var neckBase = model.rig.pivot.position.clone();

  /* ------------------------------------------------------- 花盘上的表情 */
  var faceTex = makeCanvasTexture(THREE, face.canvas);
  if (THREE.sRGBEncoding !== undefined) faceTex.texture.encoding = THREE.sRGBEncoding;
  var faceMat = new THREE.MeshBasicMaterial({
    map: faceTex.texture,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  if ('toneMapped' in faceMat) faceMat.toneMapped = false;
  var faceMesh = new THREE.Mesh(new THREE.PlaneGeometry(11.2, 11.2), faceMat);
  faceMesh.rotation.x = -Math.PI / 2;
  faceMesh.position.set(0, 1.12, 0);
  faceMesh.renderOrder = 6;
  model.rig.head.add(faceMesh);

  /* ---------------------------------------------------------- 水滴粒子 */
  var dropMat = new THREE.MeshStandardMaterial({
    color: lin(0x9fd8ff), roughness: 0.15, metalness: 0, transparent: true, opacity: 0.85
  });
  var dropGeo = new THREE.SphereGeometry(0.34, 8, 6);
  var drops = [];
  for (var di = 0; di < 16; di++) {
    var dm = new THREE.Mesh(dropGeo, dropMat);
    dm.visible = false;
    root.add(dm);
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

  /* ------------------------------------------------------------ 相机 */
  var bbox = new THREE.Box3().setFromObject(model.group);
  bbox.expandByObject(pot);
  var size = new THREE.Vector3();
  bbox.getSize(size);
  var center = new THREE.Vector3();
  bbox.getCenter(center);

  var cam = {
    theta: 0, phi: 1.32,
    dist: Math.max(70, size.y * 1.72),
    distBase: Math.max(70, size.y * 1.72),
    target: new THREE.Vector3(0, center.y + size.y * 0.12, 0)
  };
  var camGoal = {
    theta: cam.theta,
    phi: cam.phi,
    dist: cam.dist,
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

  var raycaster = new THREE.Raycaster();
  var ndc = new THREE.Vector2();

  function hitFlower(x, y) {
    ndc.set((x / platform.W) * 2 - 1, -(y / platform.H) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    var hits = raycaster.intersectObject(model.group, true);
    return hits.length > 0;
  }

  /* --------------------------------------------------------- 动画状态 */
  var time = 0;
  var faceClock = 0;
  var lastFaceSig = '';
  var blinkT = 3 + Math.random() * 4;
  var blinkPhase = 0;
  var flutter = 0;
  var qA = new THREE.Quaternion();
  var qB = new THREE.Quaternion();
  var AXIS_Z = new THREE.Vector3(0, 0, 1);
  var AXIS_X = new THREE.Vector3(1, 0, 0);
  var DAY_KEY = new THREE.Color(0xfff2da);
  var NIGHT_KEY = new THREE.Color(0xaec4ff);

  function update(dt, pose, targetPose, isNight, state) {
    time += dt;

    var f = pose.face, tf = targetPose.face;
    for (var k in tf) {
      if (Object.prototype.hasOwnProperty.call(tf, k)) {
        var cur = f[k] === undefined ? tf[k] : f[k];
        f[k] = damp(cur, tf[k], 7, dt);
      }
    }
    var b = pose.body, tb = targetPose.body;
    var keys = ['pitch', 'roll', 'petal', 'twist', 'light', 'bob', 'lean'];
    for (var i = 0; i < keys.length; i++) {
      var kk = keys[i];
      b[kk] = damp(b[kk], tb[kk], 5.5, dt);
    }
    for (var ci = 0; ci < 3; ci++) b.tint[ci] = damp(b.tint[ci], tb.tint[ci], 4, dt);

    /* 呼吸 / 摇摆 / 抚摸后颤瓣 */
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
      (isNight ? 0.78 : 1.62) * b.light, 4, dt);
    keyLight.color.lerp(isNight ? NIGHT_KEY : DAY_KEY, 1 - Math.exp(-3 * dt));
    hemi.intensity = damp(hemi.intensity, isNight ? 0.35 : 0.55, 3, dt);
    lamp.visible = isNight;

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

    /* 表情 10fps 检查；只在表情参数真正变化、眨眼或闪光时才上传纹理 */
    faceClock += dt;
    if (faceClock > 0.1 || !lastFaceSig) {
      faceClock = 0;
      var sigParts = [];
      var sigKeys = ['eyeOpen', 'eyeCurve', 'pupilX', 'pupilY', 'mouthOpen', 'smile',
        'blush', 'tears', 'anger', 'sleep', 'sparkle', 'brow', 'browTilt', 'browRaise', 'blink'];
      for (var si = 0; si < sigKeys.length; si++) {
        sigParts.push(Math.round((pose.face[sigKeys[si]] || 0) * 100));
      }
      var sig = sigParts.join(',');
      if (sig !== lastFaceSig || pose.face.sparkle > 0.05 || blinkPhase > 0) {
        lastFaceSig = sig;
        face.draw(pose.face, time);
        faceTex.update();
      }
    }

    updateDrops(dt);

    /* 相机阻尼 */
    cam.theta = damp(cam.theta, camGoal.theta, 7, dt);
    cam.phi = damp(cam.phi, camGoal.phi, 7, dt);
    cam.dist = damp(cam.dist, camGoal.dist, 7, dt);
    cam.target.lerp(camGoal.target, 1 - Math.exp(-6 * dt));
    applyCamera();
  }

  function orbit(dx, dy) {
    camGoal.theta = clamp(camGoal.theta - dx * 0.005, -0.62, 0.62);
    camGoal.phi = clamp(camGoal.phi - dy * 0.0045, 1.05, 1.56);
  }

  function pet() { flutter = 1; }

  applyCamera();

  var mounted = false;
  function mount() {
    if (mounted) return;
    scene.add(root);
    mounted = true;
    camera.aspect = platform.W / platform.H;
    camera.updateProjectionMatrix();
    applyCamera();
  }
  function unmount() {
    if (!mounted) return;
    scene.remove(root);
    mounted = false;
  }

  return {
    mount: mount,
    unmount: unmount,
    update: update,
    orbit: orbit,
    hitFlower: hitFlower,
    pet: pet,
    spawnDrops: spawnDrops,
    getStats: function () { return model.stats; },
    getSize: function () { return size; },
    getModel: function () { return model; }
  };
}

module.exports = { createEmotionScene: createEmotionScene };
