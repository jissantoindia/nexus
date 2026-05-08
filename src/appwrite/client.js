import { Client, Account, Databases, Functions, Storage, ID, Query } from 'appwrite';

const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID || '');

export const account   = new Account(client);
export const databases = new Databases(client);
export const functions = new Functions(client);
export const storage   = new Storage(client);
export { ID, Query };

export const DB_ID        = import.meta.env.VITE_APPWRITE_DATABASE_ID        || 'nexusapi-db';
export const PROJECTS_COL  = import.meta.env.VITE_APPWRITE_PROJECTS_COLLECTION_ID || 'projects';
export const REQUESTS_COL  = import.meta.env.VITE_APPWRITE_REQUESTS_COLLECTION_ID || 'requests';
export const DOCS_COL      = import.meta.env.VITE_APPWRITE_DOCS_COLLECTION_ID  || 'docs';
export const MEMBERS_COL    = import.meta.env.VITE_APPWRITE_MEMBERS_COLLECTION_ID  || 'project_members';
export const FEEDBACK_COL   = import.meta.env.VITE_APPWRITE_FEEDBACK_COLLECTION_ID || 'feedback';
export const FEEDBACK_BUCKET = import.meta.env.VITE_APPWRITE_FEEDBACK_BUCKET_ID    || 'feedback-screenshots';
export const MANAGE_USERS_FN = import.meta.env.VITE_APPWRITE_MANAGE_USERS_FUNCTION_ID || 'nexus-manage-users';
export const SETTINGS_COL   = import.meta.env.VITE_APPWRITE_SETTINGS_COLLECTION_ID || 'settings';
export const APP_RELEASE_DOC = 'app_release'; // fixed document ID for release info

export default client;
