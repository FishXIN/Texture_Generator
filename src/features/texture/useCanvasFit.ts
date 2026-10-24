import { useEffect, useMemo, useRef, useState } from 'react';

export function useCanvasFit(width?: number, height?: number) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const target = containerRef.current;
    if (!target) return;

    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = entry.contentRect.width;
      const nextHeight = entry.contentRect.height;
      setContainerSize({ width: nextWidth, height: nextHeight });
    });

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const fitted = useMemo(() => {
    if (!width || !height || !containerSize.width || !containerSize.height) {
      return { scale: 1, displayWidth: 0, displayHeight: 0 };
    }

    const padding = 24;
    const usableWidth = Math.max(containerSize.width - padding * 2, 1);
    const usableHeight = Math.max(containerSize.height - padding * 2, 1);
    const scale = Math.min(usableWidth / width, usableHeight / height);

    return {
      scale,
      displayWidth: Math.max(1, Math.round(width * scale)),
      displayHeight: Math.max(1, Math.round(height * scale)),
    };
  }, [containerSize.height, containerSize.width, height, width]);

  return {
    containerRef,
    ...fitted,
  };
}
