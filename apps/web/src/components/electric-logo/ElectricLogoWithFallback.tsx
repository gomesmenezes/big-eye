'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

import ElectricLogo, { type ElectricLogoProps } from './ElectricLogo';

interface ElectricLogoWithFallbackProps extends ElectricLogoProps {
  fallbackSrc?: string;
  fallbackAlt?: string;
  fallbackWidth?: number;
  fallbackHeight?: number;
}

function hasWebGL2(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

export default function ElectricLogoWithFallback({
  src = '/logo-icon.png',
  fallbackSrc,
  fallbackAlt = 'Big Eye Logo',
  fallbackWidth = 160,
  fallbackHeight = 140,
  className,
  ...props
}: ElectricLogoWithFallbackProps) {
  const [canRenderGL, setCanRenderGL] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    setCanRenderGL(!reduced && hasWebGL2());
  }, []);

  if (!canRenderGL) {
    return (
      <Image
        alt={fallbackAlt}
        className="h-28 w-auto object-contain drop-shadow-[0_0_25px_rgba(6,182,212,0.35)]"
        data-testid="electric-logo-fallback"
        height={fallbackHeight}
        priority
        src={fallbackSrc ?? src}
        width={fallbackWidth}
      />
    );
  }

  return (
    <div data-testid="electric-logo" style={{ width: '100%', height: '100%' }}>
      <ElectricLogo className={className} src={src} {...props} />
    </div>
  );
}
