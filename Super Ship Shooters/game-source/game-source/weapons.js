// ===========================================================================
// WEAPONS — special weapon pickups and the two weapons they grant.
//
//  - Pickups: every few seconds a spinning hologram drifts in from the right
//    like an asteroid. Fly into it to collect: each pickup grants half of
//    that weapon's max ammo. A player can hold up to 2 weapon types; the
//    first slot fires (special button: left trigger / right-click / E).
//  - Laser: a ~2s full-screen beam in the shooter's color that passes through
//    everything, damaging over time.
//  - Mini-nuke: a missile steered with the right stick after launch (flies
//    straight on keyboard). Detonates on contact or timeout with a big blast.
// ===========================================================================
(function () {
  const CONFIG = GAME.CONFIG;
  const scene = GAME.scene;

  const LASER_HOLO = 0xff1444;    // neon red
  const NUKE_HOLO = 0x2f8cff;     // brighter neon blue
  const TELEPORT_HOLO = 0xb24dff; // neon purple
  const EMP_HOLO = 0xfff23d;      // neon yellow
  const MINE_HOLO = 0xff7a1f;     // neon orange
  const SHIELD_HOLO = 0x3dffb0;   // neon green

  // --- Shared textures --------------------------------------------------------
  function makeLabelTexture(text, cssColor) {
    const canvas = document.createElement("canvas");
    canvas.width = 128; canvas.height = 32;
    const ctx = canvas.getContext("2d");
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = cssColor;
    ctx.shadowColor = cssColor;
    ctx.shadowBlur = 8;
    ctx.fillText(text, 64, 23);
    return new THREE.CanvasTexture(canvas);
  }
  const labelTextures = {
    laser: makeLabelTexture("LASER", "#ff3d6a"),
    nuke: makeLabelTexture("GUIDED NUKE", "#5f9fff"),
    teleport: makeLabelTexture("TELEPORT", "#c98bff"),
    emp: makeLabelTexture("EMP", "#fff35f"),
    mine: makeLabelTexture("MINE", "#ff9a4d"),
    shield: makeLabelTexture("SHIELD", "#6fffcf"),
  };

  function makeBeamTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 8; canvas.height = 64;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.5, "rgba(255,255,255,1)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 8, 64);
    return new THREE.CanvasTexture(canvas);
  }
  const beamTexture = makeBeamTexture();

  function makeGlowTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,0.8)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
  }
  const glowTexture = makeGlowTexture();

  // --- Hologram pickups -------------------------------------------------------
  function holoMats(color) {
    return {
      wire: new THREE.MeshBasicMaterial({
        color, wireframe: true, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
      fill: new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.16, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    };
  }
  function addHoloPart(group, geo, mats, x, y, z) {
    const wire = new THREE.Mesh(geo, mats.wire);
    const fill = new THREE.Mesh(geo, mats.fill);
    wire.position.set(x || 0, y || 0, z || 0);
    fill.position.copy(wire.position);
    group.add(wire, fill);
  }

  function buildLaserHologram(mats) {
    const g = new THREE.Group();
    const beam = new THREE.CylinderGeometry(0.07, 0.07, 1.0, 10); beam.rotateZ(Math.PI / 2);
    addHoloPart(g, beam, mats, 0.05, 0, 0);
    const housing = new THREE.CylinderGeometry(0.16, 0.1, 0.24, 10); housing.rotateZ(Math.PI / 2);
    addHoloPart(g, housing, mats, -0.55, 0, 0);
    for (const x of [-0.2, 0.15, 0.5]) {
      const ring = new THREE.TorusGeometry(0.15, 0.015, 6, 16); ring.rotateY(Math.PI / 2);
      addHoloPart(g, ring, mats, x, 0, 0);
    }
    const tip = new THREE.ConeGeometry(0.12, 0.26, 10); tip.rotateZ(-Math.PI / 2);
    addHoloPart(g, tip, mats, 0.68, 0, 0);
    return g;
  }

  function buildNukeHologram(mats) {
    const g = new THREE.Group();
    const body = new THREE.CylinderGeometry(0.11, 0.11, 0.65, 10); body.rotateZ(-Math.PI / 2);
    addHoloPart(g, body, mats, 0, 0, 0);
    const nose = new THREE.ConeGeometry(0.11, 0.32, 10); nose.rotateZ(-Math.PI / 2);
    addHoloPart(g, nose, mats, 0.48, 0, 0);
    addHoloPart(g, new THREE.BoxGeometry(0.22, 0.16, 0.02), mats, -0.3, 0.14, 0);
    addHoloPart(g, new THREE.BoxGeometry(0.22, 0.16, 0.02), mats, -0.3, -0.14, 0);
    addHoloPart(g, new THREE.BoxGeometry(0.22, 0.02, 0.16), mats, -0.3, 0, 0.14);
    const ring = new THREE.TorusGeometry(0.1, 0.012, 6, 14); ring.rotateY(Math.PI / 2);
    addHoloPart(g, ring, mats, -0.36, 0, 0);
    return g;
  }

  function buildTeleportHologram(mats) {
    const g = new THREE.Group();
    addHoloPart(g, new THREE.TorusGeometry(0.32, 0.03, 8, 20), mats, 0, 0, 0);
    addHoloPart(g, new THREE.TorusGeometry(0.18, 0.025, 8, 16), mats, 0, 0, 0.1);
    addHoloPart(g, new THREE.SphereGeometry(0.06, 8, 8), mats, 0, 0, 0.18);
    return g;
  }

  function buildEmpHologram(mats) {
    const g = new THREE.Group();
    addHoloPart(g, new THREE.IcosahedronGeometry(0.28, 0), mats, 0, 0, 0);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      addHoloPart(g, new THREE.ConeGeometry(0.03, 0.22, 4), mats, Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0);
    }
    return g;
  }

  function buildMineHologram(mats) {
    const g = new THREE.Group();
    addHoloPart(g, new THREE.IcosahedronGeometry(0.22, 0), mats, 0, 0, 0);
    const dirs = [
      [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
      [0.7, 0.7, 0], [-0.7, 0.7, 0], [0.7, -0.7, 0], [-0.7, -0.7, 0],
    ];
    for (const [dx, dy, dz] of dirs) {
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.26, 4), mats.wire);
      s.position.set(dx * 0.24, dy * 0.24, dz * 0.24);
      s.lookAt(dx * 0.6, dy * 0.6, dz * 0.6);
      s.rotateX(Math.PI / 2);
      g.add(s);
    }
    return g;
  }

  function buildShieldHologram(mats) {
    const g = new THREE.Group();
    addHoloPart(g, new THREE.SphereGeometry(0.34, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats, 0, -0.05, 0);
    const ring = new THREE.TorusGeometry(0.34, 0.02, 6, 20);
    ring.rotateX(Math.PI / 2);
    addHoloPart(g, ring, mats, 0, -0.05, 0);
    return g;
  }

  const HOLOGRAM_BUILDERS = {
    laser: buildLaserHologram, nuke: buildNukeHologram, teleport: buildTeleportHologram,
    emp: buildEmpHologram, mine: buildMineHologram, shield: buildShieldHologram,
  };
  const HOLOGRAM_COLORS = {
    laser: LASER_HOLO, nuke: NUKE_HOLO, teleport: TELEPORT_HOLO,
    emp: EMP_HOLO, mine: MINE_HOLO, shield: SHIELD_HOLO,
  };
  const MAX_AMMO = {
    laser: CONFIG.laserMaxAmmo, nuke: CONFIG.nukeMaxAmmo, teleport: CONFIG.teleportMaxAmmo,
    emp: CONFIG.empMaxAmmo, mine: CONFIG.mineMaxAmmo, shield: CONFIG.shieldMaxAmmo,
  };
  const PICKUP_TYPES = Object.keys(HOLOGRAM_BUILDERS);

  let pickups = [];
  let pickupTimer = THREE.MathUtils.randFloat(CONFIG.pickupSpawnMin, CONFIG.pickupSpawnMax);

  function spawnPickup() {
    const bounds = GAME.getPlayBounds();
    const type = PICKUP_TYPES[Math.floor(Math.random() * PICKUP_TYPES.length)];
    const color = HOLOGRAM_COLORS[type];
    const mats = holoMats(color);

    const root = new THREE.Group();
    const holo = HOLOGRAM_BUILDERS[type](mats);
    holo.scale.setScalar(0.8);
    root.add(holo);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture, color, transparent: true, opacity: 0.35,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.set(1.6, 1.6, 1);
    root.add(glow);

    const label = new THREE.Sprite(new THREE.SpriteMaterial({
      map: labelTextures[type], transparent: true, depthWrite: false,
    }));
    label.scale.set(1.0, 0.25, 1);
    label.position.set(0, -0.55, 0);
    root.add(label);

    const baseY = THREE.MathUtils.lerp(bounds.minY, bounds.maxY, Math.random());
    root.position.set(bounds.maxX + 2.5, baseY, 0);
    scene.add(root);
    pickups.push({ root, holo, mats, type, baseY, age: 0 });
  }

  // Try to add ammo. Returns false (pickup left alone) if the player can't take it.
  function grantAmmo(player, type) {
    const max = MAX_AMMO[type];
    const add = Math.ceil(max * CONFIG.pickupGrantFraction);
    const slot = player.weapons.find((w) => w.type === type);
    if (slot) {
      if (slot.ammo >= max) return false;
      slot.ammo = Math.min(max, slot.ammo + add);
    } else if (player.weapons.length < 2) {
      player.weapons.push({ type, ammo: Math.min(max, add) });
    } else {
      return false;
    }
    GAME.Players.refreshChip(player);
    return true;
  }

  function updatePickups(dt, bounds) {
    pickupTimer -= dt;
    if (pickupTimer <= 0) {
      spawnPickup();
      pickupTimer = THREE.MathUtils.randFloat(CONFIG.pickupSpawnMin, CONFIG.pickupSpawnMax);
    }

    for (let i = pickups.length - 1; i >= 0; i--) {
      const pk = pickups[i];
      pk.age += dt;
      pk.root.position.x -= CONFIG.pickupSpeed * dt;
      pk.root.position.y = pk.baseY + Math.sin(pk.age * 1.6) * 0.25;
      pk.holo.rotation.y += 1.8 * dt; // horizontal turntable spin
      const flicker = 0.75 + 0.15 * Math.sin(pk.age * 22) + 0.1 * Math.sin(pk.age * 7);
      pk.mats.wire.opacity = flicker;

      let collected = false;
      let closest = null, closestDist = CONFIG.pickupCollectRadius;
      for (const p of GAME.Players.list()) {
        if (p.state !== "ALIVE") continue;
        const pp = p.obj.mesh.position;
        const d = Math.hypot(pp.x - pk.root.position.x, pp.y - pk.root.position.y);
        if (d < closestDist) { closestDist = d; closest = p; }
      }
      if (closest && grantAmmo(closest, pk.type)) {
        GAME.Effects.spark(pk.root.position.clone(), HOLOGRAM_COLORS[pk.type]);
        GAME.Audio.pickup();
        collected = true;
      }

      if (collected || pk.root.position.x < bounds.minX - 3) {
        scene.remove(pk.root);
        pickups.splice(i, 1);
      }
    }
  }

  // --- Laser beams ------------------------------------------------------------
  let beams = [];

  function startBeam(player, powerMul) {
    const mk = (color) => new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: beamTexture, color, transparent: true, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    const outer = mk(LASER_HOLO);
    const core = mk(0xffffff);
    scene.add(outer, core);

    // Muzzle spill: a bright flare plus a few short flickering lines right
    // at the nose, for a little "light leaking out" realism.
    const flare = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture, color: LASER_HOLO, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    flare.scale.set(0.45, 0.45, 1);
    scene.add(flare);
    const spillLines = [];
    const spillGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    for (let i = 0; i < 4; i++) {
      const line = new THREE.Line(spillGeo.clone(), new THREE.LineBasicMaterial({
        color: LASER_HOLO, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending,
      }));
      scene.add(line);
      spillLines.push(line);
    }

    beams.push({ player, time: CONFIG.laserDuration, outer, core, flare, spillLines, sparkTimer: 0, powerMul: powerMul || 1 });
    GAME.Audio.laserBeam(CONFIG.laserDuration);
  }

  function removeBeam(b) {
    scene.remove(b.outer, b.core, b.flare);
    b.outer.geometry.dispose(); b.core.geometry.dispose();
    b.outer.material.dispose(); b.core.material.dispose();
    for (const line of b.spillLines) {
      scene.remove(line);
      line.geometry.dispose(); line.material.dispose();
    }
  }

  function updateBeams(dt, bounds) {
    for (let i = beams.length - 1; i >= 0; i--) {
      const b = beams[i];
      const p = b.player;
      b.time -= dt;
      if (b.time <= 0 || p.state !== "ALIVE") {
        removeBeam(b);
        beams.splice(i, 1);
        continue;
      }
      const pos = p.obj.mesh.position;
      const noseX = pos.x + 0.25;
      const endX = bounds.maxX + 5;
      const len = endX - noseX;
      const flick = 0.9 + 0.1 * Math.sin(b.time * 45);
      const fade = Math.min(1, b.time / 0.25, (CONFIG.laserDuration - b.time) / 0.08 + 0.2);

      b.outer.position.set(noseX + len / 2, pos.y, 0);
      b.outer.scale.set(len, 0.7 * flick, 1);
      b.outer.material.opacity = 0.85 * fade;
      b.core.position.set(noseX + len / 2, pos.y, 0.01);
      b.core.scale.set(len, 0.22 * flick, 1);
      b.core.material.opacity = fade;

      b.flare.position.set(noseX, pos.y, 0.02);
      b.flare.scale.setScalar(0.4 * flick);
      b.flare.material.opacity = 0.9 * fade;
      for (const line of b.spillLines) {
        const a = (Math.random() - 0.5) * 1.4;
        const len2 = 0.08 + Math.random() * 0.1;
        const pts = [
          new THREE.Vector3(noseX, pos.y, 0.02),
          new THREE.Vector3(noseX - Math.cos(a) * len2, pos.y + Math.sin(a) * len2, 0.02),
        ];
        line.geometry.setFromPoints(pts);
        line.material.opacity = (0.4 + Math.random() * 0.4) * fade;
      }

      b.sparkTimer -= dt;
      const sparkNow = b.sparkTimer <= 0;
      if (sparkNow) b.sparkTimer = 0.12;
      const hh = CONFIG.laserHalfHeight * Math.sqrt(b.powerMul);
      GAME.Enemies.damageRect(noseX, endX, pos.y - hh, pos.y + hh, CONFIG.laserDps * b.powerMul * dt, sparkNow);
      GAME.Hazards.damageRect(noseX, endX, pos.y - hh, pos.y + hh);
    }
  }

  // --- Mini-nukes -------------------------------------------------------------
  let nukes = [];
  let shockwaves = [];
  const shockwaveRingGeo = new THREE.RingGeometry(0.94, 1.0, 48);

  function launchNuke(player, powerMul) {
    const group = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0xc9ced8, metalness: 0.7, roughness: 0.35 });
    const tint = new THREE.MeshBasicMaterial({ color: player.color });

    const body = new THREE.CylinderGeometry(0.11, 0.11, 0.65, 10); body.rotateZ(-Math.PI / 2);
    group.add(new THREE.Mesh(body, metal));
    const nose = new THREE.ConeGeometry(0.11, 0.3, 10); nose.rotateZ(-Math.PI / 2);
    const noseMesh = new THREE.Mesh(nose, tint);
    noseMesh.position.set(0.47, 0, 0);
    group.add(noseMesh);
    for (const [y, z] of [[0.14, 0], [-0.14, 0], [0, 0.14]]) {
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, z ? 0.02 : 0.16, z ? 0.16 : 0.02), metal
      );
      fin.position.set(-0.3, y, z);
      group.add(fin);
    }
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.5, 8, 1, true).rotateZ(Math.PI / 2).translate(-0.55, 0, 0),
      new THREE.MeshBasicMaterial({
        color: 0xffa040, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    group.add(flame);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture, color: player.color, transparent: true, opacity: 0.6,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.set(1.4, 1.4, 1);
    group.add(glow);

    group.scale.setScalar(0.5);
    const start = player.obj.mesh.position;
    group.position.set(start.x + 0.35, start.y, 0);
    scene.add(group);
    nukes.push({ group, flame, heading: 0, life: CONFIG.nukeLife, owner: player, age: 0, powerMul: powerMul || 1 });
    GAME.Audio.nukeLaunch();
  }

  function detonateNuke(n) {
    const pos = n.group.position.clone();
    GAME.Effects.explode(pos, 0xffb060, 1.7);
    GAME.Effects.explode(pos, n.owner.color, 1.1);
    GAME.Audio.explosion(true);
    const blastRadius = CONFIG.nukeBlastRadius * n.powerMul;
    GAME.Enemies.damageCircle(pos.x, pos.y, blastRadius, CONFIG.nukeDamage);
    GAME.Hazards.damageCircle(pos.x, pos.y, blastRadius);
    scene.remove(n.group);

    const ring = new THREE.Mesh(shockwaveRingGeo, new THREE.MeshBasicMaterial({
      color: 0xffd9a0, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    ring.position.copy(pos);
    ring.scale.setScalar(0.01);
    scene.add(ring);
    shockwaves.push({ mesh: ring, life: 0.5, maxLife: 0.5, maxRadius: blastRadius });
  }

  function updateShockwaves(dt) {
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const s = shockwaves[i];
      s.life -= dt;
      const t = 1 - Math.max(0, s.life) / s.maxLife;
      const r = Math.max(0.01, t * s.maxRadius);
      s.mesh.scale.set(r, r, 1);
      s.mesh.material.opacity = (1 - t) * 0.9;
      if (s.life <= 0) {
        scene.remove(s.mesh);
        s.mesh.material.dispose();
        shockwaves.splice(i, 1);
      }
    }
  }

  function updateNukes(dt, bounds) {
    for (let i = nukes.length - 1; i >= 0; i--) {
      const n = nukes[i];
      n.age += dt;
      n.life -= dt;

      // Steer with the right stick (gamepad); keyboard flies straight.
      const aim = GAME.Input.getAim(n.owner.source);
      if (Math.hypot(aim.x, aim.y) > 0.4) {
        const target = Math.atan2(aim.y, aim.x);
        let diff = target - n.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const maxTurn = CONFIG.nukeTurnRate * dt;
        n.heading += Math.max(-maxTurn, Math.min(maxTurn, diff));
      }

      const pos = n.group.position;
      pos.x += Math.cos(n.heading) * CONFIG.nukeSpeed * dt;
      pos.y += Math.sin(n.heading) * CONFIG.nukeSpeed * dt;
      n.group.rotation.z = n.heading;
      const f = 0.85 + 0.25 * Math.sin(n.age * 40);
      n.flame.scale.set(f, 1, 1);

      const out = pos.x > bounds.maxX + 3 || pos.x < bounds.minX - 3 ||
                  pos.y > bounds.maxY + 3 || pos.y < bounds.minY - 3;
      // Small arming delay so it can't pop on the launching ship's own nose.
      const armed = n.age > 0.12;
      if (n.life <= 0 || out ||
          (armed && (GAME.Enemies.hitTest(pos.x, pos.y, 0.2) || GAME.Hazards.hitTest(pos.x, pos.y, 0.2)))) {
        detonateNuke(n);
        nukes.splice(i, 1);
      }
    }
  }

  // --- Teleport ---------------------------------------------------------------
  let teleportTrails = [];
  let teleportSwirls = [];
  const teleportRingGeo = new THREE.RingGeometry(0.92, 1.0, 40);

  function spawnTeleportTrail(a, b) {
    // A wavy chain of small rotating puffs instead of a straight bar, so the
    // path back to the new spot reads as "swirly."
    const dist = a.distanceTo(b);
    const dir = b.clone().sub(a).normalize();
    const perp = new THREE.Vector3(-dir.y, dir.x, 0);
    const puffCount = Math.max(5, Math.floor(dist / 0.18));
    const puffs = [];
    for (let i = 0; i <= puffCount; i++) {
      const t = i / puffCount;
      const wiggle = Math.sin(t * Math.PI * 3) * 0.18 * Math.sin(t * Math.PI); // fades at both ends
      const pos = a.clone().lerp(b, t).add(perp.clone().multiplyScalar(wiggle));
      const mesh = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture, color: TELEPORT_HOLO, transparent: true, opacity: 0.8,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      mesh.position.copy(pos);
      mesh.scale.setScalar(0.22);
      scene.add(mesh);
      puffs.push(mesh);
    }
    teleportTrails.push({ puffs, life: 0.4, maxLife: 0.4 });
  }

  function updateTeleportTrails(dt) {
    for (let i = teleportTrails.length - 1; i >= 0; i--) {
      const t = teleportTrails[i];
      t.life -= dt;
      const opacity = Math.max(0, t.life / t.maxLife) * 0.8;
      for (const puff of t.puffs) puff.material.opacity = opacity;
      if (t.life <= 0) {
        for (const puff of t.puffs) { scene.remove(puff); puff.material.dispose(); }
        teleportTrails.splice(i, 1);
      }
    }
  }

  function spawnSwirl(position) {
    const mk = (dir) => new THREE.Mesh(teleportRingGeo, new THREE.MeshBasicMaterial({
      color: TELEPORT_HOLO, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    const ringA = mk(1), ringB = mk(-1);
    ringA.position.copy(position); ringB.position.copy(position);
    ringA.scale.setScalar(0.01); ringB.scale.setScalar(0.01);
    scene.add(ringA, ringB);
    teleportSwirls.push({ ringA, ringB, life: 0.45, maxLife: 0.45, maxRadius: CONFIG.teleportRippleRadius });
  }

  function updateTeleportSwirls(dt) {
    for (let i = teleportSwirls.length - 1; i >= 0; i--) {
      const s = teleportSwirls[i];
      s.life -= dt;
      const t = 1 - Math.max(0, s.life) / s.maxLife;
      const r = Math.max(0.01, t * s.maxRadius);
      s.ringA.scale.setScalar(r); s.ringB.scale.setScalar(r);
      s.ringA.rotation.z += dt * 9; s.ringB.rotation.z -= dt * 7; // counter-rotating swirl
      const op = (1 - t) * 0.9;
      s.ringA.material.opacity = op; s.ringB.material.opacity = op;
      if (s.life <= 0) {
        scene.remove(s.ringA, s.ringB);
        s.ringA.material.dispose(); s.ringB.material.dispose();
        teleportSwirls.splice(i, 1);
      }
    }
  }

  function doTeleport(player, powerMul) {
    const bounds = GAME.getPlayBounds();
    const from = player.obj.mesh.position.clone();
    const toX = THREE.MathUtils.lerp(bounds.minX, bounds.maxX, CONFIG.teleportXFraction);
    const toY = THREE.MathUtils.lerp(bounds.minY, bounds.maxY, Math.random());
    player.obj.mesh.position.set(toX, toY, 0);
    player.velocity.set(0, 0);

    const r = CONFIG.teleportRippleRadius * (powerMul || 1);
    for (const [x, y] of [[from.x, from.y], [toX, toY]]) {
      GAME.Enemies.damageCircle(x, y, r, 999);
      GAME.Enemies.clearBulletsInRadius(x, y, r);
      GAME.Hazards.damageCircle(x, y, r);
      spawnSwirl(new THREE.Vector3(x, y, 0));
    }
    spawnTeleportTrail(from, new THREE.Vector3(toX, toY, 0));
    GAME.Audio.teleport();
  }

  // --- EMP ----------------------------------------------------------------
  let emps = [];
  let empBlasts = [];
  const empLatticeGeo = new THREE.IcosahedronGeometry(1, 1);
  const empArcCount = 10;

  function launchEmp(player, powerMul) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(CONFIG.empRadius, 12, 12),
      new THREE.MeshBasicMaterial({ color: EMP_HOLO, transparent: true, opacity: 0.55, wireframe: true })
    );
    const core = new THREE.Mesh(new THREE.SphereGeometry(CONFIG.empRadius * 0.4, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    mesh.add(core);
    const start = player.obj.mesh.position;
    mesh.position.set(start.x + 0.3, start.y, 0);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture, color: EMP_HOLO, transparent: true, opacity: 0.6,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.setScalar(CONFIG.empRadius * 3.2);
    mesh.add(glow);

    // Crackling static: a small cloud of points jittering around the ball.
    const staticCount = 18;
    const positions = new Float32Array(staticCount * 3);
    const staticGeo = new THREE.BufferGeometry();
    staticGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const staticPoints = new THREE.Points(staticGeo, new THREE.PointsMaterial({
      color: 0xfff9c0, size: 0.05, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    mesh.add(staticPoints);

    scene.add(mesh);
    emps.push({ mesh, staticPoints, life: CONFIG.empLife, owner: player, age: 0, powerMul: powerMul || 1 });
    GAME.Audio.empLaunch();
  }

  function updateEmpStatic(e) {
    const pos = e.staticPoints.geometry.attributes.position;
    const r = CONFIG.empRadius * 1.3;
    for (let i = 0; i < pos.count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const rr = r * (0.7 + Math.random() * 0.4);
      pos.setXYZ(i, rr * Math.sin(phi) * Math.cos(theta), rr * Math.sin(phi) * Math.sin(theta), rr * Math.cos(phi) * 0.4);
    }
    pos.needsUpdate = true;
  }

  function detonateEmp(e) {
    const pos = e.mesh.position.clone();
    GAME.Effects.spark(pos, EMP_HOLO);
    GAME.Audio.empZap();
    scene.remove(e.mesh);

    // Expanding wireframe "lattice" sphere marking the blast, plus a ring
    // of short electric-arc lines flickering around its equator.
    const lattice = new THREE.Mesh(empLatticeGeo, new THREE.MeshBasicMaterial({
      color: EMP_HOLO, wireframe: true, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    lattice.position.copy(pos);
    lattice.scale.setScalar(0.01);
    scene.add(lattice);

    const arcLines = [];
    const arcGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    for (let i = 0; i < empArcCount; i++) {
      const line = new THREE.Line(arcGeo.clone(), new THREE.LineBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending,
      }));
      scene.add(line);
      arcLines.push({ line, angle: (i / empArcCount) * Math.PI * 2 });
    }

    empBlasts.push({ pos, lattice, arcLines, life: 1.0, maxLife: 1.0, maxRadius: CONFIG.empBlastRadius * e.powerMul });
  }

  function updateEmpBlasts(dt) {
    const EXPAND_FRACTION = 0.3; // reaches full radius in the first 30% of life, then holds
    for (let i = empBlasts.length - 1; i >= 0; i--) {
      const b = empBlasts[i];
      b.life -= dt;
      const overallT = 1 - Math.max(0, b.life) / b.maxLife;
      const growT = Math.min(1, overallT / EXPAND_FRACTION);
      const r = Math.max(0.01, growT * b.maxRadius);
      b.lattice.scale.setScalar(r);
      b.lattice.rotation.y += dt * 2;
      b.lattice.material.opacity = (1 - overallT) * 0.7;
      GAME.Enemies.stunAt(b.pos.x, b.pos.y, r);
      for (const a of b.arcLines) {
        const jitterAngle = a.angle + (Math.random() - 0.5) * 0.3;
        const p1 = new THREE.Vector3(b.pos.x + Math.cos(jitterAngle) * r * 0.9, b.pos.y + Math.sin(jitterAngle) * r * 0.9, 0);
        const p2 = new THREE.Vector3(b.pos.x + Math.cos(jitterAngle) * r * 1.08, b.pos.y + Math.sin(jitterAngle) * r * 1.08, 0);
        a.line.geometry.setFromPoints([p1, p2]);
        a.line.material.opacity = Math.random() * (1 - overallT) * 0.9;
      }
      if (b.life <= 0) {
        scene.remove(b.lattice);
        b.lattice.material.dispose();
        for (const a of b.arcLines) { scene.remove(a.line); a.line.geometry.dispose(); a.line.material.dispose(); }
        empBlasts.splice(i, 1);
      }
    }
  }

  function updateEmps(dt, bounds) {
    for (let i = emps.length - 1; i >= 0; i--) {
      const e = emps[i];
      e.age += dt; e.life -= dt;
      e.mesh.position.x += CONFIG.empSpeed * dt;
      e.mesh.rotation.z += 4 * dt;
      updateEmpStatic(e);
      const out = e.mesh.position.x > bounds.maxX + 3;
      const armed = e.age > 0.1;
      const hitSomething = armed && GAME.Enemies.hitTest(e.mesh.position.x, e.mesh.position.y, CONFIG.empRadius);
      if (e.life <= 0 || out || hitSomething) {
        detonateEmp(e);
        emps.splice(i, 1);
      }
    }
    updateEmpBlasts(dt);
  }

  // --- Mines ----------------------------------------------------------------
  let mines = [];
  let mineBlasts = [];
  const mineRingGeo = new THREE.RingGeometry(0.9, 1.0, 36);

  function spawnMineBlastRing(pos, maxRadius) {
    const ring = new THREE.Mesh(mineRingGeo, new THREE.MeshBasicMaterial({
      color: 0xffcf5f, transparent: true, opacity: 0.95, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    ring.position.copy(pos);
    ring.scale.setScalar(0.01);
    scene.add(ring);
    mineBlasts.push({ ring, life: 0.28, maxLife: 0.28, maxRadius });
  }

  function updateMineBlasts(dt) {
    for (let i = mineBlasts.length - 1; i >= 0; i--) {
      const b = mineBlasts[i];
      b.life -= dt;
      const t = 1 - Math.max(0, b.life) / b.maxLife;
      const r = Math.max(0.01, t * b.maxRadius);
      b.ring.scale.setScalar(r);
      b.ring.material.opacity = (1 - t) * 0.95;
      if (b.life <= 0) {
        scene.remove(b.ring);
        b.ring.material.dispose();
        mineBlasts.splice(i, 1);
      }
    }
  }

  function buildDeployedMine(color) {
    const metal = new THREE.MeshStandardMaterial({ color: 0x24262c, metalness: 0.6, roughness: 0.5 });
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), metal));
    const dirs = [
      [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
      [0.7, 0.7, 0], [-0.7, 0.7, 0], [0.7, -0.7, 0], [-0.7, -0.7, 0],
    ];
    for (const [dx, dy, dz] of dirs) {
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.2, 4), metal);
      s.position.set(dx * 0.18, dy * 0.18, dz * 0.18);
      s.lookAt(dx * 0.5, dy * 0.5, dz * 0.5);
      s.rotateX(Math.PI / 2);
      group.add(s);
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture, color, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.set(0.5, 0.5, 1);
    group.add(glow);
    return { group, glow };
  }

  function dropMine(player, powerMul) {
    const { group, glow } = buildDeployedMine(MINE_HOLO);
    group.position.copy(player.obj.mesh.position);
    scene.add(group);
    mines.push({ group, glow, armTimer: CONFIG.mineArmDelay, armed: false, life: 20, powerMul: powerMul || 1 });
  }

  function updateMines(dt) {
    for (let i = mines.length - 1; i >= 0; i--) {
      const m = mines[i];
      m.life -= dt;
      m.group.rotation.y += 0.6 * dt;
      const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.006);
      m.glow.material.opacity = m.armed ? pulse : 0.35;

      if (!m.armed) {
        m.armTimer -= dt;
        if (m.armTimer <= 0) { m.armed = true; GAME.Audio.mineArm(); }
      } else {
        const p = m.group.position;
        const triggerR = CONFIG.mineTriggerRadius * m.powerMul;
        const chainR = CONFIG.mineChainRadius * m.powerMul;
        if (GAME.Enemies.chainKill(p.x, p.y, triggerR, chainR)) {
          GAME.Effects.explode(p.clone(), MINE_HOLO, 1.2);
          GAME.Audio.explosion(true);
          GAME.Hazards.damageCircle(p.x, p.y, triggerR);
          spawnMineBlastRing(p.clone(), chainR);
          scene.remove(m.group);
          mines.splice(i, 1);
          continue;
        }
      }
      if (m.life <= 0) { scene.remove(m.group); mines.splice(i, 1); }
    }
    updateMineBlasts(dt);
  }

  // --- Reflector shield -------------------------------------------------------
  let shields = [];

  function buildShieldMesh() {
    // A solid glowing panel (rounded via a stretched capsule-ish shape),
    // not a shape surrounding the ship — it only guards the front.
    const geo = new THREE.CapsuleGeometry
      ? new THREE.CapsuleGeometry(0.16, CONFIG.shieldPanelHeight - 0.32, 4, 8)
      : new THREE.CylinderGeometry(0.16, 0.16, CONFIG.shieldPanelHeight, 10); // fallback for older three builds
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: SHIELD_HOLO, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture, color: SHIELD_HOLO, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.setScalar(CONFIG.shieldPanelHeight * 1.6);
    mesh.add(glow);
    return mesh;
  }

  function activateShield(player, powerMul) {
    player.shieldTimer = CONFIG.shieldDuration;
    GAME.Audio.shieldUp();
    const mesh = buildShieldMesh();
    mesh.scale.setScalar(powerMul || 1);
    scene.add(mesh);
    shields.push({ player, mesh, powerMul: powerMul || 1 });
  }

  function updateShields(dt) {
    for (let i = shields.length - 1; i >= 0; i--) {
      const s = shields[i];
      const p = s.player;
      if (p.shieldTimer <= 0 || p.state !== "ALIVE") {
        if (p.shieldTimer <= 0) GAME.Audio.shieldDown();
        scene.remove(s.mesh);
        s.mesh.material.dispose();
        shields.splice(i, 1);
        continue;
      }
      p.shieldTimer -= dt;
      const pp = p.obj.mesh.position;
      s.mesh.position.set(pp.x + CONFIG.shieldOffsetX, pp.y, 0.02);
      const flicker = 0.85 + 0.15 * Math.sin(p.shieldTimer * 14);
      const fadeIn = Math.min(1, (CONFIG.shieldDuration - p.shieldTimer) / 0.15);
      const fadeOut = Math.min(1, p.shieldTimer / 0.3);
      s.mesh.material.opacity = 0.85 * flicker * fadeIn * fadeOut;
    }
  }

  // --- Firing input + top-level update ---------------------------------------
  function consumeAmmo(player) {
    const slot = player.weapons[0];
    slot.ammo -= 1;
    if (slot.ammo <= 0) player.weapons.shift();
    GAME.Players.refreshChip(player);
  }

  function update(dt) {
    const bounds = GAME.getPlayBounds();
    updatePickups(dt, bounds);

    for (const p of GAME.Players.list()) {
      if (p.weapons.length > 1 && GAME.Input.isSwapPressedEdge(p.source)) {
        p.weapons.push(p.weapons.shift());
        GAME.Players.refreshChip(p);
      }
      // Always read the edge so it stays accurate, then decide whether to act.
      const pressed = GAME.Input.isSpecialPressedEdge(p.source);
      if (!pressed || p.state !== "ALIVE") continue;

      // An in-flight EMP always takes priority over the weapon slot check —
      // ammo is spent at launch, which can pop "emp" out of weapons[0]
      // before the detonate press happens, so this can't depend on that slot.
      const ownedEmp = emps.find((e) => e.owner === p);
      if (ownedEmp) {
        detonateEmp(ownedEmp);
        emps.splice(emps.indexOf(ownedEmp), 1);
        continue;
      }

      if (p.weapons.length === 0) continue;
      const powerMul = GAME.Formations.getPowerMultiplier(p.formation);
      const slot = p.weapons[0];
      if (slot.type === "laser") {
        if (!beams.some((b) => b.player === p)) { startBeam(p, powerMul); consumeAmmo(p); }
      } else if (slot.type === "nuke") {
        launchNuke(p, powerMul);
        consumeAmmo(p);
      } else if (slot.type === "teleport") {
        doTeleport(p, powerMul);
        consumeAmmo(p);
      } else if (slot.type === "emp") {
        launchEmp(p, powerMul);
        consumeAmmo(p);
      } else if (slot.type === "mine") {
        dropMine(p, powerMul);
        consumeAmmo(p);
      } else if (slot.type === "shield") {
        if (p.shieldTimer <= 0) {
          activateShield(p, powerMul);
          consumeAmmo(p);
        }
      }
    }

    updateBeams(dt, bounds);
    updateNukes(dt, bounds);
    updateShockwaves(dt);
    updateEmps(dt, bounds);
    updateMines(dt);
    updateShields(dt);
    updateTeleportTrails(dt);
    updateTeleportSwirls(dt);
  }

  function resetAll() {
    for (const pk of pickups) scene.remove(pk.root);
    for (const b of beams) removeBeam(b);
    for (const n of nukes) scene.remove(n.group);
    for (const s of shockwaves) { scene.remove(s.mesh); s.mesh.material.dispose(); }
    for (const e of emps) scene.remove(e.mesh);
    for (const b of empBlasts) {
      scene.remove(b.lattice); b.lattice.material.dispose();
      for (const a of b.arcLines) { scene.remove(a.line); a.line.geometry.dispose(); a.line.material.dispose(); }
    }
    for (const m of mines) scene.remove(m.group);
    for (const b of mineBlasts) { scene.remove(b.ring); b.ring.material.dispose(); }
    for (const s of shields) { scene.remove(s.mesh); s.mesh.material.dispose(); }
    for (const t of teleportTrails) for (const puff of t.puffs) { scene.remove(puff); puff.material.dispose(); }
    for (const s of teleportSwirls) {
      scene.remove(s.ringA, s.ringB);
      s.ringA.material.dispose(); s.ringB.material.dispose();
    }
    pickups = []; beams = []; nukes = []; shockwaves = [];
    emps = []; empBlasts = []; mines = []; mineBlasts = [];
    shields = []; teleportTrails = []; teleportSwirls = [];
    pickupTimer = THREE.MathUtils.randFloat(CONFIG.pickupSpawnMin, CONFIG.pickupSpawnMax);
  }

  GAME.Weapons = { update, resetAll };
})();
