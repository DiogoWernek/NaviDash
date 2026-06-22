import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
  transpilePackages: ["react-simple-maps"],
};

export default nextConfig;
