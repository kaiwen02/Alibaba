interface MarqueeProps {
  items: string[];
  reverse?: boolean;
  className?: string;
}

export default function Marquee({ items, reverse = false, className = '' }: MarqueeProps) {
  const content = items.join(' — ') + ' — ';
  const parts = content.split('—');

  return (
    <div className={`relative overflow-hidden border-y border-[#242424] bg-black py-5 ${className}`}>
      <div className={`marquee-track flex whitespace-nowrap ${reverse ? 'marquee-reverse' : ''}`}>
        {[0, 1].map((copy) => (
          <span
            key={copy}
            aria-hidden={copy === 1}
            className="font-display font-bold uppercase tracking-tight text-2xl md:text-4xl text-[#F4F4F0] flex-shrink-0 pr-2"
          >
            {parts.map((item, i) => (
              <span key={i} className="inline-flex items-center">
                <span className={i % 2 === 1 ? 'text-lime' : ''}>{item.trim()}</span>
                {i < parts.length - 1 && (
                  <span className="mx-6 text-lime">✈</span>
                )}
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}
