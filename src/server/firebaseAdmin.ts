import 'dotenv/config';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

let appletConfig: any = {};
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    appletConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (err) {
  console.error('[Firebase Admin] Failed to read firebase-applet-config.json:', err);
}

const projectId = process.env.FIREBASE_PROJECT_ID || appletConfig.projectId;
const databaseId = process.env.FIREBASE_DATABASE_ID || appletConfig.firestoreDatabaseId;

console.log('[Firebase Admin] Target Project:', projectId || '(default)');
console.log('[Firebase Admin] Target Database:', databaseId || '(default)');

let app;
try {
  if (getApps().length === 0) {
    app = initializeApp({ 
      projectId: projectId || undefined 
    });
    console.log('[Firebase Admin] App initialized');
  } else {
    app = getApps()[0];
    console.log('[Firebase Admin] Using existing app');
  }
} catch (error) {
  console.error('[Firebase Admin] Initialization error:', error);
  throw error;
}

// Ensure databaseId is not just an empty string or "null" literal
const sanitizedDatabaseId = (databaseId && databaseId !== 'null' && databaseId !== '(default)') ? databaseId : undefined;

export const db = getFirestore(app, sanitizedDatabaseId);
export const auth = getAuth(app);
