// ===========================================================================
// ENEMIES — angular chevron ships. Small ships fly a straight path with a
// gentle wobble and shoot occasionally; medium ships patrol until a player
// is within a vertical "threat band," then engage (home toward that player,
// fire faster) before continuing off-screen.
//
// Collisions (all on the screen plane): player bullets use swept tests so
// fast shots can't skip over a ship; ramming an enemy destroys it (medium or
// smaller) and crashes the player; the laser/nuke hook in via damageRect /
// damageCircle / hitTest below.
// ===========================================================================
(function () {
  const CONFIG = GAME.CONFIG;

  function makeChevronShape() {
    const shape = new THREE.Shape();
    shape.moveTo(0.75, 0);
    shape.lineTo(-0.65, 0.55);
    shape.lineTo(-0.15, 0.12);
    shape.lineTo(-0.15, -0.12);
    shape.lineTo(-0.65, -0.55);
    shape.lineTo(0.75, 0);
    return shape;
  }

  function makeVentGlowTexture(colorHex) {
    const r = (colorHex >> 16) & 255, g = (colorHex >> 8) & 255, b = colorHex & 255;
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${r},${g},${b},0.95)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
  }

  function makeEnemyMesh(sizeCategory) {
    const accentColor = sizeCategory === "small" ? CONFIG.enemySmallColor : CONFIG.enemyMediumColor;
    const group = new THREE.Group();

    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a3a, metalness: 0.7, roughness: 0.35, flatShading: true,
    });
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x14141c, metalness: 0.6, roughness: 0.4, flatShading: true,
    });

    const hullGeo = new THREE.ExtrudeGeometry(makeChevronShape(), {
      depth: 0.1, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1,
    });
    hullGeo.translate(0, 0, -0.05);
    group.add(new THREE.Mesh(hullGeo, hullMat));

    const bladeGeo = new THREE.ConeGeometry(0.04, 0.55, 4);
    const bladeTop = new THREE.Mesh(bladeGeo, bladeMat);
    bladeTop.position.set(-0.85, 0.62, 0);
    bladeTop.rotation.z = Math.PI * 0.62;
    const bladeBottom = bladeTop.clone();
    bladeBottom.position.y = -0.62;
    bladeBottom.rotation.z = -Math.PI * 0.62;
    group.add(bladeTop, bladeBottom);

    const vent = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeVentGlowTexture(accentColor), transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    vent.scale.set(0.5, 0.4, 1);
    vent.position.set(-0.25, 0, 0);
    group.add(vent);

    const extraScale = sizeCategory === "small" ? CONFIG.enemySmallScale : CONFIG.enemyMediumScale;
    group.scale.setScalar(CONFIG.shipVisualScale * extraScale);
    group.rotation.y = Math.PI; // face -X (traveling left, toward the players)

    return { mesh: group };
  }

  // Shared enemy bullet visuals (red core + soft glow so they're easy to see).
  const enemyBulletGeo = new THREE.SphereGeometry(0.07, 8, 8);
  const enemyBulletMat = new THREE.MeshBasicMaterial({ color: CONFIG.enemyBulletColor });
  const enemyGlowCanvas = document.createElement("canvas");
  enemyGlowCanvas.width = enemyGlowCanvas.height = 64;
  (function () {
    const ctx = enemyGlowCanvas.getContext("2d");
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,70,50,1)");
    grad.addColorStop(0.35, "rgba(255,20,20,0.85)");
    grad.addColorStop(1, "rgba(255,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  })();
  const enemyGlowMat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(enemyGlowCanvas), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });

  let enemies = [];
  let enemyBullets = [];
  let spawnTimerSmall = CONFIG.spawnIntervalSmall;
  let spawnTimerMedium = CONFIG.spawnIntervalMedium;

  function hitRadiusOf(enemy) {
    return enemy.sizeCategory === "small" ? CONFIG.enemyHitRadiusSmall : CONFIG.enemyHitRadiusMedium;
  }

  function spawnSmall() {
    const bounds = GAME.getPlayBounds();
    const obj = makeEnemyMesh("small");
    const y = THREE.MathUtils.lerp(bounds.minY, bounds.maxY, Math.random());
    obj.mesh.position.set(bounds.maxX + 2, y, 0);
    GAME.scene.add(obj.mesh);
    enemies.push({
      obj, sizeCategory: "small",
      health: CONFIG.enemySmallHealth, maxHealth: CONFIG.enemySmallHealth,
      baseY: y, wobblePhase: Math.random() * Math.PI * 2,
      fireTimer: THREE.MathUtils.randFloat(CONFIG.enemySmallFireIntervalMin, CONFIG.enemySmallFireIntervalMax),
      phase: "PATROL", engageTimer: 0, age: 0, stunned: 0, empHits: 0,
    });
  }

  function spawnMedium() {
    const bounds = GAME.getPlayBounds();
    const obj = makeEnemyMesh("medium");
    const y = THREE.MathUtils.lerp(bounds.minY, bounds.maxY, Math.random());
    obj.mesh.position.set(bounds.maxX + 2.5, y, 0);
    GAME.scene.add(obj.mesh);
    enemies.push({
      obj, sizeCategory: "medium",
      health: CONFIG.enemyMediumHealth, maxHealth: CONFIG.enemyMediumHealth,
      baseY: y, wobblePhase: 0,
      fireTimer: CONFIG.enemyMediumFireInterval,
      phase: "PATROL", engageTimer: 0, age: 0, stunned: 0, empHits: 0,
    });
  }

  function fireEnemyBullet(x, y) {
    const mesh = new THREE.Mesh(enemyBulletGeo, enemyBulletMat);
    mesh.position.set(x - 0.3, y, 0);
    const glow = new THREE.Sprite(enemyGlowMat);
    glow.scale.set(0.5, 0.5, 1);
    mesh.add(glow);
    GAME.scene.add(mesh);
    enemyBullets.push({ mesh, life: 3.0 });
    GAME.Audio.enemyShot();
  }

  function findThreatTarget(enemy) {
    for (const p of GAME.Players.list()) {
      if (p.state !== "ALIVE") continue;
      if (Math.abs(p.obj.mesh.position.y - enemy.obj.mesh.position.y) < CONFIG.threatBandY) return p;
    }
    return null;
  }

  function updateEnemy(enemy, dt) {
    const mesh = enemy.obj.mesh;
    enemy.age += dt;

    if (enemy.stunned > 0) {
      enemy.stunned -= dt;
      const speed = enemy.sizeCategory === "small" ? CONFIG.enemySmallSpeed : CONFIG.enemyMediumSpeed;
      mesh.position.x -= speed * dt;
      mesh.rotation.z += 6 * dt; // visual "tumbling"
      return;
    }

    if (enemy.sizeCategory === "small") {
      mesh.position.x -= CONFIG.enemySmallSpeed * dt;
      mesh.position.y = enemy.baseY + Math.sin(enemy.age * 2 + enemy.wobblePhase) * 0.6;

      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0) {
        fireEnemyBullet(mesh.position.x, mesh.position.y);
        enemy.fireTimer = THREE.MathUtils.randFloat(CONFIG.enemySmallFireIntervalMin, CONFIG.enemySmallFireIntervalMax);
      }
    } else {
      if (enemy.phase === "PATROL") {
        const target = findThreatTarget(enemy);
        if (target) { enemy.phase = "ENGAGE"; enemy.engageTimer = CONFIG.mediumEngageDuration; enemy.target = target; }
      }

      if (enemy.phase === "ENGAGE") {
        mesh.position.x -= CONFIG.enemyEngageSpeed * dt;
        const targetStillAlive = enemy.target && enemy.target.state === "ALIVE";
        if (targetStillAlive) {
          const dy = enemy.target.obj.mesh.position.y - mesh.position.y;
          mesh.position.y += THREE.MathUtils.clamp(dy, -2.5, 2.5) * dt;
        }
        enemy.engageTimer -= dt;
        if (enemy.engageTimer <= 0) enemy.phase = "EXIT";
      } else {
        mesh.position.x -= CONFIG.enemyMediumSpeed * dt;
      }

      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0) {
        fireEnemyBullet(mesh.position.x, mesh.position.y);
        enemy.fireTimer = enemy.phase === "ENGAGE" ? CONFIG.enemyMediumFireInterval : CONFIG.enemyMediumFireInterval * 2;
      }
    }
  }

  function updateEnemyBullets(dt) {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      b.mesh.position.x -= CONFIG.enemyBulletSpeed * dt;
      b.life -= dt;
      if (b.life <= 0) {
        GAME.scene.remove(b.mesh);
        enemyBullets.splice(i, 1);
      }
    }
  }

  function checkCollisions() {
    const bounds = GAME.getPlayBounds();
    const hit = GAME.Collision;

    // Player bullets vs enemies (swept: prev -> current position).
    const playerBullets = GAME.getBullets();
    for (const enemy of enemies) {
      if (enemy.health <= 0) continue;
      const ep = enemy.obj.mesh.position;
      const radius = hitRadiusOf(enemy);
      for (const bullet of playerBullets.slice()) {
        const bp = bullet.mesh.position;
        if (hit.segCircle(bullet.prev.x, bullet.prev.y, bp.x, bp.y, ep.x, ep.y, radius)) {
          enemy.health -= 1;
          GAME.Effects.spark(bp.clone(), 0xffe9a8);
          GAME.Audio.impact();
          GAME.removeBullet(bullet);
          if (enemy.health <= 0) break;
        }
      }
    }

    // Ramming: the enemy is destroyed (medium or smaller), the player crashes.
    for (const p of GAME.Players.list()) {
      if (p.state !== "ALIVE") continue;
      const pp = p.obj.mesh.position;
      for (const enemy of enemies) {
        if (enemy.health <= 0) continue;
        const ep = enemy.obj.mesh.position;
        if (Math.hypot(pp.x - ep.x, pp.y - ep.y) < CONFIG.playerHitRadius + hitRadiusOf(enemy)) {
          enemy.health = 0;
          GAME.Players.crash(p);
          if (p.state !== "ALIVE") break;
        }
      }
    }

    enemies = enemies.filter((enemy) => {
      if (enemy.health <= 0) {
        const isSmall = enemy.sizeCategory === "small";
        GAME.Effects.explode(
          enemy.obj.mesh.position.clone(),
          isSmall ? CONFIG.enemySmallColor : CONFIG.enemyMediumColor,
          isSmall ? 0.8 : 1.3
        );
        GAME.Audio.explosion(!isSmall);
        GAME.scene.remove(enemy.obj.mesh);
        GAME.Score.add(isSmall ? CONFIG.scoreSmall : CONFIG.scoreMedium);
        return false;
      }
      if (enemy.obj.mesh.position.x < bounds.minX - 3) {
        GAME.scene.remove(enemy.obj.mesh);
        return false;
      }
      return true;
    });

    // Enemy bullets vs players: 1 HP bar each, unless a reflector shield
    // (a panel only in front of the ship) catches it.
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const bullet = enemyBullets[i];
      const bp = bullet.mesh.position;
      for (const p of GAME.Players.list()) {
        if (p.state !== "ALIVE") continue;
        const pp = p.obj.mesh.position;
        let blocked = false;
        if (p.shieldTimer > 0) {
          const shieldX = pp.x + CONFIG.shieldOffsetX;
          blocked = Math.hypot(bp.x - shieldX, bp.y - pp.y) < CONFIG.shieldRadius;
        }
        const reach = blocked ? CONFIG.shieldRadius : CONFIG.playerHitRadius + 0.05;
        const hitX = blocked ? pp.x + CONFIG.shieldOffsetX : pp.x;
        if (Math.hypot(bp.x - hitX, bp.y - pp.y) < reach) {
          GAME.scene.remove(bullet.mesh);
          enemyBullets.splice(i, 1);
          if (blocked) {
            GAME.fireBullet(bp.x, bp.y, p.color);
            GAME.Audio.impact();
          } else {
            GAME.Players.takeDamage(p, 1);
          }
          break;
        }
      }
    }
  }

  // --- Hooks for special weapons (laser / nuke) -----------------------------
  function damageRect(x0, x1, y0, y1, amount, sparkNow) {
    for (const e of enemies) {
      const p = e.obj.mesh.position;
      const r = hitRadiusOf(e);
      if (p.x + r >= x0 && p.x - r <= x1 && p.y + r >= y0 && p.y - r <= y1) {
        e.health -= amount;
        if (sparkNow) GAME.Effects.spark(p.clone(), 0xffffff);
      }
    }
  }
  function damageCircle(x, y, radius, amount) {
    for (const e of enemies) {
      const p = e.obj.mesh.position;
      if (Math.hypot(p.x - x, p.y - y) < radius + hitRadiusOf(e)) e.health -= amount;
    }
  }
  function hitTest(x, y, radius) {
    return enemies.some((e) => {
      const p = e.obj.mesh.position;
      return e.health > 0 && Math.hypot(p.x - x, p.y - y) < radius + hitRadiusOf(e);
    });
  }

  // EMP: stuns every ship within radius; bigger ships need multiple hits.
  // Called every frame while the blast visual is expanding, so anything
  // that drifts into the growing radius gets caught too.
  function stunAt(x, y, radius) {
    let hitAny = false;
    for (const e of enemies) {
      if (e.health <= 0 || e.stunned > 0) continue;
      const p = e.obj.mesh.position;
      if (Math.hypot(p.x - x, p.y - y) < radius + hitRadiusOf(e)) {
        e.empHits += 1;
        const needed = e.sizeCategory === "small" ? CONFIG.empHitsToStunSmall : CONFIG.empHitsToStunMedium;
        if (e.empHits >= needed) { e.stunned = CONFIG.empStunDuration; e.empHits = 0; }
        hitAny = true;
      }
    }
    return hitAny;
  }

  // Mines: instant-kill within triggerRadius, cascading to nearby enemies
  // within chainRadius of each kill. Returns true if anything was hit
  // (so the mine knows to detonate).
  function chainKill(x, y, triggerRadius, chainRadius) {
    const centers = [{ x, y }];
    let hitAny = false;
    let addedMore = true;
    while (addedMore) {
      addedMore = false;
      for (const e of enemies) {
        if (e.health <= 0) continue;
        const p = e.obj.mesh.position;
        const withinAnyCenter = centers.some((c) => Math.hypot(p.x - c.x, p.y - c.y) < (c === centers[0] ? triggerRadius : chainRadius) + hitRadiusOf(e));
        if (withinAnyCenter) {
          e.health = 0;
          centers.push({ x: p.x, y: p.y });
          hitAny = true;
          addedMore = true;
        }
      }
    }
    return hitAny;
  }

  function clearBulletsInRadius(x, y, radius) {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const bp = enemyBullets[i].mesh.position;
      if (Math.hypot(bp.x - x, bp.y - y) < radius) {
        GAME.scene.remove(enemyBullets[i].mesh);
        enemyBullets.splice(i, 1);
      }
    }
  }

  function list() { return enemies; }

  function updateAll(dt) {
    spawnTimerSmall -= dt;
    if (spawnTimerSmall <= 0) { spawnSmall(); spawnTimerSmall = CONFIG.spawnIntervalSmall; }
    spawnTimerMedium -= dt;
    if (spawnTimerMedium <= 0) { spawnMedium(); spawnTimerMedium = CONFIG.spawnIntervalMedium; }

    for (const enemy of enemies) updateEnemy(enemy, dt);
    updateEnemyBullets(dt);
    checkCollisions();
  }

  function resetAll() {
    for (const e of enemies) GAME.scene.remove(e.obj.mesh);
    for (const b of enemyBullets) GAME.scene.remove(b.mesh);
    enemies = [];
    enemyBullets = [];
    spawnTimerSmall = CONFIG.spawnIntervalSmall;
    spawnTimerMedium = CONFIG.spawnIntervalMedium;
  }

  GAME.Enemies = { updateAll, resetAll, damageRect, damageCircle, hitTest, stunAt, chainKill, clearBulletsInRadius, list };
})();
