import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => window.matchMedia(query).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

export function useBreakpoint() {
  const isWide = useMediaQuery('(min-width: 1200px)');
  const isMedium = useMediaQuery('(min-width: 960px) and (max-width: 1199px)');
  const isNarrow = useMediaQuery('(max-width: 959px)');

  return { isWide, isMedium, isNarrow };
}
