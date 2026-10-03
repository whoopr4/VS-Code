// ===========================================================================
// EFFECTS — sparks (small impact bursts) and explosions (bigger burst plus
// an expanding glow). Each effect is a short-lived THREE.Points cloud with
// per-particle velocities; no real-time lights (those caused the earlier
// shader-recompile stutter), just additive-blended points and one sprite.
// ===========================================================================
(function () {
  const scene = GAME.scene;
  let active = [];

  function makeGlowTexture() {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.4, "rgba(255,255,255,0.5)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
  }
  const glowTexture = makeGlowTexture();

  function burst(position, color, count, speed, life, size, withFlash, flashScale) {
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;
      const angle = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      velocities.push(new THREE.Vector3(Math.cos(angle) * s, Math.sin(angle) * s, (Math.random() - 0.5) * s * 0.3));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color, size, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    let flash = null;
    if (withFlash) {
      flash = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture, color, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      flash.position.copy(position);
      flash.scale.setScalar(0.2);
      scene.add(flash);
    }

    active.push({ points, velocities, life, maxLife: life, flash, flashScale: flashScale || 1 });
  }

  // Small impact: a handful of quick sparks.
  function spark(position, color) {
    burst(position, color === undefined ? 0xffe9a8 : color, 10, 3.2, 0.35, 0.09, false);
  }

  // Bigger destruction: dense burst plus an expanding flash. `scale` lets
  // small asteroids/enemies pop smaller than a player ship going down.
  function explode(position, color, scale) {
    const s = scale || 1;
    burst(position, color === undefined ? 0xff9a4d : color, Math.floor(34 * s), 4.5 * s, 0.75, 0.14, true, 1.8 * s);
    burst(position, 0xffe9a8, Math.floor(14 * s), 2.2 * s, 0.5, 0.1, false);
  }

  function update(dt) {
    for (let i = active.length - 1; i >= 0; i--) {
      const fx = active[i];
      fx.life -= dt;
      const t = Math.max(0, fx.life / fx.maxLife);
      const pos = fx.points.geometry.attributes.position;
      for (let p = 0; p < fx.velocities.length; p++) {
        const v = fx.velocities[p];
        pos.setXYZ(p, pos.getX(p) + v.x * dt, pos.getY(p) + v.y * dt, pos.getZ(p) + v.z * dt);
      }
      pos.needsUpdate = true;
      fx.points.material.opacity = t;
      if (fx.flash) {
        fx.flash.scale.setScalar(0.2 + (1 - t) * fx.flashScale);
        fx.flash.material.opacity = t * 0.9;
      }
      if (fx.life <= 0) {
        scene.remove(fx.points);
        fx.points.geometry.dispose();
        fx.points.material.dispose();
        if (fx.flash) { scene.remove(fx.flash); fx.flash.material.dispose(); }
        active.splice(i, 1);
      }
    }
  }

  function clear() {
    for (const fx of active) {
      scene.remove(fx.points);
      if (fx.flash) scene.remove(fx.flash);
    }
    active = [];
  }

  GAME.Effects = { spark, explode, update, clear };
})();
