import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function findUsers() {
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { orders: true },
  });
}

export async function findUserById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { orders: { include: { items: true } }, sessions: true },
  });
}

export async function createUser(input: { email: string; name: string }) {
  return prisma.user.create({ data: input });
}
