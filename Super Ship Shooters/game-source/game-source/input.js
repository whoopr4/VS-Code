// ===========================================================================
// INPUT — now generalized for multiple sources: "keyboard" and each
// connected gamepad by index. Movement/fire are read continuously; the
// join button is read as an edge (true only on the frame it's first
// pressed) so holding it doesn't join five times in a row.
// ===========================================================================
(function () {
  // Shared state written by mobile.js's on-screen joystick/buttons. Reading
  // "touch" as a source works the same way as "keyboard" or a gamepad index.
  GAME.TouchState = { x: 0, y: 0, fire: false, special: false, join: false, swap: false, connect: false };

  const keys = Object.create(null);
  window.addEventListener("keydown", (e) => {
    if (e.code === "AltLeft" || e.code === "AltRight") e.preventDefault(); // stop browser menu-focus
    keys[e.code] = true;
  });
  window.addEventListener("keyup", (e) => { keys[e.code] = false; });

  // Right mouse button (or E) = special weapon on keyboard.
  window.addEventListener("mousedown", (e) => { if (e.button === 2) keys["MouseRight"] = true; });
  window.addEventListener("mouseup", (e) => { if (e.button === 2) keys["MouseRight"] = false; });
  window.addEventListener("contextmenu", (e) => e.preventDefault());

  const gamepadStatusEl = document.getElementById("gamepad-status");
  function refreshGamepadStatus() {
    const pads = (navigator.getGamepads ? navigator.getGamepads() : []) || [];
    const count = Array.from(pads).filter(Boolean).length;
    if (count > 0) {
      gamepadStatusEl.textContent = count + " gamepad" + (count > 1 ? "s" : "") + " connected";
      gamepadStatusEl.classList.add("connected");
    } else {
      gamepadStatusEl.textContent = "No gamepad detected — keyboard: Enter to join";
      gamepadStatusEl.classList.remove("connected");
    }
  }
  window.addEventListener("gamepadconnected", refreshGamepadStatus);
  window.addEventListener("gamepaddisconnected", refreshGamepadStatus);
  refreshGamepadStatus();

  function connectedGamepadIndices() {
    const pads = (navigator.getGamepads ? navigator.getGamepads() : []) || [];
    const out = [];
    for (let i = 0; i < pads.length; i++) if (pads[i]) out.push(i);
    return out;
  }

  // source is either the string "keyboard" or a gamepad index (number)
  function getMovement(source) {
    let x = 0, y = 0;
    if (source === "keyboard") {
      // WASD only now — arrow keys are dedicated to steering the mini-nuke.
      if (keys["KeyA"]) x -= 1;
      if (keys["KeyD"]) x += 1;
      if (keys["KeyW"]) y += 1;
      if (keys["KeyS"]) y -= 1;
    } else if (source === "touch") {
      x = GAME.TouchState.x; y = GAME.TouchState.y;
    } else {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const pad = pads && pads[source];
      if (pad) {
        const deadzone = 0.15;
        const lx = pad.axes[0] || 0;
        const ly = pad.axes[1] || 0;
        if (Math.abs(lx) > deadzone) x = lx;
        if (Math.abs(ly) > deadzone) y = -ly;
      }
    }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }

  function isFireHeld(source) {
    if (source === "keyboard") return !!keys["Space"];
    if (source === "touch") return !!GAME.TouchState.fire;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && pads[source];
    if (!pad) return false;
    const rt = pad.buttons[7];
    return !!(rt && (rt.pressed || rt.value > 0.3));
  }

  function isJoinHeldRaw(source) {
    if (source === "keyboard") return !!keys["Enter"];
    if (source === "touch") return !!GAME.TouchState.join;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && pads[source];
    return !!(pad && pad.buttons[0] && pad.buttons[0].pressed);
  }

  const prevJoinState = Object.create(null);
  function isJoinPressedEdge(source) {
    const held = isJoinHeldRaw(source);
    const was = !!prevJoinState[source];
    prevJoinState[source] = held;
    return held && !was;
  }

  const prevKeyState = Object.create(null);
  function isKeyPressedEdge(code) {
    const held = !!keys[code];
    const was = !!prevKeyState[code];
    prevKeyState[code] = held;
    return held && !was;
  }

  // Steers the mini-nuke in flight: arrow keys on keyboard, right stick on
  // gamepad (keyboard has no analog stick, so this is just a fixed direction).
  function getAim(source) {
    if (source === "keyboard") {
      let x = 0, y = 0;
      if (keys["ArrowLeft"]) x -= 1;
      if (keys["ArrowRight"]) x += 1;
      if (keys["ArrowUp"]) y += 1;
      if (keys["ArrowDown"]) y -= 1;
      const len = Math.hypot(x, y);
      return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
    }
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && pads[source];
    if (!pad) return { x: 0, y: 0 };
    const dz = 0.25;
    const ax = pad.axes[2] || 0, ay = pad.axes[3] || 0;
    return { x: Math.abs(ax) > dz ? ax : 0, y: Math.abs(ay) > dz ? -ay : 0 };
  }

  function isSpecialHeldRaw(source) {
    if (source === "keyboard") return !!(keys["AltLeft"] || keys["AltRight"] || keys["MouseRight"]);
    if (source === "touch") return !!GAME.TouchState.special;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && pads[source];
    const lt = pad && pad.buttons[6]; // left trigger, standard mapping
    return !!(lt && (lt.pressed || lt.value > 0.4));
  }
  const prevSpecialState = Object.create(null);
  function isSpecialPressedEdge(source) {
    const held = isSpecialHeldRaw(source);
    const was = !!prevSpecialState[source];
    prevSpecialState[source] = held;
    return held && !was;
  }

  // Swap the two special-weapon slots. Keyboard: Q. Gamepad: X (button 2,
  // standard mapping) — this wasn't assigned in the original control list,
  // so it's my pick; easy to move if you'd rather use a different button.
  function isSwapHeldRaw(source) {
    if (source === "keyboard") return !!keys["KeyQ"];
    if (source === "touch") return !!GAME.TouchState.swap;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && pads[source];
    return !!(pad && pad.buttons[2] && pad.buttons[2].pressed);
  }
  const prevSwapState = Object.create(null);
  function isSwapPressedEdge(source) {
    const held = isSwapHeldRaw(source);
    const was = !!prevSwapState[source];
    prevSwapState[source] = held;
    return held && !was;
  }

  // Connect/disengage from another ship: E on keyboard (deliberately not
  // Enter/join), A on gamepad (same physical button as join — safe to
  // reuse since join is already consumed once a player has joined), and a
  // dedicated on-screen button on touch.
  function isConnectHeldRaw(source) {
    if (source === "keyboard") return !!keys["KeyE"];
    if (source === "touch") return !!GAME.TouchState.connect;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && pads[source];
    return !!(pad && pad.buttons[0] && pad.buttons[0].pressed);
  }
  const prevConnectState = Object.create(null);
  function isConnectPressedEdge(source) {
    const held = isConnectHeldRaw(source);
    const was = !!prevConnectState[source];
    prevConnectState[source] = held;
    return held && !was;
  }

  // Pause is global (any player can pause co-op play) — Escape on keyboard,
  // Start/Options (button 9, standard mapping) on any gamepad.
  let prevPauseHeld = false;
  function isPausePressedEdge() {
    let held = !!keys["Escape"];
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads || []) {
      if (pad && pad.buttons[9] && pad.buttons[9].pressed) held = true;
    }
    const edge = held && !prevPauseHeld;
    prevPauseHeld = held;
    return edge;
  }

  GAME.Input = {
    getMovement, isFireHeld, isJoinPressedEdge, connectedGamepadIndices, isKeyPressedEdge,
    getAim, isSpecialPressedEdge, isSwapPressedEdge, isConnectPressedEdge, isPausePressedEdge,
  };
})();
