import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import 'dotenv/config';
import { db, hashPassword, initDatabase, verifyPassword } from './server/db';
import {
  attachOptionalUser,
  clearSessionCookie,
  requireAdmin,
  requireAuth,
  setSessionCookie,
  signSessionToken,
  type AuthedRequest,
} from './server/auth';
import {
  computeAvailableSlots,
  createAppointmentTransactional,
  getChicagoNow,
  getMonthAvailabilitySummary,
  rescheduleAppointmentTransactional,
} from './server/bookingEngine';
import { getFirebaseProjectId, verifyFirebaseIdToken } from './server/firebaseAdmin';
import { dispatchBookingNotification } from './server/notifications';
import {
  checkSupabaseSchemaStatus,
  deleteBookingFromSupabase,
  fetchSupabaseAdminSnapshot,
  getSupabaseConfigInfo,
  syncBookingRescheduleToSupabase,
  syncBookingStatusToSupabase,
  syncBookingToSupabase,
  syncCustomerProfileToSupabase,
  updateCustomerInSupabase,
  type SupabaseSchemaStatus,
} from './server/supabaseSync';
import type { AppointmentItem, BusinessSettings, CustomerProfileType } from './src/types';

initDatabase();

const app = express();
app.use(express.json({ limit: '5mb' }));

