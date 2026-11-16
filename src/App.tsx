import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ShopProvider } from './context/ShopContext';
import { HomePage } from './pages/HomePage';
import { BookingPage } from './pages/BookingPage';
import {
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
} from './pages/AuthPages';
import { CustomerDashboard } from './pages/CustomerDashboard';
import { JournalArticlePage } from './pages/JournalArticlePage';
import { PrivacyPolicyPage, TermsOfServicePage } from './pages/LegalPages';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminOverview } from './pages/admin/AdminOverview';
import { AdminBookings } from './pages/admin/AdminBookings';
import { AdminCalendar } from './pages/admin/AdminCalendar';
import { AdminServices } from './pages/admin/AdminServices';
import { AdminBarbers } from './pages/admin/AdminBarbers';
import { AdminCustomers } from './pages/admin/AdminCustomers';
import { AdminHours } from './pages/admin/AdminHours';
import { AdminBlockedDates } from './pages/admin/AdminBlockedDates';
import { AdminBlog, AdminGallery, AdminReviews } from './pages/admin/AdminContent';
import { AdminSettings } from './pages/admin/AdminSettings';

function ScrollManager() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const targetId = hash.slice(1);
      const scrollToTarget = () => {
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
          return true;
        }
        return false;
      };
      if (!scrollToTarget()) {
        const timer = window.setTimeout(scrollToTarget, 140);
        return () => window.clearTimeout(timer);
      }
      return;
    }

    // Jump straight to the top of newly opened pages instead of preserving footer scroll offset
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname, search, hash]);

  return null;
}

export default function App() {
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  useEffect(() => {
    const onQuotaExceeded = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  return (
    <BrowserRouter>
      <ScrollManager />
      {gmpQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}
      <AuthProvider>
        <ShopProvider>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/book" element={<BookingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/dashboard" element={<CustomerDashboard />} />
            <Route path="/journal/:slug" element={<JournalArticlePage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsOfServicePage />} />

            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminOverview />} />
              <Route path="bookings" element={<AdminBookings />} />
              <Route path="calendar" element={<AdminCalendar />} />
              <Route path="services" element={<AdminServices />} />
              <Route path="barbers" element={<AdminBarbers />} />
              <Route path="customers" element={<AdminCustomers />} />
              <Route path="hours" element={<AdminHours />} />
              <Route path="blocked-dates" element={<AdminBlockedDates />} />
              <Route path="gallery" element={<AdminGallery />} />
              <Route path="reviews" element={<AdminReviews />} />
              <Route path="blog" element={<AdminBlog />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ShopProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
