import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Pin Turbopack root when multiple lockfiles exist on the machine.
  turbopack: {
    root: appDir,
  },
};

export default nextConfig;
