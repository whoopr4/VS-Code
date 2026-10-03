// ===========================================================================
// SHIP — a smooth lathed hull (rotationally-extruded profile) reads far
// more three-dimensional under lighting than flat boxes/cones did. Nose
// points toward +X (the direction the background scrolls away from).
// Swap buildShip() for a GLTFLoader call later if you want to import a
// modeled ship instead of this primitive-built one.
// ===========================================================================
(function () {
  function makeHullGeometry() {
    // Profile: (radius, position-along-axis) from tail to nose tip.
    const profile = [
      new THREE.Vector2(0.05, -0.50),
      new THREE.Vector2(0.17, -0.35),
      new THREE.Vector2(0.22, -0.10),
      new THREE.Vector2(0.20, 0.15),
      new THREE.Vector2(0.12, 0.35),
      new THREE.Vector2(0.00, 0.55),
    ];
    return new THREE.LatheGeometry(profile, 14);
  }

  function makeWingShape() {
    // Sharp swept delta wing: a single pointed apex at the tip instead of
    // a blunt edge, which is what read as "weird" before.
    const shape = new THREE.Shape();
    shape.moveTo(0.05, 0.15);
    shape.lineTo(-0.85, 0.55); // pointed tip
    shape.lineTo(-0.55, 0.42);
    shape.lineTo(-0.15, 0.16);
    shape.lineTo(0.05, 0.15);
    return shape;
  }

  function makeThruster(length, radius, color) {
    const geo = new THREE.ConeGeometry(radius, length, 10, 1, true);
    geo.translate(0, -length / 2, 0); // apex at origin, cone trails away from it
    geo.rotateZ(-Math.PI / 2);        // point along -X (backward, away from the nose)
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    return new THREE.Mesh(geo, mat);
  }

  function makeShipGlowTexture(colorHex) {
    const r = (colorHex >> 16) & 255, g = (colorHex >> 8) & 255, b = colorHex & 255;
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${r},${g},${b},0.45)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
  }

  function buildShip(color) {
    const group = new THREE.Group();

    // Soft glow behind the ship, tinted to the player's color, so the ship
    // stays easy to spot against a busy background.
    const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeShipGlowTexture(color), transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glowSprite.scale.set(2.6, 2.0, 1);
    glowSprite.position.set(-0.1, 0, -0.15);
    group.add(glowSprite);

    const hullMat = new THREE.MeshStandardMaterial({
      color, metalness: 0.55, roughness: 0.32, emissive: color, emissiveIntensity: 0.08,
    });
    const bellyMat = new THREE.MeshStandardMaterial({
      color: 0x11151f, metalness: 0.5, roughness: 0.5,
    });
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0xbdf3ff, metalness: 0.1, roughness: 0.12,
      emissive: 0x8fe8ff, emissiveIntensity: 0.85,
    });
    const wingMat = new THREE.MeshStandardMaterial({
      color, metalness: 0.6, roughness: 0.35, emissive: color, emissiveIntensity: 0.1,
      flatShading: true,
    });

    // Smooth rounded hull, laid along +X (rotation.z maps the lathe's local
    // +Y axis, its length axis, onto world +X).
    const hull = new THREE.Mesh(makeHullGeometry(), hullMat);
    hull.rotation.z = -Math.PI / 2;
    group.add(hull);

    // Dark flattened belly plate underneath for shading contrast/depth.
    const belly = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.05, 0.22), bellyMat);
    belly.position.set(-0.05, -0.14, 0);
    group.add(belly);

    // Low, integrated canopy (half-dome, flattened) instead of a ball on top.
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      canopyMat
    );
    canopy.position.set(0.08, 0.13, 0);
    canopy.scale.set(1.5, 0.4, 0.6);
    group.add(canopy);

    // Wings, mirrored top/bottom (screen-plane spread, not depth spread).
    const wingGeo = new THREE.ExtrudeGeometry(makeWingShape(), { depth: 0.05, bevelEnabled: false });
    wingGeo.translate(0, 0, -0.025);
    const wingTop = new THREE.Mesh(wingGeo, wingMat);
    const wingBottom = wingTop.clone();
    wingBottom.scale.y = -1;
    group.add(wingTop, wingBottom);

    // Thruster jets: one at the rear, one at each wing root. Scaled/faded
    // each frame by updateShipVisual() based on current speed.
    const rearJet = makeThruster(2.5, 0.45, 0xff9a4d);
    rearJet.position.set(-0.52, 0, 0);
    const wingJetTop = makeThruster(1.6, 0.275, 0x7fd0ff);
    wingJetTop.position.set(-0.28, 0.2, 0);
    const wingJetBottom = wingJetTop.clone();
    wingJetBottom.position.y = -0.2;
    group.add(rearJet, wingJetTop, wingJetBottom);

    group.scale.setScalar(GAME.CONFIG.shipVisualScale);

    return {
      mesh: group,
      glowSprite,
      materials: [hullMat, wingMat],
      thrusters: [rearJet, wingJetTop, wingJetBottom],
      baseThrusterScale: [
        rearJet.scale.clone(), wingJetTop.scale.clone(), wingJetBottom.scale.clone(),
      ],
    };
  }

  // Animates thruster length/opacity from 0 (idle) to 1 (full throttle),
  // plus a little flicker so it doesn't look static.
  function updateShipVisual(ship, throttle01, dt) {
    ship.flickerT = (ship.flickerT || 0) + dt * 14;
    const flicker = 0.9 + Math.sin(ship.flickerT) * 0.1;
    const targetLen = 0.3 + throttle01 * 1.1;
    for (let i = 0; i < ship.thrusters.length; i++) {
      const jet = ship.thrusters[i];
      const base = ship.baseThrusterScale[i];
      jet.scale.set(base.x * flicker, base.y * (targetLen) * flicker, base.z * flicker);
      jet.material.opacity = 0.35 + throttle01 * 0.5;
    }
  }

  GAME.buildShip = buildShip;
  GAME.updateShipVisual = updateShipVisual;
})();
