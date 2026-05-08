import { account, databases, storage, functions, ID, Query, DB_ID, PROJECTS_COL, REQUESTS_COL, DOCS_COL, MEMBERS_COL, FEEDBACK_COL, FEEDBACK_BUCKET, MANAGE_USERS_FN, SETTINGS_COL, APP_RELEASE_DOC } from './client';

// ─── Auth ─────────────────────────────────────────────────────────────────────
export async function login(email, password) {
  return account.createEmailPasswordSession(email, password);
}
export async function logout() {
  return account.deleteSession('current');
}
export async function getUser() {
  try { return await account.get(); } catch { return null; }
}
export function isAdmin(user) {
  return Array.isArray(user?.labels) && user.labels.includes('admin');
}
export async function changePassword(oldPassword, newPassword) {
  return account.updatePassword(newPassword, oldPassword);
}

// ─── Projects ─────────────────────────────────────────────────────────────────
export async function getProjects(userId) {
  const res = await databases.listDocuments(DB_ID, PROJECTS_COL, [
    Query.equal('userId', userId),
    Query.orderDesc('$createdAt'),
    Query.limit(100),
  ]);
  return res.documents;
}

export async function createProject(name, userId, description = '') {
  return databases.createDocument(DB_ID, PROJECTS_COL, ID.unique(), { name, userId, description });
}

export async function updateProject(docId, data) {
  return databases.updateDocument(DB_ID, PROJECTS_COL, docId, data);
}

export async function deleteProject(docId) {
  return databases.deleteDocument(DB_ID, PROJECTS_COL, docId);
}

// ─── Collaborators (dedicated collection — invite by email, no admin key needed) ─────

/**
 * List accepted collaborators for a project.
 */
export async function getCollaborators(projectId) {
  const res = await databases.listDocuments(DB_ID, MEMBERS_COL, [
    Query.equal('projectId', projectId),
    Query.orderAsc('$createdAt'),
    Query.limit(100),
  ]);
  return res.documents;
}

/**
 * Invite a collaborator by email — creates a PENDING invite record.
 * Idempotent: silently returns existing record if already invited.
 */
export async function addCollaborator(projectId, email, name, invitedBy, invitedByName) {
  const normalEmail = email.toLowerCase().trim();
  // Check if already invited / member
  const existing = await databases.listDocuments(DB_ID, MEMBERS_COL, [
    Query.equal('projectId', projectId),
    Query.equal('invitedEmail', normalEmail),
    Query.limit(1),
  ]);
  if (existing.total > 0) return existing.documents[0];
  return databases.createDocument(DB_ID, MEMBERS_COL, ID.unique(), {
    projectId,
    invitedEmail:  normalEmail,
    invitedName:   name || email,
    invitedBy:     invitedBy || '',
    invitedByName: invitedByName || '',
    status:        'pending',   // ← must be accepted by invitee
  });
}

/** Remove a collaborator by their record $id */
export async function removeCollaborator(memberId) {
  return databases.deleteDocument(DB_ID, MEMBERS_COL, memberId);
}

/** Get pending invitations for a user by their email */
export async function getPendingInvites(userEmail) {
  if (!userEmail) return [];
  const res = await databases.listDocuments(DB_ID, MEMBERS_COL, [
    Query.equal('invitedEmail', userEmail.toLowerCase().trim()),
    Query.equal('status', 'pending'),
    Query.orderDesc('$createdAt'),
    Query.limit(50),
  ]);
  // Enrich with project name
  const enriched = await Promise.all(
    res.documents.map(async m => {
      try {
        const proj = await databases.getDocument(DB_ID, PROJECTS_COL, m.projectId);
        return { ...m, projectName: proj.name, projectDesc: proj.description || '' };
      } catch { return { ...m, projectName: 'Unknown Project', projectDesc: '' }; }
    })
  );
  return enriched;
}

/** Accept a pending invitation */
export async function acceptInvite(memberId) {
  return databases.updateDocument(DB_ID, MEMBERS_COL, memberId, { status: 'accepted' });
}

/** Decline a pending invitation */
export async function declineInvite(memberId) {
  return databases.updateDocument(DB_ID, MEMBERS_COL, memberId, { status: 'declined' });
}

