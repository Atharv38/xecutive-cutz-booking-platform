import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppointmentItem } from '../src/types';

export const SUPABASE_PROJECT_ID = 'ulxrslukflzdswqjvczt';
export const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || `https://${SUPABASE_PROJECT_ID}.supabase.co`;
const SUPABASE_PUBLISHABLE_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_-zkqCQnkVf1BfQa4LhU64A_KMMOdUpo';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(val?: string | null): val is string {
  return Boolean(val && UUID_REGEX.test(val));
}

function isMissingRpcError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  const msg = err.message || '';
  return (
    err.code === 'PGRST202' ||
    err.code === '42883' ||
    msg.includes('Could not find the function') ||
    msg.includes('does not exist')
  );
}

export interface SupabaseSyncResult {
  synced: boolean;
  projectId: string;
  bookingReference?: string;
  schemaMissing?: boolean;
  method?: 'rpc' | 'service_role' | 'rest_insert';
  error?: string;
}

export interface SupabaseSchemaStatus {
  configured: boolean;
  projectId: string;
  url: string;
  hasServiceRole: boolean;
  connected: boolean;
  schemaReady: boolean;
  adminSyncReady: boolean;
  needsAdminRpc: boolean;
  statusMessage: string;
}

export interface SupabaseAdminSnapshot {
  ok: boolean;
  method?: 'rpc' | 'service_role';
  needsAdminRpc?: boolean;
  error?: string;
  appointments: any[];
  customers: any[];
  profiles: any[];
  services: any[];
  barbers: any[];
}

function getServerSupabaseClient(): { client: SupabaseClient; hasServiceRole: boolean } {
  const key = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_PUBLISHABLE_KEY;
  const client = createClient(SUPABASE_URL, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return { client, hasServiceRole: Boolean(SUPABASE_SERVICE_ROLE_KEY) };
}

export function getSupabaseConfigInfo() {
  return {
    configured: Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY),
    projectId: SUPABASE_PROJECT_ID,
    url: SUPABASE_URL,
    hasServiceRole: Boolean(SUPABASE_SERVICE_ROLE_KEY),
  };
}

export async function checkSupabaseSchemaStatus(): Promise<SupabaseSchemaStatus> {
  const info = getSupabaseConfigInfo();
  const { client, hasServiceRole } = getServerSupabaseClient();

  try {
    const { error: tableErr } = await client.from('appointments').select('id').limit(1);
    if (tableErr) {
      const msg = tableErr.message || '';
      const isMissingTable =
        tableErr.code === 'PGRST205' ||
        tableErr.code === '42P01' ||
        msg.includes('Could not find the table') ||
        msg.includes('does not exist');
      if (isMissingTable) {
        return {
          ...info,
          connected: true,
          schemaReady: false,
          adminSyncReady: false,
          needsAdminRpc: true,
          statusMessage:
            'Connected to Supabase project ulxrslukflzdswqjvczt, but public.appointments table is not created yet. Run supabase/migrations/001_initial_schema.sql in the Supabase SQL Editor.',
        };
      }
      return {
        ...info,
        connected: true,
        schemaReady: false,
        adminSyncReady: false,
        needsAdminRpc: false,
        statusMessage: `Supabase API responded with error (${tableErr.code || 'unknown'}): ${msg}`,
      };
    }

    if (hasServiceRole) {
      return {
        ...info,
        connected: true,
        schemaReady: true,
        adminSyncReady: true,
        needsAdminRpc: false,
        statusMessage: `Connected to Supabase project ${SUPABASE_PROJECT_ID} with Service Role access & all tables ready.`,
      };
    }

    const { error: rpcErr } = await client.rpc('admin_fetch_dashboard_data');
    if (rpcErr) {
      const missingRpc = isMissingRpcError(rpcErr);
      return {
        ...info,
        connected: true,
        schemaReady: true,
        adminSyncReady: false,
        needsAdminRpc: missingRpc,
        statusMessage: missingRpc
          ? `Supabase tables exist on ${SUPABASE_PROJECT_ID}, but Admin Sync RPCs (002_admin_management_rpcs.sql) are needed so the Admin Panel can read, approve, complete, and delete Supabase bookings.`
          : `Supabase connected, but admin sync returned: ${rpcErr.message}`,
      };
    }

    return {
      ...info,
      connected: true,
      schemaReady: true,
      adminSyncReady: true,
      needsAdminRpc: false,
      statusMessage: `Connected to Supabase project ${SUPABASE_PROJECT_ID} — live Admin Panel booking & customer sync active.`,
    };
  } catch (err) {
    return {
      ...info,
      connected: false,
      schemaReady: false,
      adminSyncReady: false,
      needsAdminRpc: false,
      statusMessage:
        err instanceof Error ? `Supabase connection failed: ${err.message}` : 'Unable to reach Supabase backend.',
    };
  }
}

