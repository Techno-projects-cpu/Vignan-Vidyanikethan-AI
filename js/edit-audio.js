/**
 * A tiny, original synth beat for result edits. No music files, network
 * requests or third-party samples: Web Audio builds the whole track locally.
 * Create it directly in a click handler so mobile browsers can unlock audio.
 */

export function canCreateEditBeat() {
  return typeof (globalThis.AudioContext || globalThis.webkitAudioContext) === "function";
}

export function startEditBeat({ duration = 8000, record = false, defer = false } = {}) {
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (typeof AudioContextClass !== "function") return null;

  let context;
  try {
    context = new AudioContextClass();
    const destination = record ? context.createMediaStreamDestination() : context.destination;
    if (record && !destination.stream?.getAudioTracks?.().length) throw new Error("Audio recording is unavailable.");
    const master = context.createGain();
    master.gain.value = 0.3;
    master.connect(destination);

    // Call resume while the user's gesture is still active (important on iOS).
    const ready = context.state === "suspended" ? context.resume().then(() => context.state === "running") : Promise.resolve(context.state === "running");
    const seconds = Math.max(0.2, Math.min(Number(duration) || 8000, 30000) / 1000);
    const beat = 60 / 120;

    // A deterministic noise buffer is used for hats and snare. It never leaves
    // the device and avoids fetching any copyrighted audio or samples.
    const noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.18), context.sampleRate);
    const data = noise.getChannelData(0);
    let seed = 4173;
    for (let i = 0; i < data.length; i += 1) {
      seed = (seed * 16807) % 2147483647;
      data[i] = (seed / 2147483647) * 2 - 1;
    }

    function tone(when, frequency, length, volume, type = "triangle", dropTo = 0) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, when);
      if (dropTo) oscillator.frequency.exponentialRampToValueAtTime(dropTo, when + length);
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(volume, when + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(when);
      oscillator.stop(when + length + 0.01);
    }

    function percussion(when, length, volume, cutoff) {
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = noise;
      filter.type = "highpass";
      filter.frequency.value = cutoff;
      gain.gain.setValueAtTime(volume, when);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start(when);
      source.stop(when + length);
    }

    let closed = false;
    let scheduled = false;
    function start() {
      if (closed || scheduled) return;
      scheduled = true;
      const startAt = context.currentTime + 0.08;
      const bass = [65.41, 65.41, 77.78, 58.27, 65.41, 87.31, 77.78, 58.27];
      for (let step = 0; step * beat / 2 < seconds - 0.08; step += 1) {
        const at = startAt + step * beat / 2;
        const wholeBeat = step % 2 === 0;
        const count = Math.floor(step / 2);
        // Four-on-the-floor kick, off-beat snare and crisp eighth-note hats.
        if (wholeBeat) tone(at, 145, 0.14, 0.75, "sine", 48);
        if (wholeBeat && count % 2 === 1) percussion(at, 0.13, 0.22, 1500);
        percussion(at, 0.045, step % 2 ? 0.055 : 0.075, 6500);
        if (step % 2 === 0 || step % 8 === 7) {
          tone(at + 0.015, bass[count % bass.length], 0.19, 0.20, "triangle");
        }
        // Short, syncopated synth accents give the loop a playful funk feel.
        if (step % 4 === 3) tone(at, bass[count % bass.length] * 4, 0.12, 0.07, "square");
      }
    }
    if (!defer) start();
    return {
      stream: record ? destination.stream : null,
      ready,
      start,
      stop() {
        if (closed) return;
        closed = true;
        try { master.disconnect(); } catch { /* already disconnected */ }
        try { destination.stream?.getTracks().forEach((track) => track.stop()); } catch { /* optional */ }
        try { Promise.resolve(context.close()).catch(() => {}); } catch { /* already closed */ }
      },
    };
  } catch {
    try { Promise.resolve(context?.close()).catch(() => {}); } catch { /* optional */ }
    return null;
  }
}
