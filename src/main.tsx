import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from './lib/firebase';
import App from './App.tsx';
import './index.css';

// Test connection on boot
async function testConnection() {
  console.log("Firebase Config:", {
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    databaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID,
  });
  try {
    // Attempt to reach the test collection
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Omni Backend Connected");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Omni Backend Offline: Operating in offline mode. Cache enabled.");
    } else {
      console.warn("Omni Backend Connection Info (Offline Mode):", error);
    }
  }
}

testConnection();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
