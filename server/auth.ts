import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { db } from './db';

const SESSION_COOKIE = 'xc_session';
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  crypto.createHash('sha256').update(process.cwd() + '_xecutive_cutz_secret').digest('hex');

export interface AuthUser {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: 'customer' | 'admin';
  email_verified: boolean;
  created_at: string;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

interface SessionPayload {
  uid: string;
  exp: number;
}

export function signSessionToken(userId: string): string {
  const payload: SessionPayload = {
    uid: userId,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.uid || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      out[k] = decodeURIComponent(v);
    }
  }
  return out;
}

export function getUserFromRequest(req: Request): AuthUser | null {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE] || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined);
  const payload = verifySessionToken(token);
  if (!payload) return null;

  const row = db
    .prepare(
      `SELECT p.id, p.full_name, p.email, p.phone, p.email_verified, p.created_at, COALESCE(r.role, 'customer') as role
       FROM profiles p
       LEFT JOIN user_roles r ON r.user_id = p.id
       WHERE p.id = ?`
    )
    .get(payload.uid) as
    | {
        id: string;
        full_name: string;
        email: string;
        phone: string;
        email_verified: number;
        created_at: string;
        role: 'customer' | 'admin';
      }
    | undefined;

  if (!row) return null;
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    email_verified: Boolean(row.email_verified),
    created_at: row.created_at,
  };
}

function isHttpsRequest(req?: Request): boolean {
  if (!req) return Boolean(process.env.APP_URL?.startsWith('https://'));
  const proto = req.headers['x-forwarded-proto'];
  return req.secure || proto === 'https' || (Array.isArray(proto) && proto.includes('https'));
}

export function setSessionCookie(res: Response, token: string, req?: Request): void {
  const https = isHttpsRequest(req);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: https ? 'none' : 'lax',
    secure: https,
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });
}

export function clearSessionCookie(res: Response, req?: Request): void {
  const https = isHttpsRequest(req);
  res.clearCookie(SESSION_COOKIE, {
    path: '/',
    sameSite: https ? 'none' : 'lax',
    secure: https,
  });
}

export function attachOptionalUser(req: AuthedRequest, _res: Response, next: NextFunction): void {
  req.user = getUserFromRequest(req) ?? undefined;
  next();
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const user = getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  req.user = user;
  next();
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  const user = getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden: Administrator access required.' });
    return;
  }
  req.user = user;
  next();
}
