'use strict';

/* ============================================================================
 * viewer-scene.js — 向日葵三维模型查看器（小游戏版）
 * 复用 weapp/lib/mini-viewer.js 的取景与交互思路，改为由宿主循环驱动。
 * ==========================================================================*/

var SunflowerModel = require('./lib/sunflower.js');

function createViewerScene(host, platform, seed) {
  var THREE = host.THREE;
  var scene = host.scene;
  var camera = host.camera;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  var root = new THREE.Group();

  var hemi = new THREE.HemisphereLight(0xdcecff, 0x6f7c48, 0.62);
  root.add(hemi);
  var key = new THREE.DirectionalLight(0xfff4e0, 1.55);
  key.castShadow = true;
  key.shadow.mapSize.width = 1024;
  key.shadow.mapSize.height = 1024;
  key.shadow.bias = -0.0009;
  root.add(key);
  root.add(key.target);
  var fill = new THREE.DirectionalLight(0xd6e6ff, 0.5);
  root.add(fill);
  var rim = new THREE.DirectionalLight(0xffe3a8, 0.5);
  root.add(rim);
  var bounce = new THREE.DirectionalLight(0x9fb066, 0.42);
  root.add(bounce);

  var ground = new THREE.Mesh(
    new THREE.CircleGeometry(600, 48),
    new THREE.ShadowMaterial({ opacity: 0.26 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  var params = {
    seed: seed,
    stemHeight: 56,
    headTilt: 24,
    headAzimuth: 0,
    diskRadius: 7.2,
    florets: 700,
    hairs: 220
  };

  var model = null;
  var bbox = new THREE.Box3();
  var size = new THREE.Vector3();
  var center = new THREE.Vector3();
  var target = new THREE.Vector3();
  var targetGoal = new THREE.Vector3();
  var sph = { r: 110, theta: 0.42, phi: 1.16 };
  var sphGoal = { r: 110, theta: 0.42, phi: 1.16 };
  var HOME = 'full';
  var snapped = false;
  var autoRotate = true;
  var lastTouch = 0;
  var drag = null;
  var pinch = null;

  function applyCamera() {
    var st = Math.sin(sph.phi);
    var ct = Math.cos(sph.phi);
    camera.position.set(
      target.x + sph.r * st * Math.sin(sph.theta),
      target.y + sph.r * ct,
      target.z + sph.r * st * Math.cos(sph.theta)
    );
    camera.lookAt(target);
  }

  function disposeModel() {
    if (!model) return;
    root.remove(model.group);
    model.parts.forEach(function (p) {
      if (p.geometry && p.geometry.dispose) p.geometry.dispose();
      if (p.mesh && p.mesh.material && p.mesh.material.dispose) p.mesh.material.dispose();
    });
    model = null;
  }

  function loadModel() {
    disposeModel();
    model = SunflowerModel.buildSunflower(THREE, params);
    model.parts.forEach(function (p) {
      p.mesh.castShadow = true;
      p.mesh.receiveShadow = true;
    });
    root.add(model.group);
  }

  function setHeadLight(view) {
    bbox.setFromObject(model.group);
    bbox.getSize(size);
    bbox.getCenter(center);

    key.target.position.copy(center);
    key.position.copy(center).add(new THREE.Vector3(size.y * 1.1, size.y * 1.7, size.y * 1.3));
    fill.position.copy(center).add(new THREE.Vector3(-size.y * 1.25, size.y * 0.45, -size.y * 0.45));
    rim.position.copy(center).add(new THREE.Vector3(-size.y * 0.4, size.y * 0.2, -size.y * 1.6));
    bounce.position.copy(center).add(new THREE.Vector3(size.y * 0.35, -size.y * 1.1, -size.y * 0.55));

    var s = Math.max(size.x, size.y, size.z) * 1.25;
    var cam = key.shadow.camera;
    cam.left = -s; cam.right = s; cam.top = s; cam.bottom = -s;
    cam.near = 1; cam.far = s * 8;
    cam.updateProjectionMatrix();

    ground.position.y = bbox.min.y - 0.05;
  }

  function frame(view) {
    setHeadLight(view);
    var head = new THREE.Vector3(0, params.stemHeight, 0);
    var tilt = params.headTilt * Math.PI / 180;
    var az = params.headAzimuth * Math.PI / 180;
    var hd = new THREE.Vector3(
      Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az)
    ).normalize();

    if (view === 'head') {
      targetGoal.copy(head).add(new THREE.Vector3(0, size.y * 0.02, 0));
      sphGoal.r = Math.max(size.x, size.z) * 2.1;
      sphGoal.theta = 0.35;
      sphGoal.phi = 1.05;
    } else if (view === 'side') {
      targetGoal.copy(center);
      sphGoal.r = size.y * 1.55;
      sphGoal.theta = Math.PI * 0.5 + 0.35;
      sphGoal.phi = 1.32;
    } else if (view === 'back') {
      var refZ = new THREE.Vector3(0, 0, 1);
      var zA = refZ.clone().addScaledVector(hd, -refZ.dot(hd)).normalize();
      var xA = new THREE.Vector3().crossVectors(hd, zA).normalize();
      var d = new THREE.Vector3()
        .addScaledVector(hd, -0.70)
        .addScaledVector(xA, -0.70).normalize();
      targetGoal.copy(head).addScaledVector(hd, -size.x * 0.06);
      sphGoal.r = Math.max(size.x, size.z) * 1.5;
      sphGoal.phi = Math.acos(clamp(d.y, -1, 1));
      sphGoal.theta = Math.atan2(d.x, d.z);
    } else {
      view = 'full';
      targetGoal.copy(center).add(new THREE.Vector3(0, size.y * 0.16, 0));
      sphGoal.r = size.y * 1.08;
      sphGoal.theta = 0.42;
      sphGoal.phi = 1.16;
    }
    HOME = view;
    if (!snapped) {
      target.copy(targetGoal);
      sph.r = sphGoal.r;
      sph.theta = sphGoal.theta;
      sph.phi = sphGoal.phi;
      snapped = true;
    }
    applyCamera();
  }

  function distance(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function touchStart(points) {
    lastTouch = Date.now();
    if (!points || !points.length) return;
    if (points.length >= 2) {
      drag = null;
      pinch = { d: distance(points[0], points[1]), r: sphGoal.r };
    } else {
      pinch = null;
      drag = { x: points[0].x, y: points[0].y };
    }
  }

  function touchMove(points) {
    lastTouch = Date.now();
    if (!points || !points.length) return;
    if (points.length >= 2 && pinch) {
      var d = distance(points[0], points[1]);
      sphGoal.r = clamp(pinch.r * pinch.d / Math.max(1, d), size.y * 0.30, size.y * 4.5);
      return;
    }
    if (drag && points.length === 1) {
      sphGoal.theta -= (points[0].x - drag.x) * 0.0062;
      sphGoal.phi = clamp(sphGoal.phi - (points[0].y - drag.y) * 0.0055, 0.12, Math.PI - 0.12);
      drag.x = points[0].x;
      drag.y = points[0].y;
    }
  }

  function touchEnd() {
    drag = null;
    pinch = null;
    lastTouch = Date.now();
  }

  function update(dt) {
    var idle = Date.now() - lastTouch > 2200;
    if (autoRotate && !drag && !pinch && idle) sphGoal.theta += 0.0032;
    var k = 1 - Math.exp(-9 * (dt || 0.016));
    sph.theta += (sphGoal.theta - sph.theta) * k;
    sph.phi += (sphGoal.phi - sph.phi) * k;
    sph.r += (sphGoal.r - sph.r) * k;
    target.lerp(targetGoal, k);
    applyCamera();
  }

  function rebuild(nextSeed) {
    params.seed = nextSeed;
    loadModel();
    snapped = false;
    frame(HOME || 'full');
  }

  /* 初始化：先加入场景再取景 */
  var mounted = false;
  function mount() {
    if (mounted) return;
    scene.add(root);
    mounted = true;
    camera.aspect = platform.W / platform.H;
    camera.updateProjectionMatrix();
    if (!model) {
      loadModel();
      frame('full');
    } else {
      applyCamera();
    }
  }
  function unmount() {
    if (!mounted) return;
    scene.remove(root);
    mounted = false;
  }

  loadModel();
  frame('full');

  return {
    mount: mount,
    unmount: unmount,
    update: update,
    frame: frame,
    rebuild: rebuild,
    touchStart: touchStart,
    touchMove: touchMove,
    touchEnd: touchEnd,
    setAutoRotate: function (v) { autoRotate = !!v; if (v) lastTouch = 0; },
    isAutoRotate: function () { return autoRotate; },
    getStats: function () { return model ? model.stats : null; },
    getModel: function () { return model; }
  };
}

module.exports = { createViewerScene: createViewerScene };
