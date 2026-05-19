/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Onboarding action crawls + calls AI — needs more than the default 5s.
    serverActionsBodySizeLimit: "10mb",
  },
};

export default nextConfig;
