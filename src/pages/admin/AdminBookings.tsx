import { useCallback, useEffect, useState } from 'react';
import { Check, CheckCircle2, Eye, Plus, Search, Trash2, X } from 'lucide-react';
import { CustomerProfileBadge } from '../../components/CustomerProfileBadge';
import { StatusLabel } from '../../components/StatusLabel';
import { SupabaseSyncBanner } from '../../components/SupabaseSyncBanner';
import { apiFetch } from '../../lib/api';
import { formatCurrency, formatDateDisplay, formatTime12h } from '../../lib/formatters';
import type {
  AppointmentItem,
  AppointmentStatus,
  AvailableSlot,
  BarberItem,
  ServiceItem,
  SupabaseAdminStatus,
} from '../../types';

export function AdminBookings() {
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseAdminStatus | null>(null);
  const [barbers, setBarbers] = useState<BarberItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [barberFilter, setBarberFilter] = useState('all');
  const [profileFilter, setProfileFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  // Modals
  const [detailTarget, setDetailTarget] = useState<AppointmentItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppointmentItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentItem | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Manual create form
  const [mName, setMName] = useState('');
  const [mEmail, setMEmail] = useState('');
  const [mPhone, setMPhone] = useState('');
  const [mServiceId, setMServiceId] = useState('');
  const [mBarberId, setMBarberId] = useState('');
  const [mDate, setMDate] = useState('');
  const [mTime, setMTime] = useState('');
  const [mNotes, setMNotes] = useState('');
  const [mSlots, setMSlots] = useState<AvailableSlot[]>([]);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({
      search,
      status: statusFilter,
      barberId: barberFilter,
      profileType: profileFilter,
      date: dateFilter,
    });
    const res = await apiFetch(`/api/admin/bookings?${qs.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setAppointments(data.appointments || []);
      if (data.supabaseStatus) setSupabaseStatus(data.supabaseStatus);
    }
    setLoading(false);
  }, [search, statusFilter, barberFilter, profileFilter, dateFilter]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  useEffect(() => {
    Promise.all([
      apiFetch('/api/admin/barbers').then((r) => (r.ok ? r.json() : { barbers: [] })),
      apiFetch('/api/admin/services').then((r) => (r.ok ? r.json() : { services: [] })),
    ]).then(([bData, sData]) => {
      setBarbers(bData.barbers || []);
      setServices(sData.services || []);
    });
  }, []);

  const handleSyncNow = async () => {
    setSyncing(true);
    setError('');
    try {
      const res = await apiFetch('/api/admin/sync-supabase', { method: 'POST' });
      const data = await res.json();
      if (data.status) setSupabaseStatus(data.status);
      if (data.ok) {
        setNotice(
          `Synced ${data.syncedAppointments ?? 0} bookings and ${data.syncedCustomers ?? 0} customers from Supabase.`
        );
      } else if (data.error) {
        setError(data.error);
      }
      await loadBookings();
    } finally {
      setSyncing(false);
    }
  };

  const updateStatus = async (id: string, status: AppointmentStatus) => {
    setError('');
    setNotice('');
    const res = await apiFetch(`/api/admin/bookings/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || 'Failed to update status.');
      return;
    }
    if (status === 'completed') {
      setNotice(
        `Booking ${d.appointment?.booking_reference || ''} marked Completed. Total dashboard revenue updated to ${formatCurrency(
          d.completedRevenueCents ?? 0
        )}.`
      );
    } else if (status === 'confirmed') {
      setNotice(`Booking ${d.appointment?.booking_reference || ''} approved & confirmed.`);
    }
    if (detailTarget?.id === id) {
      setDetailTarget((prev) => (prev ? { ...prev, status } : null));
    }
    await loadBookings();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    setNotice('');
    try {
      const res = await apiFetch(`/api/admin/bookings/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || 'Failed to delete booking.');
        return;
      }
      setNotice(
        `Deleted booking ${d.bookingReference} (${
          d.supabaseDeleted ? 'removed from Supabase & local database' : 'removed locally'
        }).`
      );
      if (detailTarget?.id === deleteTarget.id) setDetailTarget(null);
      setDeleteTarget(null);
      await loadBookings();
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (!rescheduleTarget || !newDate) return;
    fetch(
      `/api/availability?serviceId=${encodeURIComponent(rescheduleTarget.service_id)}&barberId=${encodeURIComponent(
        rescheduleTarget.barber_id
      )}&date=${encodeURIComponent(newDate)}`
    )
      .then((r) => r.json())
      .then((d) => setSlots(d.slots || []));
  }, [rescheduleTarget, newDate]);

  useEffect(() => {
    if (!mServiceId || !mBarberId || !mDate) return;
    fetch(
      `/api/availability?serviceId=${encodeURIComponent(mServiceId)}&barberId=${encodeURIComponent(
        mBarberId
      )}&date=${encodeURIComponent(mDate)}`
    )
      .then((r) => r.json())
      .then((d) => setMSlots(d.slots || []));
  }, [mServiceId, mBarberId, mDate]);

  const handleManualCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = await apiFetch('/api/admin/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: mName,
        customer_email: mEmail,
        customer_phone: mPhone,
        service_id: mServiceId,
        barber_id: mBarberId,
        appointment_date: mDate,
        start_time: mTime,
        customer_notes: mNotes,
      }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || 'Unable to create booking.');
      return;
    }
    setCreateOpen(false);
    setMName('');
    setMEmail('');
    setMPhone('');
    setMNotes('');
    loadBookings();
  };

  const handleReschedule = async () => {
    if (!rescheduleTarget || !newDate || !newTime) return;
    setError('');
    const res = await apiFetch(`/api/admin/bookings/${rescheduleTarget.id}/reschedule`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appointment_date: newDate,
        start_time: newTime,
        barber_id: rescheduleTarget.barber_id,
      }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || 'Reschedule failed.');
      return;
    }
    setRescheduleTarget(null);
    loadBookings();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold">Booking Management</h1>
          <p className="text-xs text-[#A5A29B] mt-1">
            Verify Supabase bookings & client profiles, approve pending requests, complete visits for revenue, or delete bookings.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-[#E9B84B] text-[#0B0B0B] hover:bg-[#C99B3C] rounded-sm cursor-pointer w-fit"
        >
          <Plus className="w-4 h-4" />
          <span>New Manual Booking</span>
        </button>
      </div>

      <SupabaseSyncBanner status={supabaseStatus} syncing={syncing} onSyncNow={handleSyncNow} />

      {notice && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs rounded-sm flex items-center justify-between gap-3">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} className="text-emerald-300 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs rounded-sm">
          {error}
        </div>
      )}

      {/* Search & Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-[#141414] p-4 border border-[rgba(218,174,77,0.22)] rounded-sm">
        <div className="relative">
          <Search className="w-4 h-4 text-[#A5A29B] absolute left-3 top-2.5" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ID, client, email, phone..."
            className="w-full pl-9 pr-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm text-xs text-[#F5F2EA]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm text-xs text-[#F5F2EA]"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending Approval</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No-show</option>
        </select>
        <select
          value={profileFilter}
          onChange={(e) => setProfileFilter(e.target.value)}
          className="px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm text-xs text-[#F5F2EA]"
        >
          <option value="all">All Client Profiles</option>
          <option value="google">Google Profile</option>
          <option value="registered">Registered Account</option>
          <option value="guest">Guest Booking</option>
          <option value="walkin">Walk-In</option>
        </select>
        <select
          value={barberFilter}
          onChange={(e) => setBarberFilter(e.target.value)}
          className="px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm text-xs text-[#F5F2EA]"
        >
          <option value="all">All Barbers</option>
          {barbers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.full_name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="flex-1 px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm text-xs text-[#F5F2EA]"
          />
          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter('')}
              className="px-2.5 text-xs border border-[rgba(218,174,77,0.22)] rounded-sm text-[#A5A29B]"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Bookings Table */}
      <div className="overflow-x-auto bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[rgba(218,174,77,0.18)] text-[#A5A29B]">
            <tr>
              <th className="py-3 px-4 font-medium">Booking ID</th>
              <th className="py-3 px-4 font-medium">Customer & Profile</th>
              <th className="py-3 px-4 font-medium">Contact</th>
              <th className="py-3 px-4 font-medium">Service</th>
              <th className="py-3 px-4 font-medium">Barber</th>
              <th className="py-3 px-4 font-medium">Date & Time</th>
              <th className="py-3 px-4 font-medium text-right">Price</th>
              <th className="py-3 px-4 font-medium">Status</th>
              <th className="py-3 px-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(218,174,77,0.12)] tabular-nums">
            {loading ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-[#A5A29B]">
                  Syncing & loading bookings...
                </td>
              </tr>
            ) : appointments.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-[#A5A29B]">
                  No bookings match your current filters.
                </td>
              </tr>
            ) : (
              appointments.map((a) => (
                <tr key={a.id} className="hover:bg-[#1C1B18]/60">
                  <td className="py-3 px-4 font-mono text-[#E9B84B] whitespace-nowrap">{a.booking_reference}</td>
                  <td className="py-3 px-4 space-y-1">
                    <p className="font-medium text-[#F5F2EA]">{a.customer_name}</p>
                    <CustomerProfileBadge
                      profileType={a.profile_type}
                      emailVerified={a.email_verified}
                      customerStatus={a.customer_status}
                    />
                  </td>
                  <td className="py-3 px-4 text-[#A5A29B]">
                    <p className="text-[#F5F2EA]">{a.customer_phone}</p>
                    <p className="text-[11px] truncate max-w-[160px]">{a.customer_email}</p>
                  </td>
                  <td className="py-3 px-4 text-[#F5F2EA]">{a.service_name_snapshot}</td>
                  <td className="py-3 px-4 text-[#A5A29B]">{a.barber_name}</td>
                  <td className="py-3 px-4 text-[#F5F2EA] whitespace-nowrap">
                    <p>{formatDateDisplay(a.appointment_date)}</p>
                    <p className="text-[11px] text-[#A5A29B]">{formatTime12h(a.start_time)}</p>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[#F5F2EA]">
                    {formatCurrency(a.price_at_booking)}
                  </td>
                  <td className="py-3 px-4">
                    <StatusLabel status={a.status} />
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDetailTarget(a)}
                        title="Verify Booking & Customer Profile"
                        className="p-1.5 border border-[rgba(218,174,77,0.22)] rounded-sm text-[#A5A29B] hover:text-[#F5F2EA] cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {a.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => updateStatus(a.id, 'confirmed')}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-sm cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          <span>Approve</span>
                        </button>
                      )}
                      {(a.status === 'pending' || a.status === 'confirmed') && (
                        <>
                          <button
                            type="button"
                            onClick={() => updateStatus(a.id, 'completed')}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded-sm cursor-pointer"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Complete</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRescheduleTarget(a);
                              setNewDate(a.appointment_date);
                              setNewTime('');
                            }}
                            className="px-2 py-1 text-[11px] font-medium border border-[rgba(218,174,77,0.3)] text-[#E9B84B] rounded-sm cursor-pointer"
                          >
                            Reschedule
                          </button>
                          <button
                            type="button"
                            onClick={() => updateStatus(a.id, 'no_show')}
                            className="px-2 py-1 text-[11px] font-medium border border-amber-500/30 text-amber-300 rounded-sm cursor-pointer"
                          >
                            No-show
                          </button>
                          <button
                            type="button"
                            onClick={() => updateStatus(a.id, 'cancelled')}
                            className="px-2 py-1 text-[11px] font-medium border border-rose-500/30 text-rose-300 rounded-sm cursor-pointer"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(a)}
                        title="Delete Booking"
                        className="p-1.5 border border-rose-500/30 text-rose-300 hover:bg-rose-950/50 rounded-sm cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* DETAIL / VERIFICATION MODAL */}
      {detailTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[rgba(218,174,77,0.3)] rounded-sm p-6 max-w-md w-full space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-serif text-xl font-semibold">Booking {detailTarget.booking_reference}</h3>
                <div className="mt-1">
                  <StatusLabel status={detailTarget.status} />
                </div>
              </div>
              <button type="button" onClick={() => setDetailTarget(null)} className="text-[#A5A29B] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-[#0B0B0B] border border-[rgba(218,174,77,0.2)] rounded-sm space-y-1.5 text-xs">
              <p className="text-[#A5A29B] uppercase tracking-wider text-[10px]">Customer Verification</p>
              <p className="text-[#F5F2EA] font-medium">{detailTarget.customer_name}</p>
              <CustomerProfileBadge
                profileType={detailTarget.profile_type}
                emailVerified={detailTarget.email_verified}
                customerStatus={detailTarget.customer_status}
              />
              <p className="text-[#A5A29B]">
                Email: <span className="text-[#F5F2EA]">{detailTarget.customer_email}</span>
              </p>
              <p className="text-[#A5A29B]">
                Phone: <span className="text-[#F5F2EA]">{detailTarget.customer_phone}</span>
              </p>
              <p className="text-[#A5A29B]">
                Role: <span className="text-[#F5F2EA] capitalize">{detailTarget.account_role || 'guest'}</span>
              </p>
            </div>

            <div className="space-y-1.5 text-xs">
              <p>
                <span className="text-[#A5A29B]">Service:</span> {detailTarget.service_name_snapshot} (
                {detailTarget.duration_minutes_snapshot} min)
              </p>
              <p>
                <span className="text-[#A5A29B]">Barber:</span> {detailTarget.barber_name}
              </p>
              <p>
                <span className="text-[#A5A29B]">Schedule:</span> {formatDateDisplay(detailTarget.appointment_date)} ·{' '}
                {formatTime12h(detailTarget.start_time)} – {formatTime12h(detailTarget.end_time)}
              </p>
              <p>
                <span className="text-[#A5A29B]">Price:</span>{' '}
                <span className="font-mono text-[#E9B84B]">{formatCurrency(detailTarget.price_at_booking)}</span>
              </p>
              <p>
                <span className="text-[#A5A29B]">Notes:</span> {detailTarget.customer_notes || 'None'}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[rgba(218,174,77,0.16)]">
              <div className="flex flex-wrap gap-2">
                {detailTarget.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => updateStatus(detailTarget.id, 'confirmed')}
                    className="px-3 py-1.5 text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-sm cursor-pointer"
                  >
                    Approve Booking
                  </button>
                )}
                {(detailTarget.status === 'pending' || detailTarget.status === 'confirmed') && (
                  <button
                    type="button"
                    onClick={() => updateStatus(detailTarget.id, 'completed')}
                    className="px-3 py-1.5 text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/40 rounded-sm cursor-pointer"
                  >
                    Mark Completed
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(detailTarget)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-rose-500/40 text-rose-300 hover:bg-rose-950/50 rounded-sm cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-rose-500/40 rounded-sm p-6 max-w-sm w-full space-y-4">
            <h3 className="font-serif text-xl font-semibold text-[#F5F2EA]">Delete Booking?</h3>
            <p className="text-xs text-[#A5A29B] leading-relaxed">
              This will permanently remove booking{' '}
              <span className="font-mono text-[#E9B84B]">{deleteTarget.booking_reference}</span> for{' '}
              <span className="text-[#F5F2EA] font-medium">{deleteTarget.customer_name}</span> from Supabase and your local
              dashboard.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs border border-[rgba(218,174,77,0.25)] text-[#A5A29B] rounded-sm cursor-pointer"
              >
                Keep Booking
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 rounded-sm cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESCHEDULE MODAL */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[rgba(218,174,77,0.3)] rounded-sm p-6 max-w-md w-full space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-serif text-xl font-semibold">Reschedule {rescheduleTarget.booking_reference}</h3>
              <button type="button" onClick={() => setRescheduleTarget(null)} className="text-[#A5A29B]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="date"
              value={newDate}
              onChange={(e) => {
                setNewDate(e.target.value);
                setNewTime('');
              }}
              className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm text-xs"
            />
            <div className="grid grid-cols-3 gap-2 max-h-44 overflow-y-auto">
              {slots.map((s) => (
                <button
                  key={s.start_time}
                  type="button"
                  onClick={() => setNewTime(s.start_time)}
                  className={`py-2 text-xs font-mono rounded-sm border ${
                    newTime === s.start_time
                      ? 'bg-[#E9B84B] text-[#0B0B0B] border-[#E9B84B]'
                      : 'bg-[#0B0B0B] border-[rgba(218,174,77,0.2)]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={!newTime}
              onClick={handleReschedule}
              className="w-full py-2.5 text-xs font-semibold bg-[#E9B84B] text-[#0B0B0B] disabled:opacity-40 rounded-sm"
            >
              Save Reschedule
            </button>
          </div>
        </div>
      )}

      {/* MANUAL CREATE MODAL */}
      {createOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form
            onSubmit={handleManualCreate}
            className="bg-[#141414] border border-[rgba(218,174,77,0.3)] rounded-sm p-6 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-serif text-xl font-semibold">Create Manual Booking</h3>
              <button type="button" onClick={() => setCreateOpen(false)} className="text-[#A5A29B]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <input
                required
                placeholder="Customer Name"
                value={mName}
                onChange={(e) => setMName(e.target.value)}
                className="px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm"
              />
              <input
                required
                placeholder="Phone Number"
                value={mPhone}
                onChange={(e) => setMPhone(e.target.value)}
                className="px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm"
              />
              <input
                placeholder="Email (optional)"
                type="email"
                value={mEmail}
                onChange={(e) => setMEmail(e.target.value)}
                className="sm:col-span-2 px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm"
              />
              <select
                required
                value={mServiceId}
                onChange={(e) => setMServiceId(e.target.value)}
                className="px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm"
              >
                <option value="">Select Active Service...</option>
                {services
                  .filter((s) => s.is_active)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({formatCurrency(s.price_cents)})
                    </option>
                  ))}
              </select>
              <select
                required
                value={mBarberId}
                onChange={(e) => setMBarberId(e.target.value)}
                className="px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm"
              >
                <option value="">Select Barber...</option>
                {barbers
                  .filter((b) => b.is_active)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.full_name}
                    </option>
                  ))}
              </select>
              <input
                type="date"
                required
                value={mDate}
                onChange={(e) => {
                  setMDate(e.target.value);
                  setMTime('');
                }}
                className="px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm"
              />
              <select
                required
                value={mTime}
                onChange={(e) => setMTime(e.target.value)}
                className="px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm"
              >
                <option value="">Select Open Time...</option>
                {mSlots.map((s) => (
                  <option key={s.start_time} value={s.start_time}>
                    {s.label}
                  </option>
                ))}
              </select>
              <textarea
                placeholder="Notes"
                value={mNotes}
                onChange={(e) => setMNotes(e.target.value)}
                className="sm:col-span-2 px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 text-xs font-semibold bg-[#E9B84B] text-[#0B0B0B] rounded-sm cursor-pointer"
            >
              Create Confirmed Booking
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
