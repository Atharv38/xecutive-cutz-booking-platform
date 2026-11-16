import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  Scissors,
  User,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useShop } from '../context/ShopContext';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { MEDIA, resolveMediaUrl } from '../lib/media';
import { formatCurrency, formatDateDisplay, formatTime12h } from '../lib/formatters';
import type { AppointmentItem, AvailableSlot } from '../types';

const guestInfoSchema = z.object({
  customer_name: z.string().min(2, 'Full name is required'),
  customer_email: z.string().email('Enter a valid email address'),
  customer_phone: z.string().min(7, 'Enter a valid phone number'),
  customer_notes: z.string().max(400).optional(),
});

type CustomerInfoForm = z.infer<typeof guestInfoSchema>;

const STEPS = [
  { num: 1, label: 'Service' },
  { num: 2, label: 'Barber' },
  { num: 3, label: 'Date' },
  { num: 4, label: 'Time' },
  { num: 5, label: 'Details' },
  { num: 6, label: 'Confirm' },
];

export function BookingPage() {
  const { services, barbers, settings, loading: shopLoading } = useShop();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const activeServices = useMemo(() => services.filter((s) => s.is_active), [services]);
  const activeBarbers = useMemo(() => barbers.filter((b) => b.is_active), [barbers]);

  const [step, setStep] = useState(1);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(searchParams.get('serviceId') || '');
  const [selectedBarberId, setSelectedBarberId] = useState<string>(searchParams.get('barberId') || 'any');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);

  // Calendar state
  const todayChicago = useMemo(
    () =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Chicago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date()),
    []
  );
  const [calYear, setCalYear] = useState<number>(() => Number(todayChicago.slice(0, 4)));
  const [calMonth, setCalMonth] = useState<number>(() => Number(todayChicago.slice(5, 7)));
  const [monthSummary, setMonthSummary] = useState<Record<string, { available: boolean; reason?: string }>>({});
  const [monthLoading, setMonthLoading] = useState(false);

  // Slots state
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsReason, setSlotsReason] = useState<string | undefined>();

  // Submission state
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<{
    appointment: AppointmentItem & { barber_name?: string };
    notificationMessage: string;
    supabaseSync?: {
      synced: boolean;
      projectId: string;
      schemaMissing?: boolean;
      error?: string;
    };
  } | null>(null);

  const form = useForm<CustomerInfoForm>({
    resolver: zodResolver(guestInfoSchema),
    defaultValues: {
      customer_name: user?.full_name || '',
      customer_email: user?.email || '',
      customer_phone: user?.phone || '',
      customer_notes: '',
    },
  });

  // Sync logged-in profile to form
  useEffect(() => {
    if (user) {
      form.setValue('customer_name', user.full_name);
      form.setValue('customer_email', user.email);
      form.setValue('customer_phone', user.phone);
    }
  }, [user, form]);

  // Preselect service or barber from query string if valid
  useEffect(() => {
    const qSvc = searchParams.get('serviceId');
    if (qSvc && activeServices.some((s) => s.id === qSvc)) {
      setSelectedServiceId(qSvc);
    }
    const qBarber = searchParams.get('barberId');
    if (qBarber && activeBarbers.some((b) => b.id === qBarber)) {
      setSelectedBarberId(qBarber);
    }
  }, [searchParams, activeServices, activeBarbers]);

  const selectedService = activeServices.find((s) => s.id === selectedServiceId) || null;
  const selectedBarber =
    selectedBarberId === 'any' ? null : activeBarbers.find((b) => b.id === selectedBarberId) || null;

  // Fetch month availability whenever entering Step 3 or changing month
  useEffect(() => {
    if (!selectedServiceId || step < 3) return;
    setMonthLoading(true);
    fetch(
      `/api/availability/month?serviceId=${encodeURIComponent(selectedServiceId)}&barberId=${encodeURIComponent(
        selectedBarberId
      )}&year=${calYear}&month=${calMonth}`
    )
      .then((r) => r.json())
      .then((data) => setMonthSummary(data.days || {}))
      .catch(() => setMonthSummary({}))
      .finally(() => setMonthLoading(false));
  }, [selectedServiceId, selectedBarberId, calYear, calMonth, step]);

  // Fetch time slots whenever date changes
  useEffect(() => {
    if (!selectedServiceId || !selectedDate) return;
    setSlotsLoading(true);
    setSlotsReason(undefined);
    fetch(
      `/api/availability?serviceId=${encodeURIComponent(selectedServiceId)}&barberId=${encodeURIComponent(
        selectedBarberId
      )}&date=${encodeURIComponent(selectedDate)}`
    )
      .then((r) => r.json())
      .then((data) => {
        setSlots(data.slots || []);
        setSlotsReason(data.unavailableReason);
      })
      .catch(() => {
        setSlots([]);
        setSlotsReason('Unable to load available time slots.');
      })
      .finally(() => setSlotsLoading(false));
  }, [selectedServiceId, selectedBarberId, selectedDate]);

  const calendarGrid = useMemo(() => {
    const firstDayDow = new Date(Date.UTC(calYear, calMonth - 1, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(calYear, calMonth, 0)).getUTCDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < firstDayDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${calYear}-${String(calMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return cells;
  }, [calYear, calMonth]);

  const monthLabel = new Date(Date.UTC(calYear, calMonth - 1, 15)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const handleConfirmBooking = async () => {
    if (!selectedService || !selectedDate || !selectedSlot) return;
    setSubmitting(true);
    setSubmitError('');
    const vals = form.getValues();
    try {
      const res = await apiFetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: vals.customer_name,
          customer_email: vals.customer_email,
          customer_phone: vals.customer_phone,
          customer_notes: vals.customer_notes || '',
          service_id: selectedService.id,
          barber_id: selectedBarberId === 'any' ? selectedSlot.barber_id : selectedBarberId,
          appointment_date: selectedDate,
          start_time: selectedSlot.start_time,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || 'Could not confirm booking.');
        return;
      }
      setConfirmedBooking({
        appointment: data.appointment,
        notificationMessage: data.notification?.message || '',
        supabaseSync: data.supabaseSync,
      });
    } catch {
      setSubmitError('Network error while reserving appointment.');
    } finally {
      setSubmitting(false);
    }
  };

  const guestBlocked = !user && settings && !settings.allow_guest_booking;

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F5F2EA] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-14">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#E9B84B]">
              Online Reservation
            </p>
            <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-[#F5F2EA]">
              Book Your Appointment
            </h1>
            <p className="text-sm text-[#A5A29B]">
              919 N Haskell Ave., Dallas, TX 75204 · Real-time chair availability
            </p>
          </div>
          {user ? (
            <div className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#141414] border border-[rgba(218,174,77,0.25)] rounded-sm text-xs text-[#F5F2EA] w-fit">
              <User className="w-3.5 h-3.5 text-[#E9B84B] shrink-0" />
              <span>Booking as {user.full_name}</span>
            </div>
          ) : (
            <Link
              to="/login?redirect=/book"
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#141414] border border-[rgba(218,174,77,0.25)] hover:border-[#E9B84B] rounded-sm text-xs text-[#A5A29B] hover:text-[#E9B84B] transition-colors w-fit"
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              <span>Sign in to save to your account</span>
            </Link>
          )}
        </div>

        {/* CONFIRMED BOOKING RECEIPT */}
        {confirmedBooking ? (
          <div className="bg-[#1C1B18] border border-[rgba(218,174,77,0.35)] rounded-sm p-6 sm:p-10 space-y-6">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-mono text-[#E9B84B] uppercase tracking-wider">
                  Booking Reference: {confirmedBooking.appointment.booking_reference}
                </p>
                <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[#F5F2EA]">
                  Your Seat Is Reserved
                </h2>
                <p className="text-sm text-[#A5A29B]">
                  Status: <span className="text-[#F5F2EA] capitalize">{confirmedBooking.appointment.status}</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 py-6 border-y border-[rgba(218,174,77,0.2)] text-sm">
              <div>
                <p className="text-xs text-[#A5A29B]">Service</p>
                <p className="font-semibold text-[#F5F2EA]">
                  {confirmedBooking.appointment.service_name_snapshot}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#A5A29B]">Barber</p>
                <p className="font-semibold text-[#F5F2EA]">
                  {confirmedBooking.appointment.barber_name || selectedSlot?.barber_name}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#A5A29B]">Date</p>
                <p className="font-semibold text-[#F5F2EA] tabular-nums">
                  {formatDateDisplay(confirmedBooking.appointment.appointment_date)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#A5A29B]">Time & Duration</p>
                <p className="font-semibold text-[#F5F2EA] tabular-nums">
                  {formatTime12h(confirmedBooking.appointment.start_time)} –{' '}
                  {formatTime12h(confirmedBooking.appointment.end_time)} (
                  {confirmedBooking.appointment.duration_minutes_snapshot} min)
                </p>
              </div>
              <div>
                <p className="text-xs text-[#A5A29B]">Total Price</p>
                <p className="font-semibold text-[#E9B84B] tabular-nums">
                  {formatCurrency(confirmedBooking.appointment.price_at_booking)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#A5A29B]">Client</p>
                <p className="font-semibold text-[#F5F2EA]">
                  {confirmedBooking.appointment.customer_name} · {confirmedBooking.appointment.customer_phone}
                </p>
              </div>
            </div>

            {confirmedBooking.notificationMessage && (
              <div className="flex items-start gap-2.5 text-xs text-[#A5A29B] bg-[#141414] p-4 rounded-sm border border-[rgba(218,174,77,0.18)]">
                <Info className="w-4 h-4 text-[#E9B84B] shrink-0 mt-0.5" />
                <span>{confirmedBooking.notificationMessage}</span>
              </div>
            )}

            {confirmedBooking.supabaseSync && (
              <div
                className={`flex items-start gap-2.5 text-xs p-4 rounded-sm border ${
                  confirmedBooking.supabaseSync.synced
                    ? 'text-emerald-200 bg-emerald-950/25 border-emerald-500/30'
                    : 'text-amber-200 bg-amber-950/25 border-amber-500/30'
                }`}
              >
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  {confirmedBooking.supabaseSync.synced
                    ? `Appointment details saved to Supabase project ${confirmedBooking.supabaseSync.projectId} (appointments & customers tables).`
                    : confirmedBooking.supabaseSync.schemaMissing
                    ? `Booking saved locally, but Supabase tables in project ${confirmedBooking.supabaseSync.projectId} are not created yet. Run supabase/migrations/001_initial_schema.sql in your Supabase SQL Editor.`
                    : `Booking saved locally. Supabase sync note (${confirmedBooking.supabaseSync.projectId}): ${confirmedBooking.supabaseSync.error || 'Unable to sync right now.'}`}
                </span>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {user ? (
                <Link
                  to="/dashboard"
                  className="px-6 py-3 text-xs font-semibold bg-[#E9B84B] text-[#0B0B0B] hover:bg-[#C99B3C] rounded-sm"
                >
                  View in My Dashboard
                </Link>
              ) : (
                <Link
                  to="/register"
                  className="px-6 py-3 text-xs font-semibold bg-[#E9B84B] text-[#0B0B0B] hover:bg-[#C99B3C] rounded-sm"
                >
                  Create Account to Manage Bookings
                </Link>
              )}
              <Link
                to="/"
                className="px-6 py-3 text-xs font-semibold border border-[rgba(218,174,77,0.3)] text-[#F5F2EA] hover:border-[#E9B84B] rounded-sm"
              >
                Return Home
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* STEP INDICATOR */}
            <nav aria-label="Booking steps" className="mb-8 overflow-x-auto pb-2">
              <ol className="flex items-center gap-2 min-w-max">
                {STEPS.map((s) => {
                  const active = step === s.num;
                  const done = step > s.num;
                  return (
                    <li key={s.num} className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!done}
                        onClick={() => done && setStep(s.num)}
                        className={`px-3.5 py-2 text-xs font-medium rounded-sm border transition-colors whitespace-nowrap ${
                          active
                            ? 'bg-[#E9B84B] text-[#0B0B0B] border-[#E9B84B] font-semibold'
                            : done
                            ? 'bg-[#1C1B18] text-[#E9B84B] border-[rgba(218,174,77,0.35)] cursor-pointer'
                            : 'bg-[#141414] text-[#A5A29B] border-[rgba(218,174,77,0.14)] cursor-default'
                        }`}
                      >
                        <span className="font-mono mr-1.5">{s.num}.</span>
                        {s.label}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>

            {/* STEP 1: SELECT SERVICE */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="font-serif text-2xl font-semibold">1. Select a Service</h2>
                    <p className="text-xs text-[#A5A29B] mt-1">
                      Choose a grooming service to view barber availability and open time slots.
                    </p>
                  </div>
                  {selectedService && (
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold bg-[#E9B84B] text-[#0B0B0B] hover:bg-[#C99B3C] rounded-sm cursor-pointer w-fit"
                    >
                      <span>Continue with {selectedService.name}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {shopLoading ? (
                  <div className="h-48 bg-[#141414] rounded-sm animate-pulse" />
                ) : activeServices.length === 0 ? (
                  <div className="bg-[#1C1B18] border border-[rgba(218,174,77,0.3)] rounded-sm p-8 space-y-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-[#E9B84B] shrink-0 mt-0.5" />
                      <div className="space-y-2">
                        <h3 className="font-serif text-xl text-[#F5F2EA]">
                          Services Currently Unavailable
                        </h3>
                        <p className="text-sm text-[#A5A29B] leading-relaxed max-w-2xl">
                          No active services are currently listed for online reservation. Please check back shortly or contact Xecutive Cutz at +1 972-358-1199.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 pt-2">
                      {user?.role === 'admin' && (
                        <Link
                          to="/admin/services"
                          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold bg-[#E9B84B] text-[#0B0B0B] hover:bg-[#C99B3C] rounded-sm"
                        >
                          <span>Manage Services in Admin</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
                      <Link
                        to="/"
                        className="px-5 py-2.5 text-xs font-medium border border-[rgba(218,174,77,0.25)] text-[#F5F2EA] rounded-sm"
                      >
                        Back to Homepage
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeServices.map((svc) => {
                      const selected = selectedServiceId === svc.id;
                      return (
                        <button
                          key={svc.id}
                          type="button"
                          onClick={() => {
                            setSelectedServiceId(svc.id);
                            setSelectedDate('');
                            setSelectedSlot(null);
                            setStep(2);
                          }}
                          className={`text-left p-5 rounded-sm border transition-colors flex gap-4 cursor-pointer ${
                            selected
                              ? 'bg-[#1C1B18] border-[#E9B84B]'
                              : 'bg-[#141414] border-[rgba(218,174,77,0.22)] hover:border-[#E9B84B]/60'
                          }`}
                        >
                          <img
                            src={resolveMediaUrl(svc.image_url, MEDIA.serviceHaircutFade)}
                            alt={svc.name}
                            className="w-20 h-20 object-cover rounded-sm shrink-0 bg-[#0B0B0B]"
                            referrerPolicy="no-referrer"
                          />
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-start justify-between gap-3">
                              <h3 className="font-serif text-lg font-semibold text-[#F5F2EA]">
                                {svc.name}
                              </h3>
                              <span className="font-mono text-sm font-semibold text-[#E9B84B] tabular-nums shrink-0">
                                {formatCurrency(svc.price_cents)}
                              </span>
                            </div>
                            <p className="text-xs text-[#A5A29B] line-clamp-2">{svc.description}</p>
                            <div className="flex items-center justify-between pt-0.5">
                              <p className="text-xs text-[#F5F2EA]/70 inline-flex items-center gap-1 tabular-nums">
                                <Clock className="w-3 h-3 text-[#E9B84B]" />
                                <span>{svc.duration_minutes || 45} min</span>
                              </p>
                              <span className="text-[11px] font-medium text-[#E9B84B] inline-flex items-center gap-1">
                                <span>Select</span>
                                <ArrowRight className="w-3 h-3" />
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: SELECT BARBER */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="font-serif text-2xl font-semibold">2. Choose Your Barber</h2>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex items-center gap-1.5 text-xs text-[#A5A29B] hover:text-[#E9B84B] cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Change Service</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBarberId('any');
                      setSelectedDate('');
                      setSelectedSlot(null);
                      setStep(3);
                    }}
                    className={`text-left p-5 rounded-sm border transition-colors flex items-center gap-4 cursor-pointer ${
                      selectedBarberId === 'any'
                        ? 'bg-[#1C1B18] border-[#E9B84B]'
                        : 'bg-[#141414] border-[rgba(218,174,77,0.22)] hover:border-[#E9B84B]/60'
                    }`}
                  >
                    <div className="w-16 h-16 rounded-sm bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] flex items-center justify-center shrink-0">
                      <Scissors className="w-6 h-6 text-[#E9B84B]" />
                    </div>
                    <div>
                      <h3 className="font-serif text-lg font-semibold text-[#F5F2EA]">
                        Any Available Barber
                      </h3>
                      <p className="text-xs text-[#A5A29B]">
                        Show the widest selection of open appointment times across all active chairs.
                      </p>
                    </div>
                  </button>

                  {activeBarbers.map((barber) => (
                    <button
                      key={barber.id}
                      type="button"
                      onClick={() => {
                        setSelectedBarberId(barber.id);
                        setSelectedDate('');
                        setSelectedSlot(null);
                        setStep(3);
                      }}
                      className={`text-left p-5 rounded-sm border transition-colors flex items-center gap-4 cursor-pointer ${
                        selectedBarberId === barber.id
                          ? 'bg-[#1C1B18] border-[#E9B84B]'
                          : 'bg-[#141414] border-[rgba(218,174,77,0.22)] hover:border-[#E9B84B]/60'
                      }`}
                    >
                      <img
                        src={resolveMediaUrl(barber.image_url, MEDIA.barberPortraitStudio)}
                        alt={barber.full_name}
                        className="w-16 h-16 object-cover object-top rounded-sm shrink-0 bg-[#0B0B0B]"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0">
                        <h3 className="font-serif text-lg font-semibold text-[#F5F2EA] truncate">
                          {barber.full_name}
                        </h3>
                        <p className="text-xs text-[#E9B84B]">{barber.title}</p>
                        {barber.specialties.length > 0 && (
                          <p className="text-xs text-[#A5A29B] truncate mt-1">
                            {barber.specialties.join(' · ')}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 3: SELECT DATE */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="font-serif text-2xl font-semibold">3. Select Date</h2>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="inline-flex items-center gap-1.5 text-xs text-[#A5A29B] hover:text-[#E9B84B] cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Change Barber</span>
                  </button>
                </div>

                <div className="bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm p-6 max-w-xl">
                  <div className="flex items-center justify-between mb-6">
                    <button
                      type="button"
                      onClick={() => {
                        if (calMonth === 1) {
                          setCalYear((y) => y - 1);
                          setCalMonth(12);
                        } else {
                          setCalMonth((m) => m - 1);
                        }
                      }}
                      aria-label="Previous month"
                      className="w-10 h-10 flex items-center justify-center border border-[rgba(218,174,77,0.22)] rounded-sm text-[#F5F2EA] hover:border-[#E9B84B] cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <h3 className="font-serif text-xl font-semibold text-[#F5F2EA]">{monthLabel}</h3>
                    <button
                      type="button"
                      onClick={() => {
                        if (calMonth === 12) {
                          setCalYear((y) => y + 1);
                          setCalMonth(1);
                        } else {
                          setCalMonth((m) => m + 1);
                        }
                      }}
                      aria-label="Next month"
                      className="w-10 h-10 flex items-center justify-center border border-[rgba(218,174,77,0.22)] rounded-sm text-[#F5F2EA] hover:border-[#E9B84B] cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-2 text-center text-xs text-[#A5A29B] mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                      <div key={d} className="py-1 font-medium">
                        {d}
                      </div>
                    ))}
                  </div>

                  {monthLoading ? (
                    <div className="h-60 bg-[#1C1B18] rounded-sm animate-pulse" />
                  ) : (
                    <div className="grid grid-cols-7 gap-2">
                      {calendarGrid.map((dateStr, idx) => {
                        if (!dateStr) return <div key={`empty-${idx}`} />;
                        const info = monthSummary[dateStr];
                        const isAvailable = info?.available ?? false;
                        const isSelected = selectedDate === dateStr;
                        const dayNum = Number(dateStr.slice(8, 10));

                        return (
                          <button
                            key={dateStr}
                            type="button"
                            disabled={!isAvailable}
                            title={info?.reason || undefined}
                            onClick={() => {
                              setSelectedDate(dateStr);
                              setSelectedSlot(null);
                              setStep(4);
                            }}
                            className={`h-11 rounded-sm text-sm font-mono tabular-nums transition-colors border ${
                              isSelected
                                ? 'bg-[#E9B84B] text-[#0B0B0B] border-[#E9B84B] font-semibold'
                                : isAvailable
                                ? 'bg-[#1C1B18] text-[#F5F2EA] border-[rgba(218,174,77,0.25)] hover:border-[#E9B84B] hover:text-[#E9B84B] cursor-pointer'
                                : 'bg-[#0B0B0B] text-[#A5A29B]/30 border-transparent cursor-not-allowed line-through'
                            }`}
                          >
                            {dayNum}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-5 pt-4 border-t border-[rgba(218,174,77,0.16)] flex flex-wrap gap-5 text-xs text-[#A5A29B]">
                    <span>Highlighted dates have live openings</span>
                    <span>Crossed-out dates are closed, past, or fully booked</span>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: SELECT TIME SLOT */}
            {step === 4 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="font-serif text-2xl font-semibold">4. Select Time Slot</h2>
                    <p className="text-xs text-[#A5A29B] mt-1">
                      {formatDateDisplay(selectedDate)} · Central Time (America/Chicago)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="inline-flex items-center gap-1.5 text-xs text-[#A5A29B] hover:text-[#E9B84B] cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Change Date</span>
                  </button>
                </div>

                {slotsLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                      <div key={i} className="h-12 bg-[#141414] rounded-sm animate-pulse" />
                    ))}
                  </div>
                ) : slots.length === 0 ? (
                  <div className="bg-[#1C1B18] border border-[rgba(218,174,77,0.22)] rounded-sm p-6 space-y-3">
                    <p className="text-sm text-[#F5F2EA]">
                      {slotsReason || 'No available time slots remain for this selection.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="px-4 py-2 text-xs font-semibold bg-[#E9B84B] text-[#0B0B0B] rounded-sm cursor-pointer"
                    >
                      Choose Another Date
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {slots.map((slot) => {
                      const active = selectedSlot?.start_time === slot.start_time;
                      return (
                        <button
                          key={slot.start_time}
                          type="button"
                          onClick={() => {
                            setSelectedSlot(slot);
                            setStep(5);
                          }}
                          className={`py-3 px-4 rounded-sm border text-left transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#E9B84B] text-[#0B0B0B] border-[#E9B84B]'
                              : 'bg-[#141414] text-[#F5F2EA] border-[rgba(218,174,77,0.22)] hover:border-[#E9B84B]'
                          }`}
                        >
                          <div className="font-mono text-sm font-semibold tabular-nums">
                            {slot.label}
                          </div>
                          {selectedBarberId === 'any' && (
                            <div className={`text-[11px] truncate ${active ? 'text-[#0B0B0B]/80' : 'text-[#A5A29B]'}`}>
                              {slot.barber_name}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* STEP 5: CUSTOMER INFORMATION */}
            {step === 5 && (
              <div className="space-y-6 max-w-xl">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="font-serif text-2xl font-semibold">5. Your Information</h2>
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="inline-flex items-center gap-1.5 text-xs text-[#A5A29B] hover:text-[#E9B84B] cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Change Time</span>
                  </button>
                </div>

                {guestBlocked ? (
                  <div className="bg-[#1C1B18] border border-[rgba(218,174,77,0.3)] rounded-sm p-6 space-y-4">
                    <p className="text-sm text-[#F5F2EA]">
                      Guest booking is currently disabled. Please sign in or create a free customer account to complete your reservation.
                    </p>
                    <div className="flex gap-3">
                      <Link
                        to="/login?redirect=/book"
                        className="px-5 py-2.5 text-xs font-semibold bg-[#E9B84B] text-[#0B0B0B] rounded-sm"
                      >
                        Sign In
                      </Link>
                      <Link
                        to="/register?redirect=/book"
                        className="px-5 py-2.5 text-xs font-semibold border border-[rgba(218,174,77,0.3)] text-[#F5F2EA] rounded-sm"
                      >
                        Register
                      </Link>
                    </div>
                  </div>
                ) : (
                  <form
                    onSubmit={form.handleSubmit(() => setStep(6))}
                    className="bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm p-6 space-y-4"
                  >
                    {user && (
                      <div className="flex items-center gap-2 text-xs text-[#E9B84B] pb-2 border-b border-[rgba(218,174,77,0.14)]">
                        <User className="w-4 h-4" />
                        <span>Signed in as {user.full_name}</span>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-[#A5A29B]">Full Name</label>
                      <input
                        {...form.register('customer_name')}
                        className="w-full px-3.5 py-2.5 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm text-sm text-[#F5F2EA] focus:outline-none focus:border-[#E9B84B]"
                        placeholder="Marcus Johnson"
                      />
                      {form.formState.errors.customer_name && (
                        <p className="text-xs text-rose-400">{form.formState.errors.customer_name.message}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-[#A5A29B]">Email Address</label>
                        <input
                          type="email"
                          {...form.register('customer_email')}
                          className="w-full px-3.5 py-2.5 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm text-sm text-[#F5F2EA] focus:outline-none focus:border-[#E9B84B]"
                          placeholder="you@example.com"
                        />
                        {form.formState.errors.customer_email && (
                          <p className="text-xs text-rose-400">{form.formState.errors.customer_email.message}</p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-[#A5A29B]">Phone Number</label>
                        <input
                          type="tel"
                          {...form.register('customer_phone')}
                          className="w-full px-3.5 py-2.5 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm text-sm text-[#F5F2EA] focus:outline-none focus:border-[#E9B84B]"
                          placeholder="+1 214-555-0199"
                        />
                        {form.formState.errors.customer_phone && (
                          <p className="text-xs text-rose-400">{form.formState.errors.customer_phone.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-[#A5A29B]">
                        Booking Notes (Optional)
                      </label>
                      <textarea
                        rows={3}
                        {...form.register('customer_notes')}
                        className="w-full px-3.5 py-2.5 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm text-sm text-[#F5F2EA] focus:outline-none focus:border-[#E9B84B]"
                        placeholder="Style preferences, fade guard notes, or beard instructions..."
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full inline-flex items-center justify-center gap-2 py-3 px-6 text-sm font-semibold bg-[#E9B84B] text-[#0B0B0B] hover:bg-[#C99B3C] rounded-sm cursor-pointer"
                    >
                      <span>Review Summary</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* STEP 6: BOOKING SUMMARY & CONFIRMATION */}
            {step === 6 && selectedService && selectedSlot && (
              <div className="space-y-6 max-w-xl">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="font-serif text-2xl font-semibold">6. Confirm Appointment</h2>
                  <button
                    type="button"
                    onClick={() => setStep(5)}
                    className="inline-flex items-center gap-1.5 text-xs text-[#A5A29B] hover:text-[#E9B84B] cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Edit Details</span>
                  </button>
                </div>

                <div className="bg-[#1C1B18] border border-[rgba(218,174,77,0.3)] rounded-sm p-6 space-y-5">
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-[rgba(218,174,77,0.14)]">
                      <span className="text-[#A5A29B]">Service</span>
                      <span className="font-semibold text-[#F5F2EA]">{selectedService.name}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[rgba(218,174,77,0.14)]">
                      <span className="text-[#A5A29B]">Barber</span>
                      <span className="font-semibold text-[#F5F2EA]">
                        {selectedBarber ? selectedBarber.full_name : selectedSlot.barber_name}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[rgba(218,174,77,0.14)]">
                      <span className="text-[#A5A29B]">Date</span>
                      <span className="font-semibold text-[#F5F2EA] tabular-nums">
                        {formatDateDisplay(selectedDate)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[rgba(218,174,77,0.14)]">
                      <span className="text-[#A5A29B]">Time</span>
                      <span className="font-semibold text-[#F5F2EA] tabular-nums">
                        {selectedSlot.label} ({selectedService.duration_minutes || 45} min)
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[rgba(218,174,77,0.14)]">
                      <span className="text-[#A5A29B]">Customer</span>
                      <span className="font-semibold text-[#F5F2EA]">{form.getValues('customer_name')}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-[#A5A29B]">Total Price</span>
                      <span className="font-mono text-lg font-semibold text-[#E9B84B] tabular-nums">
                        {formatCurrency(selectedService.price_cents)}
                      </span>
                    </div>
                  </div>

                  {submitError && (
                    <div className="p-3.5 bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs rounded-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleConfirmBooking}
                    className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 text-sm font-semibold bg-[#E9B84B] text-[#0B0B0B] hover:bg-[#C99B3C] disabled:opacity-50 rounded-sm cursor-pointer"
                  >
                    <CalendarIcon className="w-4 h-4" />
                    <span>{submitting ? 'Reserving Slot...' : 'Confirm Appointment'}</span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
