import { useSyncExternalStore } from 'react';

const COMPACT_LAYOUT_QUERY = '(max-width: 760px)';

export function useCompactLayout(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) {
        return () => undefined;
      }

      const mediaQuery = window.matchMedia(COMPACT_LAYOUT_QUERY);
      const handleChange = (): void => {
        onStoreChange();
      };

      if ('addEventListener' in mediaQuery) {
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
      }

      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    },
    () => {
      if (typeof window === 'undefined' || !window.matchMedia) {
        return false;
      }

      return window.matchMedia(COMPACT_LAYOUT_QUERY).matches;
    },
    () => false,
  );
}
