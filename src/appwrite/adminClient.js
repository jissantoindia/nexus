/**
 * Admin-only Appwrite client — uses server API key via fetch().
 * Only used on the /admin page which is gated behind the 'admin' label.
 */
// ── User Management (direct Users API, no function needed) ────────────────────
export async function adminListUsers() {
  const res = await fetch(
    `${import.meta.env.VITE_APPWRITE_ENDPOINT}/users?limit=100`,
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': import.meta.env.VITE_APPWRITE_PROJECT_ID || '',
        'X-Appwrite-Key': import.meta.env.VITE_APPWRITE_ADMIN_KEY || '',
      },
    }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to list users');
  }
  const data = await res.json();
  return data.users || [];
}

export async function adminCreateUser(email, password, name) {
  const res = await fetch(
    `${import.meta.env.VITE_APPWRITE_ENDPOINT}/users`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': import.meta.env.VITE_APPWRITE_PROJECT_ID || '',
        'X-Appwrite-Key': import.meta.env.VITE_APPWRITE_ADMIN_KEY || '',
      },
      body: JSON.stringify({ userId: 'unique()', email, password, name }),
    }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to create user');
  }
  return res.json();
}

export async function adminDeleteUser(userId) {
  const res = await fetch(
    `${import.meta.env.VITE_APPWRITE_ENDPOINT}/users/${userId}`,
    {
      method: 'DELETE',
      headers: {
        'X-Appwrite-Project': import.meta.env.VITE_APPWRITE_PROJECT_ID || '',
        'X-Appwrite-Key': import.meta.env.VITE_APPWRITE_ADMIN_KEY || '',
      },
    }
  );
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to delete user');
  }
  return true;
}

export async function adminToggleUserStatus(userId, currentStatus) {
  const res = await fetch(
    `${import.meta.env.VITE_APPWRITE_ENDPOINT}/users/${userId}/status`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': import.meta.env.VITE_APPWRITE_PROJECT_ID || '',
        'X-Appwrite-Key': import.meta.env.VITE_APPWRITE_ADMIN_KEY || '',
      },
      body: JSON.stringify({ status: !currentStatus }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to update user status');
  }
  return res.json();
}
