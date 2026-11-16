import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { apiFetch, getStoredSessionToken, setStoredSessionToken } from '../lib/api';
import { auth, googleProvider, syncFirebaseUserProfile } from '../lib/firebase';
import type { UserProfile } from '../types';

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  firebaseReady: boolean;
  refreshUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<UserProfile>;
  loginWithGoogle: () => Promise<UserProfile>;
  register: (data: {
    full_name: string;
    email: string;
    phone: string;
    password: string;
  }) => Promise<{ user: UserProfile; verificationToken?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [firebaseReady, setFirebaseReady] = useState(false);

  const refreshUser = useCallback(async () => {
    try {
      const res = await apiFetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user || null);
        if (!data.user) {
          setStoredSessionToken(null);
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const googleSignInActiveRef = React.useRef(false);

  const exchangeFirebaseToken = useCallback(async (idToken: string): Promise<UserProfile> => {
    const res = await fetch('/api/auth/firebase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ idToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Firebase authentication verification failed.');
    if (data.sessionToken) setStoredSessionToken(data.sessionToken);
    setUser(data.user);
    return data.user;
  }, []);

  useEffect(() => {
    refreshUser();
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseReady(true);
      if (fbUser && fbUser.emailVerified && !googleSignInActiveRef.current) {
        try {
          await syncFirebaseUserProfile(fbUser).catch((err) => {
            console.warn('Firestore profile sync warning:', err);
          });
          if (!getStoredSessionToken()) {
            const idToken = await fbUser.getIdToken();
            await exchangeFirebaseToken(idToken);
          }
        } catch (err) {
          console.warn('Background Firebase session restore warning:', err);
        }
      }
    });
    return () => unsub();
  }, [refreshUser, exchangeFirebaseToken]);

  const login = async (email: string, password: string): Promise<UserProfile> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Sign in failed.');
    if (data.sessionToken) setStoredSessionToken(data.sessionToken);
    setUser(data.user);
    return data.user;
  };

  const loginWithGoogle = async (): Promise<UserProfile> => {
    googleSignInActiveRef.current = true;
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const idToken = await cred.user.getIdToken();

      const signedInUser = await exchangeFirebaseToken(idToken);

      // Sync profile in Firestore (owner-only PII) without blocking session establishment
      syncFirebaseUserProfile(cred.user).catch((err) => {
        console.warn('Firestore profile sync warning:', err);
      });

      return signedInUser;
    } catch (err: any) {
      const code = err?.code as string | undefined;
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        throw new Error('Google sign-in popup was closed before completing.');
      }
      if (code === 'auth/popup-blocked') {
        throw new Error('Popup was blocked by your browser. Please allow popups for this site and try again.');
      }
      if (code === 'auth/unauthorized-domain') {
        throw new Error(`This domain (${window.location.hostname}) is not authorized in Firebase Authentication.`);
      }
      if (code === 'auth/operation-not-allowed') {
        throw new Error('Google Sign-In is not enabled in Firebase Authentication for this project.');
      }
      throw err instanceof Error ? err : new Error('Google sign-in failed.');
    } finally {
      googleSignInActiveRef.current = false;
    }
  };

  const register = async (payload: {
    full_name: string;
    email: string;
    phone: string;
    password: string;
  }) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed.');
    if (data.sessionToken) setStoredSessionToken(data.sessionToken);
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch {
      // Ignore Firebase signOut error if not signed in via Firebase
    }
    setStoredSessionToken(null);
    await apiFetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, firebaseReady, refreshUser, login, loginWithGoogle, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
