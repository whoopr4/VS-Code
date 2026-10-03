// ===========================================================================
// HAZARDS — asteroid clusters, spawned in groups with a deliberate gap so
// they funnel the player toward a safe lane.
//
// Interactions (all collision math is on the screen plane — the old bug was
// a random depth offset making shots/ships visually overlap yet miss):
//  - Ship rams an asteroid: asteroid fully explodes, the ship crashes.
//  - Player bullet hits one: breaks into ~3 smaller, slower drifting pieces;
//    pieces below a minimum size just explode. Bullet hits are swept tests.
//  - Laser / nuke: destroys asteroids outright (hooks at the bottom).
// ===========================================================================
(function () {
  const CONFIG = GAME.CONFIG;
  const PIECES_PER_BREAK = 3;
  const PIECE_SCALE_FACTOR = 0.55;
  const MIN_SPLIT_SCALE = 0.3;

  function makeAsteroidGeometry() {
    const geo = new THREE.IcosahedronGeometry(0.35, 0);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const jitter = 0.8 + Math.random() * 0.4;
      pos.setXYZ(i, pos.getX(i) * jitter, pos.getY(i) * jitter, pos.getZ(i) * jitter);
    }
    geo.computeVertexNormals();
    return geo;
  }

  const asteroidMat = new THREE.MeshStandardMaterial({
    color: 0x5a4f47, metalness: 0.1, roughness: 0.9, flatShading: true,
  });

  let hazards = [];
  let spawnTimer = CONFIG.hazardFieldInterval;

  function radiusOf(h) { return Math.max(0.12, CONFIG.hazardHitRadius * h.scale); }

  function addHazard(position, scale, velocity) {
    const mesh = new THREE.Mesh(makeAsteroidGeometry(), asteroidMat);
    mesh.scale.setScalar(scale);
    mesh.position.copy(position);
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    GAME.scene.add(mesh);
    hazards.push({
      mesh, scale, velocity,
      spin: new THREE.Vector3(
        (Math.random() - 0.5) * CONFIG.hazardRotSpeedMax,
        (Math.random() - 0.5) * CONFIG.hazardRotSpeedMax,
        (Math.random() - 0.5) * CONFIG.hazardRotSpeedMax
      ),
      dead: false,
    });
  }

  function spawnField() {
    const bounds = GAME.getPlayBounds();
    const spawnX = bounds.maxX + 3;
    const gapY = THREE.MathUtils.lerp(bounds.minY, bounds.maxY, 0.2 + Math.random() * 0.6);
    const gapHalfHeight = 1.1;

    let placed = 0, attempts = 0;
    while (placed < CONFIG.hazardsPerField && attempts < 40) {
      attempts++;
      const y = THREE.MathUtils.lerp(bounds.minY, bounds.maxY, Math.random());
      if (Math.abs(y - gapY) < gapHalfHeight) continue;

      const scale = THREE.MathUtils.lerp(CONFIG.hazardMinScale, CONFIG.hazardMaxScale, Math.random());
      addHazard(
        new THREE.Vector3(spawnX + Math.random() * 2, y, (Math.random() - 0.5) * 0.6),
        scale,
        new THREE.Vector2(-CONFIG.hazardSpeed, 0)
      );
      placed++;
    }
  }

  // Shot: split into slower pieces, or pop outright if already small.
  function breakHazard(h) {
    const pos = h.mesh.position.clone();
    h.dead = true;
    if (h.scale >= MIN_SPLIT_SCALE) {
      for (let i = 0; i < PIECES_PER_BREAK; i++) {
        const angle = Math.random() * Math.PI * 2;
        const drift = 0.8 + Math.random() * 1.0;
        addHazard(
          pos.clone().add(new THREE.Vector3(Math.cos(angle) * 0.15, Math.sin(angle) * 0.15, 0)),
          h.scale * PIECE_SCALE_FACTOR,
          new THREE.Vector2(-CONFIG.hazardSpeed * 0.5 + Math.cos(angle) * drift, Math.sin(angle) * drift)
        );
      }
      GAME.Effects.spark(pos, 0xc8b8a8);
      GAME.Audio.impact();
    } else {
      GAME.Effects.explode(pos, 0xb8a898, 0.6);
      GAME.Audio.explosion(false);
    }
  }

  function destroyHazard(h) {
    if (h.dead) return;
    h.dead = true;
    GAME.Effects.explode(h.mesh.position.clone(), 0xb8a898, 0.6 + h.scale * 0.6);
    GAME.Audio.explosion(false);
  }

  function updateAll(dt) {
    const bounds = GAME.getPlayBounds();
    const hit = GAME.Collision;

    spawnTimer -= dt;
    if (spawnTimer <= 0) { spawnField(); spawnTimer = CONFIG.hazardFieldInterval; }

    for (const h of hazards) {
      h.mesh.position.x += h.velocity.x * dt;
      h.mesh.position.y += h.velocity.y * dt;
      h.mesh.rotation.x += h.spin.x * dt;
      h.mesh.rotation.y += h.spin.y * dt;
      h.mesh.rotation.z += h.spin.z * dt;
    }

    // Player bullets vs asteroids (swept; copies because breaking adds
    // hazards and removing bullets mutates the bullet list).
    const bullets = GAME.getBullets().slice();
    for (const h of hazards.slice()) {
      if (h.dead) continue;
      const hp = h.mesh.position;
      const radius = radiusOf(h) + 0.04;
      for (const b of bullets) {
        const bp = b.mesh.position;
        if (hit.segCircle(b.prev.x, b.prev.y, bp.x, bp.y, hp.x, hp.y, radius)) {
          GAME.removeBullet(b);
          bullets.splice(bullets.indexOf(b), 1);
          breakHazard(h);
          break;
        }
      }
    }

    // Ships vs asteroids: asteroid fully explodes, ship crashes.
    for (const p of GAME.Players.list()) {
      if (p.state !== "ALIVE") continue;
      const pp = p.obj.mesh.position;
      for (const h of hazards) {
        if (h.dead) continue;
        const hp = h.mesh.position;
        if (Math.hypot(pp.x - hp.x, pp.y - hp.y) < radiusOf(h) + CONFIG.playerHitRadius) {
          h.dead = true;
          GAME.Effects.explode(hp.clone(), 0xffb37f, 0.9 + h.scale);
          GAME.Audio.explosion(false);
          GAME.Players.crash(p);
          if (p.state !== "ALIVE") break;
        }
      }
    }

    hazards = hazards.filter((h) => {
      const offscreen = h.mesh.position.x < bounds.minX - 4 || Math.abs(h.mesh.position.y) > 14;
      if (h.dead || offscreen) {
        GAME.scene.remove(h.mesh);
        h.mesh.geometry.dispose();
        return false;
      }
      return true;
    });
  }

  // --- Hooks for special weapons (laser / nuke): destroy outright ----------
  function damageRect(x0, x1, y0, y1) {
    for (const h of hazards) {
      const p = h.mesh.position;
      const r = radiusOf(h);
      if (p.x + r >= x0 && p.x - r <= x1 && p.y + r >= y0 && p.y - r <= y1) destroyHazard(h);
    }
  }
  function damageCircle(x, y, radius) {
    for (const h of hazards) {
      const p = h.mesh.position;
      if (Math.hypot(p.x - x, p.y - y) < radius + radiusOf(h)) destroyHazard(h);
    }
  }
  function hitTest(x, y, radius) {
    return hazards.some((h) => {
      const p = h.mesh.position;
      return !h.dead && Math.hypot(p.x - x, p.y - y) < radius + radiusOf(h);
    });
  }

  function resetAll() {
    for (const h of hazards) {
      GAME.scene.remove(h.mesh);
      h.mesh.geometry.dispose();
    }
    hazards = [];
    spawnTimer = CONFIG.hazardFieldInterval;
  }

  GAME.Hazards = { updateAll, resetAll, damageRect, damageCircle, hitTest };
})();
