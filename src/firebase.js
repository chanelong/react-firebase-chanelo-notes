import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAn7ToI84uQERaqlVXNV0h6G33fuXo0HbA",
  authDomain: "note-app-21767.firebaseapp.com",
  projectId: "note-app-21767",
  storageBucket: "note-app-21767.firebasestorage.app",
  messagingSenderId: "1000176976312",
  appId: "1:1000176976312:web:1a5966618cff976b9b0f4d",
  measurementId: "G-XDWTYGY549"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);