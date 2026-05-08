import { Client, Users, ID } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);
  const usersApi = new Users(client);
  try {
    const body = req.body ? (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) : {};
    const action = body.action;
    if (action === 'list') {
      const list = await usersApi.list();
      return res.json({ users: list.users.map(u => ({ $id: u.$id, name: u.name, email: u.email, status: u.status, labels: u.labels })) });
    }
    if (action === 'create') {
      const user = await usersApi.create(ID.unique(), body.email, undefined, body.password, body.name);
      return res.json({ user });
    }
    if (action === 'delete') {
      await usersApi.delete(body.userId);
      return res.json({ ok: true });
    }
    if (action === 'toggleStatus') {
      const u = await usersApi.get(body.userId);
      await usersApi.updateStatus(body.userId, !u.status);
      return res.json({ ok: true });
    }
    return res.json({ error: 'Unknown action' }, 400);
  } catch (e) {
    error(e.message);
    return res.json({ error: e.message }, 500);
  }
};