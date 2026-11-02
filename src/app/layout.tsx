import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
import { SaveStatus } from "@/components/SaveStatus";
import { SessionProvider } from "@/components/Session";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

// A characterful heading font and a very readable body font.
const display = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
const body = Figtree({ variable: "--font-figtree", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CareNudge",
  description: "Explainable, guideline-based screening nudges that a doctor reviews.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: THEME_SCRIPT sets data-theme before React hydrates, on purpose.
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body suppressHydrationWarning className="flex min-h-full flex-col bg-page text-ink">
        <SessionProvider>
          <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
            <Nav />
          </header>
          <SaveStatus />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-28 sm:py-10 md:pb-10">{children}</main>
        </SessionProvider>
        <footer className="border-t border-line bg-surface px-4 py-4 pb-24 text-center text-xs text-muted md:pb-4">
          CareNudge does not diagnose and never gives an all-clear. A rules engine decides what is flagged; AI only
          structures text, rewrites wording and reads labels. Hackathon prototype — not a medical device.
        </footer>
      </body>
    </html>
  );
}
