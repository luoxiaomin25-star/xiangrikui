'use strict';

/* ============================================================================
 * scene-host.js — WebGL 渲染宿主
 *   三个图层：背景（2D 渐变）→ 3D 场景 → UI（2D Canvas 纹理）
 * ==========================================================================*/

var createScopedThreejs = require('./lib/threejs-miniprogram.js').createScopedThreejs;
var makeCanvasTexture = require('./texture.js').makeCanvasTexture;

function createHost(platform) {
  var canvas = platform.getMainCanvas();
  var THREE = createScopedThreejs(canvas);

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(platform.dpr, 2));
  renderer.setSize(platform.W, platform.H, false);
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;

  if ('outputEncoding' in renderer) {
    renderer.outputEncoding = THREE.sRGBEncoding;
  } else {
    renderer.gammaOutput = true;
    renderer.gammaFactor = 2.2;
  }
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(38, platform.W / platform.H, 0.4, 6000);

  /* ---------------------------------------------------------- 背景层 */
  var backCanvas = platform.createCanvas2D(Math.round(platform.W), Math.round(platform.H));
  var backCtx = backCanvas.getContext('2d');
  var backTex = makeCanvasTexture(THREE, backCanvas);

  var backScene = new THREE.Scene();
  var backCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  backCam.position.z = 1;
  var backMat = new THREE.MeshBasicMaterial({ map: backTex.texture, depthTest: false, depthWrite: false });
  if ('toneMapped' in backMat) backMat.toneMapped = false;
  var backMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), backMat);
  backMesh.frustumCulled = false;
  backScene.add(backMesh);

  /* -------------------------------------------------------------- UI 层 */
  var uiScene = new THREE.Scene();
  var uiCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  uiCam.position.z = 1;

  /* --------------------------------------------------------- 方法 */
  function drawBackdrop(fn) {
    backCtx.setTransform(1, 0, 0, 1, 0, 0);
    backCtx.clearRect(0, 0, backCanvas.width, backCanvas.height);
    fn(backCtx, backCanvas.width, backCanvas.height);
    backTex.update();
  }

  function render() {
    renderer.clear();
    renderer.render(backScene, backCam);
    renderer.render(scene, camera);
    renderer.render(uiScene, uiCam);
  }

  function resize() {
    renderer.setSize(platform.W, platform.H, false);
    camera.aspect = platform.W / platform.H;
    camera.updateProjectionMatrix();
  }

  return {
    THREE: THREE,
    canvas: canvas,
    renderer: renderer,
    scene: scene,
    camera: camera,
    uiScene: uiScene,
    uiCam: uiCam,
    drawBackdrop: drawBackdrop,
    render: render,
    resize: resize,
    platform: platform
  };
}

module.exports = { createHost: createHost };
