import type { Metadata, Viewport } from "next";
// Oeffentliche Flaechen (Landingpage, Anmeldung, Ladenseite) behalten Figtree
// und Roboto Condensed. Der Betriebsbereich laeuft auf IBM Plex Sans; die
// Umschaltung passiert ueber --body/--display in globals.css.
import "@fontsource-variable/figtree";
import "@fontsource-variable/roboto-condensed";
import "@fontsource-variable/ibm-plex-sans";
import "@fontsource/ibm-plex-sans-condensed/500.css";
import "@fontsource/ibm-plex-sans-condensed/600.css";
import "@fontsource/ibm-plex-sans-condensed/700.css";
import "./globals.css";
import "./professional-storefront.css";

export const metadata: Metadata = {
  title: {
    default: "Kebapp – Gemeinsam besser einkaufen",
    template: "%s · Kebapp",
  },
  description:
    "Betreuter Gruppeneinkauf und digitales Betriebssystem für unabhängige Dönerläden.",
  applicationName: "Kebapp",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#132019",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
