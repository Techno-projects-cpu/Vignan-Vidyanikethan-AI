/**
 * Voice: reading a question aloud, and hearing an answer instead of typing it.
 *
 * Two browser APIs, both free and both optional:
 *   - speech synthesis speaks text. On many phones the voices are local, so it
 *     keeps working in aeroplane mode; on a desktop it may need a download.
 *   - speech recognition turns a spoken answer into text. Chrome usually sends
 *     the audio to a server, so it needs a connection, and it is not available
 *     in every browser.
 *
 * Neither is allowed to break the app. Every function here fails quietly and
 * says why, because a student in a quiet classroom or an offline demo should
 * still be able to type the answer.
 *
 * The helpers are pure and take their browser objects as arguments, so the
 * whole file can be tested in Node with fakes. Nothing in here fetches or
 * stores anything itself.
 */

/** App language code to the tag a speech engine expects. */
const SPEECH_LANGUAGES = {
  en: "en-IN", hi: "hi-IN", bn: "bn-IN", mr: "mr-IN", te: "te-IN", ta: "ta-IN",
  gu: "gu-IN", kn: "kn-IN", ml: "ml-IN", pa: "pa-IN", or: "or-IN", as: "as-IN",
  ur: "ur-PK", ne: "ne-NP", ar: "ar-SA", fa: "fa-IR", fr: "fr-FR", de: "de-DE",
  es: "es-ES", pt: "pt-PT", it: "it-IT", nl: "nl-NL", pl: "pl-PL", ru: "ru-RU",
  uk: "uk-UA", tr: "tr-TR", zh: "zh-CN", ja: "ja-JP", ko: "ko-KR", id: "id-ID",
  vi: "vi-VN", th: "th-TH", sw: "sw-KE",
};

export function speechLanguage(code = "en") {
  const key = String(code || "en").toLowerCase().slice(0, 2);
  return SPEECH_LANGUAGES[key] || key || "en-IN";
}

/**
 * What should actually be spoken.
 *
 * An answer is Markdown with citations in it. Read literally, a screen reader
 * says "star star" and "bracket one", which is worse than useless out loud. This
 * strips the formatting and turns a page reference into words a person says.
 */
export function plainSpeech(text = "") {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, " ")                       // code blocks are not read aloud
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, "$1")           // links keep their label
    .replace(/\[W?\d+\]/g, " ")                            // citation markers
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|\s)[*_]([^*_]+)[*_](?=\s|$)/g, "$1$2")
    .replace(/^\s*[-*+]\s+/gm, "")                         // list bullets
    .replace(/^\s*#{1,6}\s*/gm, "")                        // headings
    .replace(/\bp\.\s?(\d+)/gi, "page $1")
    .replace(/\bpp\.\s?(\d+)/gi, "pages $1")
    .replace(/[“”"«»]/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, ", ")
    .replace(/\s*\n\s*/g, ". ")
    .replace(/\.{2,}/g, ".")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/([.!?])\s*\./g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s.,;:]+|[\s.,;:]+$/g, "")
    .trim();
}

/** The voice closest to what the student is reading: exact tag, then language. */
export function selectVoice(voices = [], language = "en-IN") {
  const list = (voices || []).filter((voice) => voice && voice.lang);
  if (!list.length) return null;
  const wanted = String(language || "").toLowerCase();
  const base = wanted.split("-")[0];
  return (
    list.find((voice) => String(voice.lang).toLowerCase() === wanted)
    || list.find((voice) => String(voice.lang).toLowerCase().replace("_", "-") === wanted)
    || list.find((voice) => String(voice.lang).toLowerCase().split("-")[0] === base)
    || list.find((voice) => voice.default)
    || list[0]
  );
}

/** What this browser can do, in words a student can act on. */
export function voiceSupport(env = {}) {
  const synth = env.speechSynthesis || globalThis.speechSynthesis;
  const Recognition = env.SpeechRecognition || env.webkitSpeechRecognition || globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  const speak = Boolean(synth && typeof synth.speak === "function");
  const listen = Boolean(Recognition);
  const online = env.online !== false;
  let reason = "";
  if (!speak && !listen) reason = "This browser has no speech support. Everything still works by typing.";
  else if (!listen) reason = "This browser cannot take spoken answers. You can still type them.";
  else if (!online) reason = "Listening needs a connection in most browsers. You can still type the answer.";
  return { speak, listen, online, reason, Recognition: listen ? Recognition : null, synth: speak ? synth : null };
}