// Ensure upload directory exists
const UPLOADS_DIR = path.resolve(process.cwd(), 'public', 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${safeExt}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.use('/uploads', express.static(UPLOADS_DIR));

// Helpers to parse booleans & JSON cleanly
function mapService(row: any) {
  return {
    ...row,
    is_active: Boolean(row.is_active),
    is_owner_approved: Boolean(row.is_owner_approved),
  };
}

function mapBarber(row: any) {
  let specialties: string[] = [];
  try {
    specialties = JSON.parse((row.specialties as string) || '[]');
  } catch {
    specialties = [];
  }
  return {
    ...row,
    specialties,
    is_active: Boolean(row.is_active),
    is_placeholder: Boolean(row.is_placeholder),
  };
}

function mapSettings(row: any) {
  return {
    ...row,
    allow_guest_booking: Boolean(row.allow_guest_booking),
    require_admin_confirmation: Boolean(row.require_admin_confirmation),
    email_notifications_enabled: Boolean(row.email_notifications_enabled),
  };
}

interface LocalSyncSummary {
  ok: boolean;
  syncedAppointments: number;
  syncedCustomers: number;
  syncedProfiles: number;
  status: SupabaseSchemaStatus;
  error?: string;
}

let lastSyncTimestamp = 0;
let lastSyncResult: LocalSyncSummary | null = null;
let inFlightSync: Promise<LocalSyncSummary> | null = null;

async function syncSupabaseToLocalDb(force = false): Promise<LocalSyncSummary> {
  if (!force && lastSyncResult && Date.now() - lastSyncTimestamp < 2500) {
    return lastSyncResult;
  }
  if (inFlightSync) {
    return inFlightSync;
  }

  inFlightSync = (async (): Promise<LocalSyncSummary> => {
    const [status, snapshot] = await Promise.all([
      checkSupabaseSchemaStatus(),
      fetchSupabaseAdminSnapshot(),
    ]);

    if (!snapshot.ok) {
      const failSummary: LocalSyncSummary = {
        ok: false,
        syncedAppointments: 0,
        syncedCustomers: 0,
        syncedProfiles: 0,
        status,
        error: snapshot.error || status.statusMessage,
      };
      lastSyncTimestamp = Date.now();
      lastSyncResult = failSummary;
      return failSummary;
    }

    let syncedAppointments = 0;
    let syncedCustomers = 0;
    let syncedProfiles = 0;

    const validStatuses = new Set(['pending', 'confirmed', 'completed', 'cancelled', 'no_show']);
    const validCustomerStatuses = new Set(['active', 'vip', 'blocked']);

    db.transaction(() => {
      // 1. Reconcile Services (prevent FK errors on appointments)
      const localServices = db.prepare('SELECT id, name FROM services').all() as { id: string; name: string }[];
      const serviceById = new Map(localServices.map((s) => [s.id, s.id]));
      const serviceByName = new Map(localServices.map((s) => [s.name.trim().toLowerCase(), s.id]));

      const insertService = db.prepare(
        `INSERT INTO services (id, name, description, price_cents, duration_minutes, image_url, is_active, is_owner_approved, display_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      for (const s of snapshot.services) {
        const sName = String(s.name || '').trim();
        if (!sName) continue;
        if (serviceById.has(s.id)) continue;
        const matchByName = serviceByName.get(sName.toLowerCase());
        if (matchByName) {
          serviceById.set(s.id, matchByName);
          continue;
        }
        const newSvcId = String(s.id || crypto.randomUUID());
        insertService.run(
          newSvcId,
          sName,
          s.description || '',
          s.price_cents ?? 3500,
          s.duration_minutes ?? 45,
          s.image_url || '/assets/local/service_haircut_fade.jpg',
          s.is_active !== false ? 1 : 0,
          s.is_owner_approved !== false ? 1 : 0,
          Number(s.display_order || 99)
        );
        serviceById.set(newSvcId, newSvcId);
        serviceByName.set(sName.toLowerCase(), newSvcId);
      }

      // 2. Reconcile Barbers (prevent FK errors on appointments)
      const localBarbers = db.prepare('SELECT id, full_name FROM barbers').all() as { id: string; full_name: string }[];
      const barberById = new Map(localBarbers.map((b) => [b.id, b.id]));
      const barberByName = new Map(localBarbers.map((b) => [b.full_name.trim().toLowerCase(), b.id]));

      const insertBarber = db.prepare(
        `INSERT INTO barbers (id, full_name, title, bio, image_url, specialties, is_active, is_placeholder)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const insertSched = db.prepare(
        `INSERT OR IGNORE INTO barber_schedules (id, barber_id, day_of_week, is_working, start_time, end_time, break_start, break_end)
         VALUES (?, ?, ?, ?, '08:00', '19:00', ?, ?)`
      );

      for (const b of snapshot.barbers) {
        const bName = String(b.full_name || '').trim();
        if (!bName) continue;
        if (barberById.has(b.id)) continue;
        const matchByName = barberByName.get(bName.toLowerCase());
        if (matchByName) {
          barberById.set(b.id, matchByName);
          continue;
        }
        const newBarberId = String(b.id || crypto.randomUUID());
        const specialties = Array.isArray(b.specialties)
          ? JSON.stringify(b.specialties)
          : typeof b.specialties === 'string'
          ? b.specialties
          : '[]';
        insertBarber.run(
          newBarberId,
          bName,
          b.title || 'Barber',
          b.bio || '',
          b.image_url || '/assets/local/barber_portrait_studio.jpg',
          specialties,
          b.is_active !== false ? 1 : 0,
          b.is_placeholder ? 1 : 0
        );
        for (let d = 0; d <= 6; d++) {
          const works = d >= 2 && d <= 6 ? 1 : 0;
          insertSched.run(crypto.randomUUID(), newBarberId, d, works, works ? '13:00' : null, works ? '13:30' : null);
        }
        barberById.set(newBarberId, newBarberId);
        barberByName.set(bName.toLowerCase(), newBarberId);
      }

      // 3. Reconcile Supabase Auth Profiles
      for (const p of snapshot.profiles) {
        const email = String(p.email || '').trim().toLowerCase();
        if (!email) continue;
        const existingProf = db
          .prepare('SELECT id, email_verified FROM profiles WHERE LOWER(email) = ?')
          .get(email) as { id: string; email_verified: number } | undefined;

        if (!existingProf) {
          const newProfId = String(p.id || crypto.randomUUID());
          db.prepare(
            `INSERT INTO profiles (id, full_name, email, phone, password_hash, email_verified, auth_provider, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 'supabase', COALESCE(?, datetime('now')))`
          ).run(
            newProfId,
            String(p.full_name || email.split('@')[0] || 'Client'),
            email,
            String(p.phone || ''),
            hashPassword(crypto.randomBytes(24).toString('hex')),
            p.email_verified ? 1 : 0,
            p.created_at || null
          );
          const targetRole = email === 'admin@xecutivecutz.com' ? 'admin' : 'customer';
          db.prepare(`INSERT OR IGNORE INTO user_roles (id, user_id, role) VALUES (?, ?, ?)`).run(
            crypto.randomUUID(),
            newProfId,
            targetRole
          );
          syncedProfiles++;
        } else if (p.email_verified && !existingProf.email_verified) {
          db.prepare(`UPDATE profiles SET email_verified = 1, updated_at = datetime('now') WHERE id = ?`).run(
            existingProf.id
          );
        }
      }

      // 4. Reconcile Customers from Supabase
      for (const c of snapshot.customers) {
        const email = String(c.email || '').trim().toLowerCase();
        if (!email) continue;

        const linkedProf = db
          .prepare('SELECT id, auth_provider, email_verified FROM profiles WHERE LOWER(email) = ?')
          .get(email) as { id: string; auth_provider?: string; email_verified: number } | undefined;

        const resolvedProfileType = linkedProf
          ? linkedProf.auth_provider === 'google'
            ? 'google'
            : 'registered'
          : email === 'walkin@xecutivecutz.com'
          ? 'walkin'
          : String(c.profile_type || 'guest');

        const resolvedVerified = (linkedProf?.email_verified ? 1 : 0) || (c.email_verified ? 1 : 0);
        const custStatus = validCustomerStatuses.has(c.status) ? c.status : 'active';
        const custNotes = typeof c.notes === 'string' ? c.notes : '';

        const existingCust = db
          .prepare('SELECT id, status, notes FROM customers WHERE LOWER(email) = ?')
          .get(email) as { id: string; status: string; notes: string } | undefined;

        if (!existingCust) {
          db.prepare(
            `INSERT INTO customers (id, profile_id, full_name, email, phone, status, profile_type, email_verified, notes, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`
          ).run(
            String(c.id || crypto.randomUUID()),
            linkedProf?.id || null,
            String(c.full_name || 'Client'),
            email,
            String(c.phone || ''),
            custStatus,
            resolvedProfileType,
            resolvedVerified,
            custNotes,
            c.created_at || null
          );
        } else {
          db.prepare(
            `UPDATE customers
             SET profile_id = COALESCE(profile_id, ?),
                 full_name = COALESCE(NULLIF(?, ''), full_name),
                 phone = CASE WHEN LENGTH(?) >= 7 THEN ? ELSE phone END,
                 status = ?,
                 profile_type = CASE WHEN ? IN ('google', 'registered') THEN ? ELSE profile_type END,
                 email_verified = MAX(email_verified, ?),
                 notes = CASE WHEN ? != '' THEN ? ELSE notes END
             WHERE id = ?`
          ).run(
            linkedProf?.id || null,
            String(c.full_name || ''),
            String(c.phone || ''),
            String(c.phone || ''),
            custStatus !== 'active' || existingCust.status === 'active' ? custStatus : existingCust.status,
            resolvedProfileType,
            resolvedProfileType,
            resolvedVerified,
            custNotes,
            custNotes,
            existingCust.id
          );
        }
        syncedCustomers++;
      }

      // 5. Reconcile Appointments from Supabase
      const fallbackBarberRow = db.prepare('SELECT id FROM barbers ORDER BY is_active DESC, created_at ASC LIMIT 1').get() as
        | { id: string }
        | undefined;

      for (const a of snapshot.appointments) {
        const ref = String(a.booking_reference || '').trim();
        const apptId = String(a.id || '').trim();
        if (!ref && !apptId) continue;

        const custEmail = String(a.customer_email || '').trim().toLowerCase() || 'guest@xecutivecutz.com';
        const svcName = String(a.service_name_snapshot || 'Grooming Service').trim();
        const barberName = String(a.barber_name || a.barber_name_snapshot || 'Assigned Barber').trim();

        // Resolve local service ID
        let localServiceId =
          (a.service_id && serviceById.get(a.service_id)) ||
          serviceByName.get(svcName.toLowerCase());

        if (!localServiceId) {
          localServiceId = String(a.service_id || crypto.randomUUID());
          insertService.run(
            localServiceId,
            svcName,
            '',
            Number(a.price_at_booking || 0),
            Number(a.duration_minutes_snapshot || 45),
            '/assets/local/service_haircut_fade.jpg',
            1,
            1,
            99
          );
          serviceById.set(localServiceId, localServiceId);
          serviceByName.set(svcName.toLowerCase(), localServiceId);
        }

        // Resolve local barber ID
        let localBarberId =
          (a.barber_id && barberById.get(a.barber_id)) ||
          barberByName.get(barberName.toLowerCase()) ||
          fallbackBarberRow?.id;

        if (!localBarberId) {
          localBarberId = String(a.barber_id || crypto.randomUUID());
          insertBarber.run(
            localBarberId,
            barberName,
            'Barber',
            '',
            '/assets/local/barber_portrait_studio.jpg',
            '[]',
            1,
            0
          );
          barberById.set(localBarberId, localBarberId);
          barberByName.set(barberName.toLowerCase(), localBarberId);
        }

        // Link local customer/profile
        const linkedProf = db
          .prepare('SELECT id, auth_provider, email_verified FROM profiles WHERE LOWER(email) = ?')
          .get(custEmail) as { id: string; auth_provider?: string; email_verified: number } | undefined;

        const existingCust = db.prepare('SELECT id FROM customers WHERE LOWER(email) = ?').get(custEmail);
        if (!existingCust) {
          const fallbackProfileType = linkedProf
            ? linkedProf.auth_provider === 'google'
              ? 'google'
              : 'registered'
            : custEmail === 'walkin@xecutivecutz.com'
            ? 'walkin'
            : 'guest';
          db.prepare(
            `INSERT INTO customers (id, profile_id, full_name, email, phone, status, profile_type, email_verified)
             VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`
          ).run(
            crypto.randomUUID(),
            linkedProf?.id || null,
            String(a.customer_name || 'Client'),
            custEmail,
            String(a.customer_phone || ''),
            fallbackProfileType,
            linkedProf?.email_verified ? 1 : 0
          );
        }

        const apptDate = String(a.appointment_date || '').slice(0, 10);
        const startTime = String(a.start_time || '09:00').slice(0, 5);
        const endTime = String(a.end_time || '09:45').slice(0, 5);
        const statusVal = validStatuses.has(a.status) ? a.status : 'confirmed';

        const existingAppt = db
          .prepare('SELECT id FROM appointments WHERE booking_reference = ? OR id = ?')
          .get(ref, apptId) as { id: string } | undefined;

        if (existingAppt) {
          db.prepare(
            `UPDATE appointments
             SET customer_id = COALESCE(customer_id, ?),
                 customer_name = COALESCE(NULLIF(?, ''), customer_name),
                 customer_phone = COALESCE(NULLIF(?, ''), customer_phone),
                 service_id = ?,
                 barber_id = ?,
                 appointment_date = ?,
                 start_time = ?,
                 end_time = ?,
                 price_at_booking = ?,
                 service_name_snapshot = ?,
                 duration_minutes_snapshot = ?,
                 status = ?,
                 customer_notes = COALESCE(?, customer_notes),
                 updated_at = COALESCE(?, datetime('now'))
             WHERE id = ?`
          ).run(
            linkedProf?.id || null,
            String(a.customer_name || ''),
            String(a.customer_phone || ''),
            localServiceId,
            localBarberId,
            apptDate,
            startTime,
            endTime,
            Number(a.price_at_booking ?? 0),
            svcName,
            Number(a.duration_minutes_snapshot ?? 45),
            statusVal,
            a.customer_notes ?? null,
            a.updated_at || null,
            existingAppt.id
          );
        } else {
          db.prepare(
            `INSERT INTO appointments (
              id, booking_reference, customer_id, customer_name, customer_email, customer_phone,
              service_id, barber_id, appointment_date, start_time, end_time,
              price_at_booking, service_name_snapshot, duration_minutes_snapshot,
              status, customer_notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), COALESCE(?, datetime('now')))`
          ).run(
            apptId || crypto.randomUUID(),
            ref || `XC-${crypto.randomInt(100000, 999999)}`,
            linkedProf?.id || null,
            String(a.customer_name || 'Client'),
            custEmail,
            String(a.customer_phone || ''),
            localServiceId,
            localBarberId,
            apptDate,
            startTime,
            endTime,
            Number(a.price_at_booking ?? 0),
            svcName,
            Number(a.duration_minutes_snapshot ?? 45),
            statusVal,
            String(a.customer_notes || ''),
            a.created_at || null,
            a.updated_at || null
          );
        }
        syncedAppointments++;
      }
    }).immediate();

    const summary: LocalSyncSummary = {
      ok: true,
      syncedAppointments,
      syncedCustomers,
      syncedProfiles,
      status,
    };
    lastSyncTimestamp = Date.now();
    lastSyncResult = summary;
    return summary;
  })().finally(() => {
    inFlightSync = null;
  });

  return inFlightSync;
}

// =========================
// PUBLIC DATA ENDPOINTS
// =========================
app.get('/api/public/bootstrap', (_req, res) => {
  const settingsRow = db.prepare('SELECT * FROM business_settings WHERE id = 1').get() as Record<string, unknown>;
  const hours = db.prepare('SELECT * FROM business_hours ORDER BY day_of_week ASC').all().map((h: any) => ({
    ...h,
    is_open: Boolean(h.is_open),
    is_owner_confirmed: Boolean(h.is_owner_confirmed),
  }));
  const services = db.prepare('SELECT * FROM services ORDER BY display_order ASC, created_at ASC').all().map(mapService);
  const barbers = db.prepare('SELECT * FROM barbers WHERE is_active = 1 ORDER BY created_at ASC').all().map(mapBarber);
  const gallery = db.prepare('SELECT * FROM gallery_images WHERE is_active = 1 ORDER BY display_order ASC, created_at DESC').all().map((g: any) => ({
    ...g,
    is_active: Boolean(g.is_active),
  }));
  const testimonials = db.prepare('SELECT * FROM testimonials WHERE is_approved = 1 ORDER BY created_at DESC').all().map((t: any) => ({
    ...t,
    is_verified_google: Boolean(t.is_verified_google),
    is_approved: Boolean(t.is_approved),
  }));
  const blogPosts = db.prepare('SELECT * FROM blog_posts WHERE is_published = 1 ORDER BY published_at DESC').all().map((p: any) => ({
    ...p,
    is_published: Boolean(p.is_published),
  }));

  const supabaseInfo = getSupabaseConfigInfo();

  res.json({
    settings: mapSettings(settingsRow),
    businessHours: hours,
    services,
    barbers,
    gallery,
    testimonials,
    blogPosts,
    systemStatus: {
      firebaseAuthConfigured: Boolean(getFirebaseProjectId()),
      firebaseProjectId: getFirebaseProjectId(),
      supabaseConfigured: supabaseInfo.configured,
      supabaseProjectId: supabaseInfo.projectId,
      resendConfigured: Boolean(process.env.RESEND_API_KEY),
      googleMapsApiKey:
        process.env.VITE_GOOGLE_MAPS_API_KEY ||
        process.env.GOOGLE_MAPS_API_KEY ||
        process.env.MAPS_API_KEY ||
        '',
    },
  });
});

app.get('/api/public/blog/:slug', (req, res) => {
  const post = db.prepare('SELECT * FROM blog_posts WHERE slug = ? AND is_published = 1').get(req.params.slug) as any;
  if (!post) {
    res.status(404).json({ error: 'Article not found.' });
    return;
  }
  res.json({ ...post, is_published: Boolean(post.is_published) });
});

// =========================
// AUTHENTICATION ENDPOINTS
// =========================
app.get('/api/auth/me', (req: AuthedRequest, res) => {
  attachOptionalUser(req, res, () => {
    res.json({ user: req.user || null });
  });
});

app.post('/api/auth/register', (req, res) => {
  const { full_name, email, phone, password } = req.body as {
    full_name?: string;
    email?: string;
    phone?: string;
    password?: string;
  };

  if (!full_name || full_name.trim().length < 2) {
    res.status(400).json({ error: 'Full name is required.' });
    return;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'A valid email address is required.' });
    return;
  }
  if (!phone || phone.trim().length < 7) {
    res.status(400).json({ error: 'A valid phone number is required.' });
    return;
  }
  if (!password || password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters.' });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM profiles WHERE email = ?').get(normalizedEmail);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const userId = crypto.randomUUID();
  const verifyToken = crypto.randomBytes(20).toString('hex');

  db.transaction(() => {
    db.prepare(
      `INSERT INTO profiles (id, full_name, email, phone, password_hash, email_verified, auth_provider, verification_token)
       VALUES (?, ?, ?, ?, ?, 0, 'email', ?)`
    ).run(userId, full_name.trim(), normalizedEmail, phone.trim(), hashPassword(password), verifyToken);

    db.prepare(`INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'customer')`).run(crypto.randomUUID(), userId);

    const existingCustomer = db.prepare('SELECT id FROM customers WHERE LOWER(email) = ?').get(normalizedEmail);
    if (existingCustomer) {
      db.prepare(
        `UPDATE customers
         SET profile_id = ?, full_name = ?, phone = ?, profile_type = 'registered'
         WHERE LOWER(email) = ?`
      ).run(userId, full_name.trim(), phone.trim(), normalizedEmail);
    } else {
      db.prepare(
        `INSERT INTO customers (id, profile_id, full_name, email, phone, status, profile_type, email_verified)
         VALUES (?, ?, ?, ?, ?, 'active', 'registered', 0)`
      ).run(crypto.randomUUID(), userId, full_name.trim(), normalizedEmail, phone.trim());
    }
  })();

  syncCustomerProfileToSupabase({
    full_name: full_name.trim(),
    email: normalizedEmail,
    phone: phone.trim(),
    profile_type: 'registered',
    email_verified: false,
  }).catch(() => {});

  const token = signSessionToken(userId);
  setSessionCookie(res, token, req);

  res.status(201).json({
    sessionToken: token,
    user: {
      id: userId,
      full_name: full_name.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      role: 'customer',
      email_verified: false,
      created_at: new Date().toISOString(),
    },
    verificationToken: verifyToken,
  });
});