export async function fetchSupabaseAdminSnapshot(): Promise<SupabaseAdminSnapshot> {
  const { client, hasServiceRole } = getServerSupabaseClient();

  try {
    if (hasServiceRole) {
      const [apptsRes, custRes, profRes, rolesRes, svcRes, barbRes] = await Promise.all([
        client.from('appointments').select('*').order('appointment_date', { ascending: false }),
        client.from('customers').select('*').order('created_at', { ascending: false }),
        client.from('profiles').select('id, full_name, email, phone, email_verified, created_at'),
        client.from('user_roles').select('user_id, role'),
        client.from('services').select('*').order('display_order', { ascending: true }),
        client.from('barbers').select('*').order('created_at', { ascending: true }),
      ]);

      if (apptsRes.error) {
        return {
          ok: false,
          error: apptsRes.error.message,
          appointments: [],
          customers: [],
          profiles: [],
          services: [],
          barbers: [],
        };
      }

      const roleMap = new Map<string, string>();
      for (const r of rolesRes.data || []) {
        roleMap.set(r.user_id, r.role);
      }
      const barberMap = new Map<string, string>();
      for (const b of barbRes.data || []) {
        barberMap.set(b.id, b.full_name);
      }

      const appointments = (apptsRes.data || []).map((a: any) => ({
        ...a,
        barber_name: a.barber_name_snapshot || barberMap.get(a.barber_id) || 'Assigned Barber',
        appointment_date: String(a.appointment_date || '').slice(0, 10),
        start_time: String(a.start_time || '').slice(0, 5),
        end_time: String(a.end_time || '').slice(0, 5),
      }));

      const profiles = (profRes.data || []).map((p: any) => ({
        ...p,
        role: roleMap.get(p.id) || 'customer',
      }));

      return {
        ok: true,
        method: 'service_role',
        needsAdminRpc: false,
        appointments,
        customers: custRes.data || [],
        profiles,
        services: svcRes.data || [],
        barbers: barbRes.data || [],
      };
    }

    const { data, error } = await client.rpc('admin_fetch_dashboard_data');
    if (error) {
      return {
        ok: false,
        needsAdminRpc: isMissingRpcError(error),
        error: error.message,
        appointments: [],
        customers: [],
        profiles: [],
        services: [],
        barbers: [],
      };
    }

    return {
      ok: true,
      method: 'rpc',
      needsAdminRpc: false,
      appointments: Array.isArray(data?.appointments) ? data.appointments : [],
      customers: Array.isArray(data?.customers) ? data.customers : [],
      profiles: Array.isArray(data?.profiles) ? data.profiles : [],
      services: Array.isArray(data?.services) ? data.services : [],
      barbers: Array.isArray(data?.barbers) ? data.barbers : [],
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unexpected error fetching Supabase snapshot.',
      appointments: [],
      customers: [],
      profiles: [],
      services: [],
      barbers: [],
    };
  }
}