/**
 * Get all projects shared with the current user (accepted invites only).
 */
export async function getSharedProjects(userEmail) {
  if (!userEmail) return [];
  const res = await databases.listDocuments(DB_ID, MEMBERS_COL, [
    Query.equal('invitedEmail', userEmail.toLowerCase().trim()),
    Query.equal('status', 'accepted'),
    Query.limit(100),
  ]);
  if (res.total === 0) return [];
  const projectIds = [...new Set(res.documents.map(m => m.projectId))];
  const projects = await Promise.all(
    projectIds.map(id => databases.getDocument(DB_ID, PROJECTS_COL, id).catch(() => null))
  );
  return projects.filter(Boolean).map(p => ({ ...p, _shared: true }));
}

// ─── Requests ─────────────────────────────────────────────────────────────────
export async function getRequests(projectId) {
  const res = await databases.listDocuments(DB_ID, REQUESTS_COL, [
    Query.equal('projectId', projectId),
    Query.orderDesc('$createdAt'),
    Query.limit(200),
  ]);
  return res.documents.map(deserializeRequest);
}

export async function saveRequest(data) {
  const payload = serializeRequest(data);
  return databases.createDocument(DB_ID, REQUESTS_COL, ID.unique(), payload);
}

export async function updateRequest(docId, data) {
  const payload = serializeRequest(data);
  return databases.updateDocument(DB_ID, REQUESTS_COL, docId, payload);
}

export async function deleteRequest(docId) {
  return databases.deleteDocument(DB_ID, REQUESTS_COL, docId);
}

// ─── Docs ─────────────────────────────────────────────────────────────────────
export async function getDocs(projectId) {
  const res = await databases.listDocuments(DB_ID, DOCS_COL, [
    Query.equal('projectId', projectId),
    Query.orderDesc('$createdAt'),
    Query.limit(100),
  ]);
  return res.documents;
}

export async function getDoc(docId) {
  return databases.getDocument(DB_ID, DOCS_COL, docId);
}

export async function saveDoc(data) {
  // Appwrite 1.8 String attribute hard-limit: 1,048,576 bytes
  // Keep content well under the limit to avoid 400 errors
  const safeContent = (data.content || '').slice(0, 950000);
  const safeTitle   = (data.title || 'Untitled').slice(0, 500);
  const safeUrl     = (data.url || '').slice(0, 2048);

  const payload = {
    projectId: (data.projectId || '').slice(0, 36),
    requestId: (data.requestId || '').slice(0, 36),
    userId:    (data.userId    || '').slice(0, 36),
    title:     safeTitle,
    content:   safeContent,
    method:    (data.method   || 'GET').slice(0, 10),
    url:       safeUrl,
    password:  (data.password || '').slice(0, 255),
  };

  try {
    return await databases.createDocument(DB_ID, DOCS_COL, ID.unique(), payload);
  } catch (e) {
    // Add field sizes to error for debugging
    const sizes = Object.entries(payload).map(([k, v]) => `${k}=${v.length}`).join(', ');
    console.error('[saveDoc] Failed. Field sizes:', sizes);
    throw e;
  }
}

export async function updateDoc(docId, data) {
  // Only send fields that are explicitly provided (avoid overwriting with undefined)
  const allowed = ['title', 'content', 'password', 'method', 'url'];
  const payload = {};
  for (const key of allowed) {
    if (key in data && data[key] !== undefined) {
      payload[key] = key === 'content'
        ? (data[key] || '').slice(0, 950000)
        : key === 'title' ? (data[key] || '').slice(0, 500)
        : data[key];
    }
  }
  return databases.updateDocument(DB_ID, DOCS_COL, docId, payload);
}

export async function deleteDoc(docId) {
  return databases.deleteDocument(DB_ID, DOCS_COL, docId);
}

// ─── User Management (via Appwrite Function) ──────────────────────────────────
async function callManageUsers(action, body = {}) {
  const execution = await functions.createExecution(
    MANAGE_USERS_FN,
    JSON.stringify({ action, ...body }),
    false
  );
  if (execution.responseStatusCode >= 400) {
    throw new Error(`Function error: ${execution.responseBody}`);
  }
  return JSON.parse(execution.responseBody);
}

