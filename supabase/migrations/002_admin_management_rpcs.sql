-- Xecutive Cutz – Admin Management RPC Upgrade for Existing Supabase Projects
-- Project: ulxrslukflzdswqjvczt
-- Run this in your Supabase SQL Editor to enable full Admin fetching, approval,
-- completion revenue tracking, booking deletion, and customer profile verification.

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS profile_type TEXT NOT NULL DEFAULT 'guest';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.admin_fetch_dashboard_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointments JSONB;
  v_customers JSONB;
  v_profiles JSONB;
  v_services JSONB;
  v_barbers JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.appointment_date DESC, t.start_time DESC), '[]'::jsonb)
  INTO v_appointments
  FROM (
    SELECT
      a.id,
      a.booking_reference,
      a.customer_id,
      a.customer_name,
      a.customer_email,
      a.customer_phone,
      a.service_id,
      a.barber_id,
      COALESCE(NULLIF(a.barber_name_snapshot, ''), b.full_name, 'Assigned Barber') AS barber_name,
      a.appointment_date::text AS appointment_date,
      to_char(a.start_time, 'HH24:MI') AS start_time,
      to_char(a.end_time, 'HH24:MI') AS end_time,
      a.price_at_booking,
      a.service_name_snapshot,
      a.duration_minutes_snapshot,
      a.status,
      a.customer_notes,
      a.created_at,
      a.updated_at
    FROM public.appointments a
    LEFT JOIN public.barbers b ON b.id = a.barber_id
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(c)::jsonb ORDER BY c.created_at DESC), '[]'::jsonb)
  INTO v_customers
  FROM (
    SELECT
      id,
      profile_id,
      full_name,
      email,
      phone,
      status,
      COALESCE(profile_type, 'guest') AS profile_type,
      COALESCE(email_verified, FALSE) AS email_verified,
      notes,
      created_at
    FROM public.customers
  ) c;

  SELECT COALESCE(jsonb_agg(row_to_json(p)::jsonb ORDER BY p.created_at DESC), '[]'::jsonb)
  INTO v_profiles
  FROM (
    SELECT
      pr.id,
      pr.full_name,
      pr.email,
      pr.phone,
      pr.email_verified,
      COALESCE(ur.role, 'customer') AS role,
      pr.created_at
    FROM public.profiles pr
    LEFT JOIN public.user_roles ur ON ur.user_id = pr.id
  ) p;

  SELECT COALESCE(jsonb_agg(row_to_json(s)::jsonb ORDER BY s.display_order ASC, s.created_at ASC), '[]'::jsonb)
  INTO v_services
  FROM public.services s;

  SELECT COALESCE(jsonb_agg(row_to_json(b)::jsonb ORDER BY b.created_at ASC), '[]'::jsonb)
  INTO v_barbers
  FROM public.barbers b;

  RETURN jsonb_build_object(
    'appointments', v_appointments,
    'customers', v_customers,
    'profiles', v_profiles,
    'services', v_services,
    'barbers', v_barbers
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_appointment_status(
  p_appointment_id UUID,
  p_booking_reference TEXT,
  p_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show') THEN
    RAISE EXCEPTION 'Invalid status value.';
  END IF;

  UPDATE public.appointments
  SET status = p_status,
      updated_at = NOW()
  WHERE (p_appointment_id IS NOT NULL AND id = p_appointment_id)
     OR (p_booking_reference IS NOT NULL AND p_booking_reference <> '' AND booking_reference = trim(p_booking_reference));

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_appointment(
  p_appointment_id UUID,
  p_booking_reference TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.appointments
  WHERE (p_appointment_id IS NOT NULL AND id = p_appointment_id)
     OR (p_booking_reference IS NOT NULL AND p_booking_reference <> '' AND booking_reference = trim(p_booking_reference));

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_customer(
  p_customer_id UUID,
  p_email TEXT,
  p_status TEXT,
  p_notes TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status IS NOT NULL AND p_status NOT IN ('active', 'vip', 'blocked') THEN
    RAISE EXCEPTION 'Invalid customer status.';
  END IF;

  UPDATE public.customers
  SET status = COALESCE(p_status, status),
      notes = COALESCE(p_notes, notes)
  WHERE (p_customer_id IS NOT NULL AND id = p_customer_id)
     OR (p_email IS NOT NULL AND p_email <> '' AND lower(email) = lower(trim(p_email)));

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_customer_profile(
  p_full_name TEXT,
  p_email TEXT,
  p_phone TEXT DEFAULT '',
  p_profile_type TEXT DEFAULT 'registered',
  p_email_verified BOOLEAN DEFAULT FALSE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_email TEXT;
BEGIN
  v_clean_email := lower(trim(COALESCE(p_email, '')));
  IF v_clean_email = '' THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.customers (full_name, email, phone, status, profile_type, email_verified)
  VALUES (
    COALESCE(NULLIF(trim(p_full_name), ''), 'Client'),
    v_clean_email,
    COALESCE(trim(p_phone), ''),
    'active',
    COALESCE(NULLIF(trim(p_profile_type), ''), 'registered'),
    COALESCE(p_email_verified, FALSE)
  )
  ON CONFLICT (email) DO UPDATE
  SET full_name = COALESCE(NULLIF(trim(EXCLUDED.full_name), ''), public.customers.full_name),
      phone = CASE WHEN length(EXCLUDED.phone) >= 7 THEN EXCLUDED.phone ELSE public.customers.phone END,
      profile_type = CASE
        WHEN EXCLUDED.profile_type IN ('registered', 'google') THEN EXCLUDED.profile_type
        ELSE public.customers.profile_type
      END,
      email_verified = public.customers.email_verified OR EXCLUDED.email_verified;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_fetch_dashboard_data() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_appointment_status(UUID, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_appointment(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_customer(UUID, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_customer_profile(TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO anon, authenticated;
