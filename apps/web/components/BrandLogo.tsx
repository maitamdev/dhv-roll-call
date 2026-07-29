import Image from 'next/image';
import { cn } from '@/lib/utils';

export default function BrandLogo({
  compact = false,
  inverse = false,
  className,
}: {
  compact?: boolean;
  inverse?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <Image
        src="/brand/dhv-link-mark.svg"
        alt=""
        width={44}
        height={44}
        priority
        className="h-11 w-11 shrink-0 rounded-[11px] shadow-[0_8px_22px_rgba(16,35,63,.2)]"
      />
      {!compact && (
        <span className="leading-none">
          <span className={cn('block text-[15px] font-extrabold tracking-[-0.035em]', inverse ? 'text-white' : 'text-primary')}>
            DHV <span className="text-secondary">Tap</span>Attend
          </span>
          <span className={cn('mt-1.5 block text-[8px] font-bold uppercase tracking-[0.22em]', inverse ? 'text-slate-400' : 'text-slate-500')}>
            Attendance OS
          </span>
        </span>
      )}
    </span>
  );
}
