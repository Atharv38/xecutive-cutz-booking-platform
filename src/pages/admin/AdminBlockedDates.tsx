import { useCallback, useEffect, useState } from 'react';
import { Ban, Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { formatDateDisplay, formatTime12h } from '../../lib/formatters';
import type { BarberItem, BlockedDate, BlockedTimeSlot } from '../../types';

export function AdminBlockedDates() {
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedTimeSlot[]>([]);
  const [barbers, setBarbers] = useState<BarberItem[]>([]);

  // Block Full Day / Range form
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dayBarberId, setDayBarberId] = useState('');
  const [dayType, setDayType] = useState('holiday');
  const [dayReason, setDayReason] = useState('');

  // Block Specific Hours form
  const [slotDate, setSlotDate] = useState('');
  const [slotStart, setSlotStart] = useState('12:00');
  const [slotEnd, setSlotEnd] = useState('14:00');
  const [slotBarberId, setSlotBarberId] = useState('');
  const [slotReason, setSlotReason] = useState('');

  const loadData = useCallback(async () => {
    const [blk, barb] = await Promise.all([
      apiFetch('/api/admin/blocked').then((r) => (r.ok ? r.json() : { blockedDates: [], blockedSlots: [] })),
      apiFetch('/api/admin/barbers').then((r) => (r.ok ? r.json() : { barbers: [] })),
    ]);
    setBlockedDates(blk.blockedDates || []);
    setBlockedSlots(blk.blockedSlots || []);
    setBarbers(barb.barbers || []);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddDayBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate) return;
    await apiFetch('/api/admin/blocked-dates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barber_id: dayBarberId || null,
        start_datetime: `${startDate}T00:00:00`,
        end_datetime: `${endDate || startDate}T23:59:59`,
        block_type: dayType,
        reason: dayReason,
      }),
    });
    setStartDate('');
    setEndDate('');
    setDayReason('');
    loadData();
  };

  const handleAddSlotBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slotDate) return;
    await apiFetch('/api/admin/blocked-slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barber_id: slotBarberId || null,
        slot_date: slotDate,
        start_time: slotStart,
        end_time: slotEnd,
        reason: slotReason,
      }),
    });
    setSlotDate('');
    setSlotReason('');
    loadData();
  };

  const removeDayBlock = async (id: string) => {
    await apiFetch(`/api/admin/blocked-dates/${id}`, { method: 'DELETE' });
    loadData();
  };

  const removeSlotBlock = async (id: string) => {
    await apiFetch(`/api/admin/blocked-slots/${id}`, { method: 'DELETE' });
    loadData();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold">Blocked Dates & Time Ranges</h1>
        <p className="text-xs text-[#A5A29B] mt-1">
          Closures, holidays, vacations, and blocked hour ranges automatically disable customer booking availability.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Block Full Day / Vacation */}
        <form
          onSubmit={handleAddDayBlock}
          className="bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm p-5 space-y-4 text-xs"
        >
          <div className="flex items-center gap-2">
            <Ban className="w-4 h-4 text-[#E9B84B]" />
            <h2 className="font-serif text-lg font-semibold">Block Full Day or Vacation</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#A5A29B] mb-1">Start Date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm"
              />
            </div>
            <div>
              <label className="block text-[#A5A29B] mb-1">End Date (Optional)</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm"
              />
            </div>
            <div>
              <label className="block text-[#A5A29B] mb-1">Scope</label>
              <select
                value={dayBarberId}
                onChange={(e) => setDayBarberId(e.target.value)}
                className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm"
              >
                <option value="">Entire Shop Closed</option>
                {barbers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.full_name} Only
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[#A5A29B] mb-1">Type</label>
              <select
                value={dayType}
                onChange={(e) => setDayType(e.target.value)}
                className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm"
              >
                <option value="holiday">Holiday</option>
                <option value="vacation">Vacation</option>
                <option value="emergency">Emergency Closure</option>
                <option value="custom">Custom Unavailable</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-[#A5A29B] mb-1">Reason</label>
              <input
                value={dayReason}
                onChange={(e) => setDayReason(e.target.value)}
                placeholder="e.g. Thanksgiving Holiday, Staff Training..."
                className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-2 px-4 py-2.5 font-semibold bg-[#E9B84B] text-[#0B0B0B] rounded-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Date Block</span>
          </button>
        </form>

        {/* Block Specific Hours */}
        <form
          onSubmit={handleAddSlotBlock}
          className="bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm p-5 space-y-4 text-xs"
        >
          <div className="flex items-center gap-2">
            <Ban className="w-4 h-4 text-[#E9B84B]" />
            <h2 className="font-serif text-lg font-semibold">Block Specific Hours</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#A5A29B] mb-1">Date</label>
              <input
                type="date"
                required
                value={slotDate}
                onChange={(e) => setSlotDate(e.target.value)}
                className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm"
              />
            </div>
            <div>
              <label className="block text-[#A5A29B] mb-1">Scope</label>
              <select
                value={slotBarberId}
                onChange={(e) => setSlotBarberId(e.target.value)}
                className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm"
              >
                <option value="">Entire Shop</option>
                {barbers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[#A5A29B] mb-1">Start Time</label>
              <input
                type="time"
                required
                value={slotStart}
                onChange={(e) => setSlotStart(e.target.value)}
                className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm"
              />
            </div>
            <div>
              <label className="block text-[#A5A29B] mb-1">End Time</label>
              <input
                type="time"
                required
                value={slotEnd}
                onChange={(e) => setSlotEnd(e.target.value)}
                className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[#A5A29B] mb-1">Reason</label>
              <input
                value={slotReason}
                onChange={(e) => setSlotReason(e.target.value)}
                placeholder="e.g. Private Event, Midday Errand..."
                className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-2 px-4 py-2.5 font-semibold bg-[#E9B84B] text-[#0B0B0B] rounded-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Block Time Range</span>
          </button>
        </form>
      </div>

      {/* Active Blocks List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm p-5 space-y-3">
          <h3 className="font-serif text-lg font-semibold">Active Blocked Dates</h3>
          {blockedDates.length === 0 ? (
            <p className="text-xs text-[#A5A29B]">No blocked dates configured.</p>
          ) : (
            <ul className="divide-y divide-[rgba(218,174,77,0.14)] text-xs">
              {blockedDates.map((b) => (
                <li key={b.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-[#F5F2EA]">
                      {formatDateDisplay(b.start_datetime.slice(0, 10))}
                      {b.end_datetime.slice(0, 10) !== b.start_datetime.slice(0, 10) &&
                        ` – ${formatDateDisplay(b.end_datetime.slice(0, 10))}`}
                    </p>
                    <p className="text-[#A5A29B]">
                      {b.barber_name || 'Shop-wide'} · {b.block_type} · {b.reason || 'Closed'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDayBlock(b.id)}
                    className="p-2 text-rose-300 border border-rose-500/30 rounded-sm cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm p-5 space-y-3">
          <h3 className="font-serif text-lg font-semibold">Active Blocked Hour Ranges</h3>
          {blockedSlots.length === 0 ? (
            <p className="text-xs text-[#A5A29B]">No blocked time ranges configured.</p>
          ) : (
            <ul className="divide-y divide-[rgba(218,174,77,0.14)] text-xs">
              {blockedSlots.map((s) => (
                <li key={s.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-[#F5F2EA] tabular-nums">
                      {formatDateDisplay(s.slot_date)} · {formatTime12h(s.start_time)} – {formatTime12h(s.end_time)}
                    </p>
                    <p className="text-[#A5A29B]">
                      {s.barber_name || 'Shop-wide'} · {s.reason || 'Unavailable'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSlotBlock(s.id)}
                    className="p-2 text-rose-300 border border-rose-500/30 rounded-sm cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
