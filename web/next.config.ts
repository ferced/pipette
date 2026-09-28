import type { NextConfig } from "next";

const DATA_URL = process.env.DATA_URL || "https://pipette-day-data.s3.us-east-1.amazonaws.com";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: { inlineCss: true },
  async rewrites() {
    // Open data: every JSON file Pipette publishes is readable at /data/v1/...
    return [{ source: "/data/:path*", destination: `${DATA_URL}/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
