// ===========================================================================
// MAIN — game state machine (MENU / PLAYING / GAMEOVER) and the render
// loop. Movement/lives/respawn logic itself lives in players.js; this file
// just decides which state we're in and what runs each frame.
// ===========================================================================
(function () {
  GAME.prewarmBullets();

  const scoreValueEl = document.getElementById("score-value");
  let score = 0;
  function refreshScoreHUD() { scoreValueEl.textContent = String(score); }
  GAME.Score = {
    add(amount) { score += amount; refreshScoreHUD(); },
    reset() { score = 0; refreshScoreHUD(); },
  };

  let state = "MENU";
  let paused = false;
  const clock = new THREE.Clock();

  function quitToMenu() {
    GAME.Players.resetAll();
    GAME.Formations.resetAll();
    GAME.Enemies.resetAll();
    GAME.Hazards.resetAll();
    GAME.Weapons.resetAll();
    GAME.Effects.clear();
    paused = false;
    document.getElementById("pause-overlay").classList.add("hidden");
    state = "MENU";
  }

  const pauseOverlayEl = document.getElementById("pause-overlay");
  document.getElementById("btn-pause").addEventListener("click", () => {
    if (state === "PLAYING") paused = !paused;
  });
  document.getElementById("btn-resume").addEventListener("click", () => { paused = false; });
  document.getElementById("btn-quit").addEventListener("click", quitToMenu);

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    GAME.updateBackground(dt);
    GAME.Effects.update(dt);

    if (state === "PLAYING" && GAME.Input.isPausePressedEdge()) {
      paused = !paused;
    }
    pauseOverlayEl.classList.toggle("hidden", !(state === "PLAYING" && paused));

    if (state === "PLAYING" && paused) {
      GAME.renderer.render(GAME.scene, GAME.camera);
      return;
    }

    if (state === "MENU") {
      GAME.Menu.showMenu(true);
      GAME.Menu.showGameOver(false);
      const startSource = GAME.Menu.checkStartPress();
      if (startSource !== null) {
        GAME.Players.resetAll();
        GAME.Formations.resetAll();
        GAME.Enemies.resetAll();
        GAME.Hazards.resetAll();
        GAME.Weapons.resetAll();
        GAME.Effects.clear();
        GAME.Score.reset();
        GAME.Players.join(startSource);
        state = "PLAYING";
      }
    } else if (state === "PLAYING") {
      GAME.Menu.showMenu(false);
      GAME.Menu.showGameOver(false);
      GAME.Players.updateAll(dt);
      GAME.Formations.update(dt);
      GAME.updateBullets(dt);
      GAME.Weapons.update(dt);
      GAME.Enemies.updateAll(dt);
      GAME.Hazards.updateAll(dt);
      // TEMP DEBUG: press K to damage every active player by one life.
      // Remove once Pass 3/4 add real damage sources (enemies, asteroids).
      if (GAME.Input.isKeyPressedEdge("KeyK")) {
        for (const p of GAME.Players.list()) GAME.Players.takeDamage(p);
      }
      if (GAME.Players.allOut()) {
        state = "GAMEOVER";
      }
    } else if (state === "GAMEOVER") {
      GAME.Menu.showGameOver(true);
      // Literal "hit enter" from the spec — keyboard only for this one.
      if (GAME.Input.isJoinPressedEdge("keyboard")) {
        GAME.Players.resetAll();
        GAME.Formations.resetAll();
        GAME.Enemies.resetAll();
        GAME.Hazards.resetAll();
        GAME.Weapons.resetAll();
        GAME.Effects.clear();
        state = "MENU";
      }
    }

    GAME.renderer.render(GAME.scene, GAME.camera);
  }

  animate();
})();
