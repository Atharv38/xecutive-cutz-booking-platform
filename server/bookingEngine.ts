import crypto from 'crypto';
import { db } from './db';
import type { AppointmentItem, AvailableSlot, BusinessSettings } from '../src/types';

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatTimeLabel(hhmm: string): string {
  const [hRaw, m] = hhmm.split(':').map(Number);
  const period = hRaw >= 12 ? 'PM' : 'AM';
  const h12 = hRaw % 12 === 0 ? 12 : hRaw % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export function getChicagoNow(): { date: string; minutes: number } {
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const timeParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const hour = Number(timeParts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(timeParts.find((p) => p.type === 'minute')?.value ?? '0');
  return { date: dateStr, minutes: (hour === 24 ? 0 : hour) * 60 + minute };
}

export function getDayOfWeek(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function isDateShopBlocked(dateStr: string): { blocked: boolean; reason?: string } {
  const blocks = db
    .prepare(
      `SELECT start_datetime, end_datetime, reason FROM blocked_dates
       WHERE barber_id IS NULL`
    )
    .all() as { start_datetime: string; end_datetime: string; reason: string }[];

  for (const b of blocks) {
    const startDate = b.start_datetime.slice(0, 10);
    const endDate = b.end_datetime.slice(0, 10);
    if (dateStr >= startDate && dateStr <= endDate) {
      return { blocked: true, reason: b.reason || 'Shop closed' };
    }
  }
  return { blocked: false };
}

export function isDateBarberBlocked(barberId: string, dateStr: string): boolean {
  const blocks = db
    .prepare(
      `SELECT start_datetime, end_datetime FROM blocked_dates
       WHERE barber_id = ?`
    )
    .all(barberId) as { start_datetime: string; end_datetime: string }[];

  for (const b of blocks) {
    const startDate = b.start_datetime.slice(0, 10);
    const endDate = b.end_datetime.slice(0, 10);
    if (dateStr >= startDate && dateStr <= endDate) {
      return true;
    }
  }
  return false;
}

export function computeAvailableSlots(params: {
  serviceId: string;
  barberId: string; // specific barber UUID or 'any'
  date: string; // YYYY-MM-DD
  excludeAppointmentId?: string;
}): {
  slots: AvailableSlot[];
  unavailableReason?: string;
} {
  const { serviceId, barberId, date, excludeAppointmentId } = params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { slots: [], unavailableReason: 'Invalid date format.' };
  }

  const settings = db.prepare('SELECT * FROM business_settings WHERE id = 1').get() as BusinessSettings;
  const chicagoNow = getChicagoNow();

  if (date < chicagoNow.date) {
    return { slots: [], unavailableReason: 'Past dates cannot be booked.' };
  }

  const maxDate = new Date(`${chicagoNow.date}T12:00:00Z`);
  maxDate.setUTCDate(maxDate.getUTCDate() + (settings.max_advance_days || 60));
  const maxDateStr = maxDate.toISOString().slice(0, 10);
  if (date > maxDateStr) {
    return { slots: [], unavailableReason: `Bookings are open up to ${settings.max_advance_days} days in advance.` };
  }

  const service = db
    .prepare('SELECT id, name, duration_minutes, is_active FROM services WHERE id = ?')
    .get(serviceId) as { id: string; name: string; duration_minutes: number | null; is_active: number } | undefined;

  if (!service || !service.is_active) {
    return { slots: [], unavailableReason: 'Selected service is not currently active.' };
  }

  const duration = service.duration_minutes || 45;
  const buffer = settings.buffer_minutes || 0;

  const dow = getDayOfWeek(date);
  const bizHour = db.prepare('SELECT * FROM business_hours WHERE day_of_week = ?').get(dow) as
    | {
        is_open: number;
        open_time: string;
        close_time: string;
        break_start: string | null;
        break_end: string | null;
      }
    | undefined;

  if (!bizHour || !bizHour.is_open) {
    return { slots: [], unavailableReason: 'Xecutive Cutz is closed on this day.' };
  }

  const shopBlocked = isDateShopBlocked(date);
  if (shopBlocked.blocked) {
    return { slots: [], unavailableReason: shopBlocked.reason || 'This date is unavailable.' };
  }

  const shopOpenMin = timeToMinutes(bizHour.open_time);
  const shopCloseMin = timeToMinutes(bizHour.close_time);
  const shopBreakStart = bizHour.break_start ? timeToMinutes(bizHour.break_start) : null;
  const shopBreakEnd = bizHour.break_end ? timeToMinutes(bizHour.break_end) : null;

  const candidateBarbers =
    barberId === 'any'
      ? (db.prepare('SELECT id, full_name FROM barbers WHERE is_active = 1 ORDER BY created_at ASC').all() as {
          id: string;
          full_name: string;
        }[])
      : (db.prepare('SELECT id, full_name FROM barbers WHERE id = ? AND is_active = 1').all(barberId) as {
          id: string;
          full_name: string;
        }[]);

  if (candidateBarbers.length === 0) {
    return { slots: [], unavailableReason: 'No active barbers available.' };
  }

  const shopBlockedSlots = db
    .prepare('SELECT start_time, end_time FROM blocked_time_slots WHERE barber_id IS NULL AND slot_date = ?')
    .all(date) as { start_time: string; end_time: string }[];

  const step = duration % 30 === 0 ? 30 : 15;
  const slotMap = new Map<string, AvailableSlot>();

  for (const barber of candidateBarbers) {
    if (isDateBarberBlocked(barber.id, date)) continue;

    const barberSched = db
      .prepare('SELECT * FROM barber_schedules WHERE barber_id = ? AND day_of_week = ?')
      .get(barber.id, dow) as
      | {
          is_working: number;
          start_time: string;
          end_time: string;
          break_start: string | null;
          break_end: string | null;
        }
      | undefined;

    if (barberSched && !barberSched.is_working) continue;

    const workStart = barberSched ? Math.max(shopOpenMin, timeToMinutes(barberSched.start_time)) : shopOpenMin;
    const workEnd = barberSched ? Math.min(shopCloseMin, timeToMinutes(barberSched.end_time)) : shopCloseMin;
    const bBreakStart = barberSched?.break_start ? timeToMinutes(barberSched.break_start) : null;
    const bBreakEnd = barberSched?.break_end ? timeToMinutes(barberSched.break_end) : null;

    const barberBlockedSlots = db
      .prepare('SELECT start_time, end_time FROM blocked_time_slots WHERE barber_id = ? AND slot_date = ?')
      .all(barber.id, date) as { start_time: string; end_time: string }[];

    const existingAppts = db
      .prepare(
        `SELECT id, start_time, end_time FROM appointments
         WHERE barber_id = ? AND appointment_date = ? AND status NOT IN ('cancelled', 'no_show')`
      )
      .all(barber.id, date) as { id: string; start_time: string; end_time: string }[];

    for (let t = workStart; t + duration <= workEnd; t += step) {
      const slotEnd = t + duration;

      // Prevent booking past times today (require at least 15 min lead)
      if (date === chicagoNow.date && t <= chicagoNow.minutes + 15) {
        continue;
      }

      // Check shop break
      if (shopBreakStart !== null && shopBreakEnd !== null && overlaps(t, slotEnd, shopBreakStart, shopBreakEnd)) {
        continue;
      }

      // Check barber break
      if (bBreakStart !== null && bBreakEnd !== null && overlaps(t, slotEnd, bBreakStart, bBreakEnd)) {
        continue;
      }

      // Check shop blocked time slots
      if (shopBlockedSlots.some((bs) => overlaps(t, slotEnd, timeToMinutes(bs.start_time), timeToMinutes(bs.end_time)))) {
        continue;
      }

      // Check barber blocked time slots
      if (barberBlockedSlots.some((bs) => overlaps(t, slotEnd, timeToMinutes(bs.start_time), timeToMinutes(bs.end_time)))) {
        continue;
      }

      // Check existing appointments (with buffer)
      const conflicts = existingAppts.some((appt) => {
        if (excludeAppointmentId && appt.id === excludeAppointmentId) return false;
        const aStart = timeToMinutes(appt.start_time);
        const aEnd = timeToMinutes(appt.end_time) + buffer;
        return overlaps(t, slotEnd + buffer, aStart, aEnd);
      });

      if (conflicts) continue;

      const startStr = minutesToTime(t);
      if (!slotMap.has(startStr)) {
        slotMap.set(startStr, {
          start_time: startStr,
          end_time: minutesToTime(slotEnd),
          label: formatTimeLabel(startStr),
          barber_id: barber.id,
          barber_name: barber.full_name,
        });
      }
    }
  }

  const slots = Array.from(slotMap.values()).sort((a, b) => a.start_time.localeCompare(b.start_time));
  return {
    slots,
    unavailableReason: slots.length === 0 ? 'No open time slots remain for this date.' : undefined,
  };
}

export function getMonthAvailabilitySummary(params: {
  serviceId: string;
  barberId: string;
  year: number;
  month: number; // 1-12
}): Record<string, { available: boolean; reason?: string }> {
  const { serviceId, barberId, year, month } = params;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const result: Record<string, { available: boolean; reason?: string }> = {};

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const res = computeAvailableSlots({ serviceId, barberId, date: dateStr });
    result[dateStr] = {
      available: res.slots.length > 0,
      reason: res.unavailableReason,
    };
  }
  return result;
}

export function createAppointmentTransactional(input: {
  customerId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceId: string;
  barberId: string; // specific ID or 'any'
  appointmentDate: string;
  startTime: string;
  customerNotes?: string;
  forceStatus?: 'pending' | 'confirmed';
}): AppointmentItem & { barber_name: string } {
  const runTx = db.transaction(() => {
    const settings = db.prepare('SELECT * FROM business_settings WHERE id = 1').get() as BusinessSettings;
    const service = db
      .prepare('SELECT id, name, price_cents, duration_minutes, is_active FROM services WHERE id = ?')
      .get(input.serviceId) as
      | { id: string; name: string; price_cents: number | null; duration_minutes: number | null; is_active: number }
      | undefined;

    if (!service || !service.is_active) {
      throw new Error('Selected service is unavailable.');
    }

    const { slots, unavailableReason } = computeAvailableSlots({
      serviceId: input.serviceId,
      barberId: input.barberId,
      date: input.appointmentDate,
    });

    const matchingSlot = slots.find((s) => s.start_time === input.startTime);
    if (!matchingSlot) {
      throw new Error(unavailableReason || 'This time slot is no longer available. Please select another time.');
    }

    const chosenBarberId = input.barberId === 'any' ? matchingSlot.barber_id : input.barberId;
    const duration = service.duration_minutes || 45;
    const endTime = minutesToTime(timeToMinutes(input.startTime) + duration);
    const status = input.forceStatus || (settings.require_admin_confirmation ? 'pending' : 'confirmed');
    const id = crypto.randomUUID();
    const ref = `XC-${crypto.randomInt(100000, 999999)}`;

    db.prepare(
      `INSERT INTO appointments (
        id, booking_reference, customer_id, customer_name, customer_email, customer_phone,
        service_id, barber_id, appointment_date, start_time, end_time,
        price_at_booking, service_name_snapshot, duration_minutes_snapshot,
        status, customer_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      ref,
      input.customerId,
      input.customerName,
      input.customerEmail,
      input.customerPhone,
      service.id,
      chosenBarberId,
      input.appointmentDate,
      input.startTime,
      endTime,
      service.price_cents ?? 0,
      service.name,
      duration,
      status,
      input.customerNotes || ''
    );

    // Ensure customer record exists for admin directory with accurate profile classification
    const normalizedEmail = input.customerEmail.toLowerCase();
    const linkedProfile = input.customerId
      ? (db.prepare('SELECT id, auth_provider, email_verified FROM profiles WHERE id = ?').get(input.customerId) as
          | { id: string; auth_provider?: string; email_verified: number }
          | undefined)
      : (db.prepare('SELECT id, auth_provider, email_verified FROM profiles WHERE LOWER(email) = ?').get(normalizedEmail) as
          | { id: string; auth_provider?: string; email_verified: number }
          | undefined);

    const resolvedProfileType = linkedProfile
      ? linkedProfile.auth_provider === 'google'
        ? 'google'
        : 'registered'
      : normalizedEmail === 'walkin@xecutivecutz.com'
      ? 'walkin'
      : 'guest';
    const resolvedVerified = linkedProfile?.email_verified ? 1 : 0;

    const existingCust = db
      .prepare('SELECT id, profile_id, phone, profile_type, email_verified FROM customers WHERE LOWER(email) = ?')
      .get(normalizedEmail) as
      | { id: string; profile_id: string | null; phone: string; profile_type: string; email_verified: number }
      | undefined;

    if (!existingCust) {
      db.prepare(
        `INSERT INTO customers (id, profile_id, full_name, email, phone, status, profile_type, email_verified)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`
      ).run(
        crypto.randomUUID(),
        linkedProfile?.id || input.customerId || null,
        input.customerName,
        normalizedEmail,
        input.customerPhone,
        resolvedProfileType,
        resolvedVerified
      );
    } else {
      db.prepare(
        `UPDATE customers
         SET profile_id = COALESCE(profile_id, ?),
             full_name = COALESCE(NULLIF(full_name, ''), ?),
             phone = CASE WHEN LENGTH(?) >= 7 AND LENGTH(phone) < 7 THEN ? ELSE phone END,
             profile_type = CASE WHEN ? IN ('google', 'registered') THEN ? ELSE profile_type END,
             email_verified = MAX(email_verified, ?)
         WHERE id = ?`
      ).run(
        linkedProfile?.id || input.customerId || null,
        input.customerName,
        input.customerPhone,
        input.customerPhone,
        resolvedProfileType,
        resolvedProfileType,
        resolvedVerified,
        existingCust.id
      );
    }

    const created = db
      .prepare(
        `SELECT a.*, b.full_name as barber_name
         FROM appointments a
         JOIN barbers b ON b.id = a.barber_id
         WHERE a.id = ?`
      )
      .get(id) as AppointmentItem & { barber_name: string };

    return created;
  });

  // IMMEDIATE transaction guarantees serialized write lock preventing concurrent double-bookings
  return runTx.immediate();
}

export function rescheduleAppointmentTransactional(input: {
  appointmentId: string;
  appointmentDate: string;
  startTime: string;
  barberId?: string;
}): AppointmentItem & { barber_name: string } {
  const runTx = db.transaction(() => {
    const existing = db.prepare('SELECT * FROM appointments WHERE id = ?').get(input.appointmentId) as AppointmentItem | undefined;
    if (!existing) throw new Error('Appointment not found.');
    if (existing.status === 'cancelled' || existing.status === 'completed') {
      throw new Error('Completed or cancelled appointments cannot be rescheduled.');
    }

    const targetBarber = input.barberId || existing.barber_id;
    const { slots, unavailableReason } = computeAvailableSlots({
      serviceId: existing.service_id,
      barberId: targetBarber,
      date: input.appointmentDate,
      excludeAppointmentId: existing.id,
    });

    const match = slots.find((s) => s.start_time === input.startTime);
    if (!match) {
      throw new Error(unavailableReason || 'Selected reschedule time slot is unavailable.');
    }

    const chosenBarberId = targetBarber === 'any' ? match.barber_id : targetBarber;
    const endTime = minutesToTime(timeToMinutes(input.startTime) + existing.duration_minutes_snapshot);

    db.prepare(
      `UPDATE appointments
       SET barber_id = ?, appointment_date = ?, start_time = ?, end_time = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(chosenBarberId, input.appointmentDate, input.startTime, endTime, existing.id);

    return db
      .prepare(
        `SELECT a.*, b.full_name as barber_name
         FROM appointments a
         JOIN barbers b ON b.id = a.barber_id
         WHERE a.id = ?`
      )
      .get(existing.id) as AppointmentItem & { barber_name: string };
  });

  return runTx.immediate();
}
