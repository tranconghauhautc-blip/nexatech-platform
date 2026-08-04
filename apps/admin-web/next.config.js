//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');

/**
 * Host Windows builds must run with NODE_ENV=production.
 * Inheriting NODE_ENV=development (e.g. from .env.e2e*) causes Next 15 to
 * prerender /404 via Pages `/_error` and throw:
 *   <Html> should not be imported outside of pages/_document
 * Enforced by project.json build target: `cross-env NODE_ENV=production next build`
 * (and package.json build:storefront / build:admin). Do not assign NODE_ENV here —
 * TypeScript treats process.env.NODE_ENV as read-only during next build typecheck.
 */

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  // Use this to set Nx-specific options
  // See: https://nx.dev/recipes/next/next-config-setup
  nx: {},
  // Standalone cần symlink — bật khi Docker Linux build (DOCKER_BUILD=true).
  ...(process.env.DOCKER_BUILD === 'true' ? { output: 'standalone' } : {}),
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
