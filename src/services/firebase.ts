/**
 * Firebase Realtime Database Service
 *
 * Connects the frontend to Firebase RTDB for:
 * - Receiving live sensor readings from the USV (Pi → Firebase → here)
 * - Uploading missions/waypoints (here → Firebase → Pi)
 *
 * Authentication: Uses anonymous auth so Security Rules can gate access.
 */

import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
export const auth = getAuth(app);

/**
 * Sign in anonymously. Returns a promise that resolves once the user
 * has a valid auth session. All Firebase reads/writes should wait for
 * this before subscribing to data.
 */
export const authReady: Promise<void> = signInAnonymously(auth)
    .then(() => {
        console.log("Firebase: Anonymous auth successful");
    })
    .catch((error) => {
        console.error("Firebase: Anonymous auth failed:", error.message);
    });
