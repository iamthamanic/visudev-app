import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { getUser, listUsers, registerUser } from "../services/user.service";

const router = Router();

router.get("/", requireAuth, async (_request, response, next) => {
  try {
    response.json(await listUsers());
  } catch (error) {
    next(error);
  }
});

router.get("/:userId", requireAuth, async (request, response, next) => {
  try {
    response.json(await getUser(request.params.userId));
  } catch (error) {
    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      response.status(404).json({ error: "user_not_found" });
      return;
    }
    next(error);
  }
});

router.post("/", requireAuth, async (request, response, next) => {
  const { email, name } = request.body as { email?: unknown; name?: unknown };

  if (typeof email !== "string" || typeof name !== "string" || !email || !name) {
    response.status(400).json({ error: "email_and_name_required" });
    return;
  }

  try {
    response.status(201).json(await registerUser({ email, name }));
  } catch (error) {
    next(error);
  }
});

export { router as usersRouter };
