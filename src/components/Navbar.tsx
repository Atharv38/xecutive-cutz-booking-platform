import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Menu, Shield, User, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV_LINKS = [
  { label: 'Home', href: '/#home' },
  { label: 'About', href: '/#about' },
  { label: 'Services', href: '/#services' },
  { label: 'Barbers', href: '/#barbers' },
  { label: 'Gallery', href: '/#gallery' },
  { label: 'Location', href: '/#location' },
  { label: 'Contact', href: '/#contact' },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleNavClick = (href: string) => {
    setMobileOpen(false);
    if (href.startsWith('/#')) {
      const targetId = href.slice(2);
      if (location.pathname !== '/') {
        navigate(`/#${targetId}`);
      } else {
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0B0B0B]/92 backdrop-blur-md border-b border-[rgba(218,174,77,0.22)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-20 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <Link
          to="/"
          className="font-serif text-xl sm:text-2xl font-semibold tracking-tight text-[#F5F2EA] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#E9B84B]"
        >
          Xecutive <span className="text-[#E9B84B]">Cutz</span>
        </Link>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="hidden lg:flex items-center gap-6" aria-label="Main navigation">
          {NAV_LINKS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => handleNavClick(item.href)}
              className="text-sm font-medium text-[#A5A29B] hover:text-[#E9B84B] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: Login / Account + Book an Appointment CTA */}
        <div className="hidden md:flex items-center gap-4 shrink-0">
          {user ? (
            <div className="flex items-center gap-3">
              {user.role === 'admin' && (
                <Link
                  to="/admin"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#E9B84B] hover:text-[#F5F2EA] transition-colors whitespace-nowrap shrink-0"
                >
                  <Shield className="w-4 h-4" />
                  <span>Admin</span>
                </Link>
              )}
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#F5F2EA] hover:text-[#E9B84B] transition-colors whitespace-nowrap shrink-0"
              >
                <User className="w-4 h-4 text-[#E9B84B]" />
                <span>My Account</span>
              </Link>
            </div>
          ) : (
            <Link
              to="/login"
              className="text-sm font-medium text-[#F5F2EA] hover:text-[#E9B84B] transition-colors whitespace-nowrap shrink-0 px-2 py-2"
            >
              Login
            </Link>
          )}
          <Link
            to="/book"
            className="btn-gold-sheen group inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[#E9B84B] text-[#0B0B0B] hover:bg-[#C99B3C] hover:-translate-y-0.5 transition-all duration-200 rounded-sm whitespace-nowrap shrink-0"
          >
            <span>Book an Appointment</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </div>

        {/* Mobile Menu Trigger */}
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileOpen}
          className="lg:hidden inline-flex items-center justify-center w-11 h-11 text-[#F5F2EA] hover:text-[#E9B84B] border border-[rgba(218,174,77,0.22)] rounded-sm cursor-pointer"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden bg-[#141414] border-b border-[rgba(218,174,77,0.22)] px-4 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {NAV_LINKS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => handleNavClick(item.href)}
                className="text-left px-3 py-2.5 text-sm font-medium text-[#F5F2EA] hover:text-[#E9B84B] hover:bg-[#1C1B18] rounded-sm transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="pt-3 border-t border-[rgba(218,174,77,0.18)] flex flex-col gap-2.5">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="w-full text-center py-2.5 px-4 text-sm font-medium text-[#F5F2EA] border border-[rgba(218,174,77,0.3)] rounded-sm"
                >
                  Customer Dashboard
                </Link>
                {user.role === 'admin' && (
                  <Link
                    to="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="w-full text-center py-2.5 px-4 text-sm font-medium text-[#E9B84B] border border-[#E9B84B]/40 rounded-sm"
                  >
                    Owner Admin Panel
                  </Link>
                )}
              </>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="w-full text-center py-2.5 px-4 text-sm font-medium text-[#F5F2EA] border border-[rgba(218,174,77,0.3)] rounded-sm"
              >
                Login / Register
              </Link>
            )}
            <Link
              to="/book"
              onClick={() => setMobileOpen(false)}
              className="w-full text-center py-3 px-4 text-sm font-semibold bg-[#E9B84B] text-[#0B0B0B] rounded-sm"
            >
              Book an Appointment
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
