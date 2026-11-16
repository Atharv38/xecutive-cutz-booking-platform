import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Ban,
  BarChart3,
  BookOpen,
  Calendar,
  CalendarDays,
  Clock,
  ExternalLink,
  Image as ImageIcon,
  LogOut,
  Menu,
  MessageSquareQuote,
  Scissors,
  Settings,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const ADMIN_NAV = [
  { to: '/admin', label: 'Overview', Icon: BarChart3, end: true },
  { to: '/admin/bookings', label: 'Bookings', Icon: CalendarDays },
  { to: '/admin/calendar', label: 'Calendar', Icon: Calendar },
  { to: '/admin/services', label: 'Services', Icon: Scissors },
  { to: '/admin/barbers', label: 'Barbers', Icon: Users },
  { to: '/admin/customers', label: 'Customers', Icon: Users },
  { to: '/admin/hours', label: 'Business Hours', Icon: Clock },
  { to: '/admin/blocked-dates', label: 'Blocked Dates', Icon: Ban },
  { to: '/admin/gallery', label: 'Gallery', Icon: ImageIcon },
  { to: '/admin/reviews', label: 'Reviews', Icon: MessageSquareQuote },
  { to: '/admin/blog', label: 'Blog', Icon: BookOpen },
  { to: '/admin/settings', label: 'Settings', Icon: Settings },
];

export function AdminLayout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B0B] text-[#F5F2EA] flex items-center justify-center">
        <p className="text-sm text-[#A5A29B]">Verifying administrator session...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0B0B0B] text-[#F5F2EA] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#141414] border border-[rgba(218,174,77,0.28)] rounded-sm p-8 space-y-4 text-center">
          <ShieldAlert className="w-8 h-8 text-[#E9B84B] mx-auto" />
          <h1 className="font-serif text-2xl font-semibold">Owner Sign-In Required</h1>
          <p className="text-sm text-[#A5A29B]">
            This administration portal is restricted to authorized Xecutive Cutz staff.
          </p>
          <Link
            to={`/login?redirect=${encodeURIComponent(location.pathname)}`}
            className="inline-block w-full py-3 px-4 text-xs font-semibold bg-[#E9B84B] text-[#0B0B0B] rounded-sm"
          >
            Sign In to Admin Portal
          </Link>
        </div>
      </div>
    );
  }

  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#0B0B0B] text-[#F5F2EA] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#141414] border border-rose-500/40 rounded-sm p-8 space-y-4 text-center">
          <ShieldAlert className="w-8 h-8 text-rose-400 mx-auto" />
          <h1 className="font-serif text-2xl font-semibold">Access Restricted</h1>
          <p className="text-sm text-[#A5A29B]">
            Signed in as <span className="text-[#F5F2EA]">{user.email}</span> (Customer role). Administrator privileges are required to access /admin.
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <Link
              to="/dashboard"
              className="px-5 py-2.5 text-xs font-semibold bg-[#E9B84B] text-[#0B0B0B] rounded-sm"
            >
              Customer Dashboard
            </Link>
            <Link
              to="/"
              className="px-5 py-2.5 text-xs font-medium border border-[rgba(218,174,77,0.25)] text-[#F5F2EA] rounded-sm"
            >
              Public Site
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const currentNav = ADMIN_NAV.find((n) =>
    n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)
  );

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F5F2EA] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-[#141414] border-r border-[rgba(218,174,77,0.22)]">
        <div className="h-16 px-6 flex items-center justify-between border-b border-[rgba(218,174,77,0.18)]">
          <Link to="/admin" className="font-serif text-xl font-semibold text-[#F5F2EA]">
            Xecutive <span className="text-[#E9B84B]">Admin</span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Admin navigation">
          {ADMIN_NAV.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium rounded-sm transition-colors ${
                  isActive
                    ? 'bg-[#E9B84B] text-[#0B0B0B] font-semibold'
                    : 'text-[#A5A29B] hover:text-[#F5F2EA] hover:bg-[#1C1B18]'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-[rgba(218,174,77,0.18)] space-y-1">
          <Link
            to="/"
            className="flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium text-[#A5A29B] hover:text-[#E9B84B] rounded-sm"
          >
            <ExternalLink className="w-4 h-4 shrink-0" />
            <span>View Public Site</span>
          </Link>
          <button
            type="button"
            onClick={() => logout().then(() => navigate('/'))}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium text-rose-300 hover:bg-rose-950/30 rounded-sm cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/75" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-10 w-64 bg-[#141414] border-r border-[rgba(218,174,77,0.22)] flex flex-col">
            <div className="h-16 px-5 flex items-center justify-between border-b border-[rgba(218,174,77,0.18)]">
              <span className="font-serif text-lg font-semibold">
                Xecutive <span className="text-[#E9B84B]">Admin</span>
              </span>
              <button type="button" onClick={() => setSidebarOpen(false)} className="text-[#A5A29B]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {ADMIN_NAV.map(({ to, label, Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium rounded-sm ${
                      isActive ? 'bg-[#E9B84B] text-[#0B0B0B] font-semibold' : 'text-[#A5A29B]'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="p-3 border-t border-[rgba(218,174,77,0.18)]">
              <button
                type="button"
                onClick={() => logout().then(() => navigate('/'))}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium text-rose-300"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-[#141414] border-b border-[rgba(218,174,77,0.22)] px-4 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open admin menu"
              className="lg:hidden p-2 border border-[rgba(218,174,77,0.22)] rounded-sm text-[#F5F2EA]"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="text-xs text-[#A5A29B] flex items-center gap-2">
              <span>Admin</span>
              <span aria-hidden="true">/</span>
              <span className="text-[#F5F2EA] font-medium">{currentNav?.label || 'Overview'}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden sm:inline text-xs text-[#A5A29B]">{user.email}</span>
            <Link
              to="/admin/bookings"
              className="px-3.5 py-2 text-xs font-semibold bg-[#E9B84B] text-[#0B0B0B] hover:bg-[#C99B3C] rounded-sm whitespace-nowrap"
            >
              Manage Bookings
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
