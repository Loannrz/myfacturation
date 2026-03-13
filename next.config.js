/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer, dev }) => {
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push('pdf-lib', '@stackforge-eu/factur-x', 'libxml2-wasm')
    }
    // Évite le 404 sur layout.css en dev (bug Next.js 14.2 – CssChunkingPlugin)
    if (dev && config.plugins) {
      config.plugins = config.plugins.filter(
        (plugin) => plugin.constructor.name !== 'CssChunkingPlugin'
      )
    }
    return config
  },
}

module.exports = nextConfig
