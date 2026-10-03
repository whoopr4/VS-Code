// ===========================================================================
// PLAYERS — one entry per joined player (keyboard counts as one source,
// each gamepad index another). Handles join, momentum movement/fire, the
// damage model, lives, special-weapon slots, and the respawn sequence.
//
// Damage model:
//  - 4 HP bars. An enemy bullet takes 1 bar (takeDamage).
//  - At 0 bars the ship is "critical" (blinks red); ANY further hit destroys it.
//  - Ramming an object (asteroid / enemy ship) drops you straight to 0 bars
//    (crash); if already critical, it destroys you.
//  - Destroyed = lose a life; press a button to respawn (blink + ripple ~3s,
//    invulnerable during that window). HP refills on respawn.
// ===========================================================================
(function () {
  const CONFIG = GAME.CONFIG;
  const SPAWN_Y_OFFSETS = [0, 1.4, -1.4, 2.8, -2.8, 4.2, -4.2, 5.6];
  const WEAPON_LABELS = { laser: "LASER", nuke: "NUKE", teleport: "TELE", emp: "EMP", mine: "MINE", shield: "SHLD" };

  function makeRingTexture() {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = "rgba(255,255,255,1)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 6, 0, Math.PI * 2);
    ctx.stroke();
    return new THREE.CanvasTexture(canvas);
  }
  const ringTexture = makeRingTexture();

  let players = [];
  let joinedSources = new Set();

  function playerBarEl() { return document.getElementById("player-bar"); }

  function refreshChip(player) {
    let chip = document.getElementById("chip-" + player.id);
    if (!chip) {
      chip = document.createElement("div");
      chip.id = "chip-" + player.id;
      chip.className = "player-chip";
      chip.innerHTML =
        '<div class="chip-swatch"></div><div class="chip-label"></div>' +
        '<div class="chip-lives"></div><div class="chip-bars"></div><div class="chip-weapons"></div>';
      const bars = chip.querySelector(".chip-bars");
      for (let i = 0; i < CONFIG.maxHealth; i++) {
        const seg = document.createElement("div");
        seg.className = "chip-seg";
        bars.appendChild(seg);
      }
      playerBarEl().appendChild(chip);
    }
    const colorCss = "#" + player.color.toString(16).padStart(6, "0");
    chip.querySelector(".chip-swatch").style.background = colorCss;
    chip.querySelector(".chip-label").textContent = "P" + player.id;
    chip.querySelector(".chip-lives").textContent = "×" + Math.max(0, player.lives);
    chip.querySelectorAll(".chip-seg").forEach((seg, i) => {
      seg.style.background = i < player.hp ? colorCss : "rgba(255,255,255,0.12)";
      seg.classList.toggle("seg-critical", !!player.critical); // all bars pulse red at 0 HP
    });
    chip.querySelector(".chip-weapons").innerHTML = player.weapons
      .map((w, i) => '<span class="' + (i === 0 ? "w-active" : "") + '">' + WEAPON_LABELS[w.type] + " ×" + w.ammo + "</span>")
      .join("");
    chip.classList.toggle("chip-out", player.state === "OUT");
    chip.classList.toggle("chip-critical", !!player.critical);
  }

  function spawnAt(player) {
    const bounds = GAME.getPlayBounds();
    player.obj.mesh.position.set(
      THREE.MathUtils.lerp(bounds.minX, bounds.maxX, CONFIG.shipStartXFraction),
      SPAWN_Y_OFFSETS[(player.id - 1) % SPAWN_Y_OFFSETS.length],
      0
    );
    player.velocity.set(0, 0);
  }

  function createPlayer(source) {
    const id = players.length + 1;
    const color = CONFIG.playerColors[(id - 1) % CONFIG.playerColors.length];
    const obj = GAME.buildShip(color);
    GAME.scene.add(obj.mesh);

    const ringMat = new THREE.SpriteMaterial({
      map: ringTexture, color, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const ring = new THREE.Sprite(ringMat);
    ring.scale.set(0.1, 0.1, 1);
    GAME.scene.add(ring);

    const player = {
      id, source, color, obj, ring,
      velocity: new THREE.Vector2(0, 0),
      lives: CONFIG.startingLives,
      hp: CONFIG.maxHealth,
      weapons: [], // special weapon slots: [{ type, ammo }], max 2
      shieldTimer: 0,
      fireTimer: 0,
      formation: null, // set to a solo formation just below
      stackOffset: 0,
      state: "ALIVE",
      critical: false,
      respawnTimer: 0,
      blinkTimer: 0,
    };
    spawnAt(player);
    player.formation = GAME.Formations_soloFormation(player);
    players.push(player);
    joinedSources.add(source);
    refreshChip(player);
    return player;
  }

  function join(source) {
    if (!joinedSources.has(source)) createPlayer(source);
  }

  function scanForJoins() {
    if (GAME.Input.isJoinPressedEdge("keyboard") && !joinedSources.has("keyboard")) join("keyboard");
    if (GAME.Input.isJoinPressedEdge("touch") && !joinedSources.has("touch")) join("touch");
    for (const idx of GAME.Input.connectedGamepadIndices()) {
      if (GAME.Input.isJoinPressedEdge(idx) && !joinedSources.has(idx)) join(idx);
    }
  }

  const CRIT_RED = new THREE.Color(0xff2222);
  const tintTmp = new THREE.Color();

  function resetShipTint(player) {
    for (const m of player.obj.materials) {
      m.emissive.setHex(player.color);
      m.emissiveIntensity = 0.1;
    }
  }

  // While critical, pulse the hull/wings between the player's color and red.
  function applyCriticalBlink(player, dt) {
    player.critClock = (player.critClock || 0) + dt * 9;
    const pulse = (Math.sin(player.critClock) + 1) / 2;
    tintTmp.setHex(player.color).lerp(CRIT_RED, 0.35 + 0.65 * pulse);
    for (const m of player.obj.materials) {
      m.emissive.copy(tintTmp);
      m.emissiveIntensity = 0.15 + pulse * 0.6;
    }
    // Steady pulsing ring, reusing the respawn-ripple sprite — far easier to
    // spot than the hull tint alone, especially in a crowded formation.
    if (player.state === "ALIVE") {
      player.ring.position.copy(player.obj.mesh.position);
      player.ring.material.color.setHex(0xff2222);
      player.ring.scale.setScalar(0.55 + pulse * 0.35);
      player.ring.material.opacity = 0.55 + pulse * 0.4;
    }
  }

  function setCritical(player) {
    player.hp = 0;
    player.critical = true;
    player.obj.glowSprite.material.color.setHex(0xff2222);
  }

  // Ship destroyed: lose a life.
  function destroyShip(player) {
    try {
      GAME.Formations.handleDeath(player);
    } catch (err) {
      console.error("Formation split failed on death — forcing solo as a fallback:", err);
      player.formation = GAME.Formations_soloFormation(player);
      player.stackOffset = 0;
    }
    const pos = player.obj.mesh.position.clone();
    player.critical = false;
    player.hp = 0;
    player.shieldTimer = 0;
    player.obj.glowSprite.material.color.setHex(0xffffff);
    resetShipTint(player);
    player.lives -= 1;
    player.obj.mesh.visible = false;
    GAME.Effects.explode(pos, player.color, 1.3);
    GAME.Audio.explosion(true);
    player.state = player.lives <= 0 ? "OUT" : "WAITING_RESPAWN";
  }

  // Enemy bullet (or anything light): 1 HP bar.
  function takeDamage(player, amount) {
    if (player.state !== "ALIVE") return; // respawning/out players are invulnerable
    if (player.hp <= 0) {
      destroyShip(player);
    } else {
      player.hp = Math.max(0, player.hp - (amount || 1));
      GAME.Effects.spark(player.obj.mesh.position.clone(), 0xff8a5f);
      GAME.Audio.impact();
      if (player.hp <= 0) setCritical(player);
    }
    refreshChip(player);
  }

  // Ramming an object: straight to 0 bars, or destroyed if already critical.
  function crash(player) {
    if (player.state !== "ALIVE") return;
    if (player.hp <= 0) {
      destroyShip(player);
    } else {
      setCritical(player);
      GAME.Effects.explode(player.obj.mesh.position.clone(), 0xff9a4d, 0.7);
      GAME.Audio.explosion(false);
    }
    refreshChip(player);
  }

  function updatePlayer(player, dt, bounds) {
    if (player.state === "OUT") return;

    if (player.state === "WAITING_RESPAWN") {
      const pressed = GAME.Input.isFireHeld(player.source) || GAME.Input.isJoinPressedEdge(player.source);
      if (pressed) {
        spawnAt(player);
        player.obj.mesh.visible = true;
        player.critical = false;
        player.hp = CONFIG.maxHealth;
        player.obj.glowSprite.material.color.setHex(0xffffff);
        resetShipTint(player);
        player.ring.material.color.setHex(player.color);
        player.formation = GAME.Formations_soloFormation(player);
        player.state = "RESPAWNING";
        player.respawnTimer = CONFIG.respawnBlinkDuration;
        player.blinkTimer = 0;
        refreshChip(player);
      }
      return;
    }

    // ALIVE and RESPAWNING both fly normally; RESPAWNING adds blink+ripple.
    const isPassenger = player.formation.pilot !== player;
    const mesh = player.obj.mesh;
    let speed = player.velocity.length();

    if (!isPassenger) {
      // Pilot (or solo) — reads their own input. Formation.update() will
      // carry passengers along at their stacked offset after this runs.
      const speedMul = GAME.Formations.getSpeedMultiplier(player.formation);
      const input = GAME.Input.getMovement(player.source);
      player.velocity.x += input.x * CONFIG.shipAcceleration * speedMul * dt;
      player.velocity.y += input.y * CONFIG.shipAcceleration * speedMul * dt;
      player.velocity.multiplyScalar(Math.max(0, 1 - CONFIG.shipDrag * dt));
      speed = player.velocity.length();
      const maxSpeed = CONFIG.shipMaxSpeed * speedMul;
      if (speed > maxSpeed) { player.velocity.multiplyScalar(maxSpeed / speed); speed = maxSpeed; }

      mesh.position.x += player.velocity.x * dt;
      mesh.position.y += player.velocity.y * dt;
      if (mesh.position.x < bounds.minX) { mesh.position.x = bounds.minX; player.velocity.x = 0; }
      if (mesh.position.x > bounds.maxX) { mesh.position.x = bounds.maxX; player.velocity.x = 0; }
      if (mesh.position.y < bounds.minY) { mesh.position.y = bounds.minY; player.velocity.y = 0; }
      if (mesh.position.y > bounds.maxY) { mesh.position.y = bounds.maxY; player.velocity.y = 0; }

      const bank = THREE.MathUtils.clamp(player.velocity.y * 0.06, -0.5, 0.5);
      const yaw = THREE.MathUtils.clamp(-player.velocity.x * 0.05, -0.35, 0.35);
      mesh.rotation.z = THREE.MathUtils.lerp(mesh.rotation.z, bank, 0.12);
      mesh.rotation.y = THREE.MathUtils.lerp(mesh.rotation.y, yaw, 0.12);
    }
    // Passengers: position/rotation are set by Formations.update() after every
    // player has moved this frame; thruster visuals still track current speed.
    GAME.updateShipVisual(player.obj, Math.min(1, speed / CONFIG.shipMaxSpeed), dt);
    if (player.critical) applyCriticalBlink(player, dt);

    player.fireTimer -= dt;
    if (GAME.Input.isFireHeld(player.source) && player.fireTimer <= 0 && player.state === "ALIVE") {
      const powerMul = GAME.Formations.getPowerMultiplier(player.formation);
      let dx = 1, dy = 0;
      if (GAME.Formations.isFreeAimGunner(player)) {
        const aim = GAME.Input.getAim(player.source);
        if (Math.hypot(aim.x, aim.y) > 0.3) { dx = aim.x; dy = aim.y; }
      }
      GAME.fireBullet(mesh.position.x, mesh.position.y, player.color, dx, dy);
      GAME.Audio.playerShot();
      player.fireTimer = CONFIG.fireCooldown / powerMul;
    }

    if (player.state === "RESPAWNING") {
      player.respawnTimer -= dt;
      player.blinkTimer -= dt;
      if (player.blinkTimer <= 0) {
        mesh.visible = !mesh.visible;
        player.blinkTimer = CONFIG.respawnBlinkInterval;
      }
      const progress = 1 - Math.max(0, player.respawnTimer) / CONFIG.respawnBlinkDuration;
      player.ring.position.copy(mesh.position);
      player.ring.scale.setScalar(0.2 + progress * 2.2);
      player.ring.material.opacity = (1 - progress) * 0.8;
      if (player.respawnTimer <= 0) {
        player.state = "ALIVE";
        mesh.visible = true;
        player.ring.material.opacity = 0;
      }
    }
  }

  function updateAll(dt) {
    const bounds = GAME.getPlayBounds();
    scanForJoins();
    for (const p of players) updatePlayer(p, dt, bounds);
  }

  function allOut() {
    return players.length > 0 && players.every((p) => p.state === "OUT");
  }

  function resetAll() {
    for (const p of players) {
      GAME.scene.remove(p.obj.mesh);
      GAME.scene.remove(p.ring);
      const chip = document.getElementById("chip-" + p.id);
      if (chip) chip.remove();
    }
    players = [];
    joinedSources = new Set();
  }

  GAME.Players = {
    updateAll, allOut, resetAll, takeDamage, crash, join, refreshChip,
    list: () => players,
  };
})();
