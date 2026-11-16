import { useCallback, useEffect, useState } from 'react';
import { Eye, Save, Search, X } from 'lucide-react';
import { CustomerProfileBadge } from '../../components/CustomerProfileBadge';
import { StatusLabel } from '../../components/StatusLabel';
import { SupabaseSyncBanner } from '../../components/SupabaseSyncBanner';
import { apiFetch } from '../../lib/api';
import { formatCurrency, formatDateDisplay, formatTime12h } from '../../lib/formatters';
import type { AppointmentItem, CustomerRecord, SupabaseAdminStatus } from '../../types';

export function AdminCustomers() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseAdminStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [profileFilter, setProfileFilter] = useState('all');

  const [selected, setSelected] = useState<{ customer: CustomerRecord; history: AppointmentItem[] } | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({
      search,
      status: statusFilter,
      profileType: profileFilter,
    });
    const res = await apiFetch(`/api/admin/customers?${qs.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setCustomers(data.customers || []);
      if (data.supabaseStatus) setSupabaseStatus(data.supabaseStatus);
    }
    setLoading(false);
  }, [search, statusFilter, profileFilter]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      await apiFetch('/api/admin/sync-supabase', { method: 'POST' });
      await loadCustomers();
    } finally {
      setSyncing(false);
    }
  };

  const openHistory = async (c: CustomerRecord) => {
    setNotesSaved(false);
    const res = await apiFetch(`/api/admin/customers/${c.id}/history`);
    if (res.ok) {
      const data = await res.json();
      const loadedCust = data.customer || c;
      setSelected({ customer: loadedCust, history: data.history || [] });
      setNotesDraft(loadedCust.notes || '');
    }
  };

  const updateStatus = async (id: string, status: CustomerRecord['status']) => {
    await apiFetch(`/api/admin/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (selected?.customer.id === id) {
      setSelected((prev) => (prev ? { ...prev, customer: { ...prev.customer, status } } : null));
    }
    loadCustomers();
  };

  const handleSaveNotes = async () => {
    if (!selected) return;
    setSavingNotes(true);
    setNotesSaved(false);
    try {
      const res = await apiFetch(`/api/admin/customers/${selected.customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesDraft }),
      });
      if (res.ok) {
        setNotesSaved(true);
        setSelected((prev) => (prev ? { ...prev, customer: { ...prev.customer, notes: notesDraft } } : null));
        loadCustomers();
      }
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold">Customer Directory & Profiles</h1>
          <p className="text-xs text-[#A5A29B] mt-1">
            Verify customer account types (Google, Registered, Guest, Walk-In), completed spend, tiers, and visit history.
          </p>
        </div>
      </div>

      <SupabaseSyncBanner status={supabaseStatus} syncing={syncing} onSyncNow={handleSyncNow} />

      {/* Search & Profile Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#141414] p-4 border border-[rgba(218,174,77,0.22)] rounded-sm">
        <div className="relative">
          <Search className="w-4 h-4 text-[#A5A29B] absolute left-3 top-2.5" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone..."
            className="w-full pl-9 pr-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm text-xs text-[#F5F2EA]"
          />
        </div>
        <select
          value={profileFilter}
          onChange={(e) => setProfileFilter(e.target.value)}
          className="px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm text-xs text-[#F5F2EA]"
        >
          <option value="all">All Profile Types</option>
          <option value="google">Google Profile</option>
          <option value="registered">Registered Account</option>
          <option value="guest">Guest Booking</option>
          <option value="walkin">Walk-In</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm text-xs text-[#F5F2EA]"
        >
          <option value="all">All Customer Tiers</option>
          <option value="active">Active</option>
          <option value="vip">VIP</option>
          <option value="blocked">Blocked</option>
        </select>
      </div>

      <div className="overflow-x-auto bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[rgba(218,174,77,0.18)] text-[#A5A29B]">
            <tr>
              <th className="py-3 px-4 font-medium">Customer</th>
              <th className="py-3 px-4 font-medium">Contact</th>
              <th className="py-3 px-4 font-medium">Profile & Verification</th>
              <th className="py-3 px-4 font-medium text-right">Bookings</th>
              <th className="py-3 px-4 font-medium text-right">Completed Spend</th>
              <th className="py-3 px-4 font-medium">Last Visit</th>
              <th className="py-3 px-4 font-medium">Tier</th>
              <th className="py-3 px-4 font-medium text-right">Verify / History</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(218,174,77,0.12)] tabular-nums">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[#A5A29B]">
                  Loading Supabase customer profiles...
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[#A5A29B]">
                  No customer profiles match your filters.
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id} className="hover:bg-[#1C1B18]/60">
                  <td className="py-3 px-4">
                    <p className="font-medium text-[#F5F2EA]">{c.full_name}</p>
                    <p className="text-[11px] text-[#A5A29B] capitalize">Role: {c.account_role || 'guest'}</p>
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-[#F5F2EA]">{c.email}</p>
                    <p className="text-[11px] text-[#A5A29B]">{c.phone || 'No phone on file'}</p>
                  </td>
                  <td className="py-3 px-4">
                    <CustomerProfileBadge
                      profileType={c.profile_type}
                      emailVerified={c.email_verified}
                      customerStatus={c.status}
                    />
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    <p className="text-[#E9B84B]">{c.total_appointments} total</p>
                    <p className="text-[11px] text-[#A5A29B]">{c.completed_appointments} completed</p>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[#E9B84B]">
                    {formatCurrency(c.total_spent_cents || 0)}
                  </td>
                  <td className="py-3 px-4 text-[#A5A29B]">
                    {c.last_appointment_date ? formatDateDisplay(c.last_appointment_date) : '—'}
                  </td>
                  <td className="py-3 px-4">
                    <select
                      value={c.status}
                      onChange={(e) => updateStatus(c.id, e.target.value as CustomerRecord['status'])}
                      className="px-2 py-1 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm text-[11px]"
                    >
                      <option value="active">Active</option>
                      <option value="vip">VIP</option>
                      <option value="blocked">Blocked</option>
                    </select>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => openHistory(c)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-[rgba(218,174,77,0.25)] rounded-sm text-[#E9B84B] hover:border-[#E9B84B] cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[rgba(218,174,77,0.3)] rounded-sm p-6 max-w-xl w-full space-y-5 max-h-[88vh] overflow-y-auto">
            <div className="flex justify-between items-start gap-4">
              <div className="space-y-1">
                <h3 className="font-serif text-xl font-semibold">{selected.customer.full_name}</h3>
                <p className="text-xs text-[#A5A29B]">
                  {selected.customer.email} · {selected.customer.phone || 'No phone recorded'}
                </p>
                <div className="pt-1">
                  <CustomerProfileBadge
                    profileType={selected.customer.profile_type}
                    emailVerified={selected.customer.email_verified}
                    customerStatus={selected.customer.status}
                  />
                </div>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="text-[#A5A29B] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-[#0B0B0B] border border-[rgba(218,174,77,0.18)] rounded-sm">
                <p className="text-[#A5A29B]">Account Role</p>
                <p className="font-medium text-[#F5F2EA] capitalize mt-0.5">{selected.customer.account_role}</p>
              </div>
              <div className="p-3 bg-[#0B0B0B] border border-[rgba(218,174,77,0.18)] rounded-sm">
                <p className="text-[#A5A29B]">Completed Visits</p>
                <p className="font-mono text-[#F5F2EA] mt-0.5">
                  {selected.customer.completed_appointments} / {selected.customer.total_appointments}
                </p>
              </div>
              <div className="p-3 bg-[#0B0B0B] border border-[rgba(218,174,77,0.18)] rounded-sm">
                <p className="text-[#A5A29B]">Completed Spend</p>
                <p className="font-mono text-[#E9B84B] mt-0.5">
                  {formatCurrency(selected.customer.total_spent_cents || 0)}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block text-[#A5A29B]">Owner Verification Notes</label>
              <textarea
                rows={2}
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Preferred fade style, chair preferences, or verification notes..."
                className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm text-[#F5F2EA]"
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-emerald-400">{notesSaved ? 'Notes saved to Supabase.' : ''}</span>
                <button
                  type="button"
                  disabled={savingNotes}
                  onClick={handleSaveNotes}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#E9B84B] text-[#0B0B0B] rounded-sm cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingNotes ? 'Saving...' : 'Save Notes'}</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-serif text-base font-semibold">Appointment History</h4>
              {selected.history.length === 0 ? (
                <p className="text-xs text-[#A5A29B] py-3">No appointment history recorded.</p>
              ) : (
                <div className="divide-y divide-[rgba(218,174,77,0.14)] text-xs">
                  {selected.history.map((h) => (
                    <div key={h.id} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-mono text-[#E9B84B]">{h.booking_reference}</p>
                        <p className="text-[#F5F2EA]">
                          {h.service_name_snapshot} with {h.barber_name}
                        </p>
                        <p className="text-[#A5A29B]">
                          {formatDateDisplay(h.appointment_date)} · {formatTime12h(h.start_time)} ·{' '}
                          {formatCurrency(h.price_at_booking)}
                        </p>
                      </div>
                      <StatusLabel status={h.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
