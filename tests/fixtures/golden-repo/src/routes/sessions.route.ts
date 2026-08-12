import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { SessionService } from "../services/session.service.js";

const router = Router();
const sessions = new SessionService();

router.post("/sessions", requireAuth, async (req, res) => {
  const userId = String(req.body?.userId ?? "");
  const token = String(req.body?.token ?? "");
  const session = await sessions.create(userId, token);
  res.status(201).json(session);
});

router.delete("/sessions/:token", requireAuth, async (req, res) => {
  const result = await sessions.revoke(String(req.params.token));
  res.json(result);
});

export default router;
