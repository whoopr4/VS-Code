// ===========================================================================
// MENU — the animated "Super Ship Shooters" title/start screen and the
// game-over screen. Doesn't own game state itself (main.js does that);
// just exposes show/hide and a "did someone press start" check.
// ===========================================================================
(function () {
  const menuEl = document.getElementById("menu-overlay");
  const gameOverEl = document.getElementById("gameover-overlay");

  function showMenu(show) { menuEl.classList.toggle("hidden", !show); }
  function showGameOver(show) { gameOverEl.classList.toggle("hidden", !show); }

  // Returns the source ("keyboard" or a gamepad index) that just pressed
  // start/continue this frame, or null. Checking every source once per
  // frame here is safe as long as nothing else reads the same edge this
  // same frame (Players.scanForJoins only runs during PLAYING).
  function checkStartPress() {
    if (GAME.Input.isJoinPressedEdge("keyboard")) return "keyboard";
    if (GAME.Input.isJoinPressedEdge("touch")) return "touch";
    for (const idx of GAME.Input.connectedGamepadIndices()) {
      if (GAME.Input.isJoinPressedEdge(idx)) return idx;
    }
    return null;
  }

  GAME.Menu = { showMenu, showGameOver, checkStartPress };
})();
