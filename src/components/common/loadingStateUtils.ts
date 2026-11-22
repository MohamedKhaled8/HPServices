export type LoadingVariant = 'Drive' | 'Dots' | 'Orbit';

export interface PixelCellConfig {
  delayMs: number;
  cycleMs: number;
  isStaticDim: boolean;
  opacity?: number;
}

export const ORBIT_PERIMETER_ORDER = [0, 1, 2, 5, 8, 7, 6, 3];

export function computePixelCell(variant: LoadingVariant, index: number): PixelCellConfig {
  if (variant === 'Orbit') {
    if (index === 4) {
      return {
        delayMs: 0,
        cycleMs: 950,
        isStaticDim: true,
        opacity: 0.07,
      };
    }
    const orderIndex = ORBIT_PERIMETER_ORDER.indexOf(index);
    const k = orderIndex >= 0 ? orderIndex : 0;
    return {
      delayMs: k * 110,
      cycleMs: 950,
      isStaticDim: false,
    };
  }

  // Drive & Dots: chevron wavefront delays
  const r = Math.floor(index / 3);
  const c = index % 3;
  const delayMs = (c + Math.abs(r - 1)) * 90;
  return {
    delayMs,
    cycleMs: 650,
    isStaticDim: false,
  };
}

export function formatElapsedTime(elapsedMs: number): string {
  if (elapsedMs < 60000) {
    return `${(elapsedMs / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(elapsedMs / 60000);
  const remainingSec = (elapsedMs % 60000) / 1000;
  return `${minutes}m ${remainingSec.toFixed(1)}s`;
}