/**
 * Speak one piece of text. Returns a small handle so the caller can stop it,
 * and never throws: a failed voice must not fail the lesson.
 */
export function speakText(text, { synth = null, voices = [], language = "en-IN", rate = 1, pitch = 1, onEnd = null } = {}) {
  const spoken = plainSpeech(text);
  const engine = synth || globalThis.speechSynthesis;
  if (!spoken) return { ok: false, spoken: "", reason: "empty" };
  if (!engine || typeof engine.speak !== "function" || typeof globalThis.SpeechSynthesisUtterance !== "function") {
    return { ok: false, spoken, reason: "unsupported" };
  }
  try {
    engine.cancel?.();
    const utterance = new globalThis.SpeechSynthesisUtterance(spoken.slice(0, 4000));
    const voice = selectVoice(voices, language);
    if (voice) utterance.voice = voice;
    utterance.lang = language;
    utterance.rate = rate;
    utterance.pitch = pitch;
    if (typeof onEnd === "function") {
      utterance.onend = () => onEnd({ ok: true });
      utterance.onerror = () => onEnd({ ok: false });
    }
    engine.speak(utterance);
    return { ok: true, spoken, cancel: () => engine.cancel?.() };
  } catch (error) {
    return { ok: false, spoken, reason: error?.message || "error" };
  }
}

export function stopSpeaking(synth = null) {
  const engine = synth || globalThis.speechSynthesis;
  try { engine?.cancel?.(); } catch { /* a missing engine is not an error */ }
}

/** The voices a browser has loaded, waiting briefly on the ones that arrive late. */
export function availableVoices(synth = null) {
  try { return (synth || globalThis.speechSynthesis)?.getVoices?.() || []; } catch { return []; }
}

/**
 * Listen for one answer.
 *
 * Resolves with `{ text, error }`. `error` is one of "unsupported", "denied",
 * "no-speech", "network" or "timeout", so the caller can say something true
 * instead of a generic failure.
 */
export function listenOnce({ recognition = null, language = "en-IN", timeoutMs = 15000, interim = true } = {}) {
  if (!recognition) return Promise.resolve({ text: "", error: "unsupported" });
  return new Promise((resolve) => {
    let settled = false;
    let timer = null;
    const finish = (text, error) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try { recognition.stop?.(); } catch { /* already stopped */ }
      resolve({ text: String(text || "").trim(), error: error || "" });
    };
    try {
      recognition.lang = language;
      recognition.interimResults = Boolean(interim);
      recognition.continuous = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        const result = event?.results?.[event.results.length - 1] || event?.results?.[0];
        const text = result?.[0]?.transcript || "";
        const isFinal = result?.isFinal !== false;
        if (text && isFinal) finish(text, "");
      };
      recognition.onerror = (event) => finish("", event?.error || "error");
      recognition.onend = () => {
        // Some engines end without a final result; whatever was heard is still useful.
        finish("", "no-speech");
      };
      timer = setTimeout(() => finish("", "timeout"), Math.max(3000, Number(timeoutMs) || 15000));
      recognition.start();
    } catch (error) {
      finish("", error?.name === "NotAllowedError" ? "denied" : "error");
    }
  });
}

/** The sentence shown when listening fails, in the student's own terms. */
export function listenMessage(error = "") {
  switch (String(error)) {
    case "denied": return "Microphone access was refused. Allow it in the browser or type the answer.";
    case "no-speech": return "I did not hear anything. Tap the microphone and speak a little closer.";
    case "network": return "Listening needs a connection in this browser. Type the answer instead.";
    case "timeout": return "That took too long, so I stopped listening. Try again or type the answer.";
    case "unsupported": return "This browser cannot take a spoken answer. Type it instead.";
    case "empty": return "I did not catch that. Try once more, or type it.";
    default: return "The microphone did not work. Type the answer instead.";
  }
}
