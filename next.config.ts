import type { NextConfig } from "next"
import { PHASE_DEVELOPMENT_SERVER } from "next/constants"
import { readFileSync } from "fs"
import path from "path"

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"))

export default function nextConfig(phase: string): NextConfig {
  const isDevServer = phase === PHASE_DEVELOPMENT_SERVER

  return {
    distDir: process.env.NEXT_DEV_DIST_DIR || ".next",
    devIndicators: false,
    ...(isDevServer
      ? {}
      : {
          output: "standalone" as const,
          outputFileTracingRoot: path.resolve(__dirname),
        }),
    env: {
      NEXT_PUBLIC_APP_VERSION: pkg.version,
    },
    async rewrites() {
      return [
        {
          source: "/api/:path*",
          destination: "http://localhost:8000/api/:path*",
        },
      ]
    },
    webpack: (config, { dev }) => {
      if (dev) {
        config.watchOptions = {
          ...config.watchOptions,
          ignored: [
            "**/node_modules/**",
            "**/.git/**",
            "**/.next/**",
            "**/.next-electron-dev/**",
            "**/.next-electron-dev-*/**",
            "**/data/**",
            "**/logs/**",
            "**/marketing/profiles/**",
            "**/.omx/**",
            "**/extracted/**",
            "**/dist/**",
            "**/dist-electron/**",
            "**/dist-electron2/**",
            "**/build-staging/**",
          ],
        }
      }
      return config
    },
  }
}
