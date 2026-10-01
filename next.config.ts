import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { HTML_LIMITED_BOT_UA_RE } from "next/dist/shared/lib/router/utils/html-bots";

// Local dev and previews read the live D1 (wrangler.toml `remote = true`). CI (GitHub Actions, Workers
// Builds) has no interactive Cloudflare login, so builds there use the local D1 simulation instead.
initOpenNextCloudflareForDev({ remoteBindings: !process.env.CI && !process.env.WORKERS_CI });

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' data: blob:",
      "font-src 'self' data: https://cdnjs.cloudflare.com",
      // React/Turbopack development modules need eval; production stays strict.
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
      "connect-src 'self'",
      "worker-src 'self' blob:",
    ].join("; "),
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: false,
  // Link-preview bots read the title and description from <head>, so they get blocking metadata.
  // Next's list leaves out the KakaoTalk and Telegram scrapers, where TERMINAL links are shared.
  htmlLimitedBots: new RegExp(`${HTML_LIMITED_BOT_UA_RE.source}|kakaotalk-scrap|TelegramBot`, "i"),
  allowedDevOrigins: ['127.0.0.1'],
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
