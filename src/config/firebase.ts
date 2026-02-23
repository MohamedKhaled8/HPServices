import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase configuration using Environment Variables for better security/portability
export const firebaseConfig = {
  apiKey: "AIzaSyCG7QOtB7a7uZzzFo5kOMOKPoLIELTkOk4",
  authDomain: "hpservices-29a44.firebaseapp.com",
  databaseURL: "https://hpservices-29a44-default-rtdb.firebaseio.com",
  projectId: "hpservices-29a44",
  storageBucket: "hpservices-29a44.appspot.com",
  messagingSenderId: "542845890290",
  appId: "1:542845890290:web:18d83a41e196b1cc2a6a6b",
  measurementId: "G-B8PVV22FM1"
};

// فحص سريع لمتغيرات البيئة لحل مشكلة الشاشة البيضاء في Vercel
if (!firebaseConfig.apiKey) {
  console.warn("FIREBASE API KEY IS MISSING. Make sure to add VITE_FIREBASE_API_KEY in Vercel Environment Variables. Using default local values if possible.");
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