export async function listUsers()                        { return callManageUsers('list'); }
export async function adminCreateUser(email, password, name) { return callManageUsers('create', { email, password, name }); }
export async function adminDeleteUser(userId)            { return callManageUsers('delete', { userId }); }
export async function adminToggleUser(userId)            { return callManageUsers('toggleStatus', { userId }); }

// ─── Serialization Helpers ────────────────────────────────────────────────────
function serializeRequest(data) {
  return {
    projectId: data.projectId || '',
    userId: data.userId || '',
    name: data.name || '',
    folder: data.folder || '',
    method: data.method || 'GET',
    url: data.url || '',
    headers: JSON.stringify(data.headers || []),
    params: JSON.stringify(data.params || []),
    body: typeof data.body === 'object' ? JSON.stringify(data.body) : (data.body || ''),
    bodyType: data.bodyType || 'json',
    auth: JSON.stringify(data.auth || { type: 'none' }),
    description: data.description || '',
  };
}

function deserializeRequest(doc) {
  return {
    ...doc,
    id: doc.$id,
    folder: doc.folder || '',
    headers:  safeJSON(doc.headers, []),
    params:   safeJSON(doc.params, []),
    auth:     safeJSON(doc.auth, { type: 'none' }),
  };
}

function safeJSON(str, fallback) {
  try { return str ? JSON.parse(str) : fallback; } catch { return fallback; }
}

// ─── Feedback ──────────────────────────────────────────────────────────────────────
export const FEEDBACK_CATEGORIES = ['Bug Report', 'Feature Request', 'UI/UX', 'Performance', 'Other'];

export async function submitFeedback({ title, content, category, screenshotFile, userId, userName }) {
  let screenshotId = null;
  let screenshotUrl = null;

  // Upload screenshot if provided
  if (screenshotFile) {
    try {
      const uploaded = await storage.createFile(FEEDBACK_BUCKET, ID.unique(), screenshotFile);
      screenshotId = uploaded.$id;
      screenshotUrl = `${import.meta.env.VITE_APPWRITE_ENDPOINT}/storage/buckets/${FEEDBACK_BUCKET}/files/${screenshotId}/view?project=${import.meta.env.VITE_APPWRITE_PROJECT_ID}`;
    } catch (e) {
      console.warn('[submitFeedback] Screenshot upload failed:', e.message);
    }
  }

  return databases.createDocument(DB_ID, FEEDBACK_COL, ID.unique(), {
    title:         (title || 'No title').slice(0, 255),
    content:       (content || '').slice(0, 5000),
    category:      category || 'Other',
    userId:        userId   || '',
    userName:      userName || '',
    screenshotId:  screenshotId || '',
    screenshotUrl: screenshotUrl || '',
    status:        'new',
  });
}

export async function getFeedback() {
  const res = await databases.listDocuments(DB_ID, FEEDBACK_COL, [
    Query.orderDesc('$createdAt'), Query.limit(200),
  ]);
  return res.documents;
}

// ─── App Release / Update Management ─────────────────────────────────────────
// Uses a single document with fixed ID 'app_release' in the 'settings' collection.
// Permissions: anyone can READ, only admin can WRITE.
export async function getAppRelease() {
  try {
    return await databases.getDocument(DB_ID, SETTINGS_COL, APP_RELEASE_DOC);
  } catch {
    return null; // document doesn't exist yet
  }
}

export async function saveAppRelease(data) {
  // Only send allowed fields — strip Appwrite system fields ($id, $collectionId, etc.)
  const payload = {
    version:       (data.version       || '').trim(),
    win_url:       (data.win_url       || '').trim(),
    mac_url:       (data.mac_url       || '').trim(),
    linux_url:     (data.linux_url     || '').trim(),
    release_notes: (data.release_notes || '').trim(),
  };
  // Try update first (document already exists), create if not
  try {
    await databases.getDocument(DB_ID, SETTINGS_COL, APP_RELEASE_DOC);
    return databases.updateDocument(DB_ID, SETTINGS_COL, APP_RELEASE_DOC, payload);
  } catch {
    return databases.createDocument(DB_ID, SETTINGS_COL, APP_RELEASE_DOC, payload);
  }
}
