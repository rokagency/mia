import { PrismaClient } from "@prisma/client";

// Standard Next.js Prisma singleton: avoids the dev-mode HMR pitfall where
// each reload creates a new PrismaClient and eventually exhausts connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