app.post('/api/auth/verify-email', (req, res) => {
  const { token } = req.body as { token?: string };
  if (!token) {
    res.status(400).json({ error: 'Verification token required.' });
    return;
  }
  const user = db.prepare('SELECT id FROM profiles WHERE verification_token = ?').get(token) as { id: string } | undefined;
  if (!user) {
    res.status(400).json({ error: 'Invalid or expired verification token.' });
    return;
  }
  db.prepare(`UPDATE profiles SET email_verified = 1, verification_token = NULL, updated_at = datetime('now') WHERE id = ?`).run(user.id);
  db.prepare(`UPDATE customers SET email_verified = 1 WHERE profile_id = ?`).run(user.id);
  res.json({ verified: true });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const row = db
    .prepare(
      `SELECT p.*, COALESCE(r.role, 'customer') as role
       FROM profiles p
       LEFT JOIN user_roles r ON r.user_id = p.id
       WHERE p.email = ?`
    )
    .get(email.trim().toLowerCase()) as any;

  if (!row || !verifyPassword(password, row.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const token = signSessionToken(row.id);
  setSessionCookie(res, token, req);

  res.json({
    sessionToken: token,
    user: {
      id: row.id,
      full_name: row.full_name,
      email: row.email,
      phone: row.phone,
      role: row.role,
      email_verified: Boolean(row.email_verified),
      created_at: row.created_at,
    },
  });
});

app.post('/api/auth/firebase', async (req, res) => {
  const { idToken } = req.body as { idToken?: string };
  if (!idToken) {
    res.status(400).json({ error: 'Firebase ID token is required.' });
    return;
  }

  try {
    const decoded = await verifyFirebaseIdToken(idToken);
    if (!decoded.email || !decoded.email_verified) {
      res.status(401).json({ error: 'A verified Google account email is required.' });
      return;
    }

    const normalizedEmail = decoded.email.trim().toLowerCase();
    const displayName = (decoded.name || normalizedEmail.split('@')[0] || 'Client').trim();

    const userRow = db
      .transaction(() => {
        let row = db
          .prepare(
            `SELECT p.*, COALESCE(r.role, 'customer') as role
             FROM profiles p
             LEFT JOIN user_roles r ON r.user_id = p.id
             WHERE p.email = ?`
          )
          .get(normalizedEmail) as any;

        if (!row) {
          const newId = crypto.randomUUID();
          const targetRole = 'customer';

          db.prepare(
            `INSERT INTO profiles (id, full_name, email, phone, password_hash, email_verified, auth_provider)
             VALUES (?, ?, ?, '', ?, 1, 'google')`
          ).run(newId, displayName, normalizedEmail, hashPassword(crypto.randomBytes(24).toString('hex')));

          db.prepare(`INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)`).run(
            crypto.randomUUID(),
            newId,
            targetRole
          );

          const existingCust = db.prepare('SELECT id FROM customers WHERE LOWER(email) = ?').get(normalizedEmail);
          if (existingCust) {
            db.prepare(
              `UPDATE customers SET profile_id = ?, full_name = ?, profile_type = 'google', email_verified = 1 WHERE LOWER(email) = ?`
            ).run(newId, displayName, normalizedEmail);
          } else {
            db.prepare(
              `INSERT INTO customers (id, profile_id, full_name, email, phone, status, profile_type, email_verified)
               VALUES (?, ?, ?, ?, '', 'active', 'google', 1)`
            ).run(crypto.randomUUID(), newId, displayName, normalizedEmail);
          }

          row = db
            .prepare(
              `SELECT p.*, COALESCE(r.role, 'customer') as role
               FROM profiles p
               LEFT JOIN user_roles r ON r.user_id = p.id
               WHERE p.id = ?`
            )
            .get(newId) as any;
        } else {
          db.prepare(
            `UPDATE profiles SET email_verified = 1, auth_provider = 'google', updated_at = datetime('now') WHERE id = ?`
          ).run(row.id);
          row.email_verified = 1;

          if (normalizedEmail !== 'admin@xecutivecutz.com' && row.role !== 'customer') {
            db.prepare(`UPDATE user_roles SET role = 'customer' WHERE user_id = ?`).run(row.id);
            row.role = 'customer';
          }
          const existingCust = db.prepare('SELECT id FROM customers WHERE LOWER(email) = ?').get(normalizedEmail);
          if (existingCust) {
            db.prepare(
              `UPDATE customers SET profile_id = COALESCE(profile_id, ?), profile_type = 'google', email_verified = 1 WHERE LOWER(email) = ?`
            ).run(row.id, normalizedEmail);
          } else if (row.role === 'customer') {
            db.prepare(
              `INSERT INTO customers (id, profile_id, full_name, email, phone, status, profile_type, email_verified)
               VALUES (?, ?, ?, ?, ?, 'active', 'google', 1)`
            ).run(crypto.randomUUID(), row.id, row.full_name, normalizedEmail, row.phone || '');
          }
        }
        return row;
      })
      .immediate();

    syncCustomerProfileToSupabase({
      full_name: userRow.full_name,
      email: normalizedEmail,
      phone: userRow.phone || '',
      profile_type: 'google',
      email_verified: true,
    }).catch(() => {});

    const token = signSessionToken(userRow.id);
    setSessionCookie(res, token, req);

    res.json({
      sessionToken: token,
      user: {
        id: userRow.id,
        full_name: userRow.full_name,
        email: userRow.email,
        phone: userRow.phone,
        role: userRow.role,
        email_verified: Boolean(userRow.email_verified),
        created_at: userRow.created_at,
      },
    });
  } catch (err) {
    console.error('Firebase token verification failed:', err);
    const msg = err instanceof Error ? err.message : 'Invalid or expired Firebase authentication token.';
    res.status(401).json({ error: msg });
  }
});

app.post('/api/auth/logout', (req, res) => {
  clearSessionCookie(res, req);
  res.json({ ok: true });
});

app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email) {
    res.status(400).json({ error: 'Email is required.' });
    return;
  }
  const normalized = email.trim().toLowerCase();
  const user = db.prepare('SELECT id FROM profiles WHERE email = ?').get(normalized) as { id: string } | undefined;
  if (!user) {
    // Return uniform response for security
    res.json({ ok: true, message: 'If an account matches that email, a password reset link has been prepared.' });
    return;
  }

  const resetToken = crypto.randomBytes(20).toString('hex');
  const expires = new Date(Date.now() + 1000 * 60 * 30).toISOString();
  db.prepare('UPDATE profiles SET reset_token = ?, reset_token_expires = ? WHERE id = ?').run(resetToken, expires, user.id);

  res.json({
    ok: true,
    message: 'Password reset token generated. Use the reset link below to update your password.',
    // Returned in local demo mode when email provider isn't configured so flow is testable end-to-end
    demoResetToken: process.env.RESEND_API_KEY ? undefined : resetToken,
  });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { token, newPassword } = req.body as { token?: string; newPassword?: string };
  if (!token || !newPassword || newPassword.length < 8) {
    res.status(400).json({ error: 'Valid reset token and a new password (8+ chars) are required.' });
    return;
  }
  const user = db.prepare('SELECT id, reset_token_expires FROM profiles WHERE reset_token = ?').get(token) as
    | { id: string; reset_token_expires: string }
    | undefined;

  if (!user || new Date(user.reset_token_expires).getTime() < Date.now()) {
    res.status(400).json({ error: 'Reset token is invalid or has expired.' });
    return;
  }

  db.prepare(
    `UPDATE profiles SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL, updated_at = datetime('now') WHERE id = ?`
  ).run(hashPassword(newPassword), user.id);

  res.json({ ok: true, message: 'Password updated successfully.' });
});

