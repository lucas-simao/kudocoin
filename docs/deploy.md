# Publishing

Every merge to `main` publishes the Firestore rules, the Worker and the web app (`.github/workflows/deploy.yml`). This page is the one-time setup behind it. Everything stays on free plans with no card on file (`docs/decisions/zero-cost-hosting.md`).

## 1. Firebase

1. At console.firebase.google.com, add a project. Analytics can stay off. A new project is on the free Spark plan.
2. **Firestore**: Build → Firestore Database → Create database, in production mode. Pick the location once; it cannot change.
3. **Sign-in**: Build → Authentication → Get started → Sign-in method.
   - **Google**: enable it.
   - **GitHub**: enable it and copy the callback URL Firebase shows (`https://<project>.firebaseapp.com/__/auth/handler`). On GitHub, Settings → Developer settings → OAuth Apps → New OAuth App, with that callback URL, then paste its Client ID and a new client secret back into Firebase.
4. **Allowed domains**: Authentication → Settings → Authorized domains → add the app's domain (`kudocoin.pages.dev`).
5. **Web app settings**: Project settings → General → Your apps → add a web app. Keep `apiKey`, `authDomain`, `projectId` and `appId`; they are public by design.
6. **Service account**: Project settings → Service accounts → Generate new private key. The JSON file is a secret: it goes only into the GitHub secret below. If the deploy cannot publish the rules, give this account the roles *Firebase Rules Admin* and *Cloud Datastore Index Admin* in Google Cloud's IAM.

## 2. Cloudflare

1. A Cloudflare account on the free plan.
2. The account ID: on the dashboard's home, the account's menu → Copy account ID.
3. An API token: My Profile → API Tokens → Create token → Custom token, with **Account → Workers Scripts → Edit** and **Account → Cloudflare Pages → Edit**, for this account only.

## 3. GitHub

In the repository, Settings → Secrets and variables → Actions.

**Secrets**

| Name | Value |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | The whole service account JSON |
| `CLOUDFLARE_API_TOKEN` | The token |
| `CLOUDFLARE_ACCOUNT_ID` | The account ID |

**Variables**

| Name | Value |
| --- | --- |
| `FIREBASE_PROJECT_ID` | The project ID (the deploy waits until this is set) |
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_APP_ID` | `appId` |
| `PAGES_PROJECT` | Optional, `kudocoin` by default; the app is at `https://<PAGES_PROJECT>.pages.dev` |
| `APP_ORIGIN` | Optional, `https://kudocoin.pages.dev` by default; must match the app's address |

Then Actions → Deploy → Run workflow, or merge anything to `main`.

## After

- The Worker's address appears in the deploy log and in the app's build; the app talks to it directly.
- To check the free quotas: Firebase's Usage tab and Cloudflare's Workers overview.
