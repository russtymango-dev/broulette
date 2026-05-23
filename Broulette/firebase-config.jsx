// firebase-config.jsx — Firebase initialization + emulator detection
//
// IMPORTANT: Replace the firebaseConfig object below with your real
// Firebase project credentials before deploying to production.
// Get these from: Firebase Console → Project Settings → Your apps → Web app

const firebaseConfig = {
  apiKey: "AIzaSyC-VMCVPEYQ7PeOYII5zZ4np-Gq_dHi9qs",
  authDomain: "broulette-4f978.firebaseapp.com",
  projectId: "broulette-4f978",
  storageBucket: "broulette-4f978.firebasestorage.app",
  messagingSenderId: "1011367736800",
  appId: "1:1011367736800:web:6c5e0b0928bb9d99546785"
};

// Initialize Firebase
const firebaseApp = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Connect to emulators when running locally
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  db.useEmulator('localhost', 8080);
  auth.useEmulator('http://localhost:9099');
  console.log('[Broulette] Connected to Firebase emulators');
}

// Game ID — single game instance
const GAME_ID = 'main';

// SHA-256 hash utility for PINs
async function hashPin(pin) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + '_broulette_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Firestore helpers
const gameRef = db.collection('games').doc(GAME_ID);
const playersRef = gameRef.collection('players');
const betsRef = gameRef.collection('bets');
const rouletteBetsRef = gameRef.collection('rouletteBets');
const rouletteHistoryRef = gameRef.collection('rouletteHistory');
const transfersRef = gameRef.collection('transfers');
const activityRef = gameRef.collection('activityLog');
const sipRequestsRef = gameRef.collection('sipRequests');
const regRequestsRef = gameRef.collection('registrationRequests');

// Expose globally
Object.assign(window, {
  db, auth, firebaseApp, GAME_ID, hashPin,
  gameRef, playersRef, betsRef, rouletteBetsRef, rouletteHistoryRef,
  transfersRef, activityRef, sipRequestsRef, regRequestsRef,
});
