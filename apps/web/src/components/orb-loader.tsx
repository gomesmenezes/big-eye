import { ThinkingOrb, type OrbSize, type OrbState, type OrbTheme } from 'thinking-orbs';

export interface OrbLoaderProps {
  /**
   * The animation state for the thinking orb.
   * Defaults to 'working'.
   */
  state?: OrbState;
  /**
   * Size of the orb (20 for inline/buttons, 32 compact, 64 large).
   * Defaults to 20 for inline button loader.
   */
  size?: OrbSize;
  /**
   * Theme mode ('auto' | 'dark' | 'light').
   */
  theme?: OrbTheme;
  /**
   * Custom ink tint color (hex or rgb).
   */
  color?: string;
  /**
   * Speed multiplier.
   */
  speed?: number;
  /**
   * Additional CSS classes.
   */
  className?: string;
}

/**
 * Reusable inline ThinkingOrb loader designed for buttons and loading indicators.
 */
export function OrbLoader({
  state = 'working',
  size = 20,
  theme,
  color = '#ffffff',
  speed,
  className = '',
}: OrbLoaderProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
    >
      <span aria-hidden="true" className="inline-flex items-center justify-center">
        <ThinkingOrb
          color={color}
          size={size}
          speed={speed}
          state={state}
          theme={theme}
        />
      </span>
      <span className="sr-only">Carregando...</span>
    </span>
  );
}
