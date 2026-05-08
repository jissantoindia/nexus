#!/usr/bin/env node
/**
 * NexusAPI — Appwrite Setup Script
 * Run: npm run setup
 * Creates: Database, Collections, Attributes, Indexes, Admin User, Function
 */
import {
  Client, Databases, Storage, Users, Functions,
  ID, Permission, Role, Runtime, DatabasesIndexType as IndexType
} from 'node-appwrite';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createWriteStream } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load .env manually (no dotenv dep) ──────────────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) { console.error('❌  .env file not found'); process.exit(1); }
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

const ENDPOINT       = process.env.APPWRITE_ENDPOINT   || process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const PROJECT_ID     = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID || '';
const API_KEY        = process.env.APPWRITE_API_KEY    || '';
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'admin@nexusapi.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123456';
const ADMIN_NAME     = process.env.ADMIN_NAME     || 'Admin';

// Use existing DB ID from env, or fall back to string name
const DB_ID          = process.env.VITE_APPWRITE_DATABASE_ID || 'nexusapi-db';
const PROJECTS_COL   = process.env.VITE_APPWRITE_PROJECTS_COLLECTION_ID || 'projects';
const REQUESTS_COL   = process.env.VITE_APPWRITE_REQUESTS_COLLECTION_ID || 'requests';
const DOCS_COL       = process.env.VITE_APPWRITE_DOCS_COLLECTION_ID     || 'docs';
const MEMBERS_COL    = process.env.VITE_APPWRITE_MEMBERS_COLLECTION_ID  || 'project_members';
const FEEDBACK_COL   = process.env.VITE_APPWRITE_FEEDBACK_COLLECTION_ID || 'feedback';
const FEEDBACK_BUCKET = process.env.VITE_APPWRITE_FEEDBACK_BUCKET_ID   || 'feedback-screenshots';
const FUNCTION_ID    = process.env.VITE_APPWRITE_MANAGE_USERS_FUNCTION_ID || 'nexus-manage-users';
const SETTINGS_COL   = process.env.VITE_APPWRITE_SETTINGS_COLLECTION_ID || 'settings';

console.log('\n🔍  Config:');
console.log(`   Endpoint:   ${ENDPOINT}`);
console.log(`   Project ID: ${PROJECT_ID}`);
console.log(`   API Key:    ${API_KEY.slice(0, 20)}… (${API_KEY.length} chars)`);

if (!PROJECT_ID || !API_KEY) {
  console.error('\n❌  Missing APPWRITE_PROJECT_ID or APPWRITE_API_KEY in .env\n');
  process.exit(1);
}

const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const databases = new Databases(client);
const users     = new Users(client);
const functions = new Functions(client);



// ── Helpers ──────────────────────────────────────────────────────────────────
async function safeCreate(fn, label) {
  try {
    const result = await fn();
    console.log(`  ✓ ${label}`);
    return result;
  } catch (e) {
    if (e.code === 409) {
      console.log(`  ↩ ${label} (already exists)`);
      return null;
    }
    console.error(`  ✗ ${label}: ${e.message} [code: ${e.code}]`);
    throw e;
  }
}

async function createStr(colId, key, size, required = false) {
  try {
    await databases.createStringAttribute(DB_ID, colId, key, size, required);
    process.stdout.write(`    attr ${key} ✓  `);
  } catch (e) {
    if (e.code === 409) process.stdout.write(`    attr ${key} ↩  `);
    else console.error(`\n    attr ${key} ✗: ${e.message}`);
  }
}

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Verify connection first ───────────────────────────────────────────────────
console.log('\n🔌  Testing Appwrite connection…');
try {
  const dbList = await databases.list();
  console.log(`  ✓ Connected — ${dbList.total} existing database(s)`);
} catch (e) {
  console.error(`  ✗ Connection failed: ${e.message}`);
  console.error('\n  Check:\n  1. APPWRITE_PROJECT_ID matches your Appwrite project\n  2. APPWRITE_API_KEY has "databases.*", "users.*", "functions.*" scopes\n  3. The API key belongs to the correct project\n');
  process.exit(1);
}

