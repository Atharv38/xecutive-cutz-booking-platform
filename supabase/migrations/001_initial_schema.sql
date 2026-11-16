-- Xecutive Cutz – Complete PostgreSQL / Supabase Database Schema
-- Project: ulxrslukflzdswqjvczt
-- Safe & idempotent: can be executed in the Supabase SQL Editor cleanly.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROFILES (optional link to Supabase Auth user ID)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL DEFAULT '',
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. USER ROLES
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('customer', 'admin')) DEFAULT 'customer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Helper function to check admin role safely in RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

-- 3. SERVICES
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_cents INTEGER CHECK (price_cents IS NULL OR price_cents >= 0),
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR (duration_minutes >= 10 AND duration_minutes <= 360)),
  image_url TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  is_owner_approved BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. BARBERS
CREATE TABLE IF NOT EXISTS public.barbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Barber',
  bio TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  specialties TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_placeholder BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. BARBER SERVICES (Join table)
CREATE TABLE IF NOT EXISTS public.barber_services (
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  PRIMARY KEY (barber_id, service_id)
);

-- 6. BARBER SCHEDULES (0=Sun .. 6=Sat)
CREATE TABLE IF NOT EXISTS public.barber_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_working BOOLEAN NOT NULL DEFAULT TRUE,
  start_time TIME NOT NULL DEFAULT '08:00',
  end_time TIME NOT NULL DEFAULT '19:00',
  break_start TIME,
  break_end TIME,
  UNIQUE(barber_id, day_of_week)
);

-- 7. BUSINESS HOURS (0=Sun .. 6=Sat)
CREATE TABLE IF NOT EXISTS public.business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week SMALLINT NOT NULL UNIQUE CHECK (day_of_week BETWEEN 0 AND 6),
  is_open BOOLEAN NOT NULL DEFAULT FALSE,
  open_time TIME NOT NULL DEFAULT '08:00',
  close_time TIME NOT NULL DEFAULT '19:00',
  break_start TIME,
  break_end TIME,
  is_owner_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT NOT NULL DEFAULT ''
);

-- 8. BLOCKED DATES
CREATE TABLE IF NOT EXISTS public.blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID REFERENCES public.barbers(id) ON DELETE CASCADE,
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  block_type TEXT NOT NULL DEFAULT 'holiday',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_datetime > start_datetime)
);

-- 9. BLOCKED TIME SLOTS
CREATE TABLE IF NOT EXISTS public.blocked_time_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID REFERENCES public.barbers(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);

-- 10. CUSTOMERS
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('active', 'vip', 'blocked')) DEFAULT 'active',
  profile_type TEXT NOT NULL DEFAULT 'guest',
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS profile_type TEXT NOT NULL DEFAULT 'guest';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- 11. APPOINTMENTS
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference TEXT NOT NULL UNIQUE,
  customer_id UUID,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  barber_id UUID REFERENCES public.barbers(id) ON DELETE SET NULL,
  barber_name_snapshot TEXT NOT NULL DEFAULT '',
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  price_at_booking INTEGER NOT NULL DEFAULT 0,
  service_name_snapshot TEXT NOT NULL,
  duration_minutes_snapshot INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')) DEFAULT 'pending',
  customer_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);

ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS barber_name_snapshot TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_appointments_lookup
  ON public.appointments (appointment_date, barber_id, status);
