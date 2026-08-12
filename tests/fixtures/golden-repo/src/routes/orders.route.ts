import { Router } from "express";
import { getOrder, listOrders, placeOrder } from "../services/order.service";

interface OrderItemInput {
  sku: string;
  quantity: number;
  unitPrice: number;
}

function isOrderItem(value: unknown): value is OrderItemInput {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const item = value as Record<string, unknown>;
  return (
    typeof item.sku === "string" &&
    typeof item.quantity === "number" &&
    item.quantity > 0 &&
    typeof item.unitPrice === "number" &&
    item.unitPrice >= 0
  );
}

const router = Router();

router.get("/", async (_request, response, next) => {
  try {
    response.json(await listOrders());
  } catch (error) {
    next(error);
  }
});

router.get("/:orderId", async (request, response, next) => {
  try {
    response.json(await getOrder(request.params.orderId));
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_NOT_FOUND") {
      response.status(404).json({ error: "order_not_found" });
      return;
    }
    next(error);
  }
});

router.post("/", async (request, response, next) => {
  const { userId, items } = request.body as {
    userId?: unknown;
    items?: unknown;
  };

  if (typeof userId !== "string" || !Array.isArray(items) || !items.every(isOrderItem)) {
    response.status(400).json({ error: "valid_user_and_items_required" });
    return;
  }

  try {
    response.status(201).json(await placeOrder({ userId, items }));
  } catch (error) {
    next(error);
  }
});

export { router as ordersRouter };
