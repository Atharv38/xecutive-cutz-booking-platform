import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F5F2EA] flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-16 space-y-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#E9B84B]">Legal</p>
        <h1 className="font-serif text-4xl font-semibold">Privacy Policy</h1>
        <div className="space-y-4 text-sm text-[#A5A29B] leading-relaxed">
          <p>
            Xecutive Cutz (919 N Haskell Ave., Dallas, TX 75204) collects only the contact information needed to schedule, confirm, and manage your barbershop appointments—specifically your full name, email address, phone number, and optional booking notes.
          </p>
          <p>
            Account passwords are cryptographically hashed and never stored in plain text. Customer booking records are restricted to your authenticated account and authorized barbershop administrators.
          </p>
          <p>
            To update or delete your customer profile information, sign in to your Customer Dashboard or contact Xecutive Cutz directly at +1 972-358-1199.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F5F2EA] flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-16 space-y-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#E9B84B]">Legal</p>
        <h1 className="font-serif text-4xl font-semibold">Terms of Service</h1>
        <div className="space-y-4 text-sm text-[#A5A29B] leading-relaxed">
          <p>
            Appointments reserved through the Xecutive Cutz online booking system are subject to shop operating hours and cancellation notice windows configured by management.
          </p>
          <p>
            Please arrive on time for your scheduled appointment. If you need to cancel or reschedule, use your Customer Dashboard prior to the cancellation cutoff window or contact the shop directly.
          </p>
          <p>
            Service pricing and durations displayed in active listings reflect current barbershop rates approved by Xecutive Cutz management.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