// =========================
// BOOKING & AVAILABILITY API
// =========================
app.get('/api/availability/month', (req, res) => {
  const { serviceId, barberId = 'any', year, month } = req.query as Record<string, string>;
  if (!serviceId || !year || !month) {
    res.status(400).json({ error: 'serviceId, year, and month are required.' });
    return;
  }
  const summary = getMonthAvailabilitySummary({
    serviceId,
    barberId,
    year: Number(year),
    month: Number(month),
  });
  res.json({ days: summary });
});

app.get('/api/availability', (req, res) => {
  const { serviceId, barberId = 'any', date } = req.query as Record<string, string>;
  if (!serviceId || !date) {
    res.status(400).json({ error: 'serviceId and date are required.' });
    return;
  }
  const result = computeAvailableSlots({ serviceId, barberId, date });
  res.json(result);
});

app.post('/api/appointments', attachOptionalUser, async (req: AuthedRequest, res) => {
  const settings = db.prepare('SELECT * FROM business_settings WHERE id = 1').get() as BusinessSettings;
  if (!req.user && !settings.allow_guest_booking) {
    res.status(401).json({ error: 'Please sign in or register an account to book an appointment.' });
    return;
  }

  const { customer_name, customer_email, customer_phone, service_id, barber_id, appointment_date, start_time, customer_notes } = req.body;
  if (!customer_name || !customer_email || !customer_phone || !service_id || !barber_id || !appointment_date || !start_time) {
    res.status(400).json({ error: 'All booking fields are required.' });
    return;
  }

  try {
    const created = createAppointmentTransactional({
      customerId: req.user?.id || null,
      customerName: String(customer_name).trim(),
      customerEmail: String(customer_email).trim().toLowerCase(),
      customerPhone: String(customer_phone).trim(),
      serviceId: String(service_id),
      barberId: String(barber_id),
      appointmentDate: String(appointment_date),
      startTime: String(start_time),
      customerNotes: customer_notes ? String(customer_notes).trim() : '',
    });

    const custMeta = db
      .prepare('SELECT profile_type, email_verified FROM customers WHERE LOWER(email) = ?')
      .get(created.customer_email.toLowerCase()) as
      | { profile_type?: CustomerProfileType; email_verified?: number }
      | undefined;

    const [supabaseSync, notification] = await Promise.all([
      syncBookingToSupabase({
        ...created,
        profile_type: custMeta?.profile_type || (req.user ? 'registered' : 'guest'),
        email_verified: Boolean(custMeta?.email_verified || req.user?.email_verified),
      }),
      dispatchBookingNotification(
        created.status === 'confirmed' ? 'booking_confirmed' : 'booking_created',
        created
      ),
    ]);

    res.status(201).json({ appointment: created, notification, supabaseSync });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to reserve appointment.';
    res.status(409).json({ error: msg });
  }
});

// =========================
// CUSTOMER DASHBOARD API
// =========================
app.get('/api/customer/appointments', requireAuth, (req: AuthedRequest, res) => {
  const rows = db
    .prepare(
      `SELECT a.*, b.full_name as barber_name
       FROM appointments a
       JOIN barbers b ON b.id = a.barber_id
       WHERE a.customer_id = ?
       ORDER BY a.appointment_date DESC, a.start_time DESC`
    )
    .all(req.user!.id);
  res.json({ appointments: rows });
});

app.patch('/api/customer/appointments/:id/cancel', requireAuth, async (req: AuthedRequest, res) => {
  const appt = db
    .prepare(
      `SELECT a.*, b.full_name as barber_name FROM appointments a
       JOIN barbers b ON b.id = a.barber_id
       WHERE a.id = ? AND a.customer_id = ?`
    )
    .get(req.params.id, req.user!.id) as (AppointmentItem & { barber_name: string }) | undefined;

  if (!appt) {
    res.status(404).json({ error: 'Appointment not found.' });
    return;
  }
  if (appt.status === 'cancelled' || appt.status === 'completed') {
    res.status(400).json({ error: 'This appointment cannot be cancelled.' });
    return;
  }

  const settings = db.prepare('SELECT cancellation_window_hours FROM business_settings WHERE id = 1').get() as {
    cancellation_window_hours: number;
  };
  const chicagoNow = getChicagoNow();
  const apptDateTime = new Date(`${appt.appointment_date}T${appt.start_time}:00Z`).getTime();
  const nowPseudo = new Date(`${chicagoNow.date}T${String(Math.floor(chicagoNow.minutes / 60)).padStart(2, '0')}:${String(chicagoNow.minutes % 60).padStart(2, '0')}:00Z`).getTime();
  const hoursUntil = (apptDateTime - nowPseudo) / (1000 * 60 * 60);

  if (hoursUntil < settings.cancellation_window_hours) {
    res.status(400).json({
      error: `Online cancellation closes ${settings.cancellation_window_hours} hours before your appointment. Please call the shop directly.`,
    });
    return;
  }

  db.prepare(`UPDATE appointments SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`).run(appt.id);
  const updated = { ...appt, status: 'cancelled' as const };
  await Promise.all([
    syncBookingStatusToSupabase(appt.booking_reference, appt.customer_email, 'cancelled'),
    dispatchBookingNotification('booking_cancelled', updated),
  ]);
  res.json({ appointment: updated });
});

app.patch('/api/customer/appointments/:id/reschedule', requireAuth, async (req: AuthedRequest, res) => {
  const appt = db
    .prepare('SELECT * FROM appointments WHERE id = ? AND customer_id = ?')
    .get(req.params.id, req.user!.id) as AppointmentItem | undefined;

  if (!appt) {
    res.status(404).json({ error: 'Appointment not found.' });
    return;
  }

  const { appointment_date, start_time, barber_id } = req.body as {
    appointment_date?: string;
    start_time?: string;
    barber_id?: string;
  };
  if (!appointment_date || !start_time) {
    res.status(400).json({ error: 'New date and time are required.' });
    return;
  }

  try {
    const updated = rescheduleAppointmentTransactional({
      appointmentId: appt.id,
      appointmentDate: appointment_date,
      startTime: start_time,
      barberId: barber_id,
    });
    await Promise.all([
      syncBookingRescheduleToSupabase(updated),
      dispatchBookingNotification('booking_rescheduled', updated),
    ]);
    res.json({ appointment: updated });
  } catch (err) {
    res.status(409).json({ error: err instanceof Error ? err.message : 'Unable to reschedule.' });
  }
});

app.patch('/api/customer/profile', requireAuth, (req: AuthedRequest, res) => {
  const { full_name, phone } = req.body as { full_name?: string; phone?: string };
  if (!full_name || full_name.trim().length < 2) {
    res.status(400).json({ error: 'Full name is required.' });
    return;
  }
  if (!phone || phone.trim().length < 7) {
    res.status(400).json({ error: 'Valid phone number is required.' });
    return;
  }
  db.prepare(`UPDATE profiles SET full_name = ?, phone = ?, updated_at = datetime('now') WHERE id = ?`).run(
    full_name.trim(),
    phone.trim(),
    req.user!.id
  );
  db.prepare(`UPDATE customers SET full_name = ?, phone = ? WHERE profile_id = ?`).run(
    full_name.trim(),
    phone.trim(),
    req.user!.id
  );
  res.json({ user: { ...req.user!, full_name: full_name.trim(), phone: phone.trim() } });
});

