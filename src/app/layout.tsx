import type { Metadata, Viewport } from "next";

/**
 * Fonts are self-hosted from npm rather than fetched from Google Fonts at
 * build time, so the build works behind an egress allow-list and the deployed
 * app makes no third-party font request. See docs/adr/0005-self-hosted-fonts.md.
 */
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";

import { themeBootstrapScript } from "@/components/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SupportFlow — customer support workspace",
    template: "%s · SupportFlow",
  },
  description:
    "A customer support and knowledge workspace built with Next.js Server Components, Server Actions and SQLite: ticket triage, optimistic updates with rollback, role-based permissions and an AI assistant that works without an API key. Portfolio project on seeded demo data.",
  applicationName: "SupportFlow",
  authors: [{ name: "Shubham Naik", url: "https://github.com/Shub808" }],
  creator: "Shubham Naik",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
