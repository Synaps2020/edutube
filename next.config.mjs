/** @type {import('next').NextConfig} */
const nextConfig = {
  // Sortie "standalone" : image Docker minimale sans node_modules complet.
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Les uploads passent par les Route Handlers (multipart) ; on évite les Server Actions pour rester API-first.
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
  },
  images: { unoptimized: true },
  async headers() {
    // Les en-têtes de sécurité sont aussi posés par Nginx ; ils sont répétés ici pour le mode dev / exécution sans proxy.
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};
export default nextConfig;
