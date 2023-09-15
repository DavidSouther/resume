/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  distDir: "docs",
  images: {
    unoptimized: true,
    remotePatterns: [{ hostname: "avatars.githubusercontent.com" }],
  },
};

module.exports = nextConfig;
