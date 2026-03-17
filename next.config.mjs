/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    config.module.rules.push({
      test: /charLS-DynamicMemory-browser\.js$/,
      type: "javascript/auto",
    });

    return config;
  },
};

export default nextConfig;
