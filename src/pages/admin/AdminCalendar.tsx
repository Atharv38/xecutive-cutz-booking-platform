import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { StatusLabel } from '../../components/StatusLabel';
import { apiFetch } from '../../lib/api';
import { formatCurrency, formatDateDisplay, formatTime12h } from '../../lib/formatters';
import type { AppointmentItem, BarberItem, BlockedDate, BlockedTimeSlot } from '../../types';

export function AdminCalendar() {
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [focusDate, setFocusDate] = useState(() =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date())
  );
  const [barberFilter, setBarberFilter] = useState('all');
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [barbers, setBarbers] = useState<BarberItem[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedTimeSlot[]>([]);
  const [selectedAppt, setSelectedAppt] = useState<AppointmentItem | null>(null);

  const loadData = useCallback(async () => {
    const [bRes, barbRes, blkRes] = await Promise.all([
      apiFetch(`/api/admin/bookings?barberId=${encodeURIComponent(barberFilter)}`).then((r) =>
        r.ok ? r.json() : { appointments: [] }
      ),
      apiFetch('/api/admin/barbers').then((r) => (r.ok ? r.json() : { barbers: [] })),
      apiFetch('/api/admin/blocked').then((r) => (r.ok ? r.json() : { blockedDates: [], blockedSlots: [] })),
    ]);
    setAppointments(bRes.appointments || []);
    setBarbers(barbRes.barbers || []);
    setBlockedDates(blkRes.blockedDates || []);
    setBlockedSlots(blkRes.blockedSlots || []);
  }, [barberFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const shiftFocus = (delta: number) => {
    const d = new Date(`${focusDate}T12:00:00Z`);
    if (view === 'day') d.setUTCDate(d.getUTCDate() + delta);
    if (view === 'week') d.setUTCDate(d.getUTCDate() + delta * 7);
    if (view === 'month') d.setUTCMonth(d.getUTCMonth() + delta);
    setFocusDate(d.toISOString().slice(0, 10));
  };

  const weekDates = useMemo(() => {
    const d = new Date(`${focusDate}T12:00:00Z`);
    const dow = d.getUTCDay();
    const start = new Date(d);
    start.setUTCDate(d.getUTCDate() - dow);
    return Array.from({ length: 7 }, (_, i) => {
      const c = new Date(start);
      c.setUTCDate(start.getUTCDate() + i);
      return c.toISOString().slice(0, 10);
    });
  }, [focusDate]);

  const monthCells = useMemo(() => {
    const y = Number(focusDate.slice(0, 4));
    const m = Number(focusDate.slice(5, 7));
    const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    const total = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= total; d++) {
      cells.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return cells;
  }, [focusDate]);

  const isBlockedDay = (dateStr: string) =>
    blockedDates.some(
      (b) =>
        (barberFilter === 'all' || !b.barber_id || b.barber_id === barberFilter) &&
        dateStr >= b.start_datetime.slice(0, 10) &&
        dateStr <= b.end_datetime.slice(0, 10)
    );

  const apptsForDate = (dateStr: string) =>
    appointments.filter((a) => a.appointment_date === dateStr && a.status !== 'cancelled');

  const handleQuickCancel = async (id: string) => {
    await apiFetch(`/api/admin/bookings/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    setSelectedAppt(null);
    loadData();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold">Schedule Calendar</h1>
          <p className="text-xs text-[#A5A29B] mt-1">
            Inspect appointments, barber availability, and blocked closures across Day, Week, and Month views.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={barberFilter}
            onChange={(e) => setBarberFilter(e.target.value)}
            className="px-3 py-2 bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm text-xs text-[#F5F2EA]"
          >
            <option value="all">All Barbers</option>
            {barbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.full_name}
              </option>
            ))}
          </select>

          <div className="flex items-center bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm p-1">
            {(['day', 'week', 'month'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium capitalize rounded-sm cursor-pointer ${
                  view === v ? 'bg-[#E9B84B] text-[#0B0B0B] font-semibold' : 'text-[#A5A29B]'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation Header */}
      <div className="flex items-center justify-between bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm px-4 py-3">
        <button
          type="button"
          onClick={() => shiftFocus(-1)}
          className="p-2 border border-[rgba(218,174,77,0.22)] rounded-sm hover:border-[#E9B84B] cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-sm font-semibold font-serif text-[#F5F2EA]">
          {view === 'day' && formatDateDisplay(focusDate)}
          {view === 'week' && `${formatDateDisplay(weekDates[0])} – ${formatDateDisplay(weekDates[6])}`}
          {view === 'month' &&
            new Date(`${focusDate}T12:00:00Z`).toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            })}
        </div>
        <button
          type="button"
          onClick={() => shiftFocus(1)}
          className="p-2 border border-[rgba(218,174,77,0.22)] rounded-sm hover:border-[#E9B84B] cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* DAY VIEW */}
      {view === 'day' && (
        <div className="bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm p-5 space-y-4">
          {isBlockedDay(focusDate) && (
            <div className="p-3 bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs rounded-sm">
              Blocked / Closed date active on schedule.
            </div>
          )}
          {blockedSlots
            .filter((s) => s.slot_date === focusDate)
            .map((s) => (
              <div key={s.id} className="p-3 bg-amber-950/30 border border-amber-500/30 text-amber-200 text-xs rounded-sm">
                Blocked Hours: {formatTime12h(s.start_time)} – {formatTime12h(s.end_time)} ({s.reason || 'Unavailable'})
              </div>
            ))}
          {apptsForDate(focusDate).length === 0 ? (
            <p className="text-sm text-[#A5A29B] py-6 text-center">No active appointments for this date.</p>
          ) : (
            <div className="space-y-3">
              {apptsForDate(focusDate).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedAppt(a)}
                  className="w-full text-left p-4 bg-[#1C1B18] border border-[rgba(218,174,77,0.22)] hover:border-[#E9B84B] rounded-sm flex items-center justify-between gap-4 cursor-pointer"
                >
                  <div>
                    <p className="font-mono text-xs text-[#E9B84B]">
                      {formatTime12h(a.start_time)} – {formatTime12h(a.end_time)} · {a.booking_reference}
                    </p>
                    <p className="font-medium text-sm text-[#F5F2EA]">
                      {a.customer_name} — {a.service_name_snapshot}
                    </p>
                    <p className="text-xs text-[#A5A29B]">{a.barber_name}</p>
                  </div>
                  <StatusLabel status={a.status} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* WEEK VIEW */}
      {view === 'week' && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {weekDates.map((d) => {
            const dayAppts = apptsForDate(d);
            const blocked = isBlockedDay(d);
            return (
              <div
                key={d}
                className={`bg-[#141414] border rounded-sm p-3 min-h-[220px] flex flex-col gap-2 ${
                  blocked ? 'border-rose-500/30' : 'border-[rgba(218,174,77,0.22)]'
                }`}
              >
                <div className="pb-2 border-b border-[rgba(218,174,77,0.14)] flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#F5F2EA] tabular-nums">
                    {new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', {
                      weekday: 'short',
                      day: 'numeric',
                      timeZone: 'UTC',
                    })}
                  </span>
                  {blocked && <span className="text-[10px] text-rose-400">Blocked</span>}
                </div>
                <div className="space-y-2 flex-1">
                  {dayAppts.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setSelectedAppt(a)}
                      className="w-full text-left p-2 bg-[#1C1B18] border border-[rgba(218,174,77,0.2)] hover:border-[#E9B84B] rounded-sm text-[11px] space-y-0.5 cursor-pointer"
                    >
                      <p className="font-mono text-[#E9B84B] tabular-nums">{formatTime12h(a.start_time)}</p>
                      <p className="font-medium text-[#F5F2EA] truncate">{a.customer_name}</p>
                      <p className="text-[#A5A29B] truncate">{a.service_name_snapshot}</p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MONTH VIEW */}
      {view === 'month' && (
        <div className="bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm p-4">
          <div className="grid grid-cols-7 gap-2 text-center text-xs text-[#A5A29B] mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1 font-medium">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {monthCells.map((d, idx) => {
              if (!d) return <div key={`e-${idx}`} />;
              const list = apptsForDate(d);
              const blocked = isBlockedDay(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setFocusDate(d);
                    setView('day');
                  }}
                  className={`min-h-[84px] p-2 rounded-sm border text-left flex flex-col justify-between cursor-pointer ${
                    blocked
                      ? 'bg-rose-950/20 border-rose-500/30'
                      : 'bg-[#1C1B18] border-[rgba(218,174,77,0.16)] hover:border-[#E9B84B]'
                  }`}
                >
                  <span className="font-mono text-xs text-[#F5F2EA] tabular-nums">{Number(d.slice(8, 10))}</span>
                  <div className="space-y-0.5">
                    {blocked && <p className="text-[10px] text-rose-300">Closed</p>}
                    {list.length > 0 && (
                      <p className="text-[11px] font-mono text-[#E9B84B]">{list.length} booked</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Appointment Quick Inspector */}
      {selectedAppt && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[rgba(218,174,77,0.3)] rounded-sm p-6 max-w-md w-full space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-serif text-xl font-semibold">{selectedAppt.booking_reference}</h3>
              <button type="button" onClick={() => setSelectedAppt(null)} className="text-[#A5A29B]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-xs space-y-2">
              <p><span className="text-[#A5A29B]">Client:</span> {selectedAppt.customer_name} ({selectedAppt.customer_phone})</p>
              <p><span className="text-[#A5A29B]">Service:</span> {selectedAppt.service_name_snapshot} ({formatCurrency(selectedAppt.price_at_booking)})</p>
              <p><span className="text-[#A5A29B]">Barber:</span> {selectedAppt.barber_name}</p>
              <p><span className="text-[#A5A29B]">Date:</span> {formatDateDisplay(selectedAppt.appointment_date)} · {formatTime12h(selectedAppt.start_time)}</p>
              <div className="pt-1"><StatusLabel status={selectedAppt.status} /></div>
            </div>
            {selectedAppt.status !== 'cancelled' && selectedAppt.status !== 'completed' && (
              <button
                type="button"
                onClick={() => handleQuickCancel(selectedAppt.id)}
                className="w-full py-2.5 text-xs font-semibold border border-rose-500/40 text-rose-300 hover:bg-rose-950/40 rounded-sm cursor-pointer"
              >
                Cancel This Appointment
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
