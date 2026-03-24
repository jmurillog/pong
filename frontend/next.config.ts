import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  serverExternalPackages: [],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    return config;
  },
};

export default nextConfig;
