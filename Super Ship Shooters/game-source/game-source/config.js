// ===========================================================================
// CONFIG — every tunable number lives here. Edit this file alone for
// balance/feel changes; it doesn't need any other module.
// ===========================================================================
const GAME = {};

GAME.CONFIG = {
  // Ship
  shipColor: 0x5fd0ff,
  shipVisualScale: 0.44,     // was 0.33 — bumped up ~1/3
  shipEdgeMargin: 0.35,      // keeps the ship fully on-screen at play-area edges
  shipStartXFraction: 0.14,  // 0 = far left edge, 1 = far right edge

  // Plane-like movement: builds/loses speed instead of snapping to input.
  // Dialed 1/4 of the way back toward the laggier/more-realistic values
  // from before the big responsiveness pass, per feedback.
  shipAcceleration: 22.75,
  shipMaxSpeed: 5.5,
  shipDrag: 4.55,

  // Weapons — half speed, half fire rate from the previous pass so shots
  // are trackable and dodgeable.
  fireCooldown: 0.28,
  bulletSpeed: 17,
  bulletLife: 2.2,
  bulletNoseOffset: 0.22,    // matches the new smaller ship's nose position

  // Background
  starCount: 1400,
  starFieldWidth: 70,
  scrollSpeed: 10,
  nebulaCount: 5,
  galaxyCount: 3,

  maxHealth: 4,

  // Pass 2: multiplayer join / lives / respawn
  playerColors: [0x5fd0ff, 0xff6f6f, 0x7fff9e, 0xffd15f, 0xc98bff, 0xff9ecf, 0x6fe8ff, 0xffb37f],
  startingLives: 4,
  respawnBlinkDuration: 3.0,
  respawnBlinkInterval: 0.12,

  // Pass 3: enemies
  enemySmallSpeed: 4.5,
  enemyMediumSpeed: 3.2,
  enemyEngageSpeed: 5.5,
  enemySmallHealth: 1,
  enemyMediumHealth: 3,
  enemySmallScale: 0.6,
  enemyMediumScale: 1.1,
  enemySmallColor: 0xff4d4d,
  enemyMediumColor: 0xffa64d,
  enemySmallFireIntervalMin: 1.4,
  enemySmallFireIntervalMax: 2.6,
  enemyMediumFireInterval: 0.55,
  enemyBulletSpeed: 6,
  enemyBulletColor: 0xff2b2b,
  threatBandY: 1.6,
  mediumEngageDuration: 3.0,
  spawnIntervalSmall: 1.8,
  spawnIntervalMedium: 5.0,
  scoreSmall: 10,
  scoreMedium: 30,
  playerHitRadius: 0.16,
  enemyHitRadiusSmall: 0.22,
  enemyHitRadiusMedium: 0.4,

  // Pass 4: asteroid/debris hazards
  hazardFieldInterval: 6.0,      // seconds between spawning a new cluster
  hazardsPerField: 5,
  hazardFieldSpreadY: 2.2,       // how tall each cluster is
  hazardSpeed: 3.0,
  hazardRotSpeedMax: 1.5,
  hazardHitRadius: 0.4,
  hazardMinScale: 0.35,
  hazardMaxScale: 0.75,

  // Pass 6: damage model + special weapons
  pickupSpawnMin: 3.0,
  pickupSpawnMax: 5.0,
  pickupSpeed: 2.0,
  pickupCollectRadius: 0.6,
  pickupGrantFraction: 0.5,   // each pickup grants half of max ammo
  laserMaxAmmo: 4,
  nukeMaxAmmo: 4,
  laserDuration: 2.0,
  laserDps: 8,
  laserHalfHeight: 0.28,
  nukeSpeed: 7,
  nukeTurnRate: 3.2,
  nukeLife: 4.0,
  nukeDamage: 40,
  nukeBlastRadius: 2.4,

  // Teleport
  teleportMaxAmmo: 4,
  teleportRippleRadius: 0.95, // ~4 ship-lengths wide
  teleportXFraction: 0.1, // lands near the left edge, per the spec ("jumps far left")

  // EMP
  empMaxAmmo: 4,
  empSpeed: 8,
  empLife: 2.5,
  empRadius: 0.5,       // ~2x the player ship's length
  empBlastRadius: 3.2,  // ~14 ship-lengths wide (doubled per feedback)
  empStunDuration: 3.0,
  empHitsToStunSmall: 1,
  empHitsToStunMedium: 2,

  // Mines
  mineMaxAmmo: 4,
  mineArmDelay: 0.6,
  mineTriggerRadius: 1.0,
  mineChainRadius: 1.8,

  // Reflector shield
  shieldMaxAmmo: 4,
  shieldDuration: 3.0,
  shieldRadius: 0.5,       // reflect hit-test radius around the panel
  shieldOffsetX: 0.5,      // how far in front of the ship the panel sits
  shieldPanelHeight: 0.9,

  // Ship connection / formation mechanic
  connectRange: 1.3,                 // ~1 ship length — how close triggers the prompt
  shipStackSpacing: 0.58,            // vertical gap between stacked ship centers (roughly one ship-height, so they touch rather than overlap)
  formationSpeedPerExtraShip: 0.12,  // speed penalty per ship beyond the first
  formationMinSpeedMultiplier: 0.35, // floor, so a big formation is slow but never stuck
  formationPowerPerExtraShip: 0.15,  // weapon power bonus per ship beyond the first
  formationPowerMaxMultiplier: 2.0,
};

