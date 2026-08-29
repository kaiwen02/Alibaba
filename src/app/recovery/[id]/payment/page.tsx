'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  LockKeyhole,
  Loader2,
  Plane,
  ShieldCheck,
} from 'lucide-react';

interface RecoveryData {
  recoveryCase: {
    id: string;
    status: string;
    changeType: string;
    severity: string;
  };
  packages: Array<{
    id: string;
    type: string;
    price: string;
    currency: string;
    journeyTime: number;
    segments: any[];
  }>;
  booking: {
    id: string;
    pnr: string;
    passengerName: string;
    segments: Array<{
      origin: string;
      destination: string;
      departureAt: string;
      arrivalAt: string;
      flightNo: string;
      airline: string;
    }>;
  };
}

type CheckoutResult = {
  success?: boolean;
  ticketing?: { pnr?: string; ticketNumber?: string };
  priceChanged?: boolean;
  newPrice?: number;
  error?: string;
};

function formatMoney(value: string | number | undefined, currency = 'USD') {
  const amount = typeof value === 'number' ? value : Number(value || 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

function formatCardNumber(value: string) {
  return value
    .replace(/\D/g, '')
    .slice(0, 16)
    .replace(/(.{4})/g, '$1 ')
    .trim();
}

function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)} / ${digits.slice(2)}`;
}

export default function DemoPaymentPage() {
  const params = useParams();
  const router = useRouter();
  const recoveryId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [packageId, setPackageId] = useState<string | null>(null);
  const [data, setData] = useState<RecoveryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');
  const [expiry, setExpiry] = useState('12 / 30');
  const [cvc, setCvc] = useState('123');
  const [name, setName] = useState('Demo Traveler');
  const [zip, setZip] = useState('10001');
  const [accepted, setAccepted] = useState(true);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setPackageId(query.get('packageId'));
  }, []);

  useEffect(() => {
    if (!recoveryId) return;

    const fetchRecovery = async () => {
      try {
        const res = await fetch(`/api/recoveries/${recoveryId}`);
        const recovery = await res.json();
        setData(recovery);
      } catch (error) {
        console.error('Failed to fetch recovery for payment:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecovery();
  }, [recoveryId]);

  const selectedPackage = useMemo(
    () => data?.packages.find((pkg) => pkg.id === packageId),
    [data, packageId]
  );

  const routeSummary = useMemo(() => {
    const segment = selectedPackage?.segments?.[0] || data?.booking.segments?.[0];
    if (!segment) return 'Replacement itinerary';
    return `${segment.origin} → ${segment.destination}`;
  }, [data, selectedPackage]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const digits = cardNumber.replace(/\D/g, '');
    const expiryDigits = expiry.replace(/\D/g, '');

    if (!selectedPackage || !packageId) {
      setFormError('Choose a recovery package before paying.');
      return;
    }

    if (digits.length !== 16 || expiryDigits.length !== 4 || cvc.length < 3 || !name.trim()) {
      setFormError('Enter the demo card number, expiry, CVC, and cardholder name.');
      return;
    }

    if (!accepted) {
      setFormError('Accept the demo payment authorization to continue.');
      return;
    }

    setProcessing(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 650));

      const res = await fetch(`/api/recoveries/${recoveryId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId,
          demoPayment: {
            provider: 'stripe-style-demo',
            cardLast4: digits.slice(-4),
          },
        }),
      });

      const approvalResult = await res.json();
      setResult(approvalResult);

      if (!approvalResult.success) {
        setFormError(approvalResult.error || 'Payment authorization failed.');
      }
    } catch (error) {
      console.error('Demo checkout failed:', error);
      setFormError('Network error while confirming demo payment.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f7f9] flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#635bff]" />
      </div>
    );
  }

  if (!data || !packageId || !selectedPackage) {
    return (
      <div className="min-h-screen bg-[#f6f7f9] text-[#1f2937] flex items-center justify-center px-6">
        <div className="max-w-md rounded-2xl bg-white p-8 shadow-xl text-center">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold mb-2">Checkout unavailable</h1>
          <p className="text-sm text-gray-500 mb-6">
            The payment page needs a valid recovery package selection.
          </p>
          <Link
            href={`/recovery/${recoveryId}`}
            className="inline-flex items-center justify-center rounded-lg bg-[#635bff] px-5 py-3 text-sm font-semibold text-white hover:bg-[#4f46e5]"
          >
            Back to recovery options
          </Link>
        </div>
      </div>
    );
  }

  const subtotal = Number(selectedPackage.price || 0);
  const serviceFee = 0;
  const total = subtotal + serviceFee;
  const firstSegment = selectedPackage.segments?.[0] || data.booking.segments[0];

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-[#1f2937]">
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link
            href={`/recovery/${recoveryId}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-[#635bff]"
          >
            <ArrowLeft className="h-4 w-4" />
            Recovery options
          </Link>
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <LockKeyhole className="h-4 w-4 text-[#635bff]" />
            Demo checkout
          </div>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl lg:grid-cols-[1fr_1.05fr]">
        <section className="px-6 py-10 lg:border-r lg:border-gray-200 lg:py-16 lg:pr-14">
          <p className="mb-3 text-sm font-medium text-gray-500">Payment · Demo mode</p>
          <h1 className="mb-4 text-4xl font-semibold tracking-tight text-gray-950">
            {formatMoney(total, selectedPackage.currency)}
          </h1>
          <p className="mb-8 max-w-md text-sm leading-6 text-gray-500">
            This is a demo payment screen inspired by Stripe Checkout. No real card is charged;
            clicking the button simulates authorization before running the existing Atlas demo order → pay → ticket flow.
          </p>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#eef2ff] text-[#635bff]">
                <Plane className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="font-semibold text-gray-950">Air ticket rebooking</h2>
                  <span className="font-semibold text-gray-950">
                    {formatMoney(selectedPackage.price, selectedPackage.currency)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  {routeSummary} · {selectedPackage.type.replaceAll('_', ' ').toLowerCase()}
                </p>
              </div>
            </div>

            <div className="space-y-3 border-t border-gray-100 pt-5 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Passenger</span>
                <span className="text-gray-700">{data.booking.passengerName}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Original PNR</span>
                <span className="font-mono text-gray-700">{data.booking.pnr}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Flight</span>
                <span className="text-gray-700">{firstSegment?.flightNo || 'Pending'}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Demo processing fee</span>
                <span className="text-gray-700">{formatMoney(serviceFee, selectedPackage.currency)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-3 font-semibold text-gray-950">
                <span>Total due today</span>
                <span>{formatMoney(total, selectedPackage.currency)}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 py-10 lg:py-16 lg:pl-14">
          {result?.success ? (
            <div className="rounded-2xl bg-white p-8 shadow-xl">
              <CheckCircle2 className="mb-5 h-12 w-12 text-emerald-500" />
              <h2 className="mb-2 text-2xl font-semibold text-gray-950">Payment approved</h2>
              <p className="mb-6 text-sm leading-6 text-gray-500">
                Demo checkout authorized the fare and Pathfinder completed the rebooking.
                {result.ticketing?.pnr && ` New PNR: ${result.ticketing.pnr}.`}
              </p>
              {result.priceChanged && (
                <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  Atlas re-verified the fare at {formatMoney(result.newPrice, selectedPackage.currency)} before ticketing.
                </div>
              )}
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/dashboard"
                  className="inline-flex flex-1 items-center justify-center rounded-lg bg-[#635bff] px-5 py-3 text-sm font-semibold text-white hover:bg-[#4f46e5]"
                >
                  Back to flight board
                </Link>
                <Link
                  href={`/recovery/${recoveryId}`}
                  className="inline-flex flex-1 items-center justify-center rounded-lg border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  View recovery case
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 shadow-xl md:p-8">
              <div className="mb-7 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-950">Payment details</h2>
                  <p className="mt-1 text-sm text-gray-500">Use the prefilled demo card.</p>
                </div>
                <div className="rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-semibold text-[#635bff]">
                  DEMO
                </div>
              </div>

              <label className="mb-4 block">
                <span className="mb-2 block text-sm font-medium text-gray-700">Email</span>
                <input
                  type="email"
                  value="demo@pathfinder.dev"
                  readOnly
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm outline-none"
                />
              </label>

              <label className="mb-4 block">
                <span className="mb-2 block text-sm font-medium text-gray-700">Card information</span>
                <div className="overflow-hidden rounded-lg border border-gray-300 focus-within:border-[#635bff] focus-within:ring-2 focus-within:ring-[#635bff]/20">
                  <div className="relative">
                    <input
                      inputMode="numeric"
                      value={cardNumber}
                      onChange={(event) => setCardNumber(formatCardNumber(event.target.value))}
                      placeholder="1234 1234 1234 1234"
                      className="w-full border-0 px-4 py-3 pr-12 text-sm outline-none"
                    />
                    <CreditCard className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  </div>
                  <div className="grid grid-cols-2 border-t border-gray-300">
                    <input
                      inputMode="numeric"
                      value={expiry}
                      onChange={(event) => setExpiry(formatExpiry(event.target.value))}
                      placeholder="MM / YY"
                      className="border-0 border-r border-gray-300 px-4 py-3 text-sm outline-none"
                    />
                    <input
                      inputMode="numeric"
                      value={cvc}
                      onChange={(event) => setCvc(event.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="CVC"
                      className="border-0 px-4 py-3 text-sm outline-none"
                    />
                  </div>
                </div>
              </label>

              <label className="mb-4 block">
                <span className="mb-2 block text-sm font-medium text-gray-700">Name on card</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-[#635bff] focus:ring-2 focus:ring-[#635bff]/20"
                />
              </label>

              <label className="mb-5 block">
                <span className="mb-2 block text-sm font-medium text-gray-700">ZIP or postal code</span>
                <input
                  value={zip}
                  onChange={(event) => setZip(event.target.value.slice(0, 12))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-[#635bff] focus:ring-2 focus:ring-[#635bff]/20"
                />
              </label>

              <label className="mb-5 flex items-start gap-3 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(event) => setAccepted(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-[#635bff]"
                />
                <span>
                  Simulate this demo payment and proceed with Atlas order, pay, and ticketing. No real
                  card network transaction will occur.
                </span>
              </label>

              {formError && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={processing}
                className="flex w-full items-center justify-center gap-3 rounded-lg bg-[#635bff] px-5 py-3.5 text-sm font-semibold text-white hover:bg-[#4f46e5] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Simulating payment → booking → ticketing…
                  </>
                ) : (
                  <>Simulate payment and rebook</>
                )}
              </button>

              <div className="mt-5 flex items-center gap-2 text-xs text-gray-500">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Demo checkout · Card 4242 4242 4242 4242
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
