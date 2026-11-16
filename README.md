# Xecutive Cutz — Luxury Barbershop & Online Booking Platform

Full-stack web application, real-time appointment scheduler, and owner admin dashboard built for **Xecutive Cutz** (919 N Haskell Ave., Dallas, TX 75204).

---

## Key Features

### Client Experience & Storefront
- **Real-Time Appointment Booking:** Browse transparent grooming services, select a preferred barber chair, view live available time slots, and book appointments online in under a minute.
- **Interactive Google Maps & Route Preview:** Integrated dark-themed Google Map centered on the Dallas barbershop with live **Drive / Walk / Transit** route previews, estimated travel times, optional GPS origin detection, and one-click direct Google Maps turn-by-turn directions.
- **In-Shop Lounge Audio Player:** Interactive soundtrack player built with custom Web Audio API neo-soul/Rhodes synthesis, track scrubbing, and animated border beams.
- **Grooming Journal & Portfolio:** Filterable barber work gallery (Haircuts, Skin Fades, Beard Styling, At Work, Interior) and hair/beard maintenance guides.
- **Luxury Dark-Gold UI:** Custom scroll-triggered blur-fade reveals (`BlurFade`), animated border spotlights (`BorderBeam`), and responsive card/button micro-interactions.

### Owner Admin Portal (`/admin`)
- **Two-Way Supabase Admin Sync:** Automatic reconciliation between the local Express/SQLite server and Supabase (`admin_fetch_dashboard_data`, `admin_update_appointment_status`, `admin_delete_appointment`, `admin_update_customer`, and `sync_customer_profile` RPCs) with Row-Level Security support.
- **Booking & Revenue Management:** Approve (`pending` → `confirmed`), complete, reschedule, mark no-show, cancel, or delete appointments with real-time completed revenue analytics and weekly/monthly charts.
- **Customer Directory & Verification:** Tracks client classifications (*Google Profile*, *Registered*, *Guest Booking*, *Walk-In*), email verification status, account tiers (*Active*, *VIP*, *
