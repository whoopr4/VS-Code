// ===========================================================================
// MOBILE — on-screen joystick + buttons for touch devices. Only visible via
// the @media (pointer: coarse) rule in the CSS, but the wiring here is
// harmless either way. Everything just writes into GAME.TouchState, which
// input.js already reads as the "touch" source.
// ===========================================================================
(function () {
  const base = document.getElementById("touch-joystick-base");
  const nub = document.getElementById("touch-joystick-nub");
  const maxRadius = 46;
  let stickPointerId = null;
  let baseRect = null;

  function setStick(dx, dy) {
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);
    const nx = Math.cos(angle) * clamped;
    const ny = Math.sin(angle) * clamped;
    nub.style.transform = `translate(${nx}px, ${ny}px)`;
    GAME.TouchState.x = clamped > 4 ? Math.cos(angle) * (clamped / maxRadius) : 0;
    GAME.TouchState.y = clamped > 4 ? -Math.sin(angle) * (clamped / maxRadius) : 0;
  }

  base.addEventListener("pointerdown", (e) => {
    stickPointerId = e.pointerId;
    baseRect = base.getBoundingClientRect();
    base.setPointerCapture(e.pointerId);
    setStick(e.clientX - (baseRect.left + baseRect.width / 2), e.clientY - (baseRect.top + baseRect.height / 2));
  });
  base.addEventListener("pointermove", (e) => {
    if (e.pointerId !== stickPointerId || !baseRect) return;
    setStick(e.clientX - (baseRect.left + baseRect.width / 2), e.clientY - (baseRect.top + baseRect.height / 2));
  });
  function releaseStick(e) {
    if (e.pointerId !== stickPointerId) return;
    stickPointerId = null;
    nub.style.transform = "translate(0px, 0px)";
    GAME.TouchState.x = 0; GAME.TouchState.y = 0;
  }
  base.addEventListener("pointerup", releaseStick);
  base.addEventListener("pointercancel", releaseStick);

  function bindHoldButton(id, stateKey) {
    const el = document.getElementById(id);
    el.addEventListener("pointerdown", (e) => { e.preventDefault(); GAME.TouchState[stateKey] = true; });
    el.addEventListener("pointerup", () => { GAME.TouchState[stateKey] = false; });
    el.addEventListener("pointercancel", () => { GAME.TouchState[stateKey] = false; });
    el.addEventListener("pointerleave", () => { GAME.TouchState[stateKey] = false; });
  }
  bindHoldButton("touch-btn-fire", "fire");
  bindHoldButton("touch-btn-special", "special");

  // Swap/join are edge-triggered elsewhere, so a quick tap-pulse is enough.
  function bindTapButton(id, stateKey) {
    const el = document.getElementById(id);
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      GAME.TouchState[stateKey] = true;
      setTimeout(() => { GAME.TouchState[stateKey] = false; }, 80);
    });
  }
  bindTapButton("touch-btn-swap", "swap");
  bindTapButton("touch-btn-join", "join");
  bindTapButton("touch-btn-connect", "connect");
})();
