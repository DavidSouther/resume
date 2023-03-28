/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ hostname: "avatars.githubusercontent.com" }],
  },
};

module.exports = nextConfig;