CREATE INDEX IF NOT EXISTS idx_appointments_customer
  ON public.appointments (customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_ref
  ON public.appointments (booking_reference);

-- 12. GALLERY IMAGES
CREATE TABLE IF NOT EXISTS public.gallery_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Haircuts', 'Skin Fades', 'Beard Styling', 'At Work', 'Interior')),
  image_url TEXT NOT NULL,
  alt_text TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. TESTIMONIALS
CREATE TABLE IF NOT EXISTS public.testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'Google Review',
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5) DEFAULT 5,
  quote TEXT NOT NULL,
  is_verified_google BOOLEAN NOT NULL DEFAULT FALSE,
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. BLOG POSTS
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  content TEXT NOT NULL,
  cover_image_url TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Grooming Guide',
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. BUSINESS SETTINGS
CREATE TABLE IF NOT EXISTS public.business_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1) DEFAULT 1,
  business_name TEXT NOT NULL DEFAULT 'Xecutive Cutz',
  address TEXT NOT NULL DEFAULT '919 N Haskell Ave., Dallas, TX 75204, United States',
  phone TEXT NOT NULL DEFAULT '+1 972-358-1199',
  email TEXT NOT NULL DEFAULT '',
  logo_url TEXT NOT NULL DEFAULT '',
  tagline TEXT NOT NULL DEFAULT 'Precision Cuts. Executive Style.',
  currency TEXT NOT NULL DEFAULT 'USD',
  timezone TEXT NOT NULL DEFAULT 'America/Chicago',
  google_rating NUMERIC(2,1) NOT NULL DEFAULT 5.0,
  google_review_count INTEGER NOT NULL DEFAULT 6,
  google_maps_url TEXT NOT NULL DEFAULT 'https://www.google.com/maps/place/Xecutive+Cutz/@32.7944157,-96.7776046,17z/',
  instagram_url TEXT NOT NULL DEFAULT '',
  facebook_url TEXT NOT NULL DEFAULT '',
  tiktok_url TEXT NOT NULL DEFAULT '',
  allow_guest_booking BOOLEAN NOT NULL DEFAULT TRUE,
  cancellation_window_hours INTEGER NOT NULL DEFAULT 12,
  max_advance_days INTEGER NOT NULL DEFAULT 60,
  buffer_minutes INTEGER NOT NULL DEFAULT 0,
  require_admin_confirmation BOOLEAN NOT NULL DEFAULT FALSE,
  email_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  recipient_role TEXT NOT NULL CHECK (recipient_role IN ('customer', 'admin')),
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  delivery_status TEXT NOT NULL CHECK (delivery_status IN ('sent', 'pending', 'not_configured', 'failed')) DEFAULT 'not_configured',
  provider TEXT NOT NULL DEFAULT 'resend',
  error_message TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SEED INITIAL VERIFIED BUSINESS SETTINGS & HOURS
