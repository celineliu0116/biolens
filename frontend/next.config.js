/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  onDemandEntries: {
    // Keep dev chunks around longer to avoid transient missing chunk errors on refresh.
    maxInactiveAge: 60 * 60 * 1000,
    pagesBufferLength: 10,
  },
  async rewrites() {
    const upstream =
      process.env.API_UPSTREAM_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${upstream}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
