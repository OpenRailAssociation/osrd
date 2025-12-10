import { useEffect, useState } from 'react';

export function useDevicePixelRatio() {
  const [ratio, setRatio] = useState(window.devicePixelRatio || 1);

  useEffect(() => {
    if (!window.matchMedia || !window.devicePixelRatio) {
      return undefined;
    }

    const handleChange = () => {
      setRatio(window.devicePixelRatio);
    };

    const mediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [ratio]);

  return ratio;
}
