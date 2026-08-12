type SessionInput = { userId: string; token: string };

export class SessionRepository {
  async create(input: SessionInput) {
    return { id: "session-1", ...input, createdAt: new Date() };
  }

  async deleteByToken(token: string) {
    return { token, deleted: true };
  }

  async findByToken(token: string) {
    return { id: "session-1", userId: "user-1", token };
  }
}
