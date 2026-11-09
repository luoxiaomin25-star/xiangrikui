/* ============================================================================
 * viewer.js — 向日葵三维查看器（three.js + 自写轨道控制）
 * 需要先加载 three 与 sunflower.js，然后：
 *   var viewer = SunflowerViewer.create(THREE, container, { ui: true });
 * ==========================================================================*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SunflowerViewer = factory();
})(typeof globalThis !== 'undefined' ? globalThis
  : (typeof self !== 'undefined' ? self : this), function () {
  'use strict';
  var root = typeof self !== 'undefined' ? self : globalThis;

  function create(THREE, container, options) {
    var opts = options || {};
    var params = Object.assign({}, opts.params || {});

    var renderer = new THREE.WebGLRenderer({
      antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
    if ('outputEncoding' in renderer) renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    var canvas = renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';
    canvas.style.cursor = 'grab';
    container.appendChild(canvas);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(40, 1, 0.4, 8000);

    var hemi = new THREE.HemisphereLight(0xdcecff, 0x6f7c48, 0.6);
    scene.add(hemi);
    var key = new THREE.DirectionalLight(0xfff4e0, 1.55);
    key.castShadow = true;
    key.shadow.mapSize.width = 2048;
    key.shadow.mapSize.height = 2048;
    key.shadow.bias = -0.0009;
    key.shadow.normalBias = 0.35;
    scene.add(key, key.target);
    var fill = new THREE.DirectionalLight(0xd6e6ff, 0.5);
    scene.add(fill);
    var rim = new THREE.DirectionalLight(0xffe3a8, 0.5);
    scene.add(rim);
    /* 地面反弹光：让朝下的花托背面、叶片背面不至于死黑 */
    var bounce = new THREE.DirectionalLight(0x9fb066, 0.42);
    scene.add(bounce);

    var ground = new THREE.Mesh(
      new THREE.CircleGeometry(600, 64),
      new THREE.ShadowMaterial({ opacity: 0.26 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    var model = null;
    var groups = { head: [], foliage: [] };
    var bbox = new THREE.Box3();
    var center = new THREE.Vector3(0, 40, 0);
    var size = new THREE.Vector3(30, 70, 30);

    /* ---------------------------------------------------------- 轨道控制 */
    var target = new THREE.Vector3();
    var targetGoal = new THREE.Vector3();
    var sph = { r: 110, theta: 0.42, phi: 1.16 };
    var sphGoal = { r: 110, theta: 0.42, phi: 1.16 };
    var HOME = null;

    function applyCamera() {
      var st = Math.sin(sph.phi), ct = Math.cos(sph.phi);
      camera.position.set(
        target.x + sph.r * st * Math.sin(sph.theta),
        target.y + sph.r * ct,
        target.z + sph.r * st * Math.cos(sph.theta)
      );
      camera.lookAt(target);
    }

    function frame(view) {
      bbox.setFromObject(model.group);
      bbox.getSize(size);
      bbox.getCenter(center);
      var head = new THREE.Vector3(0, params.stemHeight || 56, 0);
      var rad = Math.max(size.x, size.z, size.y * 0.55) * 0.5;
      if (view === 'head') {
        targetGoal.copy(head).add(new THREE.Vector3(0, size.y * 0.02, 0));
        sphGoal.r = Math.max(size.x, size.z) * 2.1;
        sphGoal.theta = 0.35; sphGoal.phi = 1.05;
      } else if (view === 'side') {
        targetGoal.copy(center);
        sphGoal.r = size.y * 1.55;
        sphGoal.theta = Math.PI * 0.5 + 0.35; sphGoal.phi = 1.32;
      } else if (view === 'back') {
        /* 沿花头轴线后方 45° 观察花托 */
        var tiltR = ((params.headTilt === undefined ? 24 : params.headTilt)) * Math.PI / 180;
        var azR = ((params.headAzimuth === undefined ? 0 : params.headAzimuth)) * Math.PI / 180;
        var hd = new THREE.Vector3(Math.sin(tiltR) * Math.cos(azR), Math.cos(tiltR),
          Math.sin(tiltR) * Math.sin(azR)).normalize();
        var refZ = new THREE.Vector3(0, 0, 1);
        var zA = refZ.clone().addScaledVector(hd, -refZ.dot(hd)).normalize();
        var xA = new THREE.Vector3().crossVectors(hd, zA).normalize();
        var d = new THREE.Vector3().addScaledVector(hd, -0.70).addScaledVector(xA, -0.70).normalize();
        targetGoal.copy(head).addScaledVector(hd, -size.x * 0.06);
        sphGoal.r = Math.max(size.x, size.z) * 1.5;
        sphGoal.phi = Math.acos(Math.max(-1, Math.min(1, d.y)));
        sphGoal.theta = Math.atan2(d.x, d.z);
      } else {
        targetGoal.copy(center).add(new THREE.Vector3(0, size.y * 0.16, 0));
        sphGoal.r = size.y * 1.08;
        sphGoal.theta = 0.42; sphGoal.phi = 1.16;
      }
      if (sph.r === 110 && HOME === null) { target.copy(targetGoal); Object.assign(sph, sphGoal); }
      HOME = view || 'full';
      ground.position.y = bbox.min.y - 0.05;
      key.target.position.copy(center);
      key.position.copy(center).add(new THREE.Vector3(size.y * 1.1, size.y * 1.7, size.y * 1.3));
      /* 补光偏向后侧，避免花托背面在背光视角下糊成一团 */
      fill.position.copy(center).add(new THREE.Vector3(-size.y * 1.25, size.y * 0.45, -size.y * 0.45));
      rim.position.copy(center).add(new THREE.Vector3(-size.y * 0.4, size.y * 0.2, -size.y * 1.6));
      bounce.position.copy(center).add(new THREE.Vector3(size.y * 0.35, -size.y * 1.1, -size.y * 0.55));
      var s = Math.max(size.x, size.y, size.z) * 1.25;
      var cam = key.shadow.camera;
      cam.left = -s; cam.right = s; cam.top = s; cam.bottom = -s;
      cam.near = 1; cam.far = s * 8;
      cam.updateProjectionMatrix();
      canvas.dataset.view = HOME;
    }

    /* -------------------------------------------------------------- 构建 */
    function rebuild(newParams) {
      if (newParams) Object.assign(params, newParams);
      if (model) {
        scene.remove(model.group);
        model.parts.forEach(function (p) { p.geometry.dispose(); });
      }
      model = SunflowerModel.buildSunflower(THREE, params);
      var parts = { head: [], foliage: [] };
      model.parts.forEach(function (p) {
        p.mesh.castShadow = true;
        p.mesh.receiveShadow = true;
        var head = ['petal', 'floret', 'seed', 'receptacle', 'bract'].indexOf(p.name) >= 0;
        parts[head ? 'head' : 'foliage'].push(p.mesh);
      });
      groups = parts;
      scene.add(model.group);
      applyVisibility();
      return model;
    }

    var visibility = { foliage: true, head: true };
    var wireframe = false;
    function applyVisibility() {
      groups.foliage.forEach(function (m) { m.visible = visibility.foliage; });
      groups.head.forEach(function (m) { m.visible = visibility.head; });
    }

    var autoRotate = opts.autoRotate !== false;
    var damping = true;
    var running = true;

    /* ------------------------------------------------------------ 交互 */
    var drag = null;
    function pointerPos(e) {
      return { x: e.clientX, y: e.clientY };
    }
    canvas.addEventListener('pointerdown', function (e) {
      canvas.setPointerCapture(e.pointerId);
      drag = {
        id: e.pointerId, x: e.clientX, y: e.clientY,
        pan: e.button === 2 || e.shiftKey, moved: 0
      };
      canvas.style.cursor = 'grabbing';
      autoRotateWas = autoRotate;
      if (!opts.keepRotateOnDrag) autoRotate = false;
    });
    var autoRotateWas = autoRotate;
    canvas.addEventListener('pointermove', function (e) {
      if (!drag || drag.id !== e.pointerId) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.pan) {
        var scale = sph.r * 0.0016;
        var right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
        var up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
        targetGoal.addScaledVector(right, -dx * scale).addScaledVector(up, dy * scale);
        target.addScaledVector(right, -dx * scale).addScaledVector(up, dy * scale);
      } else {
        sphGoal.theta -= dx * 0.0062;
        sphGoal.phi = Math.max(0.12, Math.min(Math.PI - 0.12, sphGoal.phi - dy * 0.0055));
      }
    });
    function endDrag(e) {
      if (!drag) return;
      if (drag.moved < 6) autoRotate = autoRotateWas;
      drag = null;
      canvas.style.cursor = 'grab';
    }
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      sphGoal.r = Math.max(size.y * 0.30, Math.min(size.y * 4.5, sphGoal.r * Math.exp(e.deltaY * 0.0011)));
    }, { passive: false });

    var pinch = null;
    canvas.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY);
        pinch = { d: d, r: sphGoal.r };
      }
    }, { passive: true });
    canvas.addEventListener('touchmove', function (e) {
      if (pinch && e.touches.length === 2) {
        var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY);
        sphGoal.r = Math.max(size.y * 0.30, Math.min(size.y * 4.5, pinch.r * pinch.d / Math.max(1, d)));
      }
    }, { passive: true });
    canvas.addEventListener('touchend', function () { pinch = null; }, { passive: true });

    /* ------------------------------------------------------------ 渲染循环 */
    var needsResize = true;
    var ro = null;
    if (root.ResizeObserver) {
      ro = new ResizeObserver(function () { needsResize = true; });
      ro.observe(container);
    }
    window.addEventListener('resize', function () { needsResize = true; });

    function resize() {
      var w = Math.max(1, container.clientWidth);
      var h = Math.max(1, container.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      needsResize = false;
    }

    function tick() {
      if (!running) return;
      requestAnimationFrame(tick);
      if (needsResize) resize();
      if (autoRotate && !drag) sphGoal.theta += 0.0032;
      var k = damping ? 0.16 : 1;
      sph.theta += (sphGoal.theta - sph.theta) * k;
      sph.phi += (sphGoal.phi - sph.phi) * k;
      sph.r += (sphGoal.r - sph.r) * k;
      target.lerp(targetGoal, k);
      applyCamera();
      renderer.render(scene, camera);
    }

    rebuild();
    frame('full');
    resize();
    tick();

    /* -------------------------------------------------------------- 导出 */
    function exportSTL(scale) {
      scale = scale || 10;
      var tris = [];
      model.parts.forEach(function (p) {
        var pos = p.geometry.attributes.position.array;
        var idx = p.geometry.index.array;
        for (var i = 0; i < idx.length; i += 3) {
          var t = [];
          for (var e = 0; e < 3; e++) {
            var vi = idx[i + e] * 3;
            t.push(pos[vi] * scale, pos[vi + 1] * scale, pos[vi + 2] * scale);
          }
          tris.push(t);
        }
      });
      var buf = new ArrayBuffer(84 + tris.length * 50);
      var dv = new DataView(buf);
      var header = 'sunflower procedural model (mm)';
      for (var c = 0; c < header.length; c++) dv.setUint8(c, header.charCodeAt(c));
      dv.setUint32(80, tris.length, true);
      var off = 84;
      tris.forEach(function (t) {
        var ax = t[0], ay = t[1], az = t[2], bx = t[3], by = t[4], bz = t[5],
          cx = t[6], cy = t[7], cz = t[8];
        var ux = bx - ax, uy = by - ay, uz = bz - az;
        var vx = cx - ax, vy = cy - ay, vz = cz - az;
        var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        var len = Math.hypot(nx, ny, nz) || 1;
        dv.setFloat32(off, nx / len, true); dv.setFloat32(off + 4, ny / len, true);
        dv.setFloat32(off + 8, nz / len, true); off += 12;
        for (var e = 0; e < 9; e++) { dv.setFloat32(off, t[e], true); off += 4; }
        dv.setUint16(off, 0, true); off += 2;
      });
      return new Blob([buf], { type: 'model/stl' });
    }

    return {
      scene: scene, camera: camera, renderer: renderer, canvas: canvas,
      rebuild: rebuild, frame: frame, exportSTL: exportSTL,
      getModel: function () { return model; },
      /* 直接设定机位：theta 方位角、phi 与竖直方向夹角、r 距离（cm） */
      setCamera: function (theta, phi, r, targetPt) {
        sphGoal.theta = sph.theta = theta;
        sphGoal.phi = sph.phi = phi;
        sphGoal.r = sph.r = r;
        if (targetPt) {
          targetGoal.set(targetPt[0], targetPt[1], targetPt[2]);
          target.copy(targetGoal);
        }
        applyCamera();
        renderer.render(scene, camera);
      },
      setParams: function (p) { rebuild(p); frame(HOME || 'full'); },
      setVisibility: function (key, v) { visibility[key] = v; applyVisibility(); },
      setAutoRotate: function (v) { autoRotate = v; autoRotateWas = v; },
      getAutoRotate: function () { return autoRotate; },
      dispose: function () {
        running = false;
        if (ro) ro.disconnect();
        model.parts.forEach(function (p) { p.geometry.dispose(); });
        renderer.dispose();
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    };
  }

  return { create: create };
});
