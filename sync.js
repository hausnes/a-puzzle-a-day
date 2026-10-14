// Innlogging og synkronisering med Firebase. game.js laster inn denne fila bare for spillere
// som bruker innlogging, så spillet virker (og er like raskt) uten konto og uten nett.
// Hver spiller har ett dokument, players/{uid}; sikkerhetsreglene i Firestore sørger for
// at ingen kan lese eller skrive andres.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut,
  reauthenticateWithPopup, deleteUser,
} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';

// Denne er ikke hemmelig: den sier bare hvilket Firebase-prosjekt spillet hører til.
// Google Analytics (measurementId) startes ikke før vi har et samtykkebanner.
const firebaseConfig = {
  apiKey: 'AIzaSyCoE8KyYbBRGzSIMbwKeOgggbOkRQOwiDQ',
  authDomain: 'a-puzzle-a-day-7067f.firebaseapp.com',
  projectId: 'a-puzzle-a-day-7067f',
  storageBucket: 'a-puzzle-a-day-7067f.firebasestorage.app',
  messagingSenderId: '1053399791164',
  appId: '1:1053399791164:web:1c3414559918a217213539',
  measurementId: 'G-238C6GDTZ1',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = 'no';
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

const playerDoc = () => doc(db, 'players', auth.currentUser.uid);

export const onUser = callback => onAuthStateChanged(auth, callback);
export const signIn = () => signInWithPopup(auth, provider);
export const signOut = () => firebaseSignOut(auth);

export async function pull() {
  const snap = await getDoc(playerDoc());
  return snap.exists() ? snap.data() : null;
}

export const push = data => setDoc(playerDoc(), data);

// Sletter både dataene og kontoen. Google krever en fersk innlogging for å slette en konto,
// så vi ber om den først, mens vi ennå er i klikket (ellers blokkeres innloggingsvinduet).
export async function deleteAccount() {
  await reauthenticateWithPopup(auth.currentUser, provider);
  await deleteDoc(playerDoc());
  await deleteUser(auth.currentUser);
}
