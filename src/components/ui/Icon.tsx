import type { ReactNode } from "react";

// One consistent line-icon set (24px grid, 2px round strokes, drawn in the style of Lucide, which is
// ISC licensed) so the app needs no icon dependency and no emoji. Icons inherit the text colour.

const PATHS = {
  home: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h5v-6h4v6h5V10" /></>,
  clipboard: <><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4h6v3H9zM9 12h6M9 16h4" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  alert: <><path d="M12 4 2.5 20h19L12 4z" /><path d="M12 10v4M12 17.5v.01" /></>,
  file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>,
  tag: <><path d="M3 12V4h8l10 10-8 8L3 12z" /><path d="M7.5 8.5v.01" /></>,
  clinic: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M12 8v6M9 11h6M10 21v-3h4v3" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  stethoscope: <><path d="M6 3v6a4 4 0 0 0 8 0V3" /><path d="M10 13v2a5 5 0 0 0 10 0v-2" /><circle cx="20" cy="11" r="2" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></>,
  chart: <><path d="M4 20V4M4 20h16" /><path d="M8 16v-5M12 16V7M16 16v-8" /></>,
  list: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3.5 6v.01M3.5 12v.01M3.5 18v.01" /></>,
  pin: <><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  camera: <><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  volume: <><path d="M4 10v4h4l5 4V6L8 10H4z" /><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11" /></>,
  pause: <path d="M8 5v14M16 5v14" />,
  play: <path d="M7 4.5v15l12-7.5-12-7.5z" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="1.5" />,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  heart: <path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z" />,
  download: <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17v.01" /></>,
  siren: <path d="M7 18v-6a5 5 0 0 1 10 0v6M5 21h14M12 3v2M4.5 6.5 6 8M19.5 6.5 18 8" />,
  external: <path d="M14 4h6v6M20 4 10 14M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
  loader: <path d="M12 3a9 9 0 1 0 9 9" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />,
  monitor: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  logout: <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M16 8l4 4-4 4M20 12H9" />,
  switch: <path d="M17 3l4 4-4 4M3 11V9a2 2 0 0 1 2-2h16M7 21l-4-4 4-4M21 13v2a2 2 0 0 1-2 2H3" />,
  more: <path d="M5 12v.01M12 12v.01M19 12v.01" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

/** A decorative line icon. Put the meaning in nearby text or an aria-label on the button, not on the icon. */
export function Icon({ name, className = "h-5 w-5", strokeWidth = 2 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
