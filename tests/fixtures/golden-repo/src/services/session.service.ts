import { SessionRepository } from "../repositories/session.repository.js";

export class SessionService {
  constructor(private readonly sessions = new SessionRepository()) {}

  async create(userId: string, token: string) {
    return this.sessions.create({ userId, token });
  }

  async revoke(token: string) {
    return this.sessions.deleteByToken(token);
  }
}
