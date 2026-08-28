'use client';

import { signIn, useSession } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState('demo@pathfinder.dev');
  const [password, setPassword] = useState('demo123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await signIn('demo', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#000000] flex items-center justify-center">
        <div className="w-14 h-14 rounded-full border-2 border-dashed border-lime animate-spin" />
      </div>
    );
  }

  if (session) {
    router.push('/dashboard');
    return null;
  }

  return (
    <div className="min-h-screen bg-[#000000] text-[#F4F4F0] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 md:px-10 py-6 border-b border-[#242424]">
        <Link href="/" className="font-display font-bold text-xl tracking-tight">
          PATHFINDER<span className="text-lime">.</span>
        </Link>
        <span className="font-mono text-[11px] tracking-[0.3em] uppercase text-[#F4F4F0]/50">
          Check-in Counter 01
        </span>
      </header>

      {/* Boarding-pass login */}
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-2xl">
          <p className="font-mono text-xs tracking-[0.35em] text-lime uppercase mb-3 text-center">
            Passenger Check-In
          </p>
          <h1 className="font-display font-bold text-4xl md:text-6xl tracking-tighter text-center mb-12">
            PRESENT YOUR
            <br />
            <span className="text-lime">CREDENTIALS.</span>
          </h1>

          <div className="boarding-pass rounded-md overflow-hidden">
            {/* Top strip — flight info */}
            <div className="flex items-center justify-between px-8 py-4 border-b-2 border-dashed border-[#000000]/20">
              <div>
                <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#000000]/50">
                  Flight
                </p>
                <p className="font-display font-bold text-2xl text-[#000000]">PF-001</p>
              </div>
              <div className="text-center">
                <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#000000]/50">
                  Route
                </p>
                <p className="font-display font-bold text-2xl text-[#000000]">
                  YOU <span className="text-lime-dim">→</span> DEMO
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#000000]/50">
                  Class
                </p>
                <p className="font-display font-bold text-2xl text-[#000000]">FIRST</p>
              </div>
            </div>

            {/* Form body */}
            <form onSubmit={handleLogin} className="px-8 py-8 space-y-5">
              <div>
                <label className="block font-mono text-[10px] tracking-[0.25em] uppercase text-[#000000]/50 mb-2">
                  Passenger Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#000000]/5 border border-[#000000]/20 rounded px-4 py-3 font-mono text-sm text-[#000000] focus:outline-none focus:border-[#000000]"
                  placeholder="demo@pathfinder.dev"
                  required
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] tracking-[0.25em] uppercase text-[#000000]/50 mb-2">
                  Security Code
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#000000]/5 border border-[#000000]/20 rounded px-4 py-3 font-mono text-sm text-[#000000] focus:outline-none focus:border-[#000000]"
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-600/10 border border-red-600/40 text-red-700 px-4 py-3 rounded font-mono text-xs">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#000000] text-lime font-mono font-bold text-sm tracking-[0.25em] uppercase py-4 rounded hover:bg-[#242424] transition-colors disabled:opacity-50"
              >
                {loading ? 'Verifying…' : 'Proceed to Boarding →'}
              </button>
            </form>

            {/* Bottom strip — barcode */}
            <div className="flex items-center justify-between px-8 py-4 border-t-2 border-dashed border-[#000000]/20">
              <div className="barcode h-10 w-40 opacity-80" />
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#000000]/50">
                Any credentials work in demo mode
              </p>
            </div>
          </div>

          <p className="text-center mt-8">
            <Link
              href="/admin"
              className="font-mono text-xs tracking-[0.25em] uppercase text-[#F4F4F0]/40 hover:text-lime transition-colors"
            >
              Flight Ops Console →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
