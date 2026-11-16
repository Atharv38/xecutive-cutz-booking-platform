import type { CSSProperties } from 'react';
import { motion, useReducedMotion, type MotionStyle, type Transition } from 'motion/react';

interface BorderBeamProps {
  /** The size of the border beam in pixels. */
  size?: number;
  /** The duration of one beam cycle in seconds. */
  duration?: number;
  /** The delay before animation starts in seconds. */
  delay?: number;
  /** Starting gradient color when not overridden via className. */
  colorFrom?: string;
  /** Ending gradient color when not overridden via className. */
  colorTo?: string;
  /** Additional motion transition overrides. */
  transition?: Transition;
  /** Additional Tailwind gradient or utility classes. */
  className?: string;
  /** Custom inline style for the beam element. */
  style?: CSSProperties;
  /** Reverse beam direction. */
  reverse?: boolean;
  /** Initial offset percentage along the border path (0 - 100). */
  initialOffset?: number;
  /** Border width in pixels. */
  borderWidth?: number;
}

export function BorderBeam({
  className = '',
  size = 180,
  delay = 0,
  duration = 6,
  colorFrom = '#E9B84B',
  colorTo = '#FFF1C1',
  transition,
  style,
  reverse = false,
  initialOffset = 0,
  borderWidth = 1.5,
}: BorderBeamProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return null;
  }

  const hasGradientOverride = /\b(from|via|to)-/.test(className);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 rounded-[inherit]"
      style={{
        padding: `${borderWidth}px`,
        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        WebkitMaskComposite: 'xor',
        mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        maskComposite: 'exclude',
      }}
    >
      <motion.div
        className={`absolute aspect-square bg-gradient-to-l ${
          hasGradientOverride ? '' : 'from-[var(--color-from)] via-[var(--color-to)] to-transparent'
        } ${className}`}
        style={
          {
            width: size,
            offsetPath: `rect(0 auto auto 0 round ${size}px)`,
            '--color-from': colorFrom,
            '--color-to': colorTo,
            ...style,
          } as MotionStyle
        }
        initial={{ offsetDistance: `${initialOffset}%` }}
        animate={{
          offsetDistance: reverse
            ? [`${100 - initialOffset}%`, `${-initialOffset}%`]
            : [`${initialOffset}%`, `${100 + initialOffset}%`],
        }}
        transition={{
          repeat: Infinity,
          ease: 'linear',
          duration,
          delay: -delay,
          ...transition,
        }}
      />
    </div>
  );
}
