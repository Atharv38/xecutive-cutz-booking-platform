import { useState } from 'react';
import { Check, Copy, Database, RefreshCw } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { SupabaseAdminStatus } from '../types';

export function SupabaseSyncBanner({
  status,
  syncing,
  onSyncNow,
}: {
  status?: SupabaseAdminStatus | null;
  syncing: boolean;
  onSyncNow: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!status) return null;

  const needsSql = status.needsAdminRpc || !status.schemaReady;

  const handleCopySql = async () => {
    try {
      const sqlType = status.schemaReady ? 'upgrade' : 'full';
      const res = await apiFetch(`/api/admin/supabase-sql?file=${sqlType}`);
      const data = await res.json();
      if (data.sql) {
        await navigator.clipboard.writeText(data.sql);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div
      className={`p-3.5 rounded-sm border text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 ${
        status.adminSyncReady
          ? 'bg-[#141414] border-[rgba(218,174,77,0.22)] text-[#F5F2EA]'
          : 'bg-[#1C1B18] border-[#E9B84B]/50 text-[#F5F2EA]'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <Database
          className={`w-4 h-4 shrink-0 mt-0.5 ${
            status.adminSyncReady ? 'text-emerald-400' : 'text-[#E9B84B]'
          }`}
        />
        <div className="space-y-0.5">
          <p className="font-medium">
            {status.adminSyncReady
              ? `Supabase Connected (${status.projectId}) — Live Two-Way Admin Sync Active`
              : `Supabase Action Required (${status.projectId})`}
          </p>
          <p className="text-[11px] text-[#A5A29B] leading-relaxed">{status.statusMessage}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {needsSql && (
          <button
            type="button"
            onClick={handleCopySql}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#E9B84B] text-[#0B0B0B] hover:bg-[#C99B3C] font-semibold rounded-sm cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>
              {copied
                ? 'SQL Copied!'
                : status.schemaReady
                ? 'Copy Admin Sync SQL (002)'
                : 'Copy Initial SQL (001)'}
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={onSyncNow}
          disabled={syncing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[rgba(218,174,77,0.3)] text-[#E9B84B] hover:border-[#E9B84B] rounded-sm cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          <span>{syncing ? 'Syncing...' : 'Sync Supabase'}</span>
        </button>
      </div>
    </div>
  );
}
