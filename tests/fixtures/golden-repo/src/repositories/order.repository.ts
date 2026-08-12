import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface NewOrderItem {
  sku: string;
  quantity: number;
  unitPrice: number;
}

export async function findOrders() {
  return prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: true, items: true },
  });
}

export async function findOrderById(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true, items: true },
  });
}

export async function createOrder(input: { userId: string; items: NewOrderItem[] }) {
  return prisma.order.create({
    data: {
      userId: input.userId,
      items: { create: input.items },
    },
    include: { items: true },
  });
}
