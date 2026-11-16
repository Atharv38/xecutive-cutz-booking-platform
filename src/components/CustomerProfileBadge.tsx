import { BadgeCheck, Crown, ShieldAlert, UserCheck, UserRound } from 'lucide-react';
import type { CustomerProfileType } from '../types';

const PROFILE_META: Record<
  CustomerProfileType,
  { label: string; colorClass: string; Icon: typeof UserCheck }
> = {
  google: {
    label: 'Google Profile',
    colorClass: 'text-sky-300',
    Icon: UserCheck,
  },
  registered: {
    label: 'Registered',
    colorClass: 'text-[#E9B84B]',
    Icon: UserCheck,
  },
  guest: {
    label: 'Guest Booking',
    colorClass: 'text-[#A5A29B]',
    Icon: UserRound,
  },
  walkin: {
    label: 'Walk-In',
    colorClass: 'text-amber-300',
    Icon: UserRound,
  },
};

export function CustomerProfileBadge({
  profileType = 'guest',
  emailVerified,
  customerStatus,
}: {
  profileType?: CustomerProfileType;
  emailVerified?: boolean;
  customerStatus?: 'active' | 'vip' | 'blocked';
}) {
  const meta = PROFILE_META[profileType] || PROFILE_META.guest;
  const Icon = meta.Icon;

  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-[11px]">
      <span className={`inline-flex items-center gap-1 font-medium whitespace-nowrap ${meta.colorClass}`}>
        <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
        <span>{meta.label}</span>
      </span>
      {emailVerified && (
        <span
          title="Email Verified"
          className="inline-flex items-center gap-0.5 text-emerald-400 font-medium whitespace-nowrap"
        >
          <BadgeCheck className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span>Verified</span>
        </span>
      )}
      {customerStatus === 'vip' && (
        <span className="inline-flex items-center gap-0.5 text-[#E9B84B] font-semibold whitespace-nowrap">
          <Crown className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span>VIP</span>
        </span>
      )}
      {customerStatus === 'blocked' && (
        <span className="inline-flex items-center gap-0.5 text-rose-400 font-semibold whitespace-nowrap">
          <ShieldAlert className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span>Blocked</span>
        </span>
      )}
    </span>
  );
}
