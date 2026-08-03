// =========================
// FIREBASE CONFIG + INIT
// (Firebase COMPAT SDK use kar rahe hain — kyunki poora project
// plain <script> tags se chalta hai, koi bundler/ES-module setup
// nahi hai. Compat SDK global "firebase" object deta hai, jise
// bina import/export ke seedha use kar sakte hain.
//
// Is file ko index.html me firebase-app-compat.js aur
// firebase-firestore-compat.js ke BAAD, lekin script.js se
// PEHLE load karna hai — taaki "db" global variable script.js
// ke QuestionSource ko available ho.
// =========================

  const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.REGION.firebasedatabase.app",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};
// Firebase App Initialize
firebase.initializeApp(firebaseConfig);

// Firestore Instance (global — script.js isko QuestionSource me use karega)
const db = firebase.firestore();

// Analytics (optional — sirf browser me kaam karta hai, error aaye
// to bhi quiz nahi rukega)
try {
    firebase.analytics();
} catch (err) {
    console.warn("Firebase Analytics load nahi ho paya:", err);
}
