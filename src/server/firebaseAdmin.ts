import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const projectId = 'gen-lang-client-0224047921';
const databaseId = 'ai-studio-projectomni-eb6cea37-6418-4894-8b3c-83cf8594705a';

const app = getApps().length === 0 
  ? initializeApp({ projectId: projectId || undefined })
  : getApps()[0];

export const db = getFirestore(app, databaseId);
export const auth = getAuth(app);

console.log('[Firebase Admin Setup] Initialized for project:', projectId, 'database:', databaseId);
