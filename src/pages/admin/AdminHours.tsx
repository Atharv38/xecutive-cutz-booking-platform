import { useEffect, useState } from 'react';
import { AlertCircle, Check } from 'lucide-react';
import { useShop } from '../../context/ShopContext';
import { apiFetch } from '../../lib/api';
import { DAY_NAMES } from '../../lib/formatters';
import type { BusinessHour } from '../../types';

export function AdminHours() {
  const { refreshShop } = useShop();
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch('/api/admin/hours')
      .then((r) => (r.ok ? r.json() : { hours: [] }))
      .then((d) => setHours(d.hours || []));
  }, []);

  const updateDay = (dow: number, patch: Partial<BusinessHour>) => {
    setHours((prev) => prev.map((h) => (h.day_of_week === dow ? { ...h, ...patch } : h)));
  };

  const handleSave = async (confirmAll = false) => {
    setSaved(false);
    const payload = confirmAll ? hours.map((h) => ({ ...h, is_owner_confirmed: true })) : hours;
    const res = await apiFetch('/api/admin/hours', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hours: payload }),
    });
    if (res.ok) {
      setHours(payload);
      setSaved(true);
      await refreshShop();
    }
  };

  const allConfirmed = hours.length > 0 && hours.every((h) => h.is_owner_confirmed);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold">Weekly Business Hours</h1>
          <p className="text-xs text-[#A5A29B] mt-1">
            Configure shop-wide open days, opening/closing hours, and midday breaks.
          </p>
        </div>
        <div className="flex gap-2">
          {!allConfirmed && (
            <button
              type="button"
              onClick={() => handleSave(true)}
              className="px-4 py-2.5 text-xs font-semibold bg-[#E9B84B] text-[#0B0B0B] rounded-sm cursor-pointer"
            >
              Confirm & Publish Schedule
            </button>
          )}
          <button
            type="button"
            onClick={() => handleSave(false)}
            className="px-4 py-2.5 text-xs font-semibold border border-[#E9B84B] text-[#E9B84B] rounded-sm cursor-pointer"
          >
            Save Changes
          </button>
        </div>
      </div>

      {!allConfirmed && (
        <div className="p-4 bg-[#1C1B18] border border-[rgba(218,174,77,0.3)] rounded-sm flex items-start gap-3 text-xs">
          <AlertCircle className="w-4 h-4 text-[#E9B84B] shrink-0 mt-0.5" />
          <p className="text-[#A5A29B]">
            Tuesday–Saturday (8:00 AM – 7:00 PM) are initialized from publicly listed hours. Monday and Sunday require owner confirmation before activation.
          </p>
        </div>
      )}

      {saved && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs rounded-sm flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>Business hours saved and synchronized with the booking calendar.</span>
        </div>
      )}

      <div className="bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm divide-y divide-[rgba(218,174,77,0.14)]">
        {hours.map((h) => (
          <div key={h.day_of_week} className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center text-xs">
            <div className="lg:col-span-3 flex items-center justify-between lg:justify-start gap-3">
              <label className="inline-flex items-center gap-2.5 cursor-pointer font-medium text-sm text-[#F5F2EA]">
                <input
                  type="checkbox"
                  checked={h.is_open}
                  onChange={(e) => updateDay(h.day_of_week, { is_open: e.target.checked })}
                />
                <span>{DAY_NAMES[h.day_of_week]}</span>
              </label>
              <span className={h.is_open ? 'text-emerald-400' : 'text-[#A5A29B]'}>
                {h.is_open ? 'Open' : 'Closed'}
              </span>
            </div>

            <div className="lg:col-span-4 flex items-center gap-2">
              <span className="text-[#A5A29B]">Hours:</span>
              <input
                type="time"
                disabled={!h.is_open}
                value={h.open_time}
                onChange={(e) => updateDay(h.day_of_week, { open_time: e.target.value })}
                className="px-2.5 py-1.5 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm disabled:opacity-40"
              />
              <span>to</span>
              <input
                type="time"
                disabled={!h.is_open}
                value={h.close_time}
                onChange={(e) => updateDay(h.day_of_week, { close_time: e.target.value })}
                className="px-2.5 py-1.5 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm disabled:opacity-40"
              />
            </div>

            <div className="lg:col-span-5 flex items-center gap-2">
              <span className="text-[#A5A29B]">Break:</span>
              <input
                type="time"
                disabled={!h.is_open}
                value={h.break_start || ''}
                onChange={(e) => updateDay(h.day_of_week, { break_start: e.target.value || null })}
                className="px-2.5 py-1.5 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm disabled:opacity-40"
              />
              <span>to</span>
              <input
                type="time"
                disabled={!h.is_open}
                value={h.break_end || ''}
                onChange={(e) => updateDay(h.day_of_week, { break_end: e.target.value || null })}
                className="px-2.5 py-1.5 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm disabled:opacity-40"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