app.patch('/api/customer/password', requireAuth, (req: AuthedRequest, res) => {
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    res.status(400).json({ error: 'Current password and new password (8+ chars) are required.' });
    return;
  }
  const row = db.prepare('SELECT password_hash FROM profiles WHERE id = ?').get(req.user!.id) as { password_hash: string };
  if (!verifyPassword(currentPassword, row.password_hash)) {
    res.status(400).json({ error: 'Current password is incorrect.' });
    return;
  }
  db.prepare(`UPDATE profiles SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(
    hashPassword(newPassword),
    req.user!.id
  );
  res.json({ ok: true });
});

// =========================
// ADMIN DASHBOARD API (RBAC Protected)
// =========================
app.use('/api/admin', requireAdmin);

app.post('/api/admin/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No image file provided.' });
    return;
  }
  res.json({ url: `/uploads/${req.file.filename}` });
});

app.post('/api/admin/sync-supabase', async (_req, res) => {
  const result = await syncSupabaseToLocalDb(true);
  res.json(result);
});

app.get('/api/admin/overview', async (_req, res) => {
  const syncResult = await syncSupabaseToLocalDb();
  const today = getChicagoNow().date;

  const totalBookings = (db.prepare('SELECT COUNT(*) as c FROM appointments').get() as { c: number }).c;
  const todaysBookings = (db.prepare('SELECT COUNT(*) as c FROM appointments WHERE appointment_date = ? AND status != \'cancelled\'').get(today) as { c: number }).c;
  const upcomingBookings = (db.prepare('SELECT COUNT(*) as c FROM appointments WHERE appointment_date >= ? AND status IN (\'pending\', \'confirmed\')').get(today) as { c: number }).c;
  const pendingBookings = (db.prepare('SELECT COUNT(*) as c FROM appointments WHERE status = \'pending\'').get() as { c: number }).c;
  const completedBookings = (db.prepare('SELECT COUNT(*) as c FROM appointments WHERE status = \'completed\'').get() as { c: number }).c;
  const cancelledBookings = (db.prepare('SELECT COUNT(*) as c FROM appointments WHERE status = \'cancelled\'').get() as { c: number }).c;
  const totalCustomers = (db.prepare('SELECT COUNT(*) as c FROM customers').get() as { c: number }).c;
  const completedRevenueCents =
    (db.prepare('SELECT COALESCE(SUM(price_at_booking), 0) as s FROM appointments WHERE status = \'completed\'').get() as { s: number }).s;
  const confirmedPipelineCents =
    (db.prepare('SELECT COALESCE(SUM(price_at_booking), 0) as s FROM appointments WHERE status IN (\'pending\', \'confirmed\')').get() as { s: number }).s;

  // Last 7 days chart
  const weeklyChart: { date: string; label: string; bookings: number; revenue: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const row = db
      .prepare(
        `SELECT COUNT(*) as bookings, COALESCE(SUM(CASE WHEN status = 'completed' THEN price_at_booking ELSE 0 END), 0) as rev
         FROM appointments WHERE appointment_date = ? AND status != 'cancelled'`
      )
      .get(iso) as { bookings: number; rev: number };
    weeklyChart.push({
      date: iso,
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      bookings: row.bookings,
      revenue: Math.round(row.rev / 100),
    });
  }

  // Monthly chart (last 6 months)
  const monthlyChart: { month: string; bookings: number; revenue: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(`${today.slice(0, 7)}-15T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - i);
    const ym = d.toISOString().slice(0, 7);
    const row = db
      .prepare(
        `SELECT COUNT(*) as bookings, COALESCE(SUM(CASE WHEN status = 'completed' THEN price_at_booking ELSE 0 END), 0) as rev
         FROM appointments WHERE substr(appointment_date, 1, 7) = ? AND status != 'cancelled'`
      )
      .get(ym) as { bookings: number; rev: number };
    monthlyChart.push({
      month: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
      bookings: row.bookings,
      revenue: Math.round(row.rev / 100),
    });
  }

  const popularServices = db
    .prepare(
      `SELECT service_name_snapshot as name,
              COUNT(*) as count,
              COALESCE(SUM(price_at_booking), 0) as total_cents,
              COALESCE(SUM(CASE WHEN status = 'completed' THEN price_at_booking ELSE 0 END), 0) as completed_cents
       FROM appointments WHERE status != 'cancelled'
       GROUP BY service_name_snapshot ORDER BY count DESC LIMIT 5`
    )
    .all();

  const recentAppointments = db
    .prepare(
      `SELECT a.*, b.full_name as barber_name,
              COALESCE(c.status, 'active') as customer_status,
              CASE
                WHEN p.auth_provider = 'google' THEN 'google'
                WHEN p.id IS NOT NULL THEN 'registered'
                WHEN LOWER(a.customer_email) = 'walkin@xecutivecutz.com' THEN 'walkin'
                ELSE COALESCE(c.profile_type, 'guest')
              END as profile_type,
              COALESCE(p.email_verified, c.email_verified, 0) as email_verified_int,
              COALESCE(r.role, 'guest') as account_role
       FROM appointments a
       JOIN barbers b ON b.id = a.barber_id
       LEFT JOIN customers c ON LOWER(c.email) = LOWER(a.customer_email)
       LEFT JOIN profiles p ON p.id = COALESCE(a.customer_id, c.profile_id)
       LEFT JOIN user_roles r ON r.user_id = p.id
       ORDER BY a.created_at DESC LIMIT 8`
    )
    .all()
    .map((row: any) => ({ ...row, email_verified: Boolean(row.email_verified_int) }));

  const upcomingList = db
    .prepare(
      `SELECT a.*, b.full_name as barber_name,
              COALESCE(c.status, 'active') as customer_status,
              CASE
                WHEN p.auth_provider = 'google' THEN 'google'
                WHEN p.id IS NOT NULL THEN 'registered'
                WHEN LOWER(a.customer_email) = 'walkin@xecutivecutz.com' THEN 'walkin'
                ELSE COALESCE(c.profile_type, 'guest')
              END as profile_type,
              COALESCE(p.email_verified, c.email_verified, 0) as email_verified_int,
              COALESCE(r.role, 'guest') as account_role
       FROM appointments a
       JOIN barbers b ON b.id = a.barber_id
       LEFT JOIN customers c ON LOWER(c.email) = LOWER(a.customer_email)
       LEFT JOIN profiles p ON p.id = COALESCE(a.customer_id, c.profile_id)
       LEFT JOIN user_roles r ON r.user_id = p.id
       WHERE a.appointment_date >= ? AND a.status IN ('pending', 'confirmed')
       ORDER BY a.appointment_date ASC, a.start_time ASC LIMIT 8`
    )
    .all(today)
    .map((row: any) => ({ ...row, email_verified: Boolean(row.email_verified_int) }));

  res.json({
    stats: {
      totalBookings,
      todaysBookings,
      upcomingBookings,
      pendingBookings,
      completedBookings,
      cancelledBookings,
      totalCustomers,
      completedRevenueCents,
      confirmedPipelineCents,
    },
    weeklyChart,
    monthlyChart,
    popularServices,
    recentAppointments,
    upcomingList,
    supabaseStatus: {
      ...syncResult.status,
      syncedAppointments: syncResult.syncedAppointments,
      syncedCustomers: syncResult.syncedCustomers,
    },
  });
});

