/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false, // Disabled to reduce double renders in dev
    
    // Performance optimizations
    swcMinify: true,
    
    // Optimize images
    images: {
        formats: ['image/avif', 'image/webp'],
    },
    
    // Reduce bundle size
    modularizeImports: {
        '@tabler/icons-react': {
            transform: '@tabler/icons-react/dist/esm/icons/{{member}}',
        },
    },
    
    // Experimental features for better performance
    experimental: {
        optimizePackageImports: ['react-chessboard', 'chess.js'],
    },
};

module.exports = nextConfig;
