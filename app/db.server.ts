// app/db.server.ts
import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const createPrismaClient = () => {
  const client = new PrismaClient();

  // Only extend with Accelerate in production
  if (process.env.NODE_ENV === 'production') {
    return client.$extends(withAccelerate());
  }

  return client;
};

export const prisma =
  globalForPrisma.prisma ||
  createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}