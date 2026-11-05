// The Firebase web app: sign-in and Firestore reads. Writes go through the Worker (docs/decisions/ledger.md).
import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

const emulators = import.meta.env.VITE_USE_EMULATORS === 'true'

export const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'emulator',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-kudocoin',
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
})

export const auth = getAuth(app)
export const db = getFirestore(app)

if (emulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:18612', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 18613)
}
