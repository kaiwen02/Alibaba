'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { label: 'The Problem', href: '#problem' },
  { label: 'The Protocol', href: '#protocol' },
  { label: 'Network', href: '#network' },
  { label: 'Ops Console', href: '/admin' },
];

interface NavbarProps {
  visible: boolean;
}

export default function Navbar({ visible }: NavbarProps) {
  const { data: session } = useSession();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-[60] transition-all duration-700 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
      } ${
        scrolled
          ? 'bg-[#000000]/80 backdrop-blur-md border-b border-[#242424]'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="px-6 md:px-10 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="font-display font-bold text-xl tracking-tight text-[#F4F4F0]">
          PATHFINDER<span className="text-lime">.</span>
        </Link>

        {/* Center links — desktop */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="font-mono text-[11px] tracking-[0.25em] uppercase text-[#F4F4F0]/60 hover:text-lime transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right CTAs — desktop */}
        <div className="hidden md:flex items-center gap-3">
          {session ? (
            <Link
              href="/dashboard"
              className="font-mono text-[11px] font-bold tracking-[0.2em] uppercase bg-lime text-[#000000] px-5 py-2.5 hover:bg-[#F4F4F0] transition-colors"
            >
              Flight Board →
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#F4F4F0]/70 hover:text-lime transition-colors px-4 py-2.5"
              >
                Log in
              </Link>
              <Link
                href="/login"
                className="font-mono text-[11px] font-bold tracking-[0.2em] uppercase bg-lime text-[#000000] px-5 py-2.5 hover:bg-[#F4F4F0] transition-colors"
              >
                Board the Demo
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-[#F4F4F0] p-2"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-[#000000]/95 backdrop-blur-md border-b border-[#242424] px-6 py-6 flex flex-col gap-5">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="font-mono text-xs tracking-[0.25em] uppercase text-[#F4F4F0]/70 hover:text-lime transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href={session ? '/dashboard' : '/login'}
            onClick={() => setMenuOpen(false)}
            className="font-mono text-xs font-bold tracking-[0.2em] uppercase bg-lime text-[#000000] px-5 py-3 text-center"
          >
            {session ? 'Flight Board →' : 'Log in / Board the Demo'}
          </Link>
        </div>
      )}
    </nav>
  );
}
