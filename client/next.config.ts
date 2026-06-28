import path from "path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    externalDir: true
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
