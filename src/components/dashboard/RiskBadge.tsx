'use client';

import { getRiskLevel, getRiskColor } from '@/lib/services/risk-scoring';

interface RiskBadgeProps {
  score: number;
  size?: 'sm' | 'md';
}

export default function RiskBadge({ score, size = 'md' }: RiskBadgeProps) {
  const level = getRiskLevel(score);
  const color = getRiskColor(score);
  const percentage = Math.round(score * 100);

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  const colorClasses: Record<string, string> = {
    green: 'border-lime/40 text-lime',
    yellow: 'border-yellow-400/40 text-yellow-400',
    orange: 'border-orange-400/40 text-orange-400',
    red: 'border-red-400/40 text-red-400',
  };

  if (score === 0) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 ${sizeClasses[size]} border border-[#242424] text-[#F4F4F0]/35 font-mono tracking-[0.15em] uppercase`}
      >
        NO DATA
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${sizeClasses[size]} border font-mono tracking-[0.15em] uppercase ${colorClasses[color]}`}
    >
      {level} {percentage}%
    </span>
  );
}
