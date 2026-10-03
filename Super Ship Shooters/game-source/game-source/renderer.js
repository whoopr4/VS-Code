// ===========================================================================
// RENDERER — scene, camera, lighting, resize handling, and the dynamic
// play-area bounds (raycast from the camera so movement always matches
// the actual visible screen, whatever the aspect ratio).
// ===========================================================================
(function () {
  const canvasHolder = document.getElementById("canvas-holder");
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  canvasHolder.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05070c, 0.012);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 3.2, 15);
  camera.lookAt(0, 0, 0);

  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const boundsRaycaster = new THREE.Raycaster();
  let playBounds = { minX: -10, maxX: 10, minY: -6, maxY: 6 };

  function computePlayBounds() {
    const ndcCorners = [
      new THREE.Vector2(-1, -1), new THREE.Vector2(1, -1),
      new THREE.Vector2(1, 1), new THREE.Vector2(-1, 1),
    ];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const hit = new THREE.Vector3();
    for (const ndc of ndcCorners) {
      boundsRaycaster.setFromCamera(ndc, camera);
      if (boundsRaycaster.ray.intersectPlane(groundPlane, hit)) {
        minX = Math.min(minX, hit.x); maxX = Math.max(maxX, hit.x);
        minY = Math.min(minY, hit.y); maxY = Math.max(maxY, hit.y);
      }
    }
    const m = GAME.CONFIG.shipEdgeMargin;
    playBounds = { minX: minX + m, maxX: maxX - m, minY: minY + m, maxY: maxY - m };
  }

  function onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    computePlayBounds();
  }
  window.addEventListener("resize", onResize);
  onResize();

  // Lighting rig — tuned for readable ships against deep space.
  scene.add(new THREE.HemisphereLight(0x3a5aff, 0x05050a, 0.55));

  const keyLight = new THREE.DirectionalLight(0xaecbff, 1.4);
  keyLight.position.set(6, 8, 10);
  scene.add(keyLight);

  const rimLight = new THREE.PointLight(0x5fd0ff, 2.2, 40, 2);
  rimLight.position.set(-10, 2, 6);
  scene.add(rimLight);

  const fillLight = new THREE.PointLight(0xff7a5f, 0.6, 30, 2);
  fillLight.position.set(4, -6, -4);
  scene.add(fillLight);

  GAME.renderer = renderer;
  GAME.scene = scene;
  GAME.camera = camera;
  GAME.getPlayBounds = () => playBounds;
})();
