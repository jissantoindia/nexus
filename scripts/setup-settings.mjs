#!/usr/bin/env node
/**
 * Creates ONLY the `settings` collection for App Release Management.
 * Run this if you already ran the full setup and just need the new collection:
 *   node scripts/setup-settings.mjs
 */
import { Client, Databases, Permission, Role } from 'node-appwrite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) { console.error('❌  .env not found'); process.exit(1); }
for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq < 0) continue;
  const k = t.slice(0, eq).trim(), v = t.slice(eq + 1).trim();
  if (!process.env[k]) process.env[k] = v;
}

const ENDPOINT   = process.env.APPWRITE_ENDPOINT   || process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID || '';
const API_KEY    = process.env.APPWRITE_API_KEY || '';
const DB_ID      = process.env.VITE_APPWRITE_DATABASE_ID || 'nexusapi-db';
const SETTINGS_COL = process.env.VITE_APPWRITE_SETTINGS_COLLECTION_ID || 'settings';

if (!PROJECT_ID || !API_KEY) {
  console.error('❌  Missing APPWRITE_PROJECT_ID or APPWRITE_API_KEY in .env');
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
const db = new Databases(client);

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

console.log('\n⚙️  Creating settings collection…\n');

// Create collection
try {
  await db.createCollection(DB_ID, SETTINGS_COL, 'settings', [
    Permission.read(Role.any()),                    // anyone can read release info
    Permission.create(Role.label('admin')),         // only admin can write
    Permission.update(Role.label('admin')),
    Permission.delete(Role.label('admin')),
  ]);
  console.log('  ✓ Collection: settings created');
} catch (e) {
  if (e.code === 409) console.log('  ↩ Collection: settings already exists');
  else { console.error('  ✗', e.message); process.exit(1); }
}

await delay(1000);

// Create attributes
const attrs = [
  ['version',       20,   'App version string e.g. 1.2.0'],
  ['win_url',       2048, 'Windows installer download URL'],
  ['mac_url',       2048, 'macOS DMG download URL'],
  ['linux_url',     2048, 'Linux AppImage download URL'],
  ['release_notes', 5000, 'What\'s new in this version'],
];

for (const [key, size, desc] of attrs) {
  try {
    await db.createStringAttribute(DB_ID, SETTINGS_COL, key, size, false);
    console.log(`  ✓ Attribute: ${key} (${desc})`);
    await delay(300);
  } catch (e) {
    if (e.code === 409) console.log(`  ↩ Attribute: ${key} already exists`);
    else console.error(`  ✗ Attribute ${key}:`, e.message);
  }
}

console.log('\n✅  Done! You can now use the Admin panel → App Release Management.\n');
console.log('   Set version higher than 1.0.0 to test the update banner.\n');
