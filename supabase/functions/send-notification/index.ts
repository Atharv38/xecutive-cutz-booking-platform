// Supabase Edge Function: send-notification
// Deploy with: supabase functions deploy send-notification
// Set secret: supabase secrets set RESEND_API_KEY=re_...

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Xecutive Cutz <bookings@xecutivecutz.com>';

interface NotificationPayload {
  to: string;
  subject: string;
  html: string;
  eventType: 'booking_created' | 'booking_confirmed' | 'booking_cancelled' | 'booking_rescheduled' | 'admin_alert';
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const payload = (await req.json()) as NotificationPayload;

  if (!RESEND_API_KEY) {
    return new Response(
      JSON.stringify({
        sent: false,
        configured: false,
        provider: 'resend',
        reason: 'RESEND_API_KEY secret is not configured in Supabase Edge Function environment.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    return new Response(JSON.stringify({ sent: false, configured: true, error: data }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ sent: true, configured: true, id: data.id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
