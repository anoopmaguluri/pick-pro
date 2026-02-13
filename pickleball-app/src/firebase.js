import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyA96usJJtS7sKrjBhHxH7qFxnUjLmFJPNU',
  authDomain: 'pickleball-c5563.firebaseapp.com',
  databaseURL: 'https://pickleball-c5563-default-rtdb.firebaseio.com',
  projectId: 'pickleball-c5563',
  storageBucket: 'pickleball-c5563.firebasestorage.app',
  messagingSenderId: '209441917633',
  appId: '1:209441917633:web:22a1bad4e9dbb891b66240',
  measurementId: 'G-K6XZS4ECSN',
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
