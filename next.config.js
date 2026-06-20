/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Fonts are loaded via <link> in the root layout; skip Next's build-time
  // font inlining so the build never needs to reach fonts.googleapis.com.
  optimizeFonts: false,
};

module.exports = nextConfig;
