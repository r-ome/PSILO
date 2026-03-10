import { useEffect, useRef } from "react";

interface UseLoadMoreOptions {
  nextCursor: string | null;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  isOpen?: boolean;
}

export function useLoadMore({
  nextCursor,
  isLoadingMore,
  onLoadMore,
  scrollContainerRef,
  isOpen,
}: UseLoadMoreOptions) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    if (isOpen === false) return;

    let observer: IntersectionObserver | null = null;

    // Delay slightly to allow dialog open animations to complete before observing
    const timeoutId = setTimeout(() => {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && nextCursor && !isLoadingMore) {
            onLoadMore();
          }
        },
        {
          root: scrollContainerRef?.current ?? null,
          threshold: 0.1,
        },
      );
      observer.observe(el);
    }, 150);

    return () => {
      clearTimeout(timeoutId);
      observer?.disconnect();
    };
  }, [nextCursor, isLoadingMore, onLoadMore, isOpen]);

  return sentinelRef;
}
