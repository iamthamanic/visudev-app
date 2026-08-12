import { createUser, findUserById, findUsers } from "../repositories/user.repository";

export async function listUsers() {
  return findUsers();
}

export async function getUser(userId: string) {
  const user = await findUserById(userId);

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  return user;
}

export async function registerUser(input: { email: string; name: string }) {
  return createUser({
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
  });
}
