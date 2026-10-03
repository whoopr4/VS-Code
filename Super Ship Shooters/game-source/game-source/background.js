// ===========================================================================
// BACKGROUND — layered starfield (two depths for parallax) plus soft
// nebula/galaxy billboards and star clusters, all scrolling right-to-left
// as whole units so shapes don't distort as they wrap around.
// ===========================================================================
(function () {
  const scene = GAME.scene;
  const CONFIG = GAME.CONFIG;

  // --- Starfield: two point layers, far/slow and near/fast -----------------
  function makeStarLayer(count, depthZ, size, color, speedMultiplier) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * CONFIG.starFieldWidth;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 2] = depthZ + (Math.random() - 0.5) * 4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color, size, sizeAttenuation: true, transparent: true, opacity: 0.9,
    });
    const points = new THREE.Points(geo, mat);
    points.userData.speedMultiplier = speedMultiplier;
    scene.add(points);
    return points;
  }

  const starLayers = [
    makeStarLayer(CONFIG.starCount, -18, 0.08, 0x8fa6c8, 0.5),
    makeStarLayer(Math.floor(CONFIG.starCount * 0.5), -6, 0.13, 0xffffff, 1.0),
  ];

  // Dimmer stars so bright colored bullets stay easy to pick out.
  starLayers[0].material.opacity = 0.4;
  starLayers[1].material.opacity = 0.55;
  starLayers[1].material.size = 0.1;

  // --- Soft radial-gradient texture, reused for nebulae/galaxies -----------
  function makeGlowTexture(colorStops) {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const stop of colorStops) grad.addColorStop(stop.at, stop.color);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  const nebulaTexture = makeGlowTexture([
    { at: 0.0, color: "rgba(140,110,255,0.55)" },
    { at: 0.5, color: "rgba(90,60,200,0.22)" },
    { at: 1.0, color: "rgba(90,60,200,0)" },
  ]);
  const galaxyTexture = makeGlowTexture([
    { at: 0.0, color: "rgba(255,235,200,0.7)" },
    { at: 0.35, color: "rgba(255,200,150,0.3)" },
    { at: 1.0, color: "rgba(255,200,150,0)" },
  ]);

  function makeClusteredGlow(texture, z, baseScale, speedMultiplier, squashY, starColor, starCount) {
    const group = new THREE.Group();

    const spriteMat = new THREE.SpriteMaterial({
      map: texture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const sprite = new THREE.Sprite(spriteMat);
    const scale = baseScale * (0.7 + Math.random() * 0.6);
    sprite.scale.set(scale, scale * (squashY || 1), 1);
    group.add(sprite);

    // Embed a tight cluster of bright points inside/around the glow so it
    // reads as "a galaxy with visible stars," not two unrelated effects.
    const radius = scale * 0.35;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = Math.random() * radius;
      const angle = Math.random() * Math.PI * 2;
      positions[i * 3 + 0] = Math.cos(angle) * r;
      positions[i * 3 + 1] = Math.sin(angle) * r * (squashY || 1);
      positions[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({
      color: starColor, size: 0.15, sizeAttenuation: true, transparent: true, opacity: 0.95,
    });
    group.add(new THREE.Points(geo, starMat));

    group.position.set(
      (Math.random() - 0.5) * CONFIG.starFieldWidth,
      (Math.random() - 0.5) * 40,
      z
    );
    group.userData.speedMultiplier = speedMultiplier;
    scene.add(group);
    wrappingObjects.push(group);
  }

  const wrappingObjects = [];

  for (let i = 0; i < CONFIG.nebulaCount; i++) {
    makeClusteredGlow(nebulaTexture, -35 - Math.random() * 10, 14, 0.25, 0.6, 0xd8c8ff, 22);
  }
  for (let i = 0; i < CONFIG.galaxyCount; i++) {
    makeClusteredGlow(galaxyTexture, -40 - Math.random() * 10, 8, 0.3, 0.35, 0xfff0d8, 30);
  }

  function updateBackground(dt) {
    const halfWidth = CONFIG.starFieldWidth / 2;

    for (const layer of starLayers) {
      const pos = layer.geometry.attributes.position;
      const speed = CONFIG.scrollSpeed * layer.userData.speedMultiplier * dt;
      for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i) - speed;
        if (x < -halfWidth) x += CONFIG.starFieldWidth;
        pos.setX(i, x);
      }
      pos.needsUpdate = true;
    }

    for (const obj of wrappingObjects) {
      obj.position.x -= CONFIG.scrollSpeed * obj.userData.speedMultiplier * dt;
      if (obj.position.x < -halfWidth - 10) {
        obj.position.x += CONFIG.starFieldWidth + 20;
        obj.position.y = (Math.random() - 0.5) * 40;
      }
    }
  }

  GAME.updateBackground = updateBackground;
})();
