import { useEffect, useState } from 'react';
import { Check, Copy, Info } from 'lucide-react';
import { useShop } from '../../context/ShopContext';
import { apiFetch } from '../../lib/api';
import type { BusinessSettings, NotificationLog } from '../../types';

export function AdminSettings() {
  const { refreshShop } = useShop();
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [integrations, setIntegrations] = useState<{
    firebaseAuthConfigured?: boolean;
    firebaseProjectId?: string | null;
    supabaseConfigured: boolean;
    supabaseProjectId?: string | null;
    supabaseSchemaReady?: boolean;
    supabaseAdminSyncReady?: boolean;
    supabaseNeedsAdminRpc?: boolean;
    supabaseStatusMessage?: string;
    resendConfigured: boolean;
  }>({
    firebaseAuthConfigured: true,
    firebaseProjectId: null,
    supabaseConfigured: true,
    supabaseProjectId: 'ulxrslukflzdswqjvczt',
    supabaseSchemaReady: false,
    supabaseAdminSyncReady: false,
    supabaseNeedsAdminRpc: false,
    resendConfigured: false,
  });
  const [saved, setSaved] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [loadError, setLoadError] = useState('');

  const loadSettings = () => {
    setLoadError('');
    apiFetch('/api/admin/settings')
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok || !d?.settings) {
          setLoadError(d?.error || 'Unable to load settings.');
          return;
        }
        setSettings(d.settings);
        setNotifications(d.notifications || []);
        setIntegrations(
          d.integrations || {
            firebaseAuthConfigured: true,
            firebaseProjectId: null,
            supabaseConfigured: true,
            supabaseProjectId: 'ulxrslukflzdswqjvczt',
            supabaseSchemaReady: false,
            resendConfigured: false,
          }
        );
      })
      .catch(() => setLoadError('Network error while loading settings.'));
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleCopySql = async (fileType: 'full' | 'upgrade' = 'full') => {
    try {
      const res = await apiFetch(`/api/admin/supabase-sql?file=${fileType}`);
      const data = await res.json();
      if (data.sql) {
        await navigator.clipboard.writeText(data.sql);
        setCopiedSql(true);
        setTimeout(() => setCopiedSql(false), 3000);
      }
    } catch {
      // ignore clipboard errors
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaved(false);
    const res = await apiFetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      setSaved(true);
      await refreshShop();
    }
  };

  if (loadError) {
    return (
      <div className="bg-[#141414] border border-rose-500/40 rounded-sm p-6 text-xs text-rose-200 space-y-3">
        <p>{loadError}</p>
        <button
          type="button"
          onClick={loadSettings}
          className="px-4 py-2 bg-[#E9B84B] text-[#0B0B0B] font-semibold rounded-sm cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!settings) {
    return <div className="h-64 bg-[#141414] rounded-sm animate-pulse" />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold">Business Settings & Integrations</h1>
        <p className="text-xs text-[#A5A29B] mt-1">
          Configure verified shop contact info, booking policies, Firebase Authentication, and Supabase booking sync.
        </p>
      </div>

      {/* Honest Integration Status Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#F5F2EA]">Firebase Auth & Firestore</span>
            <span className={integrations.firebaseAuthConfigured ? 'text-emerald-400' : 'text-[#E9B84B]'}>
              {integrations.firebaseAuthConfigured ? 'Connected' : 'Not Configured'}
            </span>
          </div>
          <p className="text-[#A5A29B] leading-relaxed">
            {integrations.firebaseAuthConfigured
              ? `Provisioned on Firebase project ${integrations.firebaseProjectId || 'configured'} with Google Sign-In (popup) and hardened Firestore rules.`
              : 'Run Firebase provisioning to enable Google Sign-In and Firestore profile storage.'}
          </p>
        </div>

        <div className="bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm p-5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-[#F5F2EA]">Supabase Backend Sync</span>
            <span
              className={
                integrations.supabaseAdminSyncReady
                  ? 'text-emerald-400'
                  : integrations.supabaseConfigured
                  ? 'text-[#E9B84B]'
                  : 'text-rose-400'
              }
            >
              {integrations.supabaseAdminSyncReady
                ? 'Live Sync Ready'
                : integrations.supabaseSchemaReady
                ? 'Admin RPC Pending'
                : integrations.supabaseConfigured
                ? 'Schema Pending'
                : 'Not Configured'}
            </span>
          </div>
          <p className="text-[#A5A29B] leading-relaxed">
            {integrations.supabaseStatusMessage ||
              `Project: ${integrations.supabaseProjectId || 'ulxrslukflzdswqjvczt'}`}
          </p>
          {integrations.supabaseConfigured && !integrations.supabaseAdminSyncReady && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleCopySql(integrations.supabaseSchemaReady ? 'upgrade' : 'full')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#E9B84B] text-[#0B0B0B] font-semibold rounded-sm cursor-pointer"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>
                  {copiedSql
                    ? 'SQL Copied!'
                    : integrations.supabaseSchemaReady
                    ? 'Copy Admin Sync SQL (002)'
                    : 'Copy Setup SQL (001)'}
                </span>
              </button>
              <button
                type="button"
                onClick={loadSettings}
                className="px-3 py-1.5 border border-[rgba(218,174,77,0.25)] text-[#F5F2EA] rounded-sm cursor-pointer"
              >
                Re-check Tables
              </button>
            </div>
          )}
        </div>

        <div className="bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#F5F2EA]">Transactional Emails (Resend)</span>
            <span className={integrations.resendConfigured ? 'text-emerald-400' : 'text-[#E9B84B]'}>
              {integrations.resendConfigured ? 'Live Email Active' : 'RESEND_API_KEY Not Configured'}
            </span>
          </div>
          <p className="text-[#A5A29B] leading-relaxed">
            {integrations.resendConfigured
              ? 'Resend API is active for customer confirmations and owner booking alerts.'
              : 'Add RESEND_API_KEY to environment variables to send real transactional emails. All events are logged below.'}
          </p>
        </div>
      </div>

      {saved && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs rounded-sm flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>Settings updated and published across the website.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm p-6 space-y-4 text-xs">
          <h2 className="font-serif text-xl font-semibold">Shop Identity & Contact</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[#A5A29B] mb-1">Business Name</label>
              <input
                value={settings.business_name}
                onChange={(e) => setSettings({ ...settings, business_name: e.target.value })}
                className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm"
              />
            </div>
            <div>
              <label className="block text-[#A5A29B] mb-1">Phone Number</label>
              <input
                value={settings.phone}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[#A5A29B] mb-1">Address</label>
              <input
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm"
              />
            </div>
            <div>
              <label className="block text-[#A5A29B] mb-1">Owner Notification Email</label>
              <input
                type="email"
                value={settings.email}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm"
              />
            </div>
            <div>
              <label className="block text-[#A5A29B] mb-1">Time Zone & Currency</label>
              <div className="flex gap-2">
                <input
                  value={settings.timezone}
                  onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                  className="flex-1 px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm"
                />
                <input
                  value={settings.currency}
                  onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                  className="w-24 px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm"
                />
              </div>
            </div>
          </div>

          <h3 className="font-serif text-lg font-semibold pt-4">Social Media Links (Shown Only When Filled)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <input
              placeholder="Instagram URL"
              value={settings.instagram_url}
              onChange={(e) => setSettings({ ...settings, instagram_url: e.target.value })}
              className="px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm"
            />
            <input
              placeholder="Facebook URL"
              value={settings.facebook_url}
              onChange={(e) => setSettings({ ...settings, facebook_url: e.target.value })}
              className="px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm"
            />
            <input
              placeholder="TikTok URL"
              value={settings.tiktok_url}
              onChange={(e) => setSettings({ ...settings, tiktok_url: e.target.value })}
              className="px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm"
            />
          </div>

          <h3 className="font-serif text-lg font-semibold pt-4">Booking Policies & Google Rating</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-[#A5A29B] mb-1">Cancel Cutoff (hrs)</label>
              <input
                type="number"
                min="0"
                value={settings.cancellation_window_hours}
                onChange={(e) => setSettings({ ...settings, cancellation_window_hours: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm"
              />
            </div>
            <div>
              <label className="block text-[#A5A29B] mb-1">Max Advance Days</label>
              <input
                type="number"
                min="1"
                value={settings.max_advance_days}
                onChange={(e) => setSettings({ ...settings, max_advance_days: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm"
              />
            </div>
            <div>
              <label className="block text-[#A5A29B] mb-1">Buffer Between Cuts (min)</label>
              <input
                type="number"
                min="0"
                step="5"
                value={settings.buffer_minutes}
                onChange={(e) => setSettings({ ...settings, buffer_minutes: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm"
              />
            </div>
            <div>
              <label className="block text-[#A5A29B] mb-1">Google Review Count</label>
              <input
                type="number"
                min="0"
                value={settings.google_review_count}
                onChange={(e) => setSettings({ ...settings, google_review_count: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-6 pt-2">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.allow_guest_booking}
                onChange={(e) => setSettings({ ...settings, allow_guest_booking: e.target.checked })}
              />
              <span>Allow Guest Booking</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.require_admin_confirmation}
                onChange={(e) => setSettings({ ...settings, require_admin_confirmation: e.target.checked })}
              />
              <span>Require Manual Admin Confirmation</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.email_notifications_enabled}
                onChange={(e) => setSettings({ ...settings, email_notifications_enabled: e.target.checked })}
              />
              <span>Enable Notification Dispatch</span>
            </label>
          </div>

          <button
            type="submit"
            className="px-6 py-2.5 text-xs font-semibold bg-[#E9B84B] text-[#0B0B0B] rounded-sm cursor-pointer"
          >
            Save Settings
          </button>
        </div>
      </form>

      {/* Notification Audit Log */}
      <div className="bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-[#E9B84B]" />
          <h2 className="font-serif text-lg font-semibold">Recent Notification Events</h2>
        </div>
        {notifications.length === 0 ? (
          <p className="text-xs text-[#A5A29B]">No booking notifications triggered yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[rgba(218,174,77,0.16)] text-[#A5A29B]">
                <tr>
                  <th className="py-2 px-3">Recipient</th>
                  <th className="py-2 px-3">Event</th>
                  <th className="py-2 px-3">Subject</th>
                  <th className="py-2 px-3">Delivery Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(218,174,77,0.1)]">
                {notifications.map((n) => (
                  <tr key={n.id}>
                    <td className="py-2.5 px-3 text-[#F5F2EA]">{n.recipient_email}</td>
                    <td className="py-2.5 px-3 font-mono text-[#E9B84B]">{n.event_type}</td>
                    <td className="py-2.5 px-3 text-[#A5A29B]">{n.subject}</td>
                    <td className="py-2.5 px-3">
                      <span className={n.delivery_status === 'sent' ? 'text-emerald-400' : 'text-[#E9B84B]'}>
                        {n.delivery_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
