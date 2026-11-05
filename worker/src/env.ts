export interface Env {
  FIREBASE_PROJECT_ID: string
  ALLOWED_ORIGINS: string
  FIREBASE_CLIENT_EMAIL?: string
  FIREBASE_PRIVATE_KEY?: string
  /** host:port of the Firestore emulator. Development only. */
  FIRESTORE_EMULATOR_HOST?: string
  /** "true" accepts the Auth emulator's unsigned tokens. Development only. */
  AUTH_EMULATOR?: string
}
