import { PrismaClient } from "@prisma/client";

/**
 * On Node (next dev / next start / Vercel) one PrismaClient is shared.
 *
 * On Cloudflare Workers, Prisma runs its WASM engine through the `pg` driver
 * adapter, and a socket opened in one request can't be reused by another, so
 * each request gets its own client, keyed on that request's ExecutionContext.
 * `prisma` is a proxy over whichever client applies, so callers don't change.
 */

const isWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function nodeClient() {
  globalForPrisma.prisma ??= new PrismaClient();
  return globalForPrisma.prisma;
}

const perRequest = new WeakMap<object, PrismaClient>();

function workersClient(): PrismaClient {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { getCloudflareContext } = require("@opennextjs/cloudflare") as typeof import("@opennextjs/cloudflare");
  const { PrismaPg } = require("@prisma/adapter-pg") as typeof import("@prisma/adapter-pg");
  /* eslint-enable @typescript-eslint/no-require-imports */

  const { ctx } = getCloudflareContext();
  let client = perRequest.get(ctx);
  if (!client) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 1 });
    client = new PrismaClient({ adapter });
    perRequest.set(ctx, client);
  }
  return client;
}

function current(): PrismaClient {
  return isWorkers ? workersClient() : nodeClient();
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = current();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
