export type UserRole = 'customer' | 'admin';

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: UserRole;
  email_verified: boolean;
  created_at: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  price_cents: number | null;
  duration_minutes: number | null;
  image_url: string;
  is_active: boolean;
  is_owner_approved: boolean;
  display_order: number;
  created_at: string;
}

export interface BarberSchedule {
  id: string;
  barber_id: string;
  day_of_week: number; // 0 = Sun .. 6 = Sat
  is_working: boolean;
  start_time: string; // HH:mm
  end_time: string;
  break_start: string | null;
  break_end: string | null;
}

export interface BarberItem {
  id: string;
  full_name: string;
  title: string;
  bio: string;
  image_url: string;
  specialties: string[];
  is_active: boolean;
  is_placeholder: boolean;
  schedules?: BarberSchedule[];
  created_at: string;
}

export interface BusinessHour {
  id: string;
  day_of_week: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
  break_start: string | null;
  break_end: string | null;
  is_owner_confirmed: boolean;
  notes: string;
}

export interface BlockedDate {
  id: string;
  barber_id: string | null;
  barber_name?: string | null;
  start_datetime: string;
  end_datetime: string;
  reason: string;
  block_type: string;
  created_at: string;
}

export interface BlockedTimeSlot {
  id: string;
  barber_id: string | null;
  barber_name?: string | null;
  slot_date: string;
  start_time: string;
  end_time: string;
  reason: string;
  created_at: string;
}

export type CustomerProfileType = 'google' | 'registered' | 'guest' | 'walkin';

export interface SupabaseAdminStatus {
  configured: boolean;
  projectId: string;
  connected: boolean;
  schemaReady: boolean;
  adminSyncReady: boolean;
  needsAdminRpc: boolean;
  syncedAppointments?: number;
  syncedCustomers?: number;
  statusMessage: string;
}

export interface AppointmentItem {
  id: string;
  booking_reference: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_id: string;
  barber_id: string;
  barber_name?: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  price_at_booking: number;
  service_name_snapshot: string;
  duration_minutes_snapshot: number;
  status: AppointmentStatus;
  customer_notes: string;
  customer_status?: 'active' | 'vip' | 'blocked';
  profile_type?: CustomerProfileType;
  email_verified?: boolean;
  account_role?: 'admin' | 'customer' | 'guest';
  created_at: string;
  updated_at: string;
}

export interface CustomerRecord {
  id: string;
  profile_id: string | null;
  full_name: string;
  email: string;
  phone: string;
  status: 'active' | 'vip' | 'blocked';
  profile_type: CustomerProfileType;
  email_verified: boolean;
  account_role: 'admin' | 'customer' | 'guest';
  notes: string;
  total_appointments: number;
  completed_appointments: number;
  pending_appointments: number;
  total_spent_cents: number;
  last_appointment_date: string | null;
  created_at: string;
}

export interface GalleryImage {
  id: string;
  title: string;
  category: 'Haircuts' | 'Skin Fades' | 'Beard Styling' | 'At Work' | 'Interior';
  image_url: string;
  alt_text: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export interface TestimonialItem {
  id: string;
  author_name: string;
  source: string;
  rating: number;
  quote: string;
  is_verified_google: boolean;
  is_approved: boolean;
  created_at: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  cover_image_url: string;
  category: string;
  is_published: boolean;
  published_at: string;
  created_at: string;
}

export interface BusinessSettings {
  id: number;
  business_name: string;
  address: string;
  phone: string;
  email: string;
  logo_url: string;
  tagline: string;
  currency: string;
  timezone: string;
  google_rating: number;
  google_review_count: number;
  google_maps_url: string;
  instagram_url: string;
  facebook_url: string;
  tiktok_url: string;
  allow_guest_booking: boolean;
  cancellation_window_hours: number;
  max_advance_days: number;
  buffer_minutes: number;
  require_admin_confirmation: boolean;
  email_notifications_enabled: boolean;
  updated_at: string;
}

export interface NotificationLog {
  id: string;
  recipient_email: string;
  recipient_role: 'customer' | 'admin';
  appointment_id: string | null;
  event_type: string;
  subject: string;
  body: string;
  delivery_status: 'sent' | 'pending' | 'not_configured' | 'failed';
  provider: string;
  error_message: string;
  created_at: string;
}

export interface AvailableSlot {
  start_time: string; // HH:mm
  end_time: string;
  label: string; // e.g. 9:00 AM
  barber_id: string;
  barber_name: string;
}
