'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plane, CheckCircle2, AlertTriangle } from 'lucide-react';
import PackageCard from '@/components/recovery/PackageCard';

interface RecoveryData {
  recoveryCase: {
    id: string;
    status: string;
    changeType: string;
    severity: string;
    activatedAt: string;
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
    atlasOrderId: string;
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

export default function RecoveryPage() {
  const params = useParams();
  const [data, setData] = useState<RecoveryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    fetchRecovery();
  }, [params.id]);

  const fetchRecovery = async () => {
    try {
      const res = await fetch(`/api/recoveries/${params.id}`);
      const data = await res.json();
      setData(data);
    } catch (error) {
      console.error('Failed to fetch recovery:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedPackageId) return;

    setApproving(true);
    try {
      const res = await fetch(`/api/recoveries/${params.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: selectedPackageId }),
      });
      const result = await res.json();
      setResult(result);

      if (result.success) {
        await fetchRecovery();
      }
    } catch (error) {
      console.error('Approval failed:', error);
      setResult({ success: false, error: 'Network error' });
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#000000] flex items-center justify-center">
        <div className="w-14 h-14 rounded-full border-2 border-dashed border-lime animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#000000] text-[#F4F4F0] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-[#242424] mx-auto mb-4" />
          <h2 className="font-display font-bold text-2xl mb-3">Recovery case not found</h2>
          <Link
            href="/dashboard"
            className="font-mono text-xs tracking-[0.25em] uppercase text-lime hover:text-[#F4F4F0]"
          >
            ← Back to Flight Board
          </Link>
        </div>
      </div>
    );
  }

  const segment = data.booking.segments[0];

  const severityStyle: Record<string, string> = {
    LOW: 'border-yellow-400/50 text-yellow-400',
    MEDIUM: 'border-orange-400/50 text-orange-400',
    HIGH: 'border-red-400/50 text-red-400',
    CRITICAL: 'border-red-500 text-red-500',
  };

  return (
    <div className="min-h-screen bg-[#000000] text-[#F4F4F0]">
      {/* Header */}
      <header className="border-b border-[#242424] sticky top-0 z-10 bg-[#000000]/90 backdrop-blur">
        <div className="px-6 md:px-10 h-16 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-mono text-xs tracking-[0.2em] uppercase text-[#F4F4F0]/60 hover:text-lime transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Flight Board
          </Link>
          <span className="font-display font-bold text-lg tracking-tight">
            PATHFINDER<span className="text-lime">.</span>
          </span>
        </div>
      </header>

      <main className="px-6 md:px-10 py-10 max-w-4xl mx-auto">
        {/* Disruption Banner */}
        <div className={`border-2 rounded-lg p-6 md:p-8 mb-8 ${severityStyle[data.recoveryCase.severity] || 'border-[#242424] text-[#F4F4F0]'}`}>
          <div className="flex items-start gap-5">
            <AlertTriangle className="h-9 w-9 flex-shrink-0" />
            <div>
              <p className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-70 mb-1">
                Disruption Alert · {data.recoveryCase.severity}
              </p>
              <h2 className="font-display font-bold text-2xl md:text-4xl tracking-tight mb-2">
                {data.recoveryCase.changeType === 'CANCELLED' && 'FLIGHT CANCELLED'}
                {data.recoveryCase.changeType === 'MATERIAL' && 'SIGNIFICANT SCHEDULE CHANGE'}
                {data.recoveryCase.changeType === 'MINOR' && 'MINOR SCHEDULE CHANGE'}
              </h2>
              <p className="font-mono text-xs opacity-70 tracking-wider">
                Detected {new Date(data.recoveryCase.activatedAt).toLocaleString()} · Case{' '}
                {data.recoveryCase.status.replace('_', ' ')}
              </p>
            </div>
          </div>
        </div>

        {/* Original Booking */}
        <div className="border border-[#242424] rounded-lg p-6 md:p-8 mb-8 bg-[#111111]">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#F4F4F0]/40 mb-4">
            Original Booking
          </p>
          <div className="flex items-center gap-6">
            <div>
              <p className="font-display font-bold text-3xl tracking-tight">{segment.origin}</p>
              <p className="font-mono text-xs text-[#F4F4F0]/50">{segment.airline}</p>
            </div>
            <Plane className="h-5 w-5 text-lime" />
            <div>
              <p className="font-display font-bold text-3xl tracking-tight">{segment.destination}</p>
              <p className="font-mono text-xs text-[#F4F4F0]/50">{segment.flightNo}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="font-mono text-xs text-[#F4F4F0]/50">
                {new Date(segment.departureAt).toLocaleDateString()}
              </p>
              <p className="font-mono text-xs text-[#F4F4F0]/50">PNR {data.booking.pnr}</p>
            </div>
          </div>
        </div>

        {/* Success Result */}
        {result?.success && (
          <div className="border border-lime/50 bg-lime/5 rounded-lg p-6 md:p-8 mb-8">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="h-7 w-7 text-lime flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-display font-bold text-xl text-lime mb-1">
                  Rebooking Successful
                </h3>
                <p className="font-mono text-sm text-[#F4F4F0]/70">
                  Your new flight has been confirmed and ticketed.
                  {result.ticketing?.pnr && ` New PNR: ${result.ticketing.pnr}`}
                </p>
                {result.priceChanged && (
                  <p className="font-mono text-xs text-[#F4F4F0]/50 mt-2">
                    Price updated to ${result.newPrice?.toFixed(2)} at time of booking.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Error Result */}
        {result?.error && !result.success && (
          <div className="border border-red-400/50 bg-red-400/5 rounded-lg p-6 md:p-8 mb-8">
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-7 w-7 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-display font-bold text-xl text-red-400 mb-1">
                  Rebooking Failed
                </h3>
                <p className="font-mono text-sm text-[#F4F4F0]/70">{result.error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Package Selection */}
        {data.recoveryCase.status === 'PACKAGES_READY' && !result && (
          <>
            <div className="mb-6">
              <p className="font-mono text-xs tracking-[0.35em] text-lime uppercase mb-2">
                Gate 03 · Approval
              </p>
              <h3 className="font-display font-bold text-3xl md:text-5xl tracking-tighter mb-3">
                CHOOSE YOUR NEW ROUTE.
              </h3>
              <p className="font-mono text-sm text-[#F4F4F0]/50">
                {data.packages.length} alternatives pre-positioned via Atlas. Price re-verified at
                approval — nothing books without your yes.
              </p>
            </div>

            <div className="grid gap-6 mb-8">
              {data.packages.map((pkg) => (
                <PackageCard
                  key={pkg.id}
                  package={pkg}
                  selected={selectedPackageId === pkg.id}
                  onSelect={() => setSelectedPackageId(pkg.id)}
                />
              ))}
            </div>

            {selectedPackageId && (
              <button
                onClick={handleApprove}
                disabled={approving}
                className="w-full py-5 bg-lime text-[#000000] font-mono font-bold text-sm tracking-[0.25em] uppercase hover:bg-[#F4F4F0] transition-colors disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {approving ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-[#000000] border-t-transparent animate-spin" />
                    Executing order → pay → ticket…
                  </>
                ) : (
                  <>Confirm & Rebook →</>
                )}
              </button>
            )}
          </>
        )}

        {/* Already processed states */}
        {data.recoveryCase.status === 'TICKETED' && !result && (
          <div className="border border-lime/50 rounded-lg p-10 text-center">
            <CheckCircle2 className="h-12 w-12 text-lime mx-auto mb-4" />
            <h3 className="font-display font-bold text-2xl mb-2">Rebooking Complete</h3>
            <p className="font-mono text-sm text-[#F4F4F0]/50">
              This recovery case has been successfully resolved.
            </p>
          </div>
        )}

        {data.recoveryCase.status === 'EXECUTING' && (
          <div className="border border-[#242424] rounded-lg p-10 text-center">
            <div className="w-12 h-12 rounded-full border-2 border-dashed border-lime animate-spin mx-auto mb-4" />
            <h3 className="font-display font-bold text-2xl mb-2">Processing Rebooking</h3>
            <p className="font-mono text-sm text-[#F4F4F0]/50">
              Your new flight is being booked and ticketed…
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
