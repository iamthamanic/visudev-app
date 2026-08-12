import type { NextFunction, Request, Response } from "express";

export function requireAuth(request: Request, response: Response, next: NextFunction): void {
  const authorization = request.header("Authorization");

  if (!authorization?.startsWith("Bearer ") || authorization.length <= "Bearer ".length) {
    response.status(401).json({ error: "unauthorized" });
    return;
  }

  next();
}
