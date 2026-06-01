const { resolve } = require("node:path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: true,
  distDir: "docs",
  // @davidsouther/jiffdown is a file: dependency symlinked to a sibling
  // checkout outside this project. Turbopack only resolves within its root,
  // so widen the root to the common ancestor of both checkouts.
  turbopack: {
    root: resolve(__dirname, "../.."),
  },
  images: {
    unoptimized: true,
    remotePatterns: [{ hostname: "avatars.githubusercontent.com" }],
  },
  output: "export",
  reactStrictMode: true,
};

module.exports = nextConfig;