// Admin Bookings CRUD
app.get('/api/admin/bookings', async (req, res) => {
  const syncResult = await syncSupabaseToLocalDb();
  const { search = '', status = 'all', barberId = 'all', date = '', profileType = 'all' } = req.query as Record<
    string,
    string
  >;
  let sql = `
    SELECT a.*, b.full_name as barber_name,
      COALESCE(c.status, 'active') as customer_status,
      CASE
        WHEN p.auth_provider = 'google' THEN 'google'
        WHEN p.id IS NOT NULL THEN 'registered'
        WHEN LOWER(a.customer_email) = 'walkin@xecutivecutz.com' THEN 'walkin'
        ELSE COALESCE(c.profile_type, 'guest')
      END as profile_type,
      COALESCE(p.email_verified, c.email_verified, 0) as email_verified_int,
      COALESCE(r.role, 'guest') as account_role
    FROM appointments a
    JOIN barbers b ON b.id = a.barber_id
    LEFT JOIN customers c ON LOWER(c.email) = LOWER(a.customer_email)
    LEFT JOIN profiles p ON p.id = COALESCE(a.customer_id, c.profile_id)
    LEFT JOIN user_roles r ON r.user_id = p.id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (status && status !== 'all') {
    sql += ' AND a.status = ?';
    params.push(status);
  }
  if (barberId && barberId !== 'all') {
    sql += ' AND a.barber_id = ?';
    params.push(barberId);
  }
  if (date) {
    sql += ' AND a.appointment_date = ?';
    params.push(date);
  }
  if (search) {
    sql += ' AND (a.booking_reference LIKE ? OR a.customer_name LIKE ? OR a.customer_phone LIKE ? OR a.customer_email LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  sql += ' ORDER BY a.appointment_date DESC, a.start_time DESC';

  let appointments = db
    .prepare(sql)
    .all(...params)
    .map((row: any) => ({
      ...row,
      email_verified: Boolean(row.email_verified_int),
    }));

  if (profileType && profileType !== 'all') {
    appointments = appointments.filter((a: any) => a.profile_type === profileType);
  }

  res.json({
    appointments,
    supabaseStatus: {
      ...syncResult.status,
      syncedAppointments: syncResult.syncedAppointments,
      syncedCustomers: syncResult.syncedCustomers,
    },
  });
});

app.post('/api/admin/bookings', async (req, res) => {
  const { customer_name, customer_email, customer_phone, service_id, barber_id, appointment_date, start_time, customer_notes, status } = req.body;
  try {
    const created = createAppointmentTransactional({
      customerId: null,
      customerName: customer_name,
      customerEmail: customer_email || 'walkin@xecutivecutz.com',
      customerPhone: customer_phone,
      serviceId: service_id,
      barberId: barber_id,
      appointmentDate: appointment_date,
      startTime: start_time,
      customerNotes: customer_notes,
      forceStatus: status === 'pending' ? 'pending' : 'confirmed',
    });
    const supabaseSync = await syncBookingToSupabase({
      ...created,
      profile_type: (customer_email || '').trim() ? 'guest' : 'walkin',
      email_verified: false,
    });
    res.status(201).json({ appointment: created, supabaseSync });
  } catch (err) {
    res.status(409).json({ error: err instanceof Error ? err.message : 'Unable to create booking.' });
  }
});

app.patch('/api/admin/bookings/:id/status', async (req, res) => {
  const { status } = req.body as { status: AppointmentItem['status'] };
  const valid = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
  if (!valid.includes(status)) {
    res.status(400).json({ error: 'Invalid status.' });
    return;
  }

  const appt = db
    .prepare('SELECT a.*, b.full_name as barber_name FROM appointments a JOIN barbers b ON b.id = a.barber_id WHERE a.id = ?')
    .get(req.params.id) as (AppointmentItem & { barber_name: string }) | undefined;
  if (!appt) {
    res.status(404).json({ error: 'Appointment not found.' });
    return;
  }

  db.prepare(`UPDATE appointments SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, appt.id);
  const updated = { ...appt, status };

  const supaRes = await syncBookingStatusToSupabase(appt.booking_reference, appt.customer_email, status, appt.id);
  if (status === 'confirmed') await dispatchBookingNotification('booking_confirmed', updated);
  if (status === 'cancelled') await dispatchBookingNotification('booking_cancelled', updated);

  const completedRevenueCents =
    (db.prepare(`SELECT COALESCE(SUM(price_at_booking), 0) as s FROM appointments WHERE status = 'completed'`).get() as {
      s: number;
    }).s;

  res.json({ appointment: updated, completedRevenueCents, supabaseSynced: supaRes.synced });
});

app.delete('/api/admin/bookings/:id', async (req, res) => {
  const appt = db
    .prepare('SELECT id, booking_reference FROM appointments WHERE id = ?')
    .get(req.params.id) as { id: string; booking_reference: string } | undefined;

  if (!appt) {
    res.status(404).json({ error: 'Booking not found.' });
    return;
  }

  const supaDel = await deleteBookingFromSupabase(appt.id, appt.booking_reference);
  db.prepare('DELETE FROM appointments WHERE id = ?').run(appt.id);

  const completedRevenueCents =
    (db.prepare(`SELECT COALESCE(SUM(price_at_booking), 0) as s FROM appointments WHERE status = 'completed'`).get() as {
      s: number;
    }).s;

  res.json({
    ok: true,
    deletedId: appt.id,
    bookingReference: appt.booking_reference,
    supabaseDeleted: supaDel.synced,
    completedRevenueCents,
  });
});

app.patch('/api/admin/bookings/:id/reschedule', async (req, res) => {
  const { appointment_date, start_time, barber_id } = req.body;
  try {
    const updated = rescheduleAppointmentTransactional({
      appointmentId: req.params.id,
      appointmentDate: appointment_date,
      startTime: start_time,
      barberId: barber_id,
    });
    await Promise.all([
      syncBookingRescheduleToSupabase(updated),
      dispatchBookingNotification('booking_rescheduled', updated),
    ]);
    res.json({ appointment: updated });
  } catch (err) {
    res.status(409).json({ error: err instanceof Error ? err.message : 'Reschedule failed.' });
  }
});

// Admin Services CRUD
app.get('/api/admin/services', (_req, res) => {
  const services = db.prepare('SELECT * FROM services ORDER BY display_order ASC, created_at ASC').all().map(mapService);
  res.json({ services });
});

app.post('/api/admin/services', (req, res) => {
  const { name, description, price_cents, duration_minutes, image_url, is_active, is_owner_approved } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Service name is required.' });
    return;
  }
  const id = crypto.randomUUID();
  const maxOrder = (db.prepare('SELECT COALESCE(MAX(display_order), 0) as m FROM services').get() as { m: number }).m;
  db.prepare(
    `INSERT INTO services (id, name, description, price_cents, duration_minutes, image_url, is_active, is_owner_approved, display_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    name.trim(),
    description || '',
    price_cents === null || price_cents === undefined || price_cents === '' ? null : Number(price_cents),
    duration_minutes ? Number(duration_minutes) : 45,
    image_url || '/assets/local/service_haircut_fade.jpg',
    is_active ? 1 : 0,
    is_owner_approved ? 1 : 0,
    maxOrder + 1
  );
  const created = db.prepare('SELECT * FROM services WHERE id = ?').get(id) as Record<string, unknown>;
  res.status(201).json({ service: mapService(created) });
});

app.patch('/api/admin/services/:id', (req, res) => {
  const { name, description, price_cents, duration_minutes, image_url, is_active, is_owner_approved } = req.body;
  const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Service not found.' });
    return;
  }
  db.prepare(
    `UPDATE services
     SET name = COALESCE(?, name),
         description = COALESCE(?, description),
         price_cents = ?,
         duration_minutes = COALESCE(?, duration_minutes),
         image_url = COALESCE(?, image_url),
         is_active = COALESCE(?, is_active),
         is_owner_approved = COALESCE(?, is_owner_approved),
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    name !== undefined ? String(name).trim() : null,
    description !== undefined ? String(description) : null,
    price_cents === null || price_cents === '' ? null : Number(price_cents),
    duration_minutes !== undefined ? Number(duration_minutes) : null,
    image_url !== undefined ? String(image_url) : null,
    is_active !== undefined ? (is_active ? 1 : 0) : null,
    is_owner_approved !== undefined ? (is_owner_approved ? 1 : 0) : null,
    req.params.id
  );
  const updated = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id) as Record<string, unknown>;
  res.json({ service: mapService(updated) });
});

app.delete('/api/admin/services/:id', (req, res) => {
  const apptCount = (db.prepare('SELECT COUNT(*) as c FROM appointments WHERE service_id = ?').get(req.params.id) as { c: number }).c;
  if (apptCount > 0) {
    res.status(400).json({ error: 'Cannot delete a service with existing appointments. Deactivate it instead.' });
    return;
  }
  db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Admin Barbers & Schedules CRUD
app.get('/api/admin/barbers', (_req, res) => {
  const barbers = db.prepare('SELECT * FROM barbers ORDER BY created_at ASC').all().map(mapBarber);
  const schedules = db.prepare('SELECT * FROM barber_schedules ORDER BY day_of_week ASC').all().map((s: any) => ({
    ...s,
    is_working: Boolean(s.is_working),
  }));
  const enriched = barbers.map((b: any) => ({
    ...b,
    schedules: schedules.filter((s: any) => s.barber_id === b.id),
  }));
  res.json({ barbers: enriched });
});

app.post('/api/admin/barbers', (req, res) => {
  const { full_name, title, bio, image_url, specialties, is_active, is_placeholder } = req.body;
  if (!full_name) {
    res.status(400).json({ error: 'Barber name is required.' });
    return;
  }
  const id = crypto.randomUUID();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO barbers (id, full_name, title, bio, image_url, specialties, is_active, is_placeholder)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      full_name.trim(),
      title || 'Barber',
      bio || '',
      image_url || '/assets/local/barber_portrait_studio.jpg',
      JSON.stringify(Array.isArray(specialties) ? specialties : []),
      is_active !== false ? 1 : 0,
      is_placeholder ? 1 : 0
    );

    const insSched = db.prepare(
      `INSERT INTO barber_schedules (id, barber_id, day_of_week, is_working, start_time, end_time, break_start, break_end)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (let d = 0; d <= 6; d++) {
      const works = d >= 2 && d <= 6 ? 1 : 0;
      insSched.run(crypto.randomUUID(), id, d, works, '08:00', '19:00', works ? '13:00' : null, works ? '13:30' : null);
    }
  })();
  const created = db.prepare('SELECT * FROM barbers WHERE id = ?').get(id) as Record<string, unknown>;
  const schedules = db.prepare('SELECT * FROM barber_schedules WHERE barber_id = ? ORDER BY day_of_week ASC').all(id);
  res.status(201).json({ barber: { ...mapBarber(created), schedules } });
});

app.patch('/api/admin/barbers/:id', (req, res) => {
  const { full_name, title, bio, image_url, specialties, is_active, is_placeholder, schedules } = req.body;
  const existing = db.prepare('SELECT id FROM barbers WHERE id = ?').get(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Barber not found.' });
    return;
  }

  db.transaction(() => {
    db.prepare(
      `UPDATE barbers
       SET full_name = COALESCE(?, full_name),
           title = COALESCE(?, title),
           bio = COALESCE(?, bio),
           image_url = COALESCE(?, image_url),
           specialties = COALESCE(?, specialties),
           is_active = COALESCE(?, is_active),
           is_placeholder = COALESCE(?, is_placeholder),
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      full_name !== undefined ? full_name.trim() : null,
      title !== undefined ? title : null,
      bio !== undefined ? bio : null,
      image_url !== undefined ? image_url : null,
      specialties !== undefined ? JSON.stringify(specialties) : null,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      is_placeholder !== undefined ? (is_placeholder ? 1 : 0) : null,
      req.params.id
    );

    if (Array.isArray(schedules)) {
      const updSched = db.prepare(
        `UPDATE barber_schedules
         SET is_working = ?, start_time = ?, end_time = ?, break_start = ?, break_end = ?
         WHERE barber_id = ? AND day_of_week = ?`
      );
      for (const s of schedules) {
        updSched.run(
          s.is_working ? 1 : 0,
          s.start_time || '08:00',
          s.end_time || '19:00',
          s.break_start || null,
          s.break_end || null,
          req.params.id,
          s.day_of_week
        );
      }
    }
  })();

  const updated = db.prepare('SELECT * FROM barbers WHERE id = ?').get(req.params.id) as Record<string, unknown>;
  const updatedScheds = db
    .prepare('SELECT * FROM barber_schedules WHERE barber_id = ? ORDER BY day_of_week ASC')
    .all(req.params.id)
    .map((s: any) => ({ ...s, is_working: Boolean(s.is_working) }));
  res.json({ barber: { ...mapBarber(updated), schedules: updatedScheds } });
});