console.log('\n🚀  NexusAPI Appwrite Setup\n');

// ── 1. Database ───────────────────────────────────────────────────────────────
console.log('📦  Creating database…');
await safeCreate(() => databases.create(DB_ID, 'NexusAPI Database'), 'Database: nexusapi-db');
await delay(1500);

// ── 2. Projects Collection ────────────────────────────────────────────────────
console.log('\n📁  Projects collection…');
await safeCreate(
  () => databases.createCollection(DB_ID, PROJECTS_COL, 'projects',
    [Permission.read(Role.users()), Permission.create(Role.users()),
     Permission.update(Role.users()), Permission.delete(Role.users())]),
  'Collection: projects'
);
await delay(800);
console.log('  Creating attributes:');
await createStr(PROJECTS_COL, 'name',        255, true);
await createStr(PROJECTS_COL, 'userId',       36, true);
await createStr(PROJECTS_COL, 'description', 1000);
await createStr(PROJECTS_COL, 'members',     8000);   // JSON array of collaborator objects
console.log('');

// ── 3. Requests Collection ────────────────────────────────────────────────────
console.log('\n📋  Requests collection…');
await safeCreate(
  () => databases.createCollection(DB_ID, REQUESTS_COL, 'requests',
    [Permission.read(Role.users()), Permission.create(Role.users()),
     Permission.update(Role.users()), Permission.delete(Role.users())]),
  'Collection: requests'
);
await delay(800);
console.log('  Creating attributes:');
await createStr(REQUESTS_COL, 'projectId',    36, true);
await createStr(REQUESTS_COL, 'userId',        36, true);
await createStr(REQUESTS_COL, 'name',         255);
await createStr(REQUESTS_COL, 'method',        10);
await createStr(REQUESTS_COL, 'url',         2048);
await createStr(REQUESTS_COL, 'headers',    65535);
await createStr(REQUESTS_COL, 'params',     65535);
await createStr(REQUESTS_COL, 'body',       65535);
await createStr(REQUESTS_COL, 'bodyType',      20);
await createStr(REQUESTS_COL, 'auth',        4096);
await createStr(REQUESTS_COL, 'description', 65535);
await createStr(REQUESTS_COL, 'folder',      255);
console.log('');

// ── 4. Docs Collection ────────────────────────────────────────────────────────
console.log('\n📝  Docs collection…');
await safeCreate(
  () => databases.createCollection(DB_ID, DOCS_COL, 'docs',
    [Permission.read(Role.any()), Permission.create(Role.users()),
     Permission.update(Role.users()), Permission.delete(Role.users())]),
  'Collection: docs'
);
await delay(800);
console.log('  Creating attributes:');
await createStr(DOCS_COL, 'projectId',   36, true);
await createStr(DOCS_COL, 'userId',       36, true);
await createStr(DOCS_COL, 'requestId',    36);
await createStr(DOCS_COL, 'title',       512);
await createStr(DOCS_COL, 'content', 1000000);
await createStr(DOCS_COL, 'method',       10);
await createStr(DOCS_COL, 'url',        2048);
await createStr(DOCS_COL, 'password',    255);
console.log('');

// ── 5. Project Members Collection ────────────────────────────────────────────
console.log('\n👥  Project Members collection…');
await safeCreate(
  () => databases.createCollection(DB_ID, MEMBERS_COL, 'project_members',
    [Permission.read(Role.users()), Permission.create(Role.users()),
     Permission.update(Role.users()), Permission.delete(Role.users())]),
  'Collection: project_members'
);
await delay(800);
console.log('  Creating attributes:');
await createStr(MEMBERS_COL, 'projectId',     36,   true);
await createStr(MEMBERS_COL, 'invitedEmail',  255,  true);
await createStr(MEMBERS_COL, 'invitedName',   255);
await createStr(MEMBERS_COL, 'invitedBy',      36);
await createStr(MEMBERS_COL, 'invitedByName', 255);
await createStr(MEMBERS_COL, 'status',         20);   // pending | accepted | declined
console.log('');

