import type { NextConfig } from "next";
import path from "node:path";
const config: NextConfig = {
  output: "export",
  basePath: process.env.NEXT_PUBLIC_NEAR_DEMO_BASE_PATH ?? "",
  images: { unoptimized: true },
  transpilePackages: ["@clawdhq/near-ui"],
  turbopack: { root: path.resolve(import.meta.dirname, "../..") },
};
export default config;
