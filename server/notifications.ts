import crypto from 'crypto';
import { db } from './db';
import type { AppointmentItem, BusinessSettings } from '../src/types';

export interface NotificationResult {
  customerDelivered: boolean;
  adminDelivered: boolean;
  status: 'sent' | 'not_configured' | 'failed';
  message: string;
}

async function sendViaResend(to: string, subject: string, html: string): Promise<{ ok: boolean; status: 'sent' | 'not_configured' | 'failed'; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      status: 'not_configured',
      error: 'RESEND_API_KEY is not configured. Email stored in notification log.',
    };
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Xecutive Cutz <bookings@xecutivecutz.com>';
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: fromEmail, to: [to], subject, html }),
    });
    if (!response.ok) {
      const text = await response.text();
      return { ok: false, status: 'failed', error: `Resend HTTP ${response.status}: ${text}` };
    }
    return { ok: true, status: 'sent' };
  } catch (err) {
    return { ok: false, status: 'failed', error: err instanceof Error ? err.message : 'Network error' };
  }
}

export async function dispatchBookingNotification(
  eventType: 'booking_created' | 'booking_confirmed' | 'booking_cancelled' | 'booking_rescheduled',
  appointment: AppointmentItem & { barber_name?: string }
): Promise<NotificationResult> {
  const settings = db.prepare('SELECT * FROM business_settings WHERE id = 1').get() as BusinessSettings | undefined;
  const adminEmail = settings?.email || 'owner@xecutivecutz.com';
  const enabled = settings ? Boolean(settings.email_notifications_enabled) : true;

  const titles: Record<typeof eventType, string> = {
    booking_created: `Booking Request Received (${appointment.booking_reference})`,
    booking_confirmed: `Appointment Confirmed (${appointment.booking_reference})`,
    booking_cancelled: `Appointment Cancelled (${appointment.booking_reference})`,
    booking_rescheduled: `Appointment Rescheduled (${appointment.booking_reference})`,
  };

  const subject = `${titles[eventType]} — Xecutive Cutz`;
  const customerBody = `
    <div style="font-family: sans-serif; background:#0B0B0B; color:#F5F2EA; padding:24px; border:1px solid #C99B3C;">
      <h2 style="color:#E9B84B; margin:0 0 12px;">Xecutive Cutz</h2>
      <p>Hello ${appointment.customer_name},</p>
      <p>Your appointment update: <strong>${titles[eventType]}</strong></p>
      <ul>
        <li><strong>Reference:</strong> ${appointment.booking_reference}</li>
        <li><strong>Service:</strong> ${appointment.service_name_snapshot}</li>
        <li><strong>Barber:</strong> ${appointment.barber_name || 'Assigned Barber'}</li>
        <li><strong>Date:</strong> ${appointment.appointment_date}</li>
        <li><strong>Time:</strong> ${appointment.start_time} – ${appointment.end_time}</li>
        <li><strong>Location:</strong> ${settings?.address || '919 N Haskell Ave., Dallas, TX 75204'}</li>
      </ul>
    </div>
  `;

  const adminSubject = `[Admin Alert] ${titles[eventType]} — ${appointment.customer_name}`;
  const adminBody = `
    <p>Booking ${appointment.booking_reference} (${eventType})</p>
    <p>Client: ${appointment.customer_name} (${appointment.customer_email} / ${appointment.customer_phone})</p>
    <p>Service: ${appointment.service_name_snapshot} | Date: ${appointment.appointment_date} ${appointment.start_time}</p>
  `;

  let custRes: { ok: boolean; status: 'sent' | 'not_configured' | 'failed'; error?: string } = {
    ok: false,
    status: 'not_configured',
    error: 'Email notifications disabled in settings.',
  };
  let adminRes: { ok: boolean; status: 'sent' | 'not_configured' | 'failed'; error?: string } = {
    ok: false,
    status: 'not_configured',
    error: 'Email notifications disabled in settings.',
  };

  if (enabled) {
    custRes = await sendViaResend(appointment.customer_email, subject, customerBody);
    adminRes = await sendViaResend(adminEmail, adminSubject, adminBody);
  }

  const insertLog = db.prepare(`
    INSERT INTO notifications (id, recipient_email, recipient_role, appointment_id, event_type, subject, body, delivery_status, provider, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'resend', ?)
  `);

  insertLog.run(
    crypto.randomUUID(),
    appointment.customer_email,
    'customer',
    appointment.id,
    eventType,
    subject,
    `Service: ${appointment.service_name_snapshot} on ${appointment.appointment_date} at ${appointment.start_time}`,
    custRes.status,
    custRes.error || ''
  );

  insertLog.run(
    crypto.randomUUID(),
    adminEmail,
    'admin',
    appointment.id,
    `admin_${eventType}`,
    adminSubject,
    `Client ${appointment.customer_name} · ${appointment.service_name_snapshot} on ${appointment.appointment_date} ${appointment.start_time}`,
    adminRes.status,
    adminRes.error || ''
  );

  return {
    customerDelivered: custRes.ok,
    adminDelivered: adminRes.ok,
    status: custRes.status,
    message:
      custRes.status === 'sent'
        ? 'Confirmation emails sent via Resend.'
        : 'Saved in notification log. Configure RESEND_API_KEY for live email delivery.',
  };
}