// ── 6. Feedback Collection ────────────────────────────────────────────
console.log('\n💬  Feedback collection…');
await safeCreate(
  () => databases.createCollection(DB_ID, FEEDBACK_COL, 'feedback',
    [Permission.read(Role.users()), Permission.create(Role.users()),
     Permission.update(Role.users()), Permission.delete(Role.users())]),
  'Collection: feedback'
);
await delay(800);
console.log('  Creating attributes:');
await createStr(FEEDBACK_COL, 'title',        255,  true);
await createStr(FEEDBACK_COL, 'content',      5000, true);
await createStr(FEEDBACK_COL, 'category',      50);
await createStr(FEEDBACK_COL, 'userId',         36);
await createStr(FEEDBACK_COL, 'userName',      255);
await createStr(FEEDBACK_COL, 'screenshotId',   36);
await createStr(FEEDBACK_COL, 'screenshotUrl', 512);
await createStr(FEEDBACK_COL, 'status',         20);
console.log('');

// ── 7. Settings Collection (App Release Management) ───────────────────────────
console.log('\n⚙️   Settings collection (app release)…');
await safeCreate(
  () => databases.createCollection(DB_ID, SETTINGS_COL, 'settings',
    // Any user can READ (to check for updates), only admin can WRITE
    [Permission.read(Role.any()), Permission.create(Role.label('admin')),
     Permission.update(Role.label('admin')), Permission.delete(Role.label('admin'))]),
  'Collection: settings'
);
await delay(800);
console.log('  Creating attributes:');
await createStr(SETTINGS_COL, 'version',       20);    // e.g. "1.2.0"
await createStr(SETTINGS_COL, 'win_url',       2048);  // Windows installer URL
await createStr(SETTINGS_COL, 'mac_url',       2048);  // macOS DMG URL
await createStr(SETTINGS_COL, 'linux_url',     2048);  // Linux AppImage URL
await createStr(SETTINGS_COL, 'release_notes', 5000);  // What's new text
console.log('');

// Wait for attributes to propagate before creating indexes
console.log('\n⏳  Waiting for attributes to propagate (5s)…');
await delay(5000);

// ── 5. Indexes ────────────────────────────────────────────────────────────────
console.log('\n🔍  Creating indexes…');
await safeCreate(() => databases.createIndex(DB_ID, PROJECTS_COL, 'userId_idx', IndexType.Key, ['userId']), 'projects.userId index');
await delay(300);
await safeCreate(() => databases.createIndex(DB_ID, REQUESTS_COL, 'projectId_idx', IndexType.Key, ['projectId']), 'requests.projectId index');
await delay(300);
await safeCreate(() => databases.createIndex(DB_ID, DOCS_COL, 'projectId_idx', IndexType.Key, ['projectId']), 'docs.projectId index');
await delay(300);
await safeCreate(() => databases.createIndex(DB_ID, MEMBERS_COL, 'projectId_idx', IndexType.Key, ['projectId']), 'project_members.projectId index');
await delay(300);
await safeCreate(() => databases.createIndex(DB_ID, MEMBERS_COL, 'email_idx', IndexType.Key, ['invitedEmail']), 'project_members.invitedEmail index');
await delay(300);
await safeCreate(() => databases.createIndex(DB_ID, MEMBERS_COL, 'status_idx', IndexType.Key, ['status']), 'project_members.status index');
await delay(300);
await safeCreate(() => databases.createIndex(DB_ID, FEEDBACK_COL, 'userId_idx', IndexType.Key, ['userId']), 'feedback.userId index');
await delay(300);
await safeCreate(() => databases.createIndex(DB_ID, FEEDBACK_COL, 'status_idx', IndexType.Key, ['status']), 'feedback.status index');

