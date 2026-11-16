import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, CheckCircle2, KeyRound, MailCheck } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useAuth } from '../context/AuthContext';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z
  .object({
    full_name: z.string().min(2, 'Full name is required'),
    email: z.string().email('Enter a valid email address'),
    phone: z.string().min(7, 'Phone number is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (vals: z.infer<typeof loginSchema>) => {
    setError('');
    try {
      const user = await login(vals.email, vals.password);
      if (redirect) {
        navigate(redirect);
      } else {
        navigate(user.role === 'admin' ? '/admin' : '/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const user = await loginWithGoogle();
      if (redirect) {
        navigate(redirect);
      } else {
        navigate(user.role === 'admin' ? '/admin' : '/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in was cancelled or failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F5F2EA] flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-14">
        <div className="w-full max-w-md bg-[#141414] border border-[rgba(218,174,77,0.25)] rounded-sm p-7 sm:p-9 space-y-6">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#E9B84B]">
              Xecutive Cutz Account
            </p>
            <h1 className="font-serif text-3xl font-semibold">Sign In</h1>
            <p className="text-xs text-[#A5A29B]">
              Sign in with Google via Firebase Authentication or your Xecutive Cutz credentials.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs rounded-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="button"
            disabled={googleLoading}
            onClick={handleGoogleSignIn}
            className="w-full py-3 px-4 text-sm font-semibold bg-[#1C1B18] border border-[rgba(218,174,77,0.4)] hover:border-[#E9B84B] text-[#F5F2EA] rounded-sm flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-60"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#EA4335"
                d="M12 10.2v3.9h5.5c-.24 1.26-.96 2.33-2.04 3.05l3.3 2.56c1.92-1.77 3.04-4.38 3.04-7.47 0-.72-.06-1.41-.18-2.04H12z"
              />
              <path
                fill="#34A853"
                d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.3-2.56c-.91.61-2.08.97-3.32.97-2.55 0-4.71-1.72-5.48-4.04H3.11v2.64C4.76 19.86 8.12 22 12 22z"
              />
              <path
                fill="#4A90E2"
                d="M6.52 13.94c-.2-.6-.31-1.24-.31-1.94s.11-1.34.31-1.94V7.42H3.11A9.99 9.99 0 0 0 2 12c0 1.61.39 3.14 1.11 4.58l3.41-2.64z"
              />
              <path
                fill="#FBBC05"
                d="M12 6.02c1.47 0 2.79.51 3.83 1.5l2.87-2.87C16.95 3.04 14.7 2 12 2 8.12 2 4.76 4.14 3.11 7.42l3.41 2.64C7.29 7.74 9.45 6.02 12 6.02z"
              />
            </svg>
            <span>{googleLoading ? 'Connecting to Google...' : 'Continue with Google'}</span>
          </button>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-[rgba(218,174,77,0.16)]" />
            <span className="shrink mx-3 text-[11px] uppercase tracking-wider text-[#A5A29B]">or email</span>
            <div className="flex-grow border-t border-[rgba(218,174,77,0.16)]" />
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#A5A29B]">Email</label>
              <input
                type="email"
                {...form.register('email')}
                className="w-full px-3.5 py-2.5 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm text-sm text-[#F5F2EA] focus:outline-none focus:border-[#E9B84B]"
                placeholder="you@example.com"
              />
              {form.formState.errors.email && (
                <p className="text-xs text-rose-400">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between">
                <label className="block text-xs font-medium text-[#A5A29B]">Password</label>
                <Link to="/forgot-password" className="text-xs text-[#E9B84B] hover:underline">
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                {...form.register('password')}
                className="w-full px-3.5 py-2.5 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm text-sm text-[#F5F2EA] focus:outline-none focus:border-[#E9B84B]"
                placeholder="••••••••"
              />
              {form.formState.errors.password && (
                <p className="text-xs text-rose-400">{form.formState.errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="w-full py-3 px-4 text-sm font-semibold bg-[#E9B84B] text-[#0B0B0B] hover:bg-[#C99B3C] rounded-sm cursor-pointer"
            >
              {form.formState.isSubmitting ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          {/* Demo Walkthrough Credentials */}
          <div className="pt-4 border-t border-[rgba(218,174,77,0.18)] space-y-2.5">
            <p className="text-xs text-[#A5A29B]">Demo Preview Quick Fill:</p>
            <button
              type="button"
              onClick={() => {
                form.setValue('email', 'client@xecutivecutz.com');
                form.setValue('password', 'ClientDemo2026!');
              }}
              className="w-full py-2.5 px-3 text-xs font-medium bg-[#1C1B18] border border-[rgba(218,174,77,0.22)] hover:border-[#E9B84B] text-[#F5F2EA] rounded-sm cursor-pointer"
            >
              Demo Customer
            </button>
          </div>

          <p className="text-xs text-center text-[#A5A29B]">
            New to Xecutive Cutz?{' '}
            <Link to="/register" className="text-[#E9B84B] font-medium hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export function RegisterPage() {
  const { register: registerUser, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [verifyToken, setVerifyToken] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  const handleGoogleRegister = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const user = await loginWithGoogle();
      navigate(user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (vals: z.infer<typeof registerSchema>) => {
    setError('');
    try {
      const res = await registerUser({
        full_name: vals.full_name,
        email: vals.email,
        phone: vals.phone,
        password: vals.password,
      });
      if (res.verificationToken) {
        setVerifyToken(res.verificationToken);
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    }
  };

  const handleVerifyEmail = async () => {
    if (!verifyToken) return;
    const res = await fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: verifyToken }),
    });
    if (res.ok) setVerified(true);
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F5F2EA] flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-14">
        <div className="w-full max-w-md bg-[#141414] border border-[rgba(218,174,77,0.25)] rounded-sm p-7 sm:p-9 space-y-6">
          {verifyToken ? (
            <div className="space-y-4">
              <MailCheck className="w-8 h-8 text-[#E9B84B]" />
              <h1 className="font-serif text-2xl font-semibold">Verify Your Email</h1>
              <p className="text-sm text-[#A5A29B]">
                {verified
                  ? 'Your email has been verified. You can now access your Customer Dashboard.'
                  : 'Your account is created. Click below to complete email verification for this demo session.'}
              </p>
              {!verified ? (
                <button
                  type="button"
                  onClick={handleVerifyEmail}
                  className="w-full py-3 px-4 text-sm font-semibold bg-[#E9B84B] text-[#0B0B0B] rounded-sm cursor-pointer"
                >
                  Verify Email Address
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="w-full py-3 px-4 text-sm font-semibold bg-[#E9B84B] text-[#0B0B0B] rounded-sm cursor-pointer"
                >
                  Continue to Dashboard
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#E9B84B]">
                  Client Membership
                </p>
                <h1 className="font-serif text-3xl font-semibold">Create Account</h1>
                <p className="text-xs text-[#A5A29B]">
                  Register to book appointments faster and manage upcoming visits.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs rounded-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="button"
                disabled={googleLoading}
                onClick={handleGoogleRegister}
                className="w-full py-3 px-4 text-sm font-semibold bg-[#1C1B18] border border-[rgba(218,174,77,0.4)] hover:border-[#E9B84B] text-[#F5F2EA] rounded-sm flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-60"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#EA4335"
                    d="M12 10.2v3.9h5.5c-.24 1.26-.96 2.33-2.04 3.05l3.3 2.56c1.92-1.77 3.04-4.38 3.04-7.47 0-.72-.06-1.41-.18-2.04H12z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.3-2.56c-.91.61-2.08.97-3.32.97-2.55 0-4.71-1.72-5.48-4.04H3.11v2.64C4.76 19.86 8.12 22 12 22z"
                  />
                  <path
                    fill="#4A90E2"
                    d="M6.52 13.94c-.2-.6-.31-1.24-.31-1.94s.11-1.34.31-1.94V7.42H3.11A9.99 9.99 0 0 0 2 12c0 1.61.39 3.14 1.11 4.58l3.41-2.64z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M12 6.02c1.47 0 2.79.51 3.83 1.5l2.87-2.87C16.95 3.04 14.7 2 12 2 8.12 2 4.76 4.14 3.11 7.42l3.41 2.64C7.29 7.74 9.45 6.02 12 6.02z"
                  />
                </svg>
                <span>{googleLoading ? 'Connecting to Google...' : 'Sign Up with Google'}</span>
              </button>

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-[rgba(218,174,77,0.16)]" />
                <span className="shrink mx-3 text-[11px] uppercase tracking-wider text-[#A5A29B]">or register with email</span>
                <div className="flex-grow border-t border-[rgba(218,174,77,0.16)]" />
              </div>

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-[#A5A29B]">Full Name</label>
                  <input
                    {...form.register('full_name')}
                    className="w-full px-3.5 py-2.5 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm text-sm text-[#F5F2EA] focus:outline-none focus:border-[#E9B84B]"
                  />
                  {form.formState.errors.full_name && (
                    <p className="text-xs text-rose-400">{form.formState.errors.full_name.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-[#A5A29B]">Email</label>
                  <input
                    type="email"
                    {...form.register('email')}
                    className="w-full px-3.5 py-2.5 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm text-sm text-[#F5F2EA] focus:outline-none focus:border-[#E9B84B]"
                  />
                  {form.formState.errors.email && (
                    <p className="text-xs text-rose-400">{form.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-[#A5A29B]">Phone Number</label>
                  <input
                    type="tel"
                    {...form.register('phone')}
                    className="w-full px-3.5 py-2.5 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm text-sm text-[#F5F2EA] focus:outline-none focus:border-[#E9B84B]"
                  />
                  {form.formState.errors.phone && (
                    <p className="text-xs text-rose-400">{form.formState.errors.phone.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-[#A5A29B]">Password</label>
                  <input
                    type="password"
                    {...form.register('password')}
                    className="w-full px-3.5 py-2.5 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm text-sm text-[#F5F2EA] focus:outline-none focus:border-[#E9B84B]"
                  />
                  {form.formState.errors.password && (
                    <p className="text-xs text-rose-400">{form.formState.errors.password.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-[#A5A29B]">Confirm Password</label>
                  <input
                    type="password"
                    {...form.register('confirmPassword')}
                    className="w-full px-3.5 py-2.5 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm text-sm text-[#F5F2EA] focus:outline-none focus:border-[#E9B84B]"
                  />
                  {form.formState.errors.confirmPassword && (
                    <p className="text-xs text-rose-400">{form.formState.errors.confirmPassword.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  className="w-full py-3 px-4 text-sm font-semibold bg-[#E9B84B] text-[#0B0B0B] hover:bg-[#C99B3C] rounded-sm cursor-pointer"
                >
                  {form.formState.isSubmitting ? 'Creating Account...' : 'Create Account'}
                </button>
              </form>

              <p className="text-xs text-center text-[#A5A29B]">
                Already registered?{' '}
                <Link to="/login" className="text-[#E9B84B] font-medium hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [demoToken, setDemoToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Request failed.');
      return;
    }
    setMessage(data.message);
    if (data.demoResetToken) setDemoToken(data.demoResetToken);
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F5F2EA] flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-14">
        <div className="w-full max-w-md bg-[#141414] border border-[rgba(218,174,77,0.25)] rounded-sm p-8 space-y-5">
          <KeyRound className="w-7 h-7 text-[#E9B84B]" />
          <h1 className="font-serif text-2xl font-semibold">Reset Password</h1>
          <p className="text-xs text-[#A5A29B]">
            Enter the email address associated with your Xecutive Cutz account.
          </p>

          {error && <p className="text-xs text-rose-400">{error}</p>}
          {message && (
            <div className="p-3.5 bg-[#1C1B18] border border-[rgba(218,174,77,0.3)] rounded-sm text-xs space-y-2">
              <p className="text-[#F5F2EA]">{message}</p>
              {demoToken && (
                <button
                  type="button"
                  onClick={() => navigate(`/reset-password?token=${demoToken}`)}
                  className="text-[#E9B84B] font-semibold underline cursor-pointer"
                >
                  Open Password Reset Form
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3.5 py-2.5 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm text-sm text-[#F5F2EA]"
            />
            <button
              type="submit"
              className="w-full py-3 px-4 text-sm font-semibold bg-[#E9B84B] text-[#0B0B0B] rounded-sm cursor-pointer"
            >
              Send Reset Instructions
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [newPassword, setNewPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Reset failed.');
      return;
    }
    setDone(true);
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F5F2EA] flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-14">
        <div className="w-full max-w-md bg-[#141414] border border-[rgba(218,174,77,0.25)] rounded-sm p-8 space-y-5">
          {done ? (
            <div className="space-y-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              <h1 className="font-serif text-2xl font-semibold">Password Updated</h1>
              <Link
                to="/login"
                className="inline-block px-6 py-3 text-xs font-semibold bg-[#E9B84B] text-[#0B0B0B] rounded-sm"
              >
                Sign In with New Password
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h1 className="font-serif text-2xl font-semibold">Set New Password</h1>
              {error && <p className="text-xs text-rose-400">{error}</p>}
              <input
                type="password"
                minLength={8}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (8+ characters)"
                className="w-full px-3.5 py-2.5 bg-[#0B0B0B] border border-[rgba(218,174,77,0.25)] rounded-sm text-sm text-[#F5F2EA]"
              />
              <button
                type="submit"
                className="w-full py-3 px-4 text-sm font-semibold bg-[#E9B84B] text-[#0B0B0B] rounded-sm cursor-pointer"
              >
                Update Password
              </button>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
