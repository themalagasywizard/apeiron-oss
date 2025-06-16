/** @type {import('next').NextConfig} */
import MiniCssExtractPlugin from 'mini-css-extract-plugin';

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    // Add mini-css-extract-plugin
    if (!isServer) {
      config.plugins.push(new MiniCssExtractPlugin());
    }
    return config;
  }
};

export default nextConfig;