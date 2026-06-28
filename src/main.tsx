import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from './lib/firebase';
import App from './App.tsx';
import './index.css';

// Test connection on boot
async function testConnection() {
  try {
    // Attempt to reach the test collection
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Omni Backend Connected");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Omni Backend Offline: Check configuration.");
    } else {
      console.error("Omni Backend Connection Issue:", error);
    }
  }
}

testConnection();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
