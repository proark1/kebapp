import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["nodemailer"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
