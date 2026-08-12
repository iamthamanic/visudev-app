import {
  createOrder,
  findOrderById,
  findOrders,
  type NewOrderItem,
} from "../repositories/order.repository";

export async function listOrders() {
  return findOrders();
}

export async function getOrder(orderId: string) {
  const order = await findOrderById(orderId);

  if (!order) {
    throw new Error("ORDER_NOT_FOUND");
  }

  return order;
}

export async function placeOrder(input: { userId: string; items: NewOrderItem[] }) {
  if (input.items.length === 0) {
    throw new Error("ORDER_ITEMS_REQUIRED");
  }

  return createOrder(input);
}
