/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "1zztwrbl-3000.euw.devtunnels.ms",
        "*.euw.devtunnels.ms",
        "*.devtunnels.ms",
        "*.trycloudflare.com",
      ],
    },
  },
};

export default nextConfig;
