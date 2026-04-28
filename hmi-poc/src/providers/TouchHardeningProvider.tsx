import { useEffect } from 'react';

export function TouchHardeningProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handler = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    document.addEventListener('touchmove', handler, { passive: false });
    return () => document.removeEventListener('touchmove', handler);
  }, []);

  return <>{children}</>;
}
