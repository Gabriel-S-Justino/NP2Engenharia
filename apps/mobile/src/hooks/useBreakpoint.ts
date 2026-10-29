import { useWindowDimensions } from 'react-native';

import { breakpoints } from '@/theme/tokens';

export type Breakpoint = 'mobileNarrow' | 'mobileWide' | 'tablet' | 'desktop';

export function breakpointFor(width: number): Breakpoint {
  if (width >= breakpoints.desktop) return 'desktop';
  if (width >= breakpoints.tablet) return 'tablet';
  if (width >= breakpoints.mobileWide) return 'mobileWide';
  return 'mobileNarrow';
}

export function useBreakpoint() {
  const { width } = useWindowDimensions();
  const bp = breakpointFor(width);
  return {
    width,
    breakpoint: bp,
    isDesktop: bp === 'desktop',
    isTablet: bp === 'tablet',
    /** Sidebar fixa a partir do tablet; barra inferior em celulares. */
    hasSidebar: bp === 'desktop' || bp === 'tablet',
    isCompact: bp === 'mobileNarrow' || bp === 'mobileWide',
  };
}
