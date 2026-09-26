import type { NextConfig } from "next";

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://auth.privy.io",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https: wss:",
  "frame-src https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org https://challenges.cloudflare.com",
  "child-src https://auth.privy.io",
  "worker-src 'self' blob:",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@vouch/shared", "@vouch/abi"],
  serverExternalPackages: ["pdf-parse", "@prisma/client", "mppx"],
  experimental: { optimizePackageImports: ["lucide-react", "framer-motion"] },
  // Local UI work against live data: DEV_API_PROXY=https://<deployment> forwards the API to that deployment
  // (this machine cannot reach the database). Unset in every real deployment.
  async rewrites() {
    const proxy = process.env.DEV_API_PROXY;
    return proxy ? { beforeFiles: [{ source: "/api/v1/:path*", destination: `${proxy}/api/v1/:path*` }], afterFiles: [], fallback: [] } : [];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/api/(.*)",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type, Payment-Credential, Payment-Signature, X-PAYMENT, X-Payment, Accept-Payment" },
          { key: "Access-Control-Expose-Headers", value: "Payment-Receipt, WWW-Authenticate, X-PAYMENT-RESPONSE, X-Payment-Response" },
        ],
      },
    ];
  },
};

export default nextConfig;
