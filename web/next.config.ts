import type { NextConfig } from "next";

// Public, cached copy of the S3 bucket (CloudFront). Browsers read the data from here directly.
const DATA_BASE = process.env.NEXT_PUBLIC_DATA_BASE || "https://dd9whsc1nc4yy.cloudfront.net";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: { inlineCss: true },
  async redirects() {
    // Open data: every JSON file Pipette publishes is readable at /data/v1/...
    // Redirected, not proxied: proxying it through Vercel is billed as origin transfer.
    return [{ source: "/data/:path*", destination: `${DATA_BASE}/:path*`, permanent: false }];
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
