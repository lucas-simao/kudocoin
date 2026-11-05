export interface Env {
  FIREBASE_PROJECT_ID: string
  ALLOWED_ORIGINS: string
  FIREBASE_CLIENT_EMAIL?: string
  FIREBASE_PRIVATE_KEY?: string
  /** host:port of the Firestore emulator. Development only. */
  FIRESTORE_EMULATOR_HOST?: string
  /** "true" accepts the Auth emulator's unsigned tokens. Development only. */
  AUTH_EMULATOR?: string
  /** The Slack app's client ID (docs/decisions/slack.md). Empty: Slack is off. */
  SLACK_CLIENT_ID?: string
  SLACK_CLIENT_SECRET?: string
  SLACK_SIGNING_SECRET?: string
  /** Signs the Worker's Slack tokens and seals the workspace tokens. */
  SLACK_KEY?: string
  /** Slack's Web API and where its replies go. Set only for the end-to-end tests, which fake Slack. */
  SLACK_API_URL?: string
  SLACK_HOOKS_URL?: string
}
