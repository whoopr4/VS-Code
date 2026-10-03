// ===========================================================================
// AUDIO — every sound is synthesized on the fly with the Web Audio API, so
// there are no audio files to host. Browsers only allow audio after a user
// interaction, so the context is created/resumed on the first key press or
// gamepad button. Keep volumes low: shots fire a lot.
// ===========================================================================
(function () {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  const MASTER_VOLUME = 0.35;

  function ensureContext() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = MASTER_VOLUME;
      master.connect(ctx.destination);

      // One second of white noise, reused for explosions/impacts.
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume();
    return true;
  }

  // Unlock audio on the first real user interaction.
  const unlock = () => ensureContext();
  window.addEventListener("keydown", unlock);
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("gamepadconnected", unlock);

  // Sweeping tone with a fast decay envelope — the basis of the blaster sounds.
  function sweep(type, freqStart, freqEnd, duration, volume) {
    if (!ensureContext()) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function noise(duration, volume, filterFreq) {
    if (!ensureContext()) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(now);
    src.stop(now + duration + 0.02);
  }

  // Player: quick clean downward "pew". Slightly randomized so rapid fire
  // doesn't sound like one repeated sample.
  // Plasma-pistol style: a bubbly, warbling downward "bwoop" (triangle wave
  // with fast vibrato) plus a tiny crackle.
  function playerShot() {
    if (!ensureContext()) return;
    const now = ctx.currentTime;
    const jitter = 1 + (Math.random() - 0.5) * 0.1;
    const osc = ctx.createOscillator();
    const vib = ctx.createOscillator();
    const vibGain = ctx.createGain();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(760 * jitter, now);
    osc.frequency.exponentialRampToValueAtTime(240 * jitter, now + 0.16);
    vib.frequency.value = 55;
    vibGain.gain.value = 70;
    vib.connect(vibGain);
    vibGain.connect(osc.frequency);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now); vib.start(now);
    osc.stop(now + 0.19); vib.stop(now + 0.19);
    noise(0.04, 0.02, 5000);
  }

  function pickup() {
    sweep("sine", 660, 660, 0.09, 0.07);
    setTimeout(() => sweep("sine", 990, 990, 0.14, 0.07), 80);
  }

  function laserBeam(duration) {
    if (!ensureContext()) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(95, now);
    lfo.frequency.value = 18;
    lfoGain.gain.value = 25;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    filter.type = "lowpass";
    filter.frequency.value = 900;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.08);
    gain.gain.setValueAtTime(0.08, now + duration - 0.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(filter); filter.connect(gain); gain.connect(master);
    osc.start(now); lfo.start(now);
    osc.stop(now + duration + 0.02); lfo.stop(now + duration + 0.02);
  }

  function nukeLaunch() {
    noise(0.45, 0.1, 1400);
    sweep("sawtooth", 220, 60, 0.5, 0.06);
  }

  function teleport() {
    sweep("sine", 200, 1400, 0.28, 0.08);
    sweep("sine", 1400, 200, 0.32, 0.05);
  }

  function empLaunch() {
    sweep("square", 500, 900, 0.12, 0.05);
  }

  function empZap() {
    noise(0.2, 0.12, 4000);
    sweep("square", 1200, 200, 0.15, 0.06);
  }

  function mineArm() {
    sweep("sine", 500, 500, 0.07, 0.04);
    setTimeout(() => {
      sweep("square", 1800, 1800, 0.015, 0.05);
    }, 140);
  }

  function shieldUp() {
    sweep("sine", 300, 900, 0.35, 0.07);
  }

  function shieldDown() {
    sweep("sine", 900, 300, 0.25, 0.05);
  }

  // Enemy: lower, wobblier "alien" tone — sawtooth with a rising then
  // falling pitch, so it reads as clearly different from the player's shot.
  function enemyShot() {
    if (!ensureContext()) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.25);
    lfo.frequency.value = 28;
    lfoGain.gain.value = 40;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now); lfo.start(now);
    osc.stop(now + 0.27); lfo.stop(now + 0.27);
  }

  function impact() {
    sweep("triangle", 300, 90, 0.09, 0.09);
    noise(0.07, 0.05, 3000);
  }

  function explosion(big) {
    noise(big ? 0.7 : 0.4, big ? 0.28 : 0.18, big ? 2200 : 1600);
    sweep("sawtooth", big ? 140 : 180, 30, big ? 0.6 : 0.35, big ? 0.12 : 0.08);
  }

  GAME.Audio = { playerShot, enemyShot, impact, explosion, pickup, laserBeam, nukeLaunch, teleport, empLaunch, empZap, mineArm, shieldUp, shieldDown };
})();