// ── 6. Admin User ─────────────────────────────────────────────────────────────
console.log('\n👤  Creating admin user…');
let adminUser;
try {
  adminUser = await users.create(ID.unique(), ADMIN_EMAIL, undefined, ADMIN_PASSWORD, ADMIN_NAME);
  console.log(`  ✓ Admin user created: ${ADMIN_EMAIL}`);
} catch (e) {
  if (e.code === 409) {
    console.log(`  ↩ Admin user already exists: ${ADMIN_EMAIL}`);
    const list = await users.list();
    adminUser = list.users.find(u => u.email === ADMIN_EMAIL);
  } else {
    console.error('  ✗ Could not create admin:', e.message);
  }
}

if (adminUser) {
  try {
    await users.updateLabels(adminUser.$id, ['admin']);
    console.log(`  ✓ Admin label applied to ${adminUser.name}`);
  } catch (e) {
    console.warn('  ⚠ Could not set admin label:', e.message);
  }
}

// ── 7. Appwrite Function ──────────────────────────────────────────────────────
console.log('\n⚡  Setting up manage-users function…');
const funcDir = path.join(__dirname, '..', 'appwrite-functions', 'manage-users');
const funcSrc = path.join(funcDir, 'src');
fs.mkdirSync(funcSrc, { recursive: true });

// Write function code
fs.writeFileSync(path.join(funcSrc, 'main.js'), `
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
`.trim());

fs.writeFileSync(path.join(funcDir, 'package.json'), JSON.stringify({
  name: 'manage-users', version: '1.0.0', type: 'module',
  dependencies: { 'node-appwrite': '14.0.0' }
}, null, 2));

// Create or verify function record
let funcRecord;
try {
  funcRecord = await functions.create(
    FUNCTION_ID, 'Manage Users', Runtime.Node180,
    ['label:admin']  // execute permission for admin-labelled users
  );
  console.log('  ✓ Function created');
} catch (e) {
  if (e.code === 409) {
    console.log('  ↩ Function already exists');
    funcRecord = { $id: FUNCTION_ID };
  } else {
    console.warn('  ⚠ Could not create function:', e.message);
  }
}

// Deploy function
if (funcRecord) {
  const zipPath = path.join(__dirname, 'manage-users.tar.gz');
  try {
    await new Promise((resolve, reject) => {
      const output = createWriteStream(zipPath);
      const archive = archiver('tar', { gzip: true });
      archive.on('error', reject);
      output.on('close', resolve);
      archive.pipe(output);
      archive.directory(funcDir, false);
      archive.finalize();
    });

    // Try to import InputFile
    let InputFile;
    try { ({ InputFile } = await import('node-appwrite/file')); } catch {}
    if (!InputFile) {
      try { const m = await import('node-appwrite'); InputFile = m.InputFile; } catch {}
    }

    if (InputFile) {
      const zipBuffer = fs.readFileSync(zipPath);
      await functions.createDeployment(funcRecord.$id, InputFile.fromBuffer(zipBuffer, 'code.tar.gz'), true);
      console.log('  ✓ Function deployed');
    } else {
      console.warn('  ⚠ InputFile not available — deploy function manually via Appwrite Console');
    }
    fs.rmSync(zipPath, { force: true });
  } catch (e) {
    console.warn('  ⚠ Deploy failed (deploy manually via Appwrite Console):', e.message);
    fs.rmSync(zipPath, { force: true });
  }

  // Set function env vars
  try {
    await functions.createVariable(funcRecord.$id, 'APPWRITE_API_KEY', API_KEY);
    await functions.createVariable(funcRecord.$id, 'APPWRITE_ENDPOINT', ENDPOINT);
    console.log('  ✓ Function env vars set');
  } catch (e) {
    if (e.code !== 409) console.warn('  ⚠ Could not set function vars:', e.message);
    else console.log('  ↩ Function vars already set');
  }
}

// ── Done ──────────────────────────────────────────────────────────────────────
console.log('\n\n✅  Setup complete!\n');
console.log(`📧  Admin login: ${ADMIN_EMAIL}`);
console.log(`🔑  Password:   ${ADMIN_PASSWORD}`);
console.log('\n⚠   Change the admin password after first login!\n');
console.log('🌐  Start the app: npm run dev\n');
