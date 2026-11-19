import { useEffect, useRef } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

export interface UseLenisOptions {
  duration?: number;
  smoothWheel?: boolean;
  wheelMultiplier?: number;
  touchMultiplier?: number;
  preventOnModals?: boolean;
}

export function useLenis(options: UseLenisOptions = {}) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    // Respect user accessibility preference for reduced motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      return;
    }

    const {
      duration = 1.2,
      smoothWheel = true,
      wheelMultiplier = 1.0,
      touchMultiplier = 1.5,
    } = options;

    const isExcludedTarget = (node: HTMLElement): boolean => {
      if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        if (path.startsWith('/admin') || path.startsWith('/telemetry')) {
          return true;
        }
      }

      if (!node || typeof node.closest !== 'function') {
        return false;
      }

      return Boolean(
        node.hasAttribute?.('data-lenis-prevent') ||
        node.closest?.('[data-lenis-prevent]') ||
        node.closest?.('.admin-dashboard-page') ||
        node.closest?.('.admin-shell') ||
        node.closest?.('.admin-main-wrapper') ||
        node.closest?.('.admin-main') ||
        node.closest?.('.admin-sidebar') ||
        node.closest?.('.assignments-management-page') ||
        node.closest?.('.tel-shell') ||
        node.closest?.('.telemetry-dashboard') ||
        node.closest?.('.modal-overlay') ||
        node.closest?.('.request-modal-overlay') ||
        node.closest?.('.tier-modal') ||
        node.closest?.('.delete-confirm-modal') ||
        node.closest?.('.recall-modal') ||
        node.closest?.('[role="dialog"]')
      );
    };

    const lenis = new Lenis({
      duration,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel,
      wheelMultiplier,
      touchMultiplier,
      infinite: false,
      allowNestedScroll: true,
      autoToggle: true,
      prevent: isExcludedTarget,
    });

    lenisRef.current = lenis;

    // Expose instance on window for modal scroll-lock and programmatic jumps
    if (typeof window !== 'undefined') {
      (window as any).__lenis = lenis;
    }

    let rafId: number;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      lenisRef.current = null;
      if (typeof window !== 'undefined' && (window as any).__lenis === lenis) {
        delete (window as any).__lenis;
      }
    };
  }, [options.duration, options.smoothWheel, options.wheelMultiplier, options.touchMultiplier]);

  return lenisRef;
}

