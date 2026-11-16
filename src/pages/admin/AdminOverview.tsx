import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertCircle, ArrowRight, Check, CheckCircle2 } from 'lucide-react';
import { CustomerProfileBadge } from '../../components/CustomerProfileBadge';
import { StatusLabel } from '../../components/StatusLabel';
import { SupabaseSyncBanner } from '../../components/SupabaseSyncBanner';
import { apiFetch } from '../../lib/api';
import { formatCurrency, formatDateDisplay, formatTime12h } from '../../lib/formatters';
import type { AppointmentItem, AppointmentStatus, SupabaseAdminStatus } from '../../types';

interface OverviewResponse {
  stats: {
    totalBookings: number;
    todaysBookings: number;
    upcomingBookings: number;
    pendingBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    totalCustomers: number;
    completedRevenueCents: number;
    confirmedPipelineCents?: number;
  };
  weeklyChart: { date: string; label: string; bookings: number; revenue: number }[];
  monthlyChart: { month: string; bookings: number; revenue: number }[];
  popularServices: { name: string; count: number; total_cents: number; completed_cents?: number }[];
  recentAppointments: AppointmentItem[];
  upcomingList: AppointmentItem[];
  supabaseStatus?: SupabaseAdminStatus | null;
}

export function AdminOverview() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [chartMetric, setChartMetric] = useState<'revenue' | 'bookings'>('revenue');
  const [error, setError] = useState('');

  const loadOverview = useCallback(async () => {
    setError('');
    try {
      const r = await apiFetch('/api/admin/overview');
      const json = await r.json();
      if (!r.ok || !json?.stats) {
        setData(null);
        setError(json?.error || 'Unable to load dashboard metrics.');
        return;
      }
      setData({
        stats: json.stats,
        weeklyChart: Array.isArray(json.weeklyChart) ? json.weeklyChart : [],
        monthlyChart: Array.isArray(json.monthlyChart) ? json.monthlyChart : [],
        popularServices: Array.isArray(json.popularServices) ? json.popularServices : [],
        recentAppointments: Array.isArray(json.recentAppointments) ? json.recentAppointments : [],
        upcomingList: Array.isArray(json.upcomingList) ? json.upcomingList : [],
        supabaseStatus: json.supabaseStatus || null,
      });
    } catch {
      setData(null);
      setError('Network error while loading dashboard overview.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      await apiFetch('/api/admin/sync-supabase', { method: 'POST' });
      await loadOverview();
    } finally {
      setSyncing(false);
    }
  };

  const handleQuickStatus = async (id: string, status: AppointmentStatus) => {
    setActionId(id);
    try {
      const res = await apiFetch(`/api/admin/bookings/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        await loadOverview();
      }
    } finally {
      setActionId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-24 bg-[#141414] rounded-sm animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data?.stats) {
    return (
      <div className="bg-[#141414] border border-rose-500/40 rounded-sm p-6 space-y-4">
        <div className="flex items-start gap-3 text-rose-200 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Unable to Load Dashboard Overview</p>
            <p className="text-xs text-[#A5A29B]">{error || 'Missing dashboard metrics payload.'}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadOverview}
          className="px-4 py-2 text-xs font-semibold bg-[#E9B84B] text-[#0B0B0B] rounded-sm cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  const kpis = [
    { label: 'Total Bookings', value: data.stats.totalBookings },
    { label: "Today's Bookings", value: data.stats.todaysBookings },
    { label: 'Upcoming Appointments', value: data.stats.upcomingBookings },
    { label: 'Pending Approval', value: data.stats.pendingBookings },
    { label: 'Completed Visits', value: data.stats.completedBookings },
    { label: 'Cancelled', value: data.stats.cancelledBookings },
    { label: 'Verified & Guest Clients', value: data.stats.totalCustomers },
    {
      label: 'Completed Revenue',
      value: formatCurrency(data.stats.completedRevenueCents),
      sub:
        data.stats.confirmedPipelineCents && data.stats.confirmedPipelineCents > 0
          ? `${formatCurrency(data.stats.confirmedPipelineCents)} in active queue`
          : 'Calculated from completed cuts',
      gold: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold">Dashboard Overview</h1>
          <p className="text-xs text-[#A5A29B] mt-1">
            Live metrics, completed booking revenue, and client verification synced with Supabase.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/bookings"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-[#E9B84B] text-[#0B0B0B] hover:bg-[#C99B3C] rounded-sm"
          >
            <span>Manage Bookings</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            to="/admin/customers"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold border border-[#E9B84B] text-[#E9B84B] hover:bg-[#E9B84B] hover:text-[#0B0B0B] rounded-sm"
          >
            <span>Verify Customers</span>
          </Link>
        </div>
      </div>

      <SupabaseSyncBanner status={data.supabaseStatus} syncing={syncing} onSyncNow={handleSyncNow} />

      {/* 8 Live KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm p-5 space-y-1.5"
          >
            <p className="text-xs text-[#A5A29B]">{k.label}</p>
            <p
              className={`font-mono text-2xl font-semibold tabular-nums ${
                k.gold ? 'text-[#E9B84B]' : 'text-[#F5F2EA]'
              }`}
            >
              {k.value}
            </p>
            {k.sub && <p className="text-[11px] text-[#A5A29B]">{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* Charts with Revenue / Bookings Toggle */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold">Performance Analytics</h2>
          <div className="inline-flex border border-[rgba(218,174,77,0.25)] rounded-sm overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setChartMetric('revenue')}
              className={`px-3 py-1.5 cursor-pointer ${
                chartMetric === 'revenue'
                  ? 'bg-[#E9B84B] text-[#0B0B0B] font-semibold'
                  : 'bg-[#141414] text-[#A5A29B]'
              }`}
            >
              Completed Revenue ($)
            </button>
            <button
              type="button"
              onClick={() => setChartMetric('bookings')}
              className={`px-3 py-1.5 cursor-pointer ${
                chartMetric === 'bookings'
                  ? 'bg-[#E9B84B] text-[#0B0B0B] font-semibold'
                  : 'bg-[#141414] text-[#A5A29B]'
              }`}
            >
              Booking Volume
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-base font-semibold">
                {chartMetric === 'revenue' ? 'Weekly Completed Revenue (7 Days)' : 'Weekly Bookings (Last 7 Days)'}
              </h3>
              <span className="text-xs text-[#A5A29B]">
                {chartMetric === 'revenue' ? 'Completed Appointments ($)' : 'Non-cancelled Count'}
              </span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.weeklyChart}>
                  <CartesianGrid stroke="rgba(218,174,77,0.1)" vertical={false} />
                  <XAxis dataKey="label" stroke="#A5A29B" fontSize={11} />
                  <YAxis
                    allowDecimals={false}
                    stroke="#A5A29B"
                    fontSize={11}
                    tickFormatter={(v) => (chartMetric === 'revenue' ? `$${v}` : `${v}`)}
                  />
                  <Tooltip
                    formatter={(val) =>
                      chartMetric === 'revenue'
                        ? [`$${Number(val ?? 0)}`, 'Completed Revenue']
                        : [Number(val ?? 0), 'Bookings']
                    }
                    contentStyle={{
                      backgroundColor: '#1C1B18',
                      border: '1px solid rgba(218,174,77,0.3)',
                      color: '#F5F2EA',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey={chartMetric} fill="#E9B84B" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-base font-semibold">
                {chartMetric === 'revenue' ? 'Monthly Completed Revenue (6 Months)' : 'Monthly Bookings (6 Months)'}
              </h3>
              <span className="text-xs text-[#A5A29B]">
                {chartMetric === 'revenue' ? 'Completed Appointments ($)' : 'Non-cancelled Count'}
              </span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthlyChart}>
                  <CartesianGrid stroke="rgba(218,174,77,0.1)" vertical={false} />
                  <XAxis dataKey="month" stroke="#A5A29B" fontSize={11} />
                  <YAxis
                    allowDecimals={false}
                    stroke="#A5A29B"
                    fontSize={11}
                    tickFormatter={(v) => (chartMetric === 'revenue' ? `$${v}` : `${v}`)}
                  />
                  <Tooltip
                    formatter={(val) =>
                      chartMetric === 'revenue'
                        ? [`$${Number(val ?? 0)}`, 'Completed Revenue']
                        : [Number(val ?? 0), 'Bookings']
                    }
                    contentStyle={{
                      backgroundColor: '#1C1B18',
                      border: '1px solid rgba(218,174,77,0.3)',
                      color: '#F5F2EA',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey={chartMetric} fill="#C99B3C" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming, Recent & Popular Services */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold">Upcoming & Pending Queue</h2>
            <Link to="/admin/bookings" className="text-[11px] text-[#E9B84B] hover:underline">
              View All
            </Link>
          </div>
          {data.upcomingList.length === 0 ? (
            <p className="text-xs text-[#A5A29B]">No upcoming appointments in queue.</p>
          ) : (
            <ul className="divide-y divide-[rgba(218,174,77,0.12)] text-xs">
              {data.upcomingList.map((a) => (
                <li key={a.id} className="py-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-[#F5F2EA] truncate">
                        {a.customer_name}{' '}
                        <span className="font-mono text-[#E9B84B]">· {formatCurrency(a.price_at_booking)}</span>
                      </p>
                      <p className="text-[#A5A29B] truncate">
                        {a.service_name_snapshot} · {formatDateDisplay(a.appointment_date)}{' '}
                        {formatTime12h(a.start_time)}
                      </p>
                      <div className="mt-1">
                        <CustomerProfileBadge
                          profileType={a.profile_type}
                          emailVerified={a.email_verified}
                          customerStatus={a.customer_status}
                        />
                      </div>
                    </div>
                    <StatusLabel status={a.status} />
                  </div>
                  <div className="flex items-center gap-2">
                    {a.status === 'pending' && (
                      <button
                        type="button"
                        disabled={actionId === a.id}
                        onClick={() => handleQuickStatus(a.id, 'confirmed')}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-sm cursor-pointer disabled:opacity-50"
                      >
                        <Check className="w-3 h-3" />
                        <span>Approve</span>
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={actionId === a.id}
                      onClick={() => handleQuickStatus(a.id, 'completed')}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded-sm cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Complete (+{formatCurrency(a.price_at_booking)})</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold">Recent Activity</h2>
            <Link to="/admin/bookings" className="text-[11px] text-[#E9B84B] hover:underline">
              Open Table
            </Link>
          </div>
          {data.recentAppointments.length === 0 ? (
            <p className="text-xs text-[#A5A29B]">No booking records yet.</p>
          ) : (
            <ul className="divide-y divide-[rgba(218,174,77,0.12)] text-xs">
              {data.recentAppointments.map((a) => (
                <li key={a.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-mono text-[#E9B84B]">
                      {a.booking_reference} · {formatCurrency(a.price_at_booking)}
                    </p>
                    <p className="text-[#F5F2EA] truncate">
                      {a.customer_name} · {a.service_name_snapshot}
                    </p>
                    <CustomerProfileBadge
                      profileType={a.profile_type}
                      emailVerified={a.email_verified}
                      customerStatus={a.customer_status}
                    />
                  </div>
                  <StatusLabel status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm p-5 space-y-4">
          <h2 className="font-serif text-lg font-semibold">Popular Services</h2>
          {data.popularServices.length === 0 ? (
            <p className="text-xs text-[#A5A29B]">Service breakdown populates as appointments are booked.</p>
          ) : (
            <ul className="divide-y divide-[rgba(218,174,77,0.12)] text-xs tabular-nums">
              {data.popularServices.map((s) => (
                <li key={s.name} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[#F5F2EA] font-medium truncate">{s.name}</p>
                    <p className="text-[11px] text-[#A5A29B]">{s.count} bookings</p>
                  </div>
                  <div className="text-right font-mono shrink-0">
                    <p className="text-[#E9B84B]">{formatCurrency(s.completed_cents ?? 0)} earned</p>
                    <p className="text-[11px] text-[#A5A29B]">{formatCurrency(s.total_cents)} booked</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
