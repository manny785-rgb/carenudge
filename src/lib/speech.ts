"use client";

export const LANGUAGES = [
  { name: "English", tag: "en-SG" },
  { name: "Chinese (Simplified)", tag: "zh-CN" },
  { name: "Malay", tag: "ms-MY" },
  { name: "Tamil", tag: "ta-IN" },
] as const;

let currentUtterance: SpeechSynthesisUtterance | null = null;

export function isPlaying() {
  return speechSynthesis?.speaking || false;
}

export function pauseSpeech() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (speechSynthesis.speaking && !speechSynthesis.paused) {
    speechSynthesis.pause();
  }
}

export function resumeSpeech() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (speechSynthesis.paused) {
    speechSynthesis.resume();
  }
}

export function stopSpeech() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  currentUtterance = null;
}

export function speak(text: string, languageName: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    alert("Read-aloud isn't supported in this browser.");
    return;
  }
  const tag = LANGUAGES.find((l) => l.name === languageName)?.tag ?? "en-SG";
  const u = new SpeechSynthesisUtterance(text);
  u.lang = tag;
  u.rate = 0.9;
  const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(tag.slice(0, 2)));
  if (voice) u.voice = voice;
  speechSynthesis.cancel();
  currentUtterance = u;
  speechSynthesis.speak(u);
}
