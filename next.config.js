/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: true,
  distDir: "docs",
  images: {
    unoptimized: true,
    remotePatterns: [{ hostname: "avatars.githubusercontent.com" }],
  },
  output: "export",
  reactStrictMode: true,
  webpack(config, _) {
    config.experiments = { asyncWebAssembly: true, layers: true };
    return config;
  },
};

module.exports = nextConfig;
