/* ============================================================================
 * 微信小程序专用三维查看器
 * 与 model/viewer.js 共用同一套造型、光照与相机逻辑，但不依赖 DOM：
 *   · 渲染循环使用 canvas.requestAnimationFrame
 *   · 触摸事件由页面通过 touchStart / touchMove / touchEnd 传入
 *   · 兼容 threejs-miniprogram 内置的 three r108
 * ==========================================================================*/
const { buildSunflower } = require('./sunflower.js');

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

function createMiniViewer(THREE, canvas, width, height, options) {
  const opts = options || {};
  const params = Object.assign({}, opts.params || {});

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(opts.pixelRatio || 1);
  renderer.setSize(width, height);
  if ('outputEncoding' in renderer) {
    renderer.outputEncoding = THREE.sRGBEncoding;
  } else {
    /* three r108 的旧颜色输出接口 */
    renderer.gammaOutput = true;
    renderer.gammaFactor = 2.2;
  }
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setClearColor(opts.background === undefined ? 0x171a15 : opts.background, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, width / Math.max(1, height), 0.4, 6000);

  const hemi = new THREE.HemisphereLight(0xdcecff, 0x6f7c48, 0.62);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff4e0, 1.55);
  key.castShadow = true;
  key.shadow.mapSize.width = 1024;
  key.shadow.mapSize.height = 1024;
  key.shadow.bias = -0.0009;
  scene.add(key);
  scene.add(key.target);
  const fill = new THREE.DirectionalLight(0xd6e6ff, 0.5);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffe3a8, 0.5);
  scene.add(rim);
  const bounce = new THREE.DirectionalLight(0x9fb066, 0.42);
  scene.add(bounce);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(600, 48),
    new THREE.ShadowMaterial({ opacity: 0.26 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  let model = null;
  const bbox = new THREE.Box3();
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  const target = new THREE.Vector3();
  const targetGoal = new THREE.Vector3();
  const sph = { r: 110, theta: 0.42, phi: 1.16 };
  const sphGoal = { r: 110, theta: 0.42, phi: 1.16 };
  let HOME = null;
  let snapped = false;

  function applyCamera() {
    const st = Math.sin(sph.phi);
    const ct = Math.cos(sph.phi);
    camera.position.set(
      target.x + sph.r * st * Math.sin(sph.theta),
      target.y + sph.r * ct,
      target.z + sph.r * st * Math.cos(sph.theta)
    );
    camera.lookAt(target);
  }

  function loadModel() {
    if (model) {
      scene.remove(model.group);
      model.parts.forEach(function (p) {
        p.geometry.dispose();
        if (p.mesh.material) p.mesh.material.dispose();
      });
    }
    model = buildSunflower(THREE, params);
    model.parts.forEach(function (p) {
      p.mesh.castShadow = true;
      p.mesh.receiveShadow = true;
    });
    scene.add(model.group);
  }

  function frame(view) {
    bbox.setFromObject(model.group);
    bbox.getSize(size);
    bbox.getCenter(center);
    const head = new THREE.Vector3(0, params.stemHeight === undefined ? 47 : params.stemHeight, 0);
    const tilt = (params.headTilt === undefined ? 24 : params.headTilt) * Math.PI / 180;
    const az = (params.headAzimuth === undefined ? 0 : params.headAzimuth) * Math.PI / 180;
    const hd = new THREE.Vector3(
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
      const refZ = new THREE.Vector3(0, 0, 1);
      const zA = refZ.clone().addScaledVector(hd, -refZ.dot(hd)).normalize();
      const xA = new THREE.Vector3().crossVectors(hd, zA).normalize();
      const d = new THREE.Vector3()
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

    ground.position.y = bbox.min.y - 0.05;
    key.target.position.copy(center);
    key.position.copy(center).add(new THREE.Vector3(size.y * 1.1, size.y * 1.7, size.y * 1.3));
    fill.position.copy(center).add(new THREE.Vector3(-size.y * 1.25, size.y * 0.45, -size.y * 0.45));
    rim.position.copy(center).add(new THREE.Vector3(-size.y * 0.4, size.y * 0.2, -size.y * 1.6));
    bounce.position.copy(center).add(new THREE.Vector3(size.y * 0.35, -size.y * 1.1, -size.y * 0.55));

    const s = Math.max(size.x, size.y, size.z) * 1.25;
    const cam = key.shadow.camera;
    cam.left = -s; cam.right = s; cam.top = s; cam.bottom = -s;
    cam.near = 1; cam.far = s * 8;
    cam.updateProjectionMatrix();
  }

  /* ------------------------------------------------------------ 触摸交互 */
  let autoRotate = opts.autoRotate !== false;
  let drag = null;
  let pinch = null;
  let lastTouch = 0;

  function pointOf(t) {
    return {
      x: t.clientX !== undefined ? t.clientX : t.x,
      y: t.clientY !== undefined ? t.clientY : t.y
    };
  }
  function distance(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function touchStart(touches) {
    lastTouch = Date.now();
    if (!touches || !touches.length) return;
    if (touches.length >= 2) {
      drag = null;
      const a = pointOf(touches[0]), b = pointOf(touches[1]);
      pinch = { d: distance(a, b), r: sphGoal.r };
    } else {
      pinch = null;
      const p = pointOf(touches[0]);
      drag = { x: p.x, y: p.y };
    }
  }
  function touchMove(touches) {
    lastTouch = Date.now();
    if (!touches || !touches.length) return;
    if (touches.length >= 2 && pinch) {
      const a = pointOf(touches[0]), b = pointOf(touches[1]);
      const d = distance(a, b);
      sphGoal.r = clamp(pinch.r * pinch.d / Math.max(1, d), size.y * 0.30, size.y * 4.5);
      return;
    }
    if (drag && touches.length === 1) {
      const p = pointOf(touches[0]);
      sphGoal.theta -= (p.x - drag.x) * 0.0062;
      sphGoal.phi = clamp(sphGoal.phi - (p.y - drag.y) * 0.0055, 0.12, Math.PI - 0.12);
      drag.x = p.x;
      drag.y = p.y;
    }
  }
  function touchEnd() {
    drag = null;
    pinch = null;
    lastTouch = Date.now();
  }

  /* ------------------------------------------------------------ 渲染循环 */
  let running = true;
  let rafId = null;
  function requestFrame(fn) {
    if (canvas.requestAnimationFrame) return canvas.requestAnimationFrame(fn);
    return setTimeout(fn, 16);
  }
  function cancelFrame(id) {
    if (canvas.cancelAnimationFrame) canvas.cancelAnimationFrame(id);
    else clearTimeout(id);
  }
  function tick() {
    if (!running) return;
    rafId = requestFrame(tick);
    if (autoRotate && !drag && !pinch && Date.now() - lastTouch > 2200) {
      sphGoal.theta += 0.0032;
    }
    const k = 0.16;
    sph.theta += (sphGoal.theta - sph.theta) * k;
    sph.phi += (sphGoal.phi - sph.phi) * k;
    sph.r += (sphGoal.r - sph.r) * k;
    target.lerp(targetGoal, k);
    applyCamera();
    renderer.render(scene, camera);
  }

  loadModel();
  frame('full');
  applyCamera();
  requestFrame(function () { tick(); });

  return {
    renderer: renderer,
    scene: scene,
    camera: camera,
    getModel: function () { return model; },
    frame: frame,
    touchStart: touchStart,
    touchMove: touchMove,
    touchEnd: touchEnd,
    setAutoRotate: function (v) { autoRotate = !!v; if (v) lastTouch = 0; },
    isAutoRotate: function () { return autoRotate; },
    setParams: function (p) {
      Object.assign(params, p || {});
      loadModel();
      frame(HOME || 'full');
    },
    resize: function (w, h) {
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      width = w;
      height = h;
    },
    pause: function () {
      running = false;
      if (rafId !== null) cancelFrame(rafId);
      rafId = null;
    },
    resume: function () {
      if (running) return;
      running = true;
      requestFrame(function () { tick(); });
    }
  };
}

module.exports = { createMiniViewer: createMiniViewer };
