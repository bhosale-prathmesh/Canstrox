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
    apiKey: "AIzaSyAQI9INNkcRZ4zc9N_0DSo-77tk8Io4dwY",
    authDomain: "learnova-launch.firebaseapp.com",
    databaseURL: "https://learnova-launch-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "learnova-launch",
    storageBucket: "learnova-launch.firebasestorage.app",
    messagingSenderId: "582265849910",
    appId: "1:582265849910:web:b5c90b78c5f2f9c860b097",
    measurementId: "G-X2GGME9WMZ"
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