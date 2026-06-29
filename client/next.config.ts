import path from "path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    externalDir: true
  },
  // Same-origin API proxy: the browser calls /api/backend/* on the frontend's
  // own origin and the Next server forwards it to the real backend. This avoids
  // cross-origin requests entirely (no CORS, and privacy browsers / shields that
  // block third-party requests can't break sign-in). Only enabled when
  // BACKEND_ORIGIN is set at runtime (production); local dev calls the backend
  // directly via NEXT_PUBLIC_API_BASE_URL.
  async rewrites() {
    const backend = process.env.BACKEND_ORIGIN?.replace(/\/$/, "");
    if (!backend) {
      return [];
    }
    return [
      {
        source: "/api/backend/:path*",
        destination: `${backend}/:path*`
      }
    ];
  },
  webpack: (config) => {
    // The alpha @tensorflow/tfjs-tflite ESM entry imports an internal
    // `tflite_web_api_client` module that ships only as a runtime wasm glue,
    // which webpack cannot resolve. The prebuilt FESM bundle inlines it, so
    // alias the bare package import to that self-contained build.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@tensorflow/tfjs-tflite$": path.join(
        process.cwd(),
        "node_modules/@tensorflow/tfjs-tflite/dist/tf-tflite.fesm.min.js"
      )
    };
    return config;
  }
};

export default nextConfig;
