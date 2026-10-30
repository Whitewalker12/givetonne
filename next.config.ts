import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Prisma's generated client out of the server bundle so the Cloudflare
  // build can pick its workerd (WASM) entry instead of the Node engine.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  // The tracer only copies the Node stubs; the Workers build needs these too.
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/pg-cloudflare/dist/**",
      "./node_modules/pg-cloudflare/esm/**",
      "./node_modules/.prisma/client/wasm*",
      "./node_modules/.prisma/client/query_engine_bg.*",
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

// Lets `next dev` read Cloudflare bindings/vars from wrangler.jsonc + .dev.vars.
if (process.env.NODE_ENV === "development") {
  import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
}
