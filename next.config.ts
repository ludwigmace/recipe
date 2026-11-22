import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
};

export default nextConfig;
