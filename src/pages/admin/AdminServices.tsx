import { useCallback, useEffect, useState } from 'react';
import { Check, Plus, Trash2, Upload, X } from 'lucide-react';
import { useShop } from '../../context/ShopContext';
import { apiFetch } from '../../lib/api';
import { formatCurrency } from '../../lib/formatters';
import { MEDIA, resolveMediaUrl } from '../../lib/media';
import type { ServiceItem } from '../../types';

export function AdminServices() {
  const { refreshShop } = useShop();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<ServiceItem> & { priceDollars?: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const loadServices = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch('/api/admin/services');
    if (res.ok) {
      const data = await res.json();
      setServices(data.services || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('image', file);
    const res = await apiFetch('/api/admin/upload', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    setUploading(false);
    if (res.ok && editing) {
      setEditing({ ...editing, image_url: data.url });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setError('');

    const priceCents =
      editing.priceDollars !== undefined && editing.priceDollars !== ''
        ? Math.round(Number(editing.priceDollars) * 100)
        : null;

    const payload = {
      name: editing.name,
      description: editing.description || '',
      price_cents: priceCents,
      duration_minutes: Number(editing.duration_minutes || 45),
      image_url: editing.image_url || '/assets/local/service_haircut_fade.jpg',
      is_active: Boolean(editing.is_active),
      is_owner_approved: Boolean(editing.is_owner_approved),
    };

    const url = editing.id ? `/api/admin/services/${editing.id}` : '/api/admin/services';
    const method = editing.id ? 'PATCH' : 'POST';

    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Failed to save service.');
      return;
    }
    setEditing(null);
    await loadServices();
    await refreshShop();
  };

  const quickToggleActive = async (svc: ServiceItem) => {
    setError('');
    if (!svc.is_active && (svc.price_cents === null || svc.price_cents === undefined)) {
      setEditing({
        ...svc,
        priceDollars: '',
        is_active: true,
        is_owner_approved: true,
      });
      return;
    }
    const res = await apiFetch(`/api/admin/services/${svc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        price_cents: svc.price_cents,
        is_active: !svc.is_active,
        is_owner_approved: !svc.is_active ? true : svc.is_owner_approved,
      }),
    });
    if (res.ok) {
      await loadServices();
      await refreshShop();
    }
  };

  const handleDelete = async (id: string) => {
    setError('');
    const res = await apiFetch(`/api/admin/services/${id}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Cannot delete service.');
      return;
    }
    await loadServices();
    await refreshShop();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold">Service Management</h1>
          <p className="text-xs text-[#A5A29B] mt-1">
            Set official USD prices and durations, upload photography, and activate services for online booking.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setEditing({
              name: '',
              description: '',
              priceDollars: '',
              duration_minutes: 45,
              image_url: '/assets/local/service_haircut_fade.jpg',
              is_active: true,
              is_owner_approved: true,
            })
          }
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-[#E9B84B] text-[#0B0B0B] hover:bg-[#C99B3C] rounded-sm cursor-pointer w-fit"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Service</span>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs rounded-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-48 bg-[#141414] rounded-sm animate-pulse" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {services.map((s) => (
            <div
              key={s.id}
              className="bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm p-4 flex gap-4 justify-between"
            >
              <img
                src={resolveMediaUrl(s.image_url, MEDIA.serviceHaircutFade)}
                alt={s.name}
                className="w-20 h-20 object-cover rounded-sm shrink-0 bg-[#0B0B0B]"
                referrerPolicy="no-referrer"
              />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-serif text-lg font-semibold text-[#F5F2EA] truncate">{s.name}</h3>
                  <span className="font-mono text-xs text-[#E9B84B] tabular-nums shrink-0">
                    {formatCurrency(s.price_cents)}
                  </span>
                </div>
                <p className="text-xs text-[#A5A29B] line-clamp-2">{s.description}</p>
                <div className="text-[11px] text-[#A5A29B] tabular-nums">
                  {s.duration_minutes || 45} min
                  <span aria-hidden="true"> · </span>
                  <span className={s.is_active ? 'text-emerald-400' : 'text-[#E9B84B]'}>
                    {s.is_active ? 'Active & Bookable' : 'Draft / Inactive'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      setEditing({
                        ...s,
                        priceDollars:
                          s.price_cents !== null && s.price_cents !== undefined
                            ? (s.price_cents / 100).toFixed(2)
                            : '',
                      })
                    }
                    className="px-3 py-1.5 text-[11px] font-medium border border-[rgba(218,174,77,0.3)] text-[#F5F2EA] hover:border-[#E9B84B] rounded-sm cursor-pointer"
                  >
                    Edit Price & Details
                  </button>
                  <button
                    type="button"
                    onClick={() => quickToggleActive(s)}
                    className={`px-3 py-1.5 text-[11px] font-semibold rounded-sm cursor-pointer ${
                      s.is_active
                        ? 'border border-amber-500/40 text-amber-300'
                        : 'bg-[#E9B84B] text-[#0B0B0B]'
                    }`}
                  >
                    {s.is_active ? 'Deactivate' : 'Approve & Activate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(s.id)}
                    title="Delete Service"
                    className="p-1.5 border border-rose-500/30 text-rose-300 hover:bg-rose-950/40 rounded-sm cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* EDIT / CREATE MODAL */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="bg-[#141414] border border-[rgba(218,174,77,0.3)] rounded-sm p-6 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-serif text-xl font-semibold">
                {editing.id ? `Edit ${editing.name}` : 'Create Service'}
              </h3>
              <button type="button" onClick={() => setEditing(null)} className="text-[#A5A29B]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#A5A29B] mb-1">Service Name</label>
                <input
                  required
                  value={editing.name || ''}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm text-[#F5F2EA]"
                />
              </div>
              <div>
                <label className="block text-[#A5A29B] mb-1">Description</label>
                <textarea
                  rows={3}
                  value={editing.description || ''}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm text-[#F5F2EA]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#A5A29B] mb-1">Price (USD $)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 40.00"
                    value={editing.priceDollars ?? ''}
                    onChange={(e) => setEditing({ ...editing, priceDollars: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm text-[#F5F2EA]"
                  />
                </div>
                <div>
                  <label className="block text-[#A5A29B] mb-1">Duration (minutes)</label>
                  <input
                    type="number"
                    min="10"
                    max="240"
                    step="5"
                    required
                    value={editing.duration_minutes || 45}
                    onChange={(e) => setEditing({ ...editing, duration_minutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm text-[#F5F2EA]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#A5A29B] mb-1">Service Image</label>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 px-3 py-2 bg-[#1C1B18] border border-[rgba(218,174,77,0.3)] rounded-sm cursor-pointer hover:border-[#E9B84B]">
                    <Upload className="w-3.5 h-3.5 text-[#E9B84B]" />
                    <span>{uploading ? 'Uploading...' : 'Upload Image'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                    />
                  </label>
                  <span className="text-[11px] text-[#A5A29B] truncate flex-1">{editing.image_url}</span>
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editing.is_owner_approved)}
                    onChange={(e) => setEditing({ ...editing, is_owner_approved: e.target.checked })}
                  />
                  <span>Owner Approved</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editing.is_active)}
                    onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                  />
                  <span>Active on Website & Booking</span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 text-xs font-semibold bg-[#E9B84B] text-[#0B0B0B] rounded-sm cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Save Service</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
