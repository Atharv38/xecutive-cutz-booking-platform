import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type User } from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

function createFirestoreInstance(): Firestore {
  const databaseId = firebaseConfig.firestoreDatabaseId;
  try {
    return initializeFirestore(
      app,
      {
        experimentalForceLongPolling: true,
      },
      databaseId
    );
  } catch {
    return getFirestore(app, databaseId);
  }
}

export const db = createFirestoreInstance();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (retryError) {
        if (retryError instanceof Error && retryError.message.includes('the client is offline')) {
          console.error('Please check your Firebase configuration.');
        }
      }
    }
  }
}
testConnection();

const UID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;
const inFlightProfileSyncs = new Map<string, Promise<void>>();

export async function syncFirebaseUserProfile(user: User, phone?: string): Promise<void> {
  if (!user.emailVerified || !UID_REGEX.test(user.uid) || !user.email) {
    return;
  }

  const existingSync = inFlightProfileSyncs.get(user.uid);
  if (existingSync) {
    return existingSync;
  }

  const runSync = (async () => {
    const userPath = `users/${user.uid}`;
    const ref = doc(db, 'users', user.uid);
    const fullName = (user.displayName || user.email!.split('@')[0] || 'Client').slice(0, 120);
    const email = user.email!.slice(0, 180);
    const safePhoto = user.photoURL ? user.photoURL.slice(0, 500) : '';
    const safePhone = phone ? phone.slice(0, 40) : '';

    let snap;
    try {
      snap = await getDoc(ref);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, userPath);
    }

    if (!snap.exists()) {
      try {
        await setDoc(ref, {
          uid: user.uid,
          fullName,
          email,
          phone: safePhone,
          photoUrl: safePhoto,
          emailVerified: Boolean(user.emailVerified),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, userPath);
      }
    } else {
      try {
        await updateDoc(ref, {
          fullName,
          ...(safePhone ? { phone: safePhone } : {}),
          photoUrl: safePhoto,
          emailVerified: Boolean(user.emailVerified),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, userPath);
      }
    }
  })();

  inFlightProfileSyncs.set(user.uid, runSync);
  try {
    await runSync;
  } finally {
    inFlightProfileSyncs.delete(user.uid);
  }
}
