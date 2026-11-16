import fs from 'fs';
import path from 'path';
import { getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';

interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId?: string;
}

let cachedConfig: FirebaseAppletConfig | null = null;

function loadFirebaseConfig(): FirebaseAppletConfig | null {
  if (cachedConfig) return cachedConfig;
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) return null;
  try {
    cachedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8')) as FirebaseAppletConfig;
    return cachedConfig;
  } catch {
    return null;
  }
}

function getFirebaseAdminApp(): App | null {
  const cfg = loadFirebaseConfig();
  if (!cfg?.projectId) return null;
  const existing = getApps().find((a) => a.name === 'xecutive-firebase-admin');
  if (existing) return existing;
  return initializeApp({ projectId: cfg.projectId }, 'xecutive-firebase-admin');
}

export function getFirebaseProjectId(): string | null {
  return loadFirebaseConfig()?.projectId ?? null;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<DecodedIdToken> {
  const adminApp = getFirebaseAdminApp();
  if (!adminApp) {
    throw new Error('Firebase project configuration is missing.');
  }
  return getAuth(adminApp).verifyIdToken(idToken, false);
}
