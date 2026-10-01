'use client';

import { gsap } from 'gsap';
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react';

export interface LoginTransitionHandle {
  playCover: () => Promise<void>;
}

interface LoginTransitionOverlayProps {
  colors?: string[];
}

const DEFAULT_COLORS = ['#06b6d4', '#0e7490', '#080a0f'];

export const LoginTransitionOverlay = forwardRef<LoginTransitionHandle, LoginTransitionOverlayProps>(
  function LoginTransitionOverlay({ colors = DEFAULT_COLORS }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const layersRef = useRef<HTMLDivElement>(null);
    const busyRef = useRef(false);

    useLayoutEffect(() => {
      const ctx = gsap.context(() => {
        const container = containerRef.current;
        const preContainer = layersRef.current;
        if (!container || !preContainer) return;

        const layers = Array.from(
          preContainer.querySelectorAll('.lt-prelayer'),
        ) as HTMLElement[];
        // Offscreen à direita, invisível até GSAP posicionar (evita flicker).
        gsap.set([container, ...layers], { xPercent: 100, opacity: 0 });
        gsap.set(preContainer, { xPercent: 0, opacity: 1 });
        gsap.set(layers, { xPercent: 100, opacity: 1 });
        gsap.set(container, { xPercent: 0, opacity: 1, pointerEvents: 'none' });
      });
      return () => ctx.revert();
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        playCover: () => {
          const preContainer = layersRef.current;
          const container = containerRef.current;
          if (!preContainer || !container) return Promise.resolve();
          if (busyRef.current) return Promise.resolve();
          if (
            typeof window !== 'undefined' &&
            window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
          ) {
            return Promise.resolve();
          }

          busyRef.current = true;
          const layers = Array.from(
            preContainer.querySelectorAll('.lt-prelayer'),
          ) as HTMLElement[];

          return new Promise<void>((resolve) => {
            const tl = gsap.timeline({
              paused: true,
              onComplete: () => {
                busyRef.current = false;
                resolve();
              },
              onInterrupt: () => {
                busyRef.current = false;
                resolve();
              },
            });

            gsap.set(container, { pointerEvents: 'auto' });

            // Mesmo easing/stagger do Staggered Menu (React Bits).
            layers.forEach((el, i) => {
              tl.fromTo(
                el,
                { xPercent: 100 },
                { xPercent: 0, duration: 0.5, ease: 'power4.out' },
                i * 0.07,
              );
            });

            tl.play(0);
          });
        },
      }),
      [],
    );

    return (
      <div
        ref={containerRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[100] overflow-hidden opacity-0"
      >
        <div ref={layersRef} className="absolute inset-0">
          {colors.map((color) => (
            <div
              key={color}
              className="lt-prelayer absolute inset-0 will-change-transform"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
    );
  },
);
