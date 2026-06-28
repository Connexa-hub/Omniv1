import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import * as fs from 'fs';
import * as path from 'path';

let projectId = 'gen-lang-client-0794808429';
let databaseId = 'ai-studio-projectomni-eb6cea37-6418-4894-8b3c-83cf8594705a';

try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.projectId) projectId = config.projectId;
    if (config.firestoreDatabaseId) databaseId = config.firestoreDatabaseId;
  }
} catch (e) {
  console.error("Failed to load firebase config", e);
}

const app = getApps().length === 0 
  ? initializeApp({
      projectId: projectId || process.env.FIREBASE_PROJECT_ID,
    })
  : getApps()[0];

console.log('[Firebase Admin Setup] Env project ID:', process.env.FIREBASE_PROJECT_ID);
console.log('[Firebase Admin Setup] Config project ID:', projectId);
console.log('[Firebase Admin Setup] Final project ID:', process.env.FIREBASE_PROJECT_ID || projectId);
console.log('[Firebase Admin Setup] Database ID:', databaseId);

export const db = getFirestore(app, databaseId);
export const auth = getAuth(app);