export async function syncBookingToSupabase(
  appointment: AppointmentItem & { barber_name?: string; profile_type?: string; email_verified?: boolean }
): Promise<SupabaseSyncResult> {
  const { client, hasServiceRole } = getServerSupabaseClient();

  try {
    if (hasServiceRole) {
      await client
        .from('services')
        .upsert(
          {
            id: appointment.service_id,
            name: appointment.service_name_snapshot,
            price_cents: appointment.price_at_booking,
            duration_minutes: appointment.duration_minutes_snapshot,
            is_active: true,
            is_owner_approved: true,
          },
          { onConflict: 'id' }
        );

      await client
        .from('barbers')
        .upsert(
          {
            id: appointment.barber_id,
            full_name: appointment.barber_name || 'Assigned Barber',
            is_active: true,
          },
          { onConflict: 'id' }
        );

      await client
        .from('customers')
        .upsert(
          {
            full_name: appointment.customer_name,
            email: appointment.customer_email.toLowerCase(),
            phone: appointment.customer_phone,
            status: 'active',
          },
          { onConflict: 'email' }
        );

      const { error: insertErr } = await client.from('appointments').upsert(
        {
          id: appointment.id,
          booking_reference: appointment.booking_reference,
          customer_id: null,
          customer_name: appointment.customer_name,
          customer_email: appointment.customer_email.toLowerCase(),
          customer_phone: appointment.customer_phone,
          service_id: appointment.service_id,
          barber_id: appointment.barber_id,
          barber_name_snapshot: appointment.barber_name || 'Assigned Barber',
          appointment_date: appointment.appointment_date,
          start_time: appointment.start_time,
          end_time: appointment.end_time,
          price_at_booking: appointment.price_at_booking,
          service_name_snapshot: appointment.service_name_snapshot,
          duration_minutes_snapshot: appointment.duration_minutes_snapshot,
          status: appointment.status,
          customer_notes: appointment.customer_notes || '',
        },
        { onConflict: 'booking_reference' }
      );

      if (!insertErr) {
        return {
          synced: true,
          projectId: SUPABASE_PROJECT_ID,
          bookingReference: appointment.booking_reference,
          method: 'service_role',
        };
      }
    }

    const { error: rpcError } = await client.rpc('save_appointment_booking', {
      p_appointment_id: appointment.id,
      p_booking_reference: appointment.booking_reference,
      p_customer_name: appointment.customer_name,
      p_customer_email: appointment.customer_email.toLowerCase(),
      p_customer_phone: appointment.customer_phone,
      p_service_id: appointment.service_id,
      p_service_name: appointment.service_name_snapshot,
      p_price_cents: appointment.price_at_booking,
      p_duration_minutes: appointment.duration_minutes_snapshot,
      p_barber_id: appointment.barber_id,
      p_barber_name: appointment.barber_name || 'Assigned Barber',
      p_appointment_date: appointment.appointment_date,
      p_start_time: appointment.start_time,
      p_end_time: appointment.end_time,
      p_status: appointment.status,
      p_customer_notes: appointment.customer_notes || '',
    });

    if (!rpcError) {
      if (appointment.profile_type) {
        await syncCustomerProfileToSupabase({
          full_name: appointment.customer_name,
          email: appointment.customer_email.toLowerCase(),
          phone: appointment.customer_phone,
          profile_type: appointment.profile_type,
          email_verified: Boolean(appointment.email_verified),
        });
      }
      return {
        synced: true,
        projectId: SUPABASE_PROJECT_ID,
        bookingReference: appointment.booking_reference,
        method: 'rpc',
      };
    }

    const { error: directErr } = await client.from('appointments').insert({
      id: appointment.id,
      booking_reference: appointment.booking_reference,
      customer_name: appointment.customer_name,
      customer_email: appointment.customer_email.toLowerCase(),
      customer_phone: appointment.customer_phone,
      service_name_snapshot: appointment.service_name_snapshot,
      barber_name_snapshot: appointment.barber_name || 'Assigned Barber',
      appointment_date: appointment.appointment_date,
      start_time: appointment.start_time,
      end_time: appointment.end_time,
      price_at_booking: appointment.price_at_booking,
      duration_minutes_snapshot: appointment.duration_minutes_snapshot,
      status: appointment.status === 'pending' ? 'pending' : 'confirmed',
      customer_notes: appointment.customer_notes || '',
    });

    if (!directErr) {
      await client.from('customers').insert({
        full_name: appointment.customer_name,
        email: appointment.customer_email.toLowerCase(),
        phone: appointment.customer_phone,
        status: 'active',
      });
      return {
        synced: true,
        projectId: SUPABASE_PROJECT_ID,
        bookingReference: appointment.booking_reference,
        method: 'rest_insert',
      };
    }

    const combinedMsg = rpcError.message || directErr.message || 'Supabase write failed.';
    const schemaMissing =
      rpcError.code === 'PGRST202' ||
      rpcError.code === 'PGRST205' ||
      directErr.code === 'PGRST205' ||
      combinedMsg.includes('Could not find');

    console.warn('[Supabase Sync]', combinedMsg);
    return {
      synced: false,
      projectId: SUPABASE_PROJECT_ID,
      bookingReference: appointment.booking_reference,
      schemaMissing,
      error: combinedMsg,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected Supabase sync error.';
    console.warn('[Supabase Sync Exception]', msg);
    return {
      synced: false,
      projectId: SUPABASE_PROJECT_ID,
      bookingReference: appointment.booking_reference,
      error: msg,
    };
  }
}

export async function syncBookingStatusToSupabase(
  bookingReference: string,
  customerEmail: string,
  status: string,
  appointmentId?: string
): Promise<{ synced: boolean; error?: string }> {
  const { client, hasServiceRole } = getServerSupabaseClient();
  try {
    if (hasServiceRole) {
      const { error } = await client
        .from('appointments')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('booking_reference', bookingReference);
      return { synced: !error, error: error?.message };
    }

    const { error: adminRpcErr } = await client.rpc('admin_update_appointment_status', {
      p_appointment_id: isUuid(appointmentId) ? appointmentId : null,
      p_booking_reference: bookingReference,
      p_status: status,
    });

    if (!adminRpcErr) {
      return { synced: true };
    }

    if (isMissingRpcError(adminRpcErr)) {
      const { error: legacyErr } = await client.rpc('update_appointment_status_sync', {
        p_booking_reference: bookingReference,
        p_customer_email: customerEmail.toLowerCase(),
        p_status: status,
      });
      return { synced: !legacyErr, error: legacyErr?.message };
    }

    return { synced: false, error: adminRpcErr.message };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[Supabase Status Sync]', msg);
    return { synced: false, error: msg };
  }
}

export async function deleteBookingFromSupabase(
  appointmentId: string,
  bookingReference: string
): Promise<{ synced: boolean; error?: string }> {
  const { client, hasServiceRole } = getServerSupabaseClient();
  try {
    if (hasServiceRole) {
      const { error } = await client
        .from('appointments')
        .delete()
        .eq('booking_reference', bookingReference);
      return { synced: !error, error: error?.message };
    }

    const { error } = await client.rpc('admin_delete_appointment', {
      p_appointment_id: isUuid(appointmentId) ? appointmentId : null,
      p_booking_reference: bookingReference,
    });
    if (error) {
      console.warn('[Supabase Delete Sync]', error.message);
      return { synced: false, error: error.message };
    }
    return { synced: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[Supabase Delete Sync]', msg);
    return { synced: false, error: msg };
  }
}

export async function updateCustomerInSupabase(params: {
  id?: string;
  email: string;
  status?: string | null;
  notes?: string | null;
}): Promise<{ synced: boolean; error?: string }> {
  const { client, hasServiceRole } = getServerSupabaseClient();
  const normalizedEmail = (params.email || '').trim().toLowerCase();
  if (!normalizedEmail) return { synced: false, error: 'Missing customer email.' };

  try {
    if (hasServiceRole) {
      const patch: Record<string, unknown> = {};
      if (params.status) patch.status = params.status;
      if (params.notes !== undefined && params.notes !== null) patch.notes = params.notes;
      const { error } = await client.from('customers').update(patch).ilike('email', normalizedEmail);
      return { synced: !error, error: error?.message };
    }

    const { error } = await client.rpc('admin_update_customer', {
      p_customer_id: isUuid(params.id) ? params.id : null,
      p_email: normalizedEmail,
      p_status: params.status ?? null,
      p_notes: params.notes ?? null,
    });
    if (error) {
      return { synced: false, error: error.message };
    }
    return { synced: true };
  } catch (err) {
    return { synced: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function syncCustomerProfileToSupabase(params: {
  full_name: string;
  email: string;
  phone?: string;
  profile_type: 'registered' | 'google' | 'guest' | 'walkin' | string;
  email_verified: boolean;
}): Promise<void> {
  const { client, hasServiceRole } = getServerSupabaseClient();
  const normalizedEmail = (params.email || '').trim().toLowerCase();
  if (!normalizedEmail) return;

  try {
    if (hasServiceRole) {
      await client
        .from('customers')
        .upsert(
          {
            full_name: params.full_name,
            email: normalizedEmail,
            phone: params.phone || '',
            profile_type: params.profile_type,
            email_verified: params.email_verified,
            status: 'active',
          },
          { onConflict: 'email' }
        );
      return;
    }

    await client.rpc('sync_customer_profile', {
      p_full_name: params.full_name,
      p_email: normalizedEmail,
      p_phone: params.phone || '',
      p_profile_type: params.profile_type,
      p_email_verified: params.email_verified,
    });
  } catch (err) {
    console.warn('[Supabase Customer Profile Sync]', err instanceof Error ? err.message : err);
  }
}

export async function syncBookingRescheduleToSupabase(
  appointment: AppointmentItem & { barber_name?: string }
): Promise<void> {
  const { client, hasServiceRole } = getServerSupabaseClient();
  try {
    if (hasServiceRole) {
      await client
        .from('appointments')
        .update({
          barber_id: appointment.barber_id,
          barber_name_snapshot: appointment.barber_name || 'Assigned Barber',
          appointment_date: appointment.appointment_date,
          start_time: appointment.start_time,
          end_time: appointment.end_time,
          updated_at: new Date().toISOString(),
        })
        .eq('booking_reference', appointment.booking_reference);
      return;
    }

    await client.rpc('reschedule_appointment_sync', {
      p_booking_reference: appointment.booking_reference,
      p_customer_email: appointment.customer_email.toLowerCase(),
      p_barber_id: appointment.barber_id,
      p_barber_name: appointment.barber_name || 'Assigned Barber',
      p_appointment_date: appointment.appointment_date,
      p_start_time: appointment.start_time,
      p_end_time: appointment.end_time,
    });
  } catch (err) {
    console.warn('[Supabase Reschedule Sync]', err instanceof Error ? err.message : err);
  }
}