// Admin Customers
app.get('/api/admin/customers', async (req, res) => {
  const syncResult = await syncSupabaseToLocalDb();
  const { search = '', status = 'all', profileType = 'all' } = req.query as Record<string, string>;
  let sql = `
    SELECT c.*,
      CASE
        WHEN p.auth_provider = 'google' THEN 'google'
        WHEN p.id IS NOT NULL THEN 'registered'
        WHEN LOWER(c.email) = 'walkin@xecutivecutz.com' THEN 'walkin'
        ELSE COALESCE(c.profile_type, 'guest')
      END as computed_profile_type,
      COALESCE(p.email_verified, c.email_verified, 0) as email_verified_int,
      COALESCE(r.role, 'guest') as account_role,
      (SELECT COUNT(*) FROM appointments a WHERE (a.customer_id = c.profile_id OR LOWER(a.customer_email) = LOWER(c.email))) as total_appointments,
      (SELECT COUNT(*) FROM appointments a WHERE (a.customer_id = c.profile_id OR LOWER(a.customer_email) = LOWER(c.email)) AND a.status = 'completed') as completed_appointments,
      (SELECT COUNT(*) FROM appointments a WHERE (a.customer_id = c.profile_id OR LOWER(a.customer_email) = LOWER(c.email)) AND a.status = 'pending') as pending_appointments,
      (SELECT COALESCE(SUM(a.price_at_booking), 0) FROM appointments a WHERE (a.customer_id = c.profile_id OR LOWER(a.customer_email) = LOWER(c.email)) AND a.status = 'completed') as total_spent_cents,
      (SELECT MAX(a.appointment_date) FROM appointments a WHERE (a.customer_id = c.profile_id OR LOWER(a.customer_email) = LOWER(c.email))) as last_appointment_date
    FROM customers c
    LEFT JOIN profiles p ON p.id = c.profile_id OR LOWER(p.email) = LOWER(c.email)
    LEFT JOIN user_roles r ON r.user_id = p.id
    WHERE 1=1
  `;
  const params: unknown[] = [];
  if (status && status !== 'all') {
    sql += ' AND c.status = ?';
    params.push(status);
  }
  if (search) {
    sql += ' AND (c.full_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  sql += ' ORDER BY c.created_at DESC';

  let customers = db
    .prepare(sql)
    .all(...params)
    .map((c: any) => ({
      ...c,
      profile_type: c.computed_profile_type,
      email_verified: Boolean(c.email_verified_int),
    }));

  if (profileType && profileType !== 'all') {
    customers = customers.filter((c: any) => c.profile_type === profileType);
  }

  res.json({
    customers,
    supabaseStatus: {
      ...syncResult.status,
      syncedAppointments: syncResult.syncedAppointments,
      syncedCustomers: syncResult.syncedCustomers,
    },
  });
});

app.get('/api/admin/customers/:id/history', async (req, res) => {
  await syncSupabaseToLocalDb();
  const customer = db
    .prepare(
      `SELECT c.*,
        CASE
          WHEN p.auth_provider = 'google' THEN 'google'
          WHEN p.id IS NOT NULL THEN 'registered'
          WHEN LOWER(c.email) = 'walkin@xecutivecutz.com' THEN 'walkin'
          ELSE COALESCE(c.profile_type, 'guest')
        END as computed_profile_type,
        COALESCE(p.email_verified, c.email_verified, 0) as email_verified_int,
        COALESCE(r.role, 'guest') as account_role,
        (SELECT COUNT(*) FROM appointments a WHERE (a.customer_id = c.profile_id OR LOWER(a.customer_email) = LOWER(c.email))) as total_appointments,
        (SELECT COUNT(*) FROM appointments a WHERE (a.customer_id = c.profile_id OR LOWER(a.customer_email) = LOWER(c.email)) AND a.status = 'completed') as completed_appointments,
        (SELECT COUNT(*) FROM appointments a WHERE (a.customer_id = c.profile_id OR LOWER(a.customer_email) = LOWER(c.email)) AND a.status = 'pending') as pending_appointments,
        (SELECT COALESCE(SUM(a.price_at_booking), 0) FROM appointments a WHERE (a.customer_id = c.profile_id OR LOWER(a.customer_email) = LOWER(c.email)) AND a.status = 'completed') as total_spent_cents,
        (SELECT MAX(a.appointment_date) FROM appointments a WHERE (a.customer_id = c.profile_id OR LOWER(a.customer_email) = LOWER(c.email))) as last_appointment_date
       FROM customers c
       LEFT JOIN profiles p ON p.id = c.profile_id OR LOWER(p.email) = LOWER(c.email)
       LEFT JOIN user_roles r ON r.user_id = p.id
       WHERE c.id = ?`
    )
    .get(req.params.id) as any;
  if (!customer) {
    res.status(404).json({ error: 'Customer not found.' });
    return;
  }
  const history = db
    .prepare(
      `SELECT a.*, b.full_name as barber_name FROM appointments a
       JOIN barbers b ON b.id = a.barber_id
       WHERE a.customer_id = ? OR LOWER(a.customer_email) = LOWER(?)
       ORDER BY a.appointment_date DESC, a.start_time DESC`
    )
    .all(customer.profile_id || '', customer.email);
  res.json({
    customer: {
      ...customer,
      profile_type: customer.computed_profile_type,
      email_verified: Boolean(customer.email_verified_int),
    },
    history,
  });
});

app.patch('/api/admin/customers/:id', async (req, res) => {
  const { status, notes } = req.body as { status?: string; notes?: string };
  if (status !== undefined && !['active', 'vip', 'blocked'].includes(status)) {
    res.status(400).json({ error: 'Invalid customer status.' });
    return;
  }
  const existing = db.prepare('SELECT id, email FROM customers WHERE id = ?').get(req.params.id) as
    | { id: string; email: string }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Customer not found.' });
    return;
  }
  db.prepare('UPDATE customers SET status = COALESCE(?, status), notes = COALESCE(?, notes) WHERE id = ?').run(
    status ?? null,
    notes ?? null,
    req.params.id
  );
  const supaRes = await updateCustomerInSupabase({
    id: existing.id,
    email: existing.email,
    status: status ?? null,
    notes: notes ?? null,
  });
  res.json({ ok: true, supabaseSynced: supaRes.synced });
});

// Admin Business Hours
app.get('/api/admin/hours', (_req, res) => {
  const hours = db.prepare('SELECT * FROM business_hours ORDER BY day_of_week ASC').all().map((h: any) => ({
    ...h,
    is_open: Boolean(h.is_open),
    is_owner_confirmed: Boolean(h.is_owner_confirmed),
  }));
  res.json({ hours });
});

app.put('/api/admin/hours', (req, res) => {
  const { hours } = req.body as { hours: any[] };
  if (!Array.isArray(hours)) {
    res.status(400).json({ error: 'Hours array required.' });
    return;
  }
  const upd = db.prepare(
    `UPDATE business_hours
     SET is_open = ?, open_time = ?, close_time = ?, break_start = ?, break_end = ?, is_owner_confirmed = ?, notes = ?
     WHERE day_of_week = ?`
  );
  db.transaction(() => {
    for (const h of hours) {
      upd.run(
        h.is_open ? 1 : 0,
        h.open_time || '08:00',
        h.close_time || '19:00',
        h.break_start || null,
        h.break_end || null,
        h.is_owner_confirmed ? 1 : 0,
        h.notes || '',
        h.day_of_week
      );
    }
  })();
  res.json({ ok: true });
});

