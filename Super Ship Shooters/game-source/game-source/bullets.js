// ===========================================================================
// BULLETS — pooled-free projectiles drawn as stretched, player-colored
// streaks (a white-hot core plus a tinted glow) so they read differently
// from the round star dots behind them and show who fired them. No
// per-bullet real-time lights (those caused the original first-shot stutter).
//
// Also home of the shared collision helpers: bullets move fast, so hit tests
// check the path a bullet travelled this frame (prev -> current position)
// rather than just its end point, and work on the screen plane only.
// ===========================================================================
(function () {
  const scene = GAME.scene;

  function segCircle(ax, ay, bx, by, cx, cy, r) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq > 0 ? ((cx - ax) * dx + (cy - ay) * dy) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const px = ax + dx * t - cx, py = ay + dy * t - cy;
    return px * px + py * py <= r * r;
  }
  function dist2D(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  GAME.Collision = { segCircle, dist2D };

  const bulletGeo = new THREE.SphereGeometry(0.05, 8, 6);
  bulletGeo.scale(3.2, 1, 1); // stretched into a streak

  function makeGlowTexture() {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(255,255,255,0.95)");
    grad.addColorStop(0.45, "rgba(255,255,255,0.4)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
  }
  const glowTexture = makeGlowTexture();

  const styleCache = new Map();
  function getStyle(color) {
    if (!styleCache.has(color)) {
      const core = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.65);
      styleCache.set(color, {
        coreMat: new THREE.MeshBasicMaterial({ color: core }),
        glowMat: new THREE.SpriteMaterial({
          map: glowTexture, color, transparent: true,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }),
      });
    }
    return styleCache.get(color);
  }

  const bullets = [];

  function fireBullet(originX, originY, color, dirX, dirY) {
    const style = getStyle(color === undefined ? 0x9fe8ff : color);
    const mesh = new THREE.Mesh(bulletGeo, style.coreMat);
    const x = originX + GAME.CONFIG.bulletNoseOffset;
    mesh.position.set(x, originY, 0);

    let dx = dirX === undefined ? 1 : dirX;
    let dy = dirY === undefined ? 0 : dirY;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    mesh.rotation.z = Math.atan2(dy, dx);

    const glow = new THREE.Sprite(style.glowMat);
    glow.scale.set(1.0, 0.42, 1);
    mesh.add(glow);

    scene.add(mesh);
    bullets.push({ mesh, life: GAME.CONFIG.bulletLife, prev: { x, y: originY }, dir: { x: dx, y: dy } });
  }

  function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.prev.x = b.mesh.position.x;
      b.prev.y = b.mesh.position.y;
      b.mesh.position.x += b.dir.x * GAME.CONFIG.bulletSpeed * dt;
      b.mesh.position.y += b.dir.y * GAME.CONFIG.bulletSpeed * dt;
      b.life -= dt;
      if (b.life <= 0 || Math.abs(b.mesh.position.x) > 30 || Math.abs(b.mesh.position.y) > 20) {
        scene.remove(b.mesh);
        bullets.splice(i, 1);
      }
    }
  }

  function removeBullet(bulletObj) {
    const idx = bullets.indexOf(bulletObj);
    if (idx !== -1) {
      scene.remove(bulletObj.mesh);
      bullets.splice(idx, 1);
    }
  }

  // Fire one throwaway bullet off-screen at load time and force a compile
  // pass, so the real first shot doesn't stutter.
  function prewarm() {
    fireBullet(-1000, -1000, 0xffffff);
    GAME.renderer.compile(scene, GAME.camera);
    updateBullets(GAME.CONFIG.bulletLife + 1);
  }

  GAME.fireBullet = fireBullet;
  GAME.updateBullets = updateBullets;
  GAME.prewarmBullets = prewarm;
  GAME.getBullets = () => bullets;
  GAME.removeBullet = removeBullet;
})();