INSERT INTO public.business_settings (
  id, business_name, address, phone, email, tagline, currency, timezone,
  google_rating, google_review_count, google_maps_url
) VALUES (
  1,
  'Xecutive Cutz',
  '919 N Haskell Ave., Dallas, TX 75204, United States',
  '+1 972-358-1199',
  'owner@xecutivecutz.com',
  'Precision Cuts. Executive Style.',
  'USD',
  'America/Chicago',
  5.0,
  6,
  'https://www.google.com/maps/place/Xecutive+Cutz/@32.7944157,-96.7776046,17z/'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.business_hours (day_of_week, is_open, open_time, close_time, is_owner_confirmed, notes)
VALUES
  (0, FALSE, '08:00', '19:00', FALSE, 'Sunday hours require owner confirmation'),
  (1, FALSE, '08:00', '19:00', FALSE, 'Monday hours require owner confirmation'),
  (2, TRUE,  '08:00', '19:00', FALSE, 'Listed public hours (pending owner confirmation)'),
  (3, TRUE,  '08:00', '19:00', FALSE, 'Listed public hours (pending owner confirmation)'),
  (4, TRUE,  '08:00', '19:00', FALSE, 'Listed public hours (pending owner confirmation)'),
  (5, TRUE,  '08:00', '19:00', FALSE, 'Listed public hours (pending owner confirmation)'),
  (6, TRUE,  '08:00', '19:00', FALSE, 'Listed public hours (pending owner confirmation)')
ON CONFLICT (day_of_week) DO NOTHING;

-- ATOMIC BOOKING SAVE RPC (Called when appointment booking form is submitted)
CREATE OR REPLACE FUNCTION public.save_appointment_booking(
  p_appointment_id UUID,
  p_booking_reference TEXT,
  p_customer_name TEXT,
  p_customer_email TEXT,
  p_customer_phone TEXT,
  p_service_id UUID,
  p_service_name TEXT,
  p_price_cents INTEGER,
  p_duration_minutes INTEGER,
  p_barber_id UUID,
  p_barber_name TEXT,
  p_appointment_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_status TEXT DEFAULT 'confirmed',
  p_customer_notes TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conflict_count INTEGER;
  v_clean_email TEXT;
  v_clean_status TEXT;
BEGIN
  IF length(trim(COALESCE(p_customer_name, ''))) < 2 THEN
    RAISE EXCEPTION 'Customer name is required.';
  END IF;
  IF trim(COALESCE(p_customer_email, '')) !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Valid customer email is required.';
  END IF;
  IF length(trim(COALESCE(p_customer_phone, ''))) < 7 THEN
    RAISE EXCEPTION 'Valid customer phone is required.';
  END IF;
  IF length(trim(COALESCE(p_booking_reference, ''))) < 4 THEN
    RAISE EXCEPTION 'Booking reference is required.';
  END IF;
  IF p_end_time <= p_start_time THEN
    RAISE EXCEPTION 'End time must be after start time.';
  END IF;

  v_clean_email := lower(trim(p_customer_email));
  v_clean_status := CASE WHEN p_status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show') THEN p_status ELSE 'confirmed' END;

  -- Ensure referenced service exists if UUID provided (no-op if already exists)
  IF p_service_id IS NOT NULL THEN
    INSERT INTO public.services (id, name, price_cents, duration_minutes, is_active, is_owner_approved)
    VALUES (
      p_service_id,
      COALESCE(NULLIF(trim(p_service_name), ''), 'Grooming Service'),
      GREATEST(COALESCE(p_price_cents, 0), 0),
      LEAST(GREATEST(COALESCE(p_duration_minutes, 45), 10), 360),
      TRUE,
      TRUE
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Ensure referenced barber exists if UUID provided (no-op if already exists)
  IF p_barber_id IS NOT NULL THEN
    INSERT INTO public.barbers (id, full_name, title, is_active, is_placeholder)
    VALUES (
      p_barber_id,
      COALESCE(NULLIF(trim(p_barber_name), ''), 'Assigned Barber'),
      'Barber',
      TRUE,
      FALSE
    )
    ON CONFLICT (id) DO NOTHING;

    PERFORM 1 FROM public.barbers WHERE id = p_barber_id FOR UPDATE;

    SELECT COUNT(*) INTO v_conflict_count
    FROM public.appointments
    WHERE barber_id = p_barber_id
      AND appointment_date = p_appointment_date
      AND booking_reference <> p_booking_reference
      AND status NOT IN ('cancelled', 'no_show')
      AND (start_time, end_time) OVERLAPS (p_start_time, p_end_time);

    IF v_conflict_count > 0 THEN
      RAISE EXCEPTION 'Time slot is already booked in Supabase.';
    END IF;
  END IF;

  -- Upsert customer record for owner directory
  INSERT INTO public.customers (full_name, email, phone, status)
  VALUES (trim(p_customer_name), v_clean_email, trim(p_customer_phone), 'active')
  ON CONFLICT (email) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      phone = CASE WHEN length(EXCLUDED.phone) >= 7 THEN EXCLUDED.phone ELSE public.customers.phone END;

  -- Upsert appointment record cleanly
  INSERT INTO public.appointments (
    id, booking_reference, customer_id, customer_name, customer_email, customer_phone,
    service_id, barber_id, barber_name_snapshot, appointment_date, start_time, end_time,
    price_at_booking, service_name_snapshot, duration_minutes_snapshot,
    status, customer_notes
  ) VALUES (
    COALESCE(p_appointment_id, gen_random_uuid()),
    trim(p_booking_reference),
    NULL,
    trim(p_customer_name),
    v_clean_email,
    trim(p_customer_phone),
    p_service_id,
    p_barber_id,
    COALESCE(NULLIF(trim(p_barber_name), ''), 'Assigned Barber'),
    p_appointment_date,
    p_start_time,
    p_end_time,
    GREATEST(COALESCE(p_price_cents, 0), 0),
    COALESCE(NULLIF(trim(p_service_name), ''), 'Grooming Service'),
    LEAST(GREATEST(COALESCE(p_duration_minutes, 45), 10), 360),
    v_clean_status,
    COALESCE(p_customer_notes, '')
  )
  ON CONFLICT (booking_reference) DO UPDATE
  SET status = EXCLUDED.status,
      updated_at = NOW();

  RETURN jsonb_build_object(
    'booking_reference', trim(p_booking_reference),
    'status', v_clean_status,
    'appointment_date', p_appointment_date,
    'start_time', p_start_time,
    'end_time', p_end_time
  );
END;
$$;

-- SYNC BOOKING STATUS UPDATE (Cancellation / Admin Status)
CREATE OR REPLACE FUNCTION public.update_appointment_status_sync(
  p_booking_reference TEXT,
  p_customer_email TEXT,
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
  WHERE booking_reference = trim(p_booking_reference)
    AND (p_customer_email IS NULL OR p_customer_email = '' OR lower(customer_email) = lower(trim(p_customer_email)));

  RETURN FOUND;
END;
$$;

-- SYNC BOOKING RESCHEDULE
CREATE OR REPLACE FUNCTION public.reschedule_appointment_sync(
  p_booking_reference TEXT,
  p_customer_email TEXT,
  p_barber_id UUID,
  p_barber_name TEXT,
  p_appointment_date DATE,
  p_start_time TIME,
  p_end_time TIME
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_end_time <= p_start_time THEN
    RAISE EXCEPTION 'End time must be after start time.';
  END IF;

  IF p_barber_id IS NOT NULL THEN
    INSERT INTO public.barbers (id, full_name, title, is_active, is_placeholder)
    VALUES (
      p_barber_id,
      COALESCE(NULLIF(trim(p_barber_name), ''), 'Assigned Barber'),
      'Barber',
      TRUE,
      FALSE
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  UPDATE public.appointments
  SET barber_id = COALESCE(p_barber_id, barber_id),
      barber_name_snapshot = COALESCE(NULLIF(trim(p_barber_name), ''), barber_name_snapshot),
      appointment_date = p_appointment_date,
      start_time = p_start_time,
      end_time = p_end_time,
      updated_at = NOW()
  WHERE booking_reference = trim(p_booking_reference)
    AND (p_customer_email IS NULL OR p_customer_email = '' OR lower(customer_email) = lower(trim(p_customer_email)));

  RETURN FOUND;
END;
$$;

-- ADMIN DASHBOARD SNAPSHOT RPC (Fetches appointments, customers, profiles, services, barbers)
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

-- ADMIN APPOINTMENT STATUS UPDATE RPC
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

-- ADMIN APPOINTMENT DELETE RPC
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

-- ADMIN CUSTOMER UPDATE RPC (Tier status & owner notes)
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

-- SYNC CUSTOMER & PROFILE KIND TO SUPABASE
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

GRANT EXECUTE ON FUNCTION public.save_appointment_booking(
  UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, INTEGER, INTEGER, UUID, TEXT, DATE, TIME, TIME, TEXT, TEXT
) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_appointment_status_sync(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment_sync(TEXT, TEXT, UUID, TEXT, DATE, TIME, TIME) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_fetch_dashboard_data() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_appointment_status(UUID, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_appointment(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_customer(UUID, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_customer_profile(TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO anon, authenticated;

-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barber_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barber_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES (Idempotent)
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users read own role" ON public.user_roles;
CREATE POLICY "Users read own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Only admin manages roles" ON public.user_roles;
CREATE POLICY "Only admin manages roles" ON public.user_roles FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Public read active services" ON public.services;
CREATE POLICY "Public read active services" ON public.services FOR SELECT USING (is_active = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "Admin manages services" ON public.services;
CREATE POLICY "Admin manages services" ON public.services FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Public read active barbers" ON public.barbers;
CREATE POLICY "Public read active barbers" ON public.barbers FOR SELECT USING (is_active = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "Admin manages barbers" ON public.barbers;
CREATE POLICY "Admin manages barbers" ON public.barbers FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Public read barber_services" ON public.barber_services;
CREATE POLICY "Public read barber_services" ON public.barber_services FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Admin manages barber_services" ON public.barber_services;
CREATE POLICY "Admin manages barber_services" ON public.barber_services FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Public read barber_schedules" ON public.barber_schedules;
CREATE POLICY "Public read barber_schedules" ON public.barber_schedules FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Admin manages barber_schedules" ON public.barber_schedules;
CREATE POLICY "Admin manages barber_schedules" ON public.barber_schedules FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Public read business_hours" ON public.business_hours;
CREATE POLICY "Public read business_hours" ON public.business_hours FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Admin manages business_hours" ON public.business_hours;
CREATE POLICY "Admin manages business_hours" ON public.business_hours FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Public read blocked_dates" ON public.blocked_dates;
CREATE POLICY "Public read blocked_dates" ON public.blocked_dates FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Admin manages blocked_dates" ON public.blocked_dates;
CREATE POLICY "Admin manages blocked_dates" ON public.blocked_dates FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Public read blocked_time_slots" ON public.blocked_time_slots;
CREATE POLICY "Public read blocked_time_slots" ON public.blocked_time_slots FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Admin manages blocked_time_slots" ON public.blocked_time_slots;
CREATE POLICY "Admin manages blocked_time_slots" ON public.blocked_time_slots FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Customers view own appointments" ON public.appointments;
CREATE POLICY "Customers view own appointments" ON public.appointments FOR SELECT USING (auth.uid() = customer_id OR public.is_admin());

DROP POLICY IF EXISTS "Customers update own appointments" ON public.appointments;
CREATE POLICY "Customers update own appointments" ON public.appointments FOR UPDATE USING (auth.uid() = customer_id OR public.is_admin());

DROP POLICY IF EXISTS "Public booking insert appointments" ON public.appointments;
CREATE POLICY "Public booking insert appointments" ON public.appointments
  FOR INSERT
  WITH CHECK (
    status IN ('pending', 'confirmed')
    AND length(trim(customer_name)) >= 2
    AND length(trim(customer_email)) >= 5
    AND length(trim(customer_phone)) >= 7
    AND length(trim(booking_reference)) >= 4
    AND end_time > start_time
  );

DROP POLICY IF EXISTS "Admin manages all appointments" ON public.appointments;
CREATE POLICY "Admin manages all appointments" ON public.appointments FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Public booking insert customers" ON public.customers;
CREATE POLICY "Public booking insert customers" ON public.customers
  FOR INSERT
  WITH CHECK (
    status = 'active'
    AND length(trim(full_name)) >= 2
    AND length(trim(email)) >= 5
  );

DROP POLICY IF EXISTS "Admin only customers" ON public.customers;
CREATE POLICY "Admin only customers" ON public.customers FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Public read active gallery" ON public.gallery_images;
CREATE POLICY "Public read active gallery" ON public.gallery_images FOR SELECT USING (is_active = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "Admin manages gallery" ON public.gallery_images;
CREATE POLICY "Admin manages gallery" ON public.gallery_images FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Public read approved testimonials" ON public.testimonials;
CREATE POLICY "Public read approved testimonials" ON public.testimonials FOR SELECT USING (is_approved = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "Admin manages testimonials" ON public.testimonials;
CREATE POLICY "Admin manages testimonials" ON public.testimonials FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Public read published blog" ON public.blog_posts;
CREATE POLICY "Public read published blog" ON public.blog_posts FOR SELECT USING (is_published = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "Admin manages blog" ON public.blog_posts;
CREATE POLICY "Admin manages blog" ON public.blog_posts FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Public read business_settings" ON public.business_settings;
CREATE POLICY "Public read business_settings" ON public.business_settings FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Admin manages settings" ON public.business_settings;
CREATE POLICY "Admin manages settings" ON public.business_settings FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admin only notifications" ON public.notifications;
CREATE POLICY "Admin only notifications" ON public.notifications FOR ALL USING (public.is_admin());
