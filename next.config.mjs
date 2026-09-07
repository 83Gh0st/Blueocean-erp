/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";

// Same reasoning as the marketing site's CSP: no third-party scripts here
// at all, so the allowlist is short on purpose. This app holds financial
// records, so headers matter even more than on the marketing site.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Financial records — never indexed, never cached by intermediaries.
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  { key: "Cache-Control", value: "no-store" },
];

const nextConfig = {
  reactStrictMode: true,
  // Next.js scans upward from this folder looking for a workspace root,
  // and can get confused if it finds another lockfile in a parent folder
  // (e.g. a stray package-lock.json sitting in Downloads on Windows) —
  // that's the "inferred workspace root... may not be correct" warning.
  // Pinning it to this project's own folder removes the ambiguity.
  outputFileTracingRoot: process.cwd(),
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
