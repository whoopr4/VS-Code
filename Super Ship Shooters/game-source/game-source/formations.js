// ===========================================================================
// FORMATIONS — the ship-connection mechanic. A "formation" is a small
// object shared by reference across every member: { members: [...bottom
// to top], pilot: <player> }. A solo player is just a formation of one,
// which keeps all the code below uniform (no separate solo-case branches).
//
// Scope for this pass (agreed with the user): vertical stacking only, one
// player can only connect to another when they're currently solo (no
// merging two multi-ship stacks together), and only the pilot's input
// drives movement — passengers ride along at a fixed offset.
// ===========================================================================
(function () {
  const CONFIG = GAME.CONFIG;

  function soloFormation(player) {
    return { members: [player], pilot: player };
  }
  GAME.Formations_soloFormation = soloFormation; // used by players.js at create/respawn time

  function recomputeOffsets(formation) {
    const pilotIdx = formation.members.indexOf(formation.pilot);
    formation.members.forEach((m, i) => {
      m.stackOffset = (i - pilotIdx) * CONFIG.shipStackSpacing;
    });
  }

  // --- Query helpers used by players.js / weapons.js --------------------------
  function isFreeAimGunner(player) {
    const f = player.formation;
    if (f.members.length < 3) return false;
    return player === f.members[0] || player === f.members[f.members.length - 1];
  }

  function getSpeedMultiplier(formation) {
    const extra = formation.members.length - 1;
    return Math.max(CONFIG.formationMinSpeedMultiplier, 1 - extra * CONFIG.formationSpeedPerExtraShip);
  }

  function getPowerMultiplier(formation) {
    const extra = formation.members.length - 1;
    return Math.min(CONFIG.formationPowerMaxMultiplier, 1 + extra * CONFIG.formationPowerPerExtraShip);
  }

  // --- Splitting (shared by voluntary disengage and death) --------------------
  function finalizeGroup(group, originalPilot, breakEndIsLast) {
    if (group.length === 0) return;
    if (group.length === 1) {
      group[0].formation = soloFormation(group[0]);
      group[0].stackOffset = 0;
      return;
    }
    const newFormation = { members: group, pilot: null };
    newFormation.pilot = group.includes(originalPilot)
      ? originalPilot
      : (breakEndIsLast ? group[group.length - 1] : group[0]);
    for (const m of group) m.formation = newFormation;
    recomputeOffsets(newFormation);
  }

  function splitFormationAt(formation, idx) {
    const removed = formation.members[idx];
    const below = formation.members.slice(0, idx);
    const above = formation.members.slice(idx + 1);
    removed.formation = soloFormation(removed);
    removed.stackOffset = 0;

    // The half that broke off (doesn't contain the original pilot) promotes
    // whichever ship is now at the break point to pilot.
    finalizeGroup(below, formation.pilot, true);   // break point is "below"'s top end
    finalizeGroup(above, formation.pilot, false);  // break point is "above"'s bottom end

    GAME.Effects.spark(removed.obj.mesh.position.clone(), 0xffffff);
  }

  function handleDeath(player) {
    const f = player.formation;
    if (f.members.length <= 1) return;
    splitFormationAt(f, f.members.indexOf(player));
  }

  function disengage(player) {
    const f = player.formation;
    if (f.members.length <= 1) return; // already solo, nothing to leave
    splitFormationAt(f, f.members.indexOf(player));
    GAME.Audio.impact();
  }

  function connect(joiner, targetFormation, attachEnd) {
    joiner.formation = targetFormation;
    if (attachEnd === "top") targetFormation.members.push(joiner);
    else targetFormation.members.unshift(joiner);
    recomputeOffsets(targetFormation);
    GAME.Effects.spark(joiner.obj.mesh.position.clone(), 0xffffff);
    GAME.Audio.pickup();
  }

  // --- Connect prompts ----------------------------------------------------
  const promptEls = new Map();
  function promptFor(player) {
    let el = promptEls.get(player.id);
    if (!el) {
      el = document.createElement("div");
      el.className = "connect-prompt";
      document.getElementById("connect-prompts").appendChild(el);
      promptEls.set(player.id, el);
    }
    return el;
  }
  function hideAllPrompts() {
    for (const el of promptEls.values()) el.style.display = "none";
  }
  function connectLabelFor(source) {
    if (source === "keyboard") return "Connect [E]";
    if (source === "touch") return "Connect [LINK]";
    return "Connect [A]";
  }

  function findConnectTarget(solo, allFormations) {
    let best = null, bestDist = CONFIG.connectRange;
    const pp = solo.obj.mesh.position;
    for (const f of allFormations) {
      if (f === solo.formation) continue;
      for (const m of f.members) {
        const d = Math.hypot(pp.x - m.obj.mesh.position.x, pp.y - m.obj.mesh.position.y);
        if (d < bestDist) {
          bestDist = d;
          best = { formation: f, nearMember: m };
        }
      }
    }
    if (!best) return null;
    const attachEnd = pp.y > best.nearMember.obj.mesh.position.y ? "top" : "bottom";
    return { formation: best.formation, attachEnd };
  }

  // --- Top-level update, called once per frame from main.js -------------------
  function update(dt) {
    const players = GAME.Players.list();
    const formations = new Set(players.map((p) => p.formation));

    hideAllPrompts();

    for (const p of players) {
      if (p.state !== "ALIVE") continue;

      if (p.formation.members.length === 1) {
        // Solo: look for someone to connect to.
        const target = findConnectTarget(p, formations);
        if (target) {
          const el = promptFor(p);
          el.textContent = connectLabelFor(p.source);
          el.style.display = "block";
          const screen = p.obj.mesh.position.clone().project(GAME.camera);
          el.style.left = ((screen.x * 0.5 + 0.5) * window.innerWidth) + "px";
          el.style.top = ((1 - (screen.y * 0.5 + 0.5)) * window.innerHeight - 28) + "px";

          if (GAME.Input.isConnectPressedEdge(p.source)) {
            connect(p, target.formation, target.attachEnd);
          }
        }
      } else if (GAME.Input.isConnectPressedEdge(p.source) && p.formation.pilot !== p) {
        // Any passenger can disengage with their own connect button.
        disengage(p);
      }
    }

    // Passengers ride along at a fixed offset from their pilot, synced after
    // every player has had a chance to move this frame.
    for (const f of formations) {
      if (f.members.length <= 1) continue;
      const pilot = f.pilot;
      for (const m of f.members) {
        if (m === pilot) continue;
        m.obj.mesh.position.set(pilot.obj.mesh.position.x, pilot.obj.mesh.position.y + m.stackOffset, 0);
        m.obj.mesh.rotation.z = pilot.obj.mesh.rotation.z;
        m.obj.mesh.rotation.y = pilot.obj.mesh.rotation.y;
        m.velocity.copy(pilot.velocity);
      }
    }
  }

  function resetAll() {
    hideAllPrompts();
  }

  GAME.Formations = {
    update, resetAll, handleDeath, isFreeAimGunner, getSpeedMultiplier, getPowerMultiplier,
  };
})();
