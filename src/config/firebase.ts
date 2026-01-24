import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCG7QOtB7a7uZzzFo5kOMOKPoLIELTkOk4",
  authDomain: "hpservices-29a44.firebaseapp.com",
  databaseURL: "https://hpservices-29a44-default-rtdb.firebaseio.com",
  projectId: "hpservices-29a44",
  storageBucket: "hpservices-29a44.firebasestorage.app",
  messagingSenderId: "542845890290",
  appId: "1:542845890290:web:18d83a41e196b1cc2a6a6b",
  measurementId: "G-B8PVV22FM1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;

