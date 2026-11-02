// Checks WCAG AA contrast (4.5:1 for text, 3:1 for UI) of every colour pairing the app uses, in BOTH
// themes, straight from src/styles/tokens.css. Usage: npm run check:contrast
import fs from "node:fs";

const css = fs.readFileSync("src/styles/tokens.css", "utf8");

/** Token values of one theme block, e.g. ":root[data-theme="dark"]". */
function theme(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("\n}", start));
  return Object.fromEntries([...body.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
}

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [text token, background token, minimum ratio]
const TEXT = 4.5, UI = 3;
const PAIRS: [string, string, number][] = [
  ...["page", "surface", "raised"].flatMap((bg): [string, string, number][] => [["ink", bg, TEXT], ["muted", bg, TEXT], ["faint", bg, TEXT], ["accent-text", bg, TEXT]]),
  ["ink", "accent-soft", TEXT], ["muted", "accent-soft", TEXT], ["accent-text", "accent-soft", TEXT],
  ["accent-ink", "accent", TEXT], ["accent-ink", "accent-strong", TEXT], ["accent-ink", "ok", TEXT], ["play-ink", "play", TEXT],
  ["ok", "ok-soft", TEXT], ["warn", "warn-soft", TEXT], ["bad", "bad-soft", TEXT], ["info", "info-soft", TEXT],
  ["ok", "surface", TEXT], ["warn", "surface", TEXT], ["bad", "surface", TEXT], ["info", "surface", TEXT],
  ["warn", "page", TEXT], ["bad", "raised", TEXT],
  ["urgent-ink", "urgent-bg", TEXT], ["ink", "play-soft", TEXT],
  ["focus", "surface", UI], ["focus", "page", UI], ["accent", "surface", UI], ["line-strong", "surface", 1.5],
];

let failed = 0;
for (const [name, selector] of [["light", ":root,\n:root[data-theme=\"light\"]"], ["dark", ":root[data-theme=\"dark\"]"]] as const) {
  const t = theme(selector);
  for (const [fg, bg, min] of PAIRS) {
    const r = ratio(t[fg], t[bg]);
    const ok = r >= min;
    if (!ok) failed++;
    if (!ok || process.env.VERBOSE) console.log(`${ok ? "PASS" : "FAIL"}  ${name}: ${fg} on ${bg} = ${r.toFixed(2)}:1 (needs ${min})`);
  }
}
console.log(failed ? `\n${failed} pairing(s) below AA` : "\nALL PAIRINGS PASS AA in light and dark");
process.exit(failed ? 1 : 0);
