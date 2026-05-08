import { account, ID } from './client';

export async function login(email, password) {
  return account.createEmailPasswordSession(email, password);
}

export async function register(name, email, password) {
  await account.create(ID.unique(), email, password, name);
  return login(email, password);
}

export async function logout() {
  return account.deleteSession('current');
}

export async function getUser() {
  try {
    return await account.get();
  } catch {
    return null;
  }
}
