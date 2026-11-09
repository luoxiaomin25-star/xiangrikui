/* 独立页面的界面逻辑：参数面板、视角切换、导出 STL */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  var viewer = SunflowerViewer.create(THREE, $('stage'), { ui: false });
  /* 以模型自身的默认参数为准，避免面板与模型默认值脱节 */
  var DEFAULTS = viewer.getModel().params;
  var seed = DEFAULTS.seed;

  function petalWhorls(count) {
    var t = DEFAULTS.petalWhorls;
    var k = count / t[0].count;
    return [
      Object.assign({}, t[0], { count: count }),
      Object.assign({}, t[1], { count: Math.max(3, Math.round(t[1].count * k)) })
    ];
  }

  function currentOverrides() {
    var leafCount = parseInt($('i-leaves').value, 10);
    return {
      seed: seed,
      headTilt: parseFloat($('i-tilt').value),
      diskRadius: parseFloat($('i-disk').value),
      florets: parseInt($('i-florets').value, 10),
      stemHeight: parseFloat($('i-stem').value),
      petalWhorls: petalWhorls(parseInt($('i-petals').value, 10)),
      leaves: DEFAULTS.leaves.slice(0, leafCount)
    };
  }

  /* 用模型默认值初始化控件 */
  (function initControls() {
    $('i-tilt').value = DEFAULTS.headTilt;
    $('i-disk').value = DEFAULTS.diskRadius;
    $('i-stem').value = DEFAULTS.stemHeight;
    $('i-petals').value = DEFAULTS.petalWhorls[0].count;
    $('i-florets').value = DEFAULTS.florets;
    $('i-leaves').value = DEFAULTS.leaves.length;
    ['i-tilt', 'i-disk', 'i-florets', 'i-stem', 'i-petals', 'i-leaves'].forEach(function (id) {
      var el = $(id), out = $('o-' + id.slice(2));
      if (out) out.textContent = el.value + (el.dataset.unit || '');
    });
  })();

  function refresh(keepView) {
    viewer.setParams(currentOverrides());
    if (keepView) viewer.frame(keepView);
    var m = viewer.getModel();
    var s = m.stats.size;
    $('stats').innerHTML =
      m.stats.parts + ' 个部件 · ' + m.stats.triangles.toLocaleString() + ' 三角面<br>' +
      '尺寸 ' + (s.x * 10).toFixed(0) + ' × ' + (s.y * 10).toFixed(0) + ' × ' + (s.z * 10).toFixed(0) + ' mm';
  }

  var views = document.querySelectorAll('[data-view]');
  Array.prototype.forEach.call(views, function (b) {
    b.addEventListener('click', function () {
      Array.prototype.forEach.call(views, function (o) { o.classList.remove('active'); });
      b.classList.add('active');
      viewer.frame(b.dataset.view);
    });
  });

  $('auto').addEventListener('change', function () { viewer.setAutoRotate(this.checked); });
  $('show-foliage').addEventListener('change', function () { viewer.setVisibility('foliage', this.checked); });
  $('show-head').addEventListener('change', function () { viewer.setVisibility('head', this.checked); });

  ['i-tilt', 'i-disk', 'i-florets', 'i-stem', 'i-petals', 'i-leaves'].forEach(function (id) {
    var el = $(id);
    var out = $('o-' + id.slice(2));
    var unit = el.dataset.unit || '';
    el.addEventListener('input', function () {
      if (out) out.textContent = el.value + unit;
      refresh(viewer.canvas.dataset.view);
    });
  });

  $('seed').addEventListener('click', function () {
    seed = Math.floor(Math.random() * 1e9);
    refresh(viewer.canvas.dataset.view);
  });

  $('dl').addEventListener('click', function () {
    var blob = viewer.exportSTL(10);
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sunflower.stl';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  });

  window.__viewer = viewer;

  /* URL 参数：?view=head|side|full  ?clean=1 隐藏面板  ?rotate=0 关闭自动旋转 */
  var q = new URLSearchParams(location.search);
  if (q.get('clean') === '1') document.body.classList.add('clean');
  if (q.get('rotate') === '0') { viewer.setAutoRotate(false); $('auto').checked = false; }
  var v0 = q.get('view');
  if (v0) {
    Array.prototype.forEach.call(views, function (o) {
      o.classList.toggle('active', o.dataset.view === v0);
    });
  }
  refresh(v0 || 'full');

  if (q.get('debug') === '1') {
    setTimeout(function () {
      var m = viewer.getModel();
      var pre = document.createElement('pre');
      pre.id = 'dbg';
      pre.textContent = JSON.stringify({
        canvas: [viewer.canvas.clientWidth, viewer.canvas.clientHeight],
        drawingBuffer: [viewer.renderer.domElement.width, viewer.renderer.domElement.height],
        camera: viewer.camera.position.toArray().map(function (n) { return +n.toFixed(2); }),
        fov: viewer.camera.fov, aspect: +viewer.camera.aspect.toFixed(3),
        parts: m.stats.parts, triangles: m.stats.triangles,
        size: [m.stats.size.x, m.stats.size.y, m.stats.size.z].map(function (n) { return +n.toFixed(2); }),
        bounds: [m.stats.bounds.min, m.stats.bounds.max]
      }, null, 1);
      document.body.appendChild(pre);
    }, 1200);
  }
})();
