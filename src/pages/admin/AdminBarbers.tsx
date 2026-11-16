import { useCallback, useEffect, useState } from 'react';
import { Check, Plus, Upload, X } from 'lucide-react';
import { useShop } from '../../context/ShopContext';
import { apiFetch } from '../../lib/api';
import { DAY_SHORT } from '../../lib/formatters';
import { MEDIA, resolveMediaUrl } from '../../lib/media';
import type { BarberItem, BarberSchedule } from '../../types';

export function AdminBarbers() {
  const { refreshShop } = useShop();
  const [barbers, setBarbers] = useState<BarberItem[]>([]);
  const [editing, setEditing] = useState<(Partial<BarberItem> & { specialtiesText?: string }) | null>(null);
  const [uploading, setUploading] = useState(false);

  const loadBarbers = useCallback(async () => {
    const res = await apiFetch('/api/admin/barbers');
    if (res.ok) {
      const data = await res.json();
      setBarbers(data.barbers || []);
    }
  }, []);

  useEffect(() => {
    loadBarbers();
  }, [loadBarbers]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.append('image', file);
    const res = await apiFetch('/api/admin/upload', { method: 'POST', body: fd });
    const data = await res.json();
    setUploading(false);
    if (res.ok && editing) setEditing({ ...editing, image_url: data.url });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const specialties = (editing.specialtiesText || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      full_name: editing.full_name,
      title: editing.title,
      bio: editing.bio,
      image_url: editing.image_url || '/assets/local/barber_portrait_studio.jpg',
      specialties,
      is_active: Boolean(editing.is_active),
      is_placeholder: Boolean(editing.is_placeholder),
      schedules: editing.schedules,
    };

    const url = editing.id ? `/api/admin/barbers/${editing.id}` : '/api/admin/barbers';
    const method = editing.id ? 'PATCH' : 'POST';

    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setEditing(null);
      await loadBarbers();
      await refreshShop();
    }
  };

  const updateScheduleRow = (dow: number, patch: Partial<BarberSchedule>) => {
    if (!editing?.schedules) return;
    setEditing({
      ...editing,
      schedules: editing.schedules.map((s) => (s.day_of_week === dow ? { ...s, ...patch } : s)),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold">Barber Team & Schedules</h1>
          <p className="text-xs text-[#A5A29B] mt-1">
            Replace placeholder profiles with confirmed team names, specialties, photos, and individual working hours.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setEditing({
              full_name: '',
              title: 'Master Barber',
              bio: '',
              image_url: '/assets/local/barber_portrait_studio.jpg',
              specialtiesText: 'Skin Fades, Beard Sculpting',
              is_active: true,
              is_placeholder: false,
            })
          }
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-[#E9B84B] text-[#0B0B0B] rounded-sm cursor-pointer w-fit"
        >
          <Plus className="w-4 h-4" />
          <span>Add Barber</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {barbers.map((b) => (
          <div
            key={b.id}
            className="bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm overflow-hidden flex flex-col justify-between"
          >
            <div>
              <div className="aspect-[4/3] bg-[#0B0B0B] overflow-hidden">
                <img
                  src={resolveMediaUrl(b.image_url, MEDIA.barberPortraitStudio)}
                  alt={b.full_name}
                  className="w-full h-full object-cover object-top"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="p-5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#E9B84B]">{b.title}</span>
                  <span className={b.is_active ? 'text-emerald-400' : 'text-rose-400'}>
                    {b.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <h3 className="font-serif text-xl font-semibold">{b.full_name}</h3>
                <p className="text-xs text-[#A5A29B] line-clamp-2">{b.bio}</p>
                <p className="text-[11px] text-[#F5F2EA]/80">{b.specialties.join(' · ')}</p>
              </div>
            </div>
            <div className="px-5 pb-5">
              <button
                type="button"
                onClick={() =>
                  setEditing({
                    ...b,
                    specialtiesText: b.specialties.join(', '),
                  })
                }
                className="w-full py-2 text-xs font-semibold border border-[rgba(218,174,77,0.3)] text-[#F5F2EA] hover:border-[#E9B84B] rounded-sm cursor-pointer"
              >
                Edit Profile & Weekly Schedule
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="bg-[#141414] border border-[rgba(218,174,77,0.3)] rounded-sm p-6 max-w-2xl w-full space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-serif text-xl font-semibold">
                {editing.id ? `Edit ${editing.full_name}` : 'Add New Barber'}
              </h3>
              <button type="button" onClick={() => setEditing(null)} className="text-[#A5A29B]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[#A5A29B] mb-1">Full Name</label>
                <input
                  required
                  value={editing.full_name || ''}
                  onChange={(e) => setEditing({ ...editing, full_name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm"
                />
              </div>
              <div>
                <label className="block text-[#A5A29B] mb-1">Title / Role</label>
                <input
                  value={editing.title || ''}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[#A5A29B] mb-1">Bio</label>
                <textarea
                  rows={2}
                  value={editing.bio || ''}
                  onChange={(e) => setEditing({ ...editing, bio: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[#A5A29B] mb-1">Specialties (comma-separated)</label>
                <input
                  value={editing.specialtiesText || ''}
                  onChange={(e) => setEditing({ ...editing, specialtiesText: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm"
                />
              </div>
              <div className="sm:col-span-2 flex items-center gap-3">
                <label className="inline-flex items-center gap-2 px-3 py-2 bg-[#1C1B18] border border-[rgba(218,174,77,0.3)] rounded-sm cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-[#E9B84B]" />
                  <span>{uploading ? 'Uploading...' : 'Upload Portrait'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                  />
                </label>
                <label className="inline-flex items-center gap-2 ml-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editing.is_active)}
                    onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                  />
                  <span>Active for Booking</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editing.is_placeholder)}
                    onChange={(e) => setEditing({ ...editing, is_placeholder: e.target.checked })}
                  />
                  <span>Placeholder Profile</span>
                </label>
              </div>
            </div>

            {editing.schedules && editing.schedules.length > 0 && (
              <div className="pt-3 border-t border-[rgba(218,174,77,0.18)] space-y-2">
                <p className="text-xs font-semibold text-[#E9B84B]">Individual Working Schedule & Breaks</p>
                <div className="space-y-2 text-xs">
                  {editing.schedules.map((s) => (
                    <div
                      key={s.day_of_week}
                      className="grid grid-cols-12 gap-2 items-center bg-[#0B0B0B] p-2 rounded-sm border border-[rgba(218,174,77,0.14)]"
                    >
                      <label className="col-span-3 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(s.is_working)}
                          onChange={(e) => updateScheduleRow(s.day_of_week, { is_working: e.target.checked })}
                        />
                        <span>{DAY_SHORT[s.day_of_week]}</span>
                      </label>
                      <input
                        type="time"
                        disabled={!s.is_working}
                        value={s.start_time}
                        onChange={(e) => updateScheduleRow(s.day_of_week, { start_time: e.target.value })}
                        className="col-span-2 px-1.5 py-1 bg-[#141414] border border-[rgba(218,174,77,0.2)] rounded-sm disabled:opacity-40"
                      />
                      <input
                        type="time"
                        disabled={!s.is_working}
                        value={s.end_time}
                        onChange={(e) => updateScheduleRow(s.day_of_week, { end_time: e.target.value })}
                        className="col-span-2 px-1.5 py-1 bg-[#141414] border border-[rgba(218,174,77,0.2)] rounded-sm disabled:opacity-40"
                      />
                      <span className="col-span-1 text-[10px] text-[#A5A29B] text-center">Break</span>
                      <input
                        type="time"
                        disabled={!s.is_working}
                        value={s.break_start || ''}
                        onChange={(e) => updateScheduleRow(s.day_of_week, { break_start: e.target.value || null })}
                        className="col-span-2 px-1.5 py-1 bg-[#141414] border border-[rgba(218,174,77,0.2)] rounded-sm disabled:opacity-40"
                      />
                      <input
                        type="time"
                        disabled={!s.is_working}
                        value={s.break_end || ''}
                        onChange={(e) => updateScheduleRow(s.day_of_week, { break_end: e.target.value || null })}
                        className="col-span-2 px-1.5 py-1 bg-[#141414] border border-[rgba(218,174,77,0.2)] rounded-sm disabled:opacity-40"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 text-xs font-semibold bg-[#E9B84B] text-[#0B0B0B] rounded-sm cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Save Barber Profile</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
