import type { NextConfig } from "next";

function buildSecurityHeaders(): Array<{ key: string; value: string }> {
  const isProduction = process.env.NODE_ENV === "production";
  const scriptSrc = isProduction
    ? "'self' 'unsafe-inline'"
    : "'self' 'unsafe-inline' 'unsafe-eval'";
  // In der Entwicklung erlaubt connect-src zusätzlich die HMR-Websockets.
  const connectSrc = isProduction ? "connect-src 'self'" : "connect-src 'self' ws:";
  const contentSecurityPolicy = [
    "default-src 'self'",
    "base-uri 'self'",
    connectSrc,
    "font-src 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "object-src 'none'",
    "form-action 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
  ].join("; ");

  const headers: Array<{ key: string; value: string }> = [
    { key: "Content-Security-Policy", value: contentSecurityPolicy },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Permissions-Policy",
      // Die Zeiterfassung fragt den Standort ab, um den Abstand zum
      // Laden zu bestimmen (siehe src/lib/geofence.ts). Ohne `self`
      // lehnt der Browser `navigator.geolocation` ohne Rueckfrage ab.
      // Kamera und Mikrofon bleiben gesperrt: der Belegscan laeuft
      // ueber `input[type=file] capture`, das keine Kamerafreigabe
      // nach dieser Richtlinie braucht.
      value: "camera=(), geolocation=(self), microphone=()",
    },
  ];

  if (isProduction) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains",
    });
  }

  return headers;
}

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  // tesseract.js startet einen worker_thread und laedt seine wasm-Kerne
  // per `require` aus node_modules - gebuendelt findet es beides nicht.
  serverExternalPackages: ["nodemailer", "tesseract.js"],
  // Der Trace erkennt die wasm-Dateien hinter dem dynamischen `require`
  // in tesseract.js nicht; ohne sie fehlt der Kern im standalone-Build.
  outputFileTracingIncludes: {
    "/app/buchhaltung": [
      "./node_modules/.pnpm/tesseract.js-core@*/node_modules/tesseract.js-core/**",
      "./node_modules/.pnpm/tesseract.js@*/node_modules/tesseract.js/**",
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders(),
      },
      {
        source: "/einladung/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
