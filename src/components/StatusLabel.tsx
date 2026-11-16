import { AlertCircle, CheckCircle2, Clock, Slash, XCircle } from 'lucide-react';
import type { AppointmentStatus } from '../types';

const STATUS_CONFIG: Record<
  AppointmentStatus,
  { label: string; colorClass: string; Icon: typeof CheckCircle2 }
> = {
  pending: {
    label: 'Pending',
    colorClass: 'text-[#E9B84B]',
    Icon: Clock,
  },
  confirmed: {
    label: 'Confirmed',
    colorClass: 'text-emerald-400',
    Icon: CheckCircle2,
  },
  completed: {
    label: 'Completed',
    colorClass: 'text-sky-300',
    Icon: CheckCircle2,
  },
  cancelled: {
    label: 'Cancelled',
    colorClass: 'text-rose-400',
    Icon: XCircle,
  },
  no_show: {
    label: 'No-show',
    colorClass: 'text-amber-500',
    Icon: Slash,
  },
};

export function StatusLabel({ status }: { status: AppointmentStatus }) {
  const cfg = STATUS_CONFIG[status] || {
    label: status,
    colorClass: 'text-[#A5A29B]',
    Icon: AlertCircle,
  };
  const Icon = cfg.Icon;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${cfg.colorClass}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{cfg.label}</span>
    </span>
  );
}
