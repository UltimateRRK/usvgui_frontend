/**
 * Firebase Realtime Database Service
 *
 * Connects the frontend to Firebase RTDB for:
 * - Receiving live sensor readings from the USV (Pi → Firebase → here)
 * - Uploading missions/waypoints (here → Firebase → Pi)
 */

import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
    apiKey: "AIzaSyB_5pPg5jdDRPTXAvpvNWi_RKkvlZJYNxw",
    authDomain: "usv-water-quality-1a12.firebaseapp.com",
    databaseURL:
        "https://usv-water-quality-1a12-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "usv-water-quality-1a12",
    storageBucket: "usv-water-quality-1a12.firebasestorage.app",
    messagingSenderId: "113712384907",
    appId: "1:113712384907:web:632acdf47c44f81699fd8e",
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