// Admin Blocked Dates & Blocked Time Slots
app.get('/api/admin/blocked', (_req, res) => {
  const blockedDates = db
    .prepare(
      `SELECT bd.*, b.full_name as barber_name FROM blocked_dates bd
       LEFT JOIN barbers b ON b.id = bd.barber_id
       ORDER BY bd.start_datetime DESC`
    )
    .all();
  const blockedSlots = db
    .prepare(
      `SELECT bs.*, b.full_name as barber_name FROM blocked_time_slots bs
       LEFT JOIN barbers b ON b.id = bs.barber_id
       ORDER BY bs.slot_date DESC, bs.start_time ASC`
    )
    .all();
  res.json({ blockedDates, blockedSlots });
});

app.post('/api/admin/blocked-dates', (req, res) => {
  const { barber_id, start_datetime, end_datetime, reason, block_type } = req.body;
  if (!start_datetime || !end_datetime) {
    res.status(400).json({ error: 'Start and end dates are required.' });
    return;
  }
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO blocked_dates (id, barber_id, start_datetime, end_datetime, reason, block_type)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, barber_id || null, start_datetime, end_datetime, reason || '', block_type || 'holiday');
  res.status(201).json({ id });
});

app.delete('/api/admin/blocked-dates/:id', (req, res) => {
  db.prepare('DELETE FROM blocked_dates WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.post('/api/admin/blocked-slots', (req, res) => {
  const { barber_id, slot_date, start_time, end_time, reason } = req.body;
  if (!slot_date || !start_time || !end_time) {
    res.status(400).json({ error: 'Date, start time, and end time are required.' });
    return;
  }
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO blocked_time_slots (id, barber_id, slot_date, start_time, end_time, reason)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, barber_id || null, slot_date, start_time, end_time, reason || '');
  res.status(201).json({ id });
});

app.delete('/api/admin/blocked-slots/:id', (req, res) => {
  db.prepare('DELETE FROM blocked_time_slots WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Admin Gallery
app.get('/api/admin/gallery', (_req, res) => {
  const images = db.prepare('SELECT * FROM gallery_images ORDER BY display_order ASC, created_at DESC').all().map((g: any) => ({
    ...g,
    is_active: Boolean(g.is_active),
  }));
  res.json({ images });
});

app.post('/api/admin/gallery', (req, res) => {
  const { title, category, image_url, alt_text } = req.body;
  if (!title || !category || !image_url) {
    res.status(400).json({ error: 'Title, category, and image URL are required.' });
    return;
  }
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO gallery_images (id, title, category, image_url, alt_text, is_active, display_order)
     VALUES (?, ?, ?, ?, ?, 1, 0)`
  ).run(id, title, category, image_url, alt_text || title);
  res.status(201).json({ id });
});

app.patch('/api/admin/gallery/:id', (req, res) => {
  const { title, category, alt_text, is_active } = req.body;
  db.prepare(
    `UPDATE gallery_images
     SET title = COALESCE(?, title),
         category = COALESCE(?, category),
         alt_text = COALESCE(?, alt_text),
         is_active = COALESCE(?, is_active)
     WHERE id = ?`
  ).run(title ?? null, category ?? null, alt_text ?? null, is_active !== undefined ? (is_active ? 1 : 0) : null, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/admin/gallery/:id', (req, res) => {
  db.prepare('DELETE FROM gallery_images WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Admin Testimonials
app.get('/api/admin/testimonials', (_req, res) => {
  const testimonials = db.prepare('SELECT * FROM testimonials ORDER BY created_at DESC').all().map((t: any) => ({
    ...t,
    is_verified_google: Boolean(t.is_verified_google),
    is_approved: Boolean(t.is_approved),
  }));
  res.json({ testimonials });
});

app.post('/api/admin/testimonials', (req, res) => {
  const { author_name, source, rating, quote, is_verified_google, is_approved } = req.body;
  if (!author_name || !quote) {
    res.status(400).json({ error: 'Author name and verified quote are required.' });
    return;
  }
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO testimonials (id, author_name, source, rating, quote, is_verified_google, is_approved)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, author_name, source || 'Google Review', Number(rating || 5), quote, is_verified_google ? 1 : 0, is_approved !== false ? 1 : 0);
  res.status(201).json({ id });
});

app.patch('/api/admin/testimonials/:id', (req, res) => {
  const { is_approved } = req.body;
  db.prepare('UPDATE testimonials SET is_approved = ? WHERE id = ?').run(is_approved ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/admin/testimonials/:id', (req, res) => {
  db.prepare('DELETE FROM testimonials WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Admin Blog Posts
app.get('/api/admin/blog', (_req, res) => {
  const posts = db.prepare('SELECT * FROM blog_posts ORDER BY created_at DESC').all().map((p: any) => ({
    ...p,
    is_published: Boolean(p.is_published),
  }));
  res.json({ posts });
});

app.post('/api/admin/blog', (req, res) => {
  const { title, excerpt, content, cover_image_url, category, is_published } = req.body;
  if (!title || !content) {
    res.status(400).json({ error: 'Title and content are required.' });
    return;
  }
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') +
    '-' +
    crypto.randomBytes(2).toString('hex');
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO blog_posts (id, slug, title, excerpt, content, cover_image_url, category, is_published)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, slug, title, excerpt || content.slice(0, 140), content, cover_image_url || '/assets/local/gallery_tools_craft.jpg', category || 'Grooming Guide', is_published !== false ? 1 : 0);
  res.status(201).json({ id, slug });
});

app.patch('/api/admin/blog/:id', (req, res) => {
  const { title, excerpt, content, cover_image_url, category, is_published } = req.body;
  db.prepare(
    `UPDATE blog_posts
     SET title = COALESCE(?, title),
         excerpt = COALESCE(?, excerpt),
         content = COALESCE(?, content),
         cover_image_url = COALESCE(?, cover_image_url),
         category = COALESCE(?, category),
         is_published = COALESCE(?, is_published),
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    title ?? null,
    excerpt ?? null,
    content ?? null,
    cover_image_url ?? null,
    category ?? null,
    is_published !== undefined ? (is_published ? 1 : 0) : null,
    req.params.id
  );
  res.json({ ok: true });
});

app.delete('/api/admin/blog/:id', (req, res) => {
  db.prepare('DELETE FROM blog_posts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Admin Settings & Notification Logs
app.get('/api/admin/settings', async (_req, res) => {
  const settings = db.prepare('SELECT * FROM business_settings WHERE id = 1').get() as Record<string, unknown>;
  const notifications = db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50').all();
  const supabaseStatus = await checkSupabaseSchemaStatus();
  res.json({
    settings: mapSettings(settings),
    notifications,
    integrations: {
      firebaseAuthConfigured: Boolean(getFirebaseProjectId()),
      firebaseProjectId: getFirebaseProjectId(),
      supabaseConfigured: supabaseStatus.configured,
      supabaseProjectId: supabaseStatus.projectId,
      supabaseSchemaReady: supabaseStatus.schemaReady,
      supabaseAdminSyncReady: supabaseStatus.adminSyncReady,
      supabaseNeedsAdminRpc: supabaseStatus.needsAdminRpc,
      supabaseStatusMessage: supabaseStatus.statusMessage,
      resendConfigured: Boolean(process.env.RESEND_API_KEY),
    },
  });
});

app.get('/api/admin/supabase-sql', (req, res) => {
  try {
    const fileType = req.query.file === 'upgrade' ? '002_admin_management_rpcs.sql' : '001_initial_schema.sql';
    const sqlPath = path.resolve(process.cwd(), 'supabase', 'migrations', fileType);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    res.json({ sql, file: fileType });
  } catch {
    res.status(404).json({ error: 'Migration SQL file not found.' });
  }
});

app.put('/api/admin/settings', (req, res) => {
  const s = req.body;
  db.prepare(
    `UPDATE business_settings
     SET business_name = ?, address = ?, phone = ?, email = ?, logo_url = ?, tagline = ?,
         currency = ?, timezone = ?, google_rating = ?, google_review_count = ?, google_maps_url = ?,
         instagram_url = ?, facebook_url = ?, tiktok_url = ?,
         allow_guest_booking = ?, cancellation_window_hours = ?, max_advance_days = ?,
         buffer_minutes = ?, require_admin_confirmation = ?, email_notifications_enabled = ?,
         updated_at = datetime('now')
     WHERE id = 1`
  ).run(
    s.business_name,
    s.address,
    s.phone,
    s.email,
    s.logo_url || '',
    s.tagline || '',
    s.currency || 'USD',
    s.timezone || 'America/Chicago',
    Number(s.google_rating || 5.0),
    Number(s.google_review_count || 6),
    s.google_maps_url || '',
    s.instagram_url || '',
    s.facebook_url || '',
    s.tiktok_url || '',
    s.allow_guest_booking ? 1 : 0,
    Number(s.cancellation_window_hours ?? 12),
    Number(s.max_advance_days ?? 60),
    Number(s.buffer_minutes ?? 0),
    s.require_admin_confirmation ? 1 : 0,
    s.email_notifications_enabled ? 1 : 0
  );
  const updated = db.prepare('SELECT * FROM business_settings WHERE id = 1').get() as Record<string, unknown>;
  res.json({ settings: mapSettings(updated) });
});

// =========================
// SERVER STARTUP (VITE DEV / PROD DIST)
// =========================
async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Xecutive Cutz server running at http://localhost:${PORT}`);
  });
}

startServer();
