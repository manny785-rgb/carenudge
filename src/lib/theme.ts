// Theme handling shared by the layout (inline script) and the toggle. No dependency needed.
//
// The choice is "light", "dark" or "system" (follow the device). It is remembered in localStorage and
// applied to <html data-theme> by THEME_SCRIPT, which runs before the first paint so there is no
// flash of the wrong theme. The script and the layout's suppressHydrationWarning on <html> are the
// only places the server-rendered and client HTML are allowed to differ.

export type ThemeChoice = "light" | "dark" | "system";
export const THEME_KEY = "cn-theme";

/** Runs in <head> before paint. Kept tiny and defensive: storage can be blocked. */
export const THEME_SCRIPT = `(function(){try{var c=localStorage.getItem("${THEME_KEY}")||"system";var d=c==="dark"||(c==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){document.documentElement.dataset.theme="light";}})();`;

export function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

/** Resolve a choice to the theme actually shown, and put it on <html>. */
export function applyChoice(choice: ThemeChoice): void {
  const dark = choice === "dark" || (choice === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function saveChoice(choice: ThemeChoice): void {
  try {
    if (choice === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    /* the choice still applies for this visit */
  }
  applyChoice(choice);
}
