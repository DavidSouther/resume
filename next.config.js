/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
    remotePatterns: [{ hostname: "avatars.githubusercontent.com" }],
  },
};

module.exports = nextConfig;
