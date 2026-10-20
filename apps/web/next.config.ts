import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  // Contracts and domain rules are shared with the API as TypeScript sources.
  transpilePackages: ["@nobre/contracts", "@nobre/domain"],
  turbopack: { root: path.resolve(import.meta.dirname, "../..") },
  outputFileTracingRoot: path.resolve(import.meta.dirname, "../.."),
};

export default config;
