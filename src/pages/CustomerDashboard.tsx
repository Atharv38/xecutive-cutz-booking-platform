import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, LogOut, RefreshCw, Shield, UserCheck, X } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { StatusLabel } from '../components/StatusLabel';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { formatCurrency, formatDateDisplay, formatTime12h } from '../lib/formatters';
import type { AppointmentItem, AvailableSlot } from '../types';

export function CustomerDashboard() {
  const { user, loading, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [loadingAppts, setLoadingAppts] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  // Profile form
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Reschedule modal
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentItem | null>(null);
  const [newDate, setNewDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');

  const loadAppointments = useCallback(async () => {
    setLoadingAppts(true);
    try {
      const res = await apiFetch('/api/customer/appointments');
      if (res.ok) {
        const data = await res.json();
        setAppointments(data.appointments || []);
      }
    } finally {
      setLoadingAppts(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login?redirect=/dashboard');
      return;
    }
    if (user) {
      setFullName(user.full_name);
      setPhone(user.phone);
      loadAppointments();
    }
  }, [loading, user, navigate, loadAppointments]);

  const handleCancel = async (id: string) => {
    setError('');
    setFeedback('');
    const res = await apiFetch(`/api/customer/appointments/${id}/cancel`, {
      method: 'PATCH',
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Could not cancel appointment.');
      return;
    }
    setFeedback('Appointment cancelled and availability released.');
    loadAppointments();
  };

  useEffect(() => {
    if (!rescheduleTarget || !newDate) return;
    fetch(
      `/api/availability?serviceId=${encodeURIComponent(rescheduleTarget.service_id)}&barberId=${encodeURIComponent(
        rescheduleTarget.barber_id
      )}&date=${encodeURIComponent(newDate)}`
    )
      .then((r) => r.json())
      .then((d) => setAvailableSlots(d.slots || []));
  }, [rescheduleTarget, newDate]);

  const handleRescheduleSubmit = async () => {
    if (!rescheduleTarget || !newDate || !selectedSlot) return;
    setError('');
    const res = await apiFetch(`/api/customer/appointments/${rescheduleTarget.id}/reschedule`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appointment_date: newDate,
        start_time: selectedSlot,
        barber_id: rescheduleTarget.barber_id,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Unable to reschedule.');
      return;
    }
    setRescheduleTarget(null);
    setFeedback('Appointment rescheduled successfully.');
    loadAppointments();
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFeedback('');
    const res = await apiFetch('/api/customer/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName, phone }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    await refreshUser();
    setFeedback('Profile updated.');
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFeedback('');
    const res = await apiFetch('/api/customer/password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setFeedback('Password changed successfully.');
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0B0B0B] text-[#F5F2EA] flex items-center justify-center">
        <p className="text-sm text-[#A5A29B]">Loading account...</p>
      </div>
    );
  }

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
  const upcoming = appointments.filter(
    (a) => a.appointment_date >= today && (a.status === 'pending' || a.status === 'confirmed')
  );
  const history = appointments.filter(
    (a) => !(a.appointment_date >= today && (a.status === 'pending' || a.status === 'confirmed'))
  );

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F5F2EA] flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-10 space-y-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[rgba(218,174,77,0.22)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#E9B84B]">
              Client Portal
            </p>
            <h1 className="font-serif text-3xl font-semibold mt-1">
              Welcome back, {user.full_name}
            </h1>
            <p className="text-xs text-[#A5A29B] mt-1">
              {user.email} · {user.phone || 'No phone saved'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {user.role === 'admin' && (
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border border-[#E9B84B] text-[#E9B84B] rounded-sm"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin Panel</span>
              </Link>
            )}
            <Link
              to="/book"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold bg-[#E9B84B] text-[#0B0B0B] rounded-sm"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Book Appointment</span>
            </Link>
            <button
              type="button"
              onClick={() => logout().then(() => navigate('/'))}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border border-[rgba(218,174,77,0.22)] text-[#A5A29B] hover:text-[#F5F2EA] rounded-sm cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {feedback && (
          <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs rounded-sm">
            {feedback}
          </div>
        )}
        {error && (
          <div className="p-3.5 bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs rounded-sm">
            {error}
          </div>
        )}

        {/* UPCOMING APPOINTMENTS */}
        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-semibold">Upcoming Appointments</h2>
          {loadingAppts ? (
            <div className="h-32 bg-[#141414] rounded-sm animate-pulse" />
          ) : upcoming.length === 0 ? (
            <div className="bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <p className="text-sm text-[#A5A29B]">You have no upcoming appointments scheduled.</p>
              <Link
                to="/book"
                className="px-4 py-2 text-xs font-semibold bg-[#E9B84B] text-[#0B0B0B] rounded-sm w-fit"
              >
                Reserve a Chair
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcoming.map((appt) => (
                <div
                  key={appt.id}
                  className="bg-[#1C1B18] border border-[rgba(218,174,77,0.25)] rounded-sm p-5 space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-[#E9B84B]">{appt.booking_reference}</p>
                      <h3 className="font-serif text-xl font-semibold text-[#F5F2EA]">
                        {appt.service_name_snapshot}
                      </h3>
                      <p className="text-xs text-[#A5A29B]">with {appt.barber_name}</p>
                    </div>
                    <StatusLabel status={appt.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-[rgba(218,174,77,0.14)] tabular-nums">
                    <div>
                      <span className="text-[#A5A29B] block">Date</span>
                      <span className="text-[#F5F2EA] font-medium">
                        {formatDateDisplay(appt.appointment_date)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#A5A29B] block">Time & Total</span>
                      <span className="text-[#F5F2EA] font-medium">
                        {formatTime12h(appt.start_time)} · {formatCurrency(appt.price_at_booking)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setRescheduleTarget(appt);
                        setNewDate(appt.appointment_date);
                        setSelectedSlot('');
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-[rgba(218,174,77,0.3)] text-[#F5F2EA] hover:border-[#E9B84B] rounded-sm cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Reschedule</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCancel(appt.id)}
                      className="px-3.5 py-2 text-xs font-medium border border-rose-500/30 text-rose-300 hover:bg-rose-950/40 rounded-sm cursor-pointer"
                    >
                      Cancel Appointment
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* BOOKING HISTORY */}
        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-semibold">Booking History</h2>
          {history.length === 0 ? (
            <p className="text-sm text-[#A5A29B]">No past or cancelled appointments yet.</p>
          ) : (
            <div className="overflow-x-auto bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[rgba(218,174,77,0.18)] text-[#A5A29B]">
                  <tr>
                    <th className="py-3 px-4 font-medium">Reference</th>
                    <th className="py-3 px-4 font-medium">Service</th>
                    <th className="py-3 px-4 font-medium">Barber</th>
                    <th className="py-3 px-4 font-medium">Date & Time</th>
                    <th className="py-3 px-4 font-medium text-right">Price</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(218,174,77,0.12)] tabular-nums">
                  {history.map((a) => (
                    <tr key={a.id} className="hover:bg-[#1C1B18]/60">
                      <td className="py-3 px-4 font-mono text-[#E9B84B]">{a.booking_reference}</td>
                      <td className="py-3 px-4 text-[#F5F2EA]">{a.service_name_snapshot}</td>
                      <td className="py-3 px-4 text-[#A5A29B]">{a.barber_name}</td>
                      <td className="py-3 px-4 text-[#F5F2EA]">
                        {formatDateDisplay(a.appointment_date)} · {formatTime12h(a.start_time)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[#F5F2EA]">
                        {formatCurrency(a.price_at_booking)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusLabel status={a.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* PROFILE & SECURITY */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          <form
            onSubmit={handleProfileSave}
            className="bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm p-6 space-y-4"
          >
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#E9B84B]" />
              <h3 className="font-serif text-xl font-semibold">Profile Details</h3>
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-[#A5A29B]">Full Name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm text-sm text-[#F5F2EA]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-[#A5A29B]">Phone Number</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm text-sm text-[#F5F2EA]"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-semibold bg-[#E9B84B] text-[#0B0B0B] rounded-sm cursor-pointer"
            >
              Save Profile
            </button>
          </form>

          <form
            onSubmit={handlePasswordChange}
            className="bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm p-6 space-y-4"
          >
            <h3 className="font-serif text-xl font-semibold">Change Password</h3>
            <div className="space-y-1">
              <label className="block text-xs text-[#A5A29B]">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm text-sm text-[#F5F2EA]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-[#A5A29B]">New Password (8+ characters)</label>
              <input
                type="password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm text-sm text-[#F5F2EA]"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-semibold border border-[#E9B84B] text-[#E9B84B] hover:bg-[#E9B84B] hover:text-[#0B0B0B] transition-colors rounded-sm cursor-pointer"
            >
              Update Password
            </button>
          </form>
        </section>
      </main>

      {/* RESCHEDULE MODAL */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[rgba(218,174,77,0.3)] rounded-sm p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-xl font-semibold">Reschedule {rescheduleTarget.booking_reference}</h3>
              <button
                type="button"
                onClick={() => setRescheduleTarget(null)}
                className="text-[#A5A29B] hover:text-[#F5F2EA] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-[#A5A29B]">New Date</label>
              <input
                type="date"
                min={today}
                value={newDate}
                onChange={(e) => {
                  setNewDate(e.target.value);
                  setSelectedSlot('');
                }}
                className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm text-sm text-[#F5F2EA]"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs text-[#A5A29B]">Available Times</label>
              {availableSlots.length === 0 ? (
                <p className="text-xs text-[#A5A29B]">No slots open on this date.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {availableSlots.map((s) => (
                    <button
                      key={s.start_time}
                      type="button"
                      onClick={() => setSelectedSlot(s.start_time)}
                      className={`py-2 px-2 text-xs font-mono rounded-sm border cursor-pointer ${
                        selectedSlot === s.start_time
                          ? 'bg-[#E9B84B] text-[#0B0B0B] border-[#E9B84B] font-semibold'
                          : 'bg-[#0B0B0B] text-[#F5F2EA] border-[rgba(218,174,77,0.2)]'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              disabled={!selectedSlot}
              onClick={handleRescheduleSubmit}
              className="w-full py-2.5 px-4 text-xs font-semibold bg-[#E9B84B] text-[#0B0B0B] disabled:opacity-40 rounded-sm cursor-pointer"
            >
              Confirm New Time
            </button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
