import { ICON_MAP, FALLBACK_ICON } from '@/lib/icons';
import { cn } from '@/lib/utils';

/**
 * A category/goal/account icon on its own tinted disc. The colour comes from
 * user data, so it is applied inline rather than through a class.
 */
export function IconBadge({
  icon,
  color,
  size = 'md',
  className,
}: {
  icon: string | null | undefined;
  color: string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  // Indexed, not constructed: these are module-level components.
  const Icon = ICON_MAP[icon ?? ''] ?? FALLBACK_ICON;
  const tint = color ?? '#71717A';

  const box = size === 'sm' ? 'size-8' : size === 'lg' ? 'size-12' : 'size-10';
  const glyph = size === 'sm' ? 'size-4' : size === 'lg' ? 'size-6' : 'size-5';

  return (
    <span
      className={cn('flex shrink-0 items-center justify-center rounded-xl', box, className)}
      style={{ backgroundColor: `${tint}1f`, color: tint }}
    >
      <Icon className={glyph} strokeWidth={2} aria-hidden />
    </span>
  );
}
