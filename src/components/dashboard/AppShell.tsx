'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  ClipboardCheck,
  Ticket,
  Luggage,
  Award,
  SlidersHorizontal,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import NotificationBell from '@/components/dashboard/NotificationBell';
import PassengerCard from '@/components/dashboard/PassengerCard';

/**
 * Shared chrome for every signed-in traveller page.
 *
 * Implemented as a wrapper component rather than a Next.js route-group layout so
 * that `/dashboard` and `/admin` keep their existing URLs and file locations —
 * moving them into a group would churn paths the e2e specs and deep links rely
 * on for no visual gain.
 */

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Journey',
    items: [
      { href: '/dashboard', label: 'Flight Board', icon: LayoutDashboard },
      { href: '/check-in', label: 'Check-in', icon: ClipboardCheck },
      { href: '/boarding-pass', label: 'Boarding Passes', icon: Ticket },
      { href: '/baggage', label: 'Baggage', icon: Luggage },
    ],
  },
  {
    title: 'Account',
    items: [{ href: '/loyalty', label: 'Loyalty', icon: Award }],
  },
  {
    title: 'Operations',
    items: [
      { href: '/admin', label: 'Ops Console', icon: SlidersHorizontal },
    ],
  },
];

interface AppShellProps {
  /** Small lime kicker above the page title, e.g. "Terminal 01 · Departures". */
  eyebrow: string;
  title: string;
  /** Optional right-aligned action, rendered beside the page title. */
  action?: React.ReactNode;
  segmentsFlown?: number;
  children: React.ReactNode;
}

export default function AppShell({
  eyebrow,
  title,
  action,
  segmentsFlown = 0,
  children,
}: AppShellProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [clock, setClock] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Live departures-board clock. Minute precision avoids re-rendering every second.
  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  // Close the mobile drawer whenever navigation happens.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Breadcrumb for the top bar. The eyebrow is already shown above the page
  // title, so repeating it here would print the same line twice on one screen.
  const activeGroup = NAV_GROUPS.find((group) =>
    group.items.some(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    )
  );
  const activeItem = activeGroup?.items.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="h-16 flex items-center px-5 border-b border-[#242424]">
        <Link href="/" className="font-display font-bold text-lg tracking-tight">
          PATHFINDER<span className="text-lime">.</span>
        </Link>
      </div>

      <div className="p-4">
        <PassengerCard
          name={session?.user?.name}
          email={session?.user?.email}
          segmentsFlown={segmentsFlown}
          compact
        />
      </div>

      <nav className="flex-1 overflow-y-auto px-4 pb-4 space-y-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-[#F4F4F0]/25 px-2 mb-2">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`group flex items-center gap-3 px-2 py-2.5 border-l-2 font-mono text-[11px] tracking-[0.15em] uppercase transition-colors ${
                        active
                          ? 'border-lime bg-[#111111] text-lime'
                          : 'border-transparent text-[#F4F4F0]/55 hover:border-[#3a3a3a] hover:bg-[#0d0d0d] hover:text-[#F4F4F0]'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-[#242424] p-4 space-y-3">
        <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[#F4F4F0]/25">
          Atlas · Demo mode
        </p>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="flex w-full items-center gap-2 font-mono text-[11px] tracking-[0.2em] uppercase text-[#F4F4F0]/55 hover:text-red-400 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </div>
  );

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#000000] flex items-center justify-center">
        <div className="w-14 h-14 rounded-full border-2 border-dashed border-lime animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#000000] text-[#F4F4F0]">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-[260px] border-r border-[#242424] bg-[#050505] z-20">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <button
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <aside className="absolute inset-y-0 left-0 w-[260px] border-r border-[#242424] bg-[#050505]">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-[260px]">
        <header className="border-b border-[#242424] sticky top-0 z-30 bg-[#000000]/90 backdrop-blur">
          <div className="px-6 md:px-10 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <button
                onClick={() => setDrawerOpen(true)}
                aria-label="Open navigation"
                className="lg:hidden p-2 -ml-2 text-[#F4F4F0]/60 hover:text-lime transition-colors"
              >
                {drawerOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
              <Link
                href="/"
                className="lg:hidden font-display font-bold text-lg tracking-tight"
              >
                PATHFINDER<span className="text-lime">.</span>
              </Link>
              <p className="hidden lg:block font-mono text-[10px] tracking-[0.3em] uppercase text-[#F4F4F0]/35 truncate">
                {activeGroup && activeItem
                  ? `${activeGroup.title} / ${activeItem.label}`
                  : eyebrow}
              </p>
            </div>

            <div className="flex items-center gap-5 shrink-0">
              <span className="hidden md:inline font-mono text-xs tracking-[0.2em] text-[#F4F4F0]/50">
                LOCAL {clock}
              </span>
              <NotificationBell />
            </div>
          </div>
        </header>

        <main className="px-6 md:px-10 py-10 max-w-6xl mx-auto">
          <div className="flex flex-wrap items-end justify-between gap-6 mb-10">
            <div>
              <p className="font-mono text-xs tracking-[0.35em] text-lime uppercase mb-2">
                {eyebrow}
              </p>
              <h1 className="font-display font-bold text-4xl md:text-6xl tracking-tighter">
                {title}
              </h1>
            </div>
            {action}
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
