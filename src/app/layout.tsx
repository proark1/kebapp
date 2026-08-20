import type { Metadata, Viewport } from "next";
import "@fontsource-variable/figtree";
import "@fontsource-variable/roboto-condensed";
import "./globals.css";

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
