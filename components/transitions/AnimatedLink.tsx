"use client";

import React, { ReactNode, forwardRef, useEffect, useRef, useCallback } from 'react';
import Link, { LinkProps } from 'next/link';
import { useRouter } from 'next/navigation'; // Corrected import for App Router
import { usePageTransition } from './PageTransitionProvider';

interface AnimatedLinkProps extends Omit<LinkProps, 'onClick' | 'prefetch'> { // Omit LinkProps' onClick and prefetch
  children: ReactNode;
  className?: string;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void; // Define our own onClick
  target?: React.HTMLAttributeAnchorTarget; // Explicitly add target
  rel?: string; // Explicitly add rel
  priority?: boolean; // New prop for high-priority prefetching
  prefetchOnHover?: boolean; // New prop for hover-based prefetching, defaults to false
  prefetchOnIntersect?: boolean; // New prop for intersection-based prefetching, defaults to false
}

// eslint-disable-next-line react/display-name
export const AnimatedLink = forwardRef<HTMLAnchorElement, AnimatedLinkProps>(
  (props, ref) => {
    const {
      children,
      href,
      className,
      onClick,
      target,
      rel,
      priority,
      prefetchOnHover = false,
      prefetchOnIntersect = false,
      ...otherProps // These are other LinkProps like scroll, replace, locale etc.
    } = props;

    const router = useRouter();
    const { setTransitioning, isTransitioning } = usePageTransition();

    const internalLinkRef = useRef<HTMLAnchorElement>(null);
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const hasPrefetchedOnIntersectRef = useRef(false);
    const isTransitioningPage = useRef(isTransitioning);

    useEffect(() => {
        isTransitioningPage.current = isTransitioning;
    }, [isTransitioning]);

    const combinedRef = useCallback(
      (node: HTMLAnchorElement | null) => {
        // Assign to internal ref
        (internalLinkRef as React.MutableRefObject<HTMLAnchorElement | null>).current = node;
        // Assign to forwarded ref
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLAnchorElement | null>).current = node;
        }
      },
      [ref]
    );

    const handleAnimatedClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (onClick) {
        onClick(e);
      }
      if (e.defaultPrevented || isTransitioningPage.current || (typeof href === 'string' && href.startsWith('#'))) {
        if (isTransitioningPage.current && !(typeof href === 'string' && href.startsWith('#'))) {
            e.preventDefault();
        }
        return;
      }
      e.preventDefault();
      setTransitioning(true);
      setTimeout(() => {
        if (href) router.push(href.toString());
      }, 50);
    };

    // Hover Prefetching
    const handleMouseEnter = () => {
      if (prefetchOnHover && href && !isTransitioningPage.current) {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = setTimeout(() => {
          if (href) router.prefetch(href.toString());
        }, 200);
      }
    };

    const handleMouseLeave = () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
    };

    // Intersection Prefetching & Cleanup
    useEffect(() => {
      let observer: IntersectionObserver | null = null;
      const currentLinkElement = internalLinkRef.current;

      if (prefetchOnIntersect && href && currentLinkElement && !hasPrefetchedOnIntersectRef.current) {
        observer = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting && !isTransitioningPage.current) {
              if (href) router.prefetch(href.toString());
              hasPrefetchedOnIntersectRef.current = true;
              if (observer) observer.disconnect(); // Disconnect current observer instance
            }
          },
          { rootMargin: '200px' } // Optional: Adjust threshold
        );
        observer.observe(currentLinkElement);
      }

      return () => {
        if (observer) {
          observer.disconnect();
        }
        // Cleanup hover timeout on unmount or if dependencies change leading to re-run
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
          hoverTimeoutRef.current = null;
        }
      };
    }, [href, prefetchOnIntersect, router]); // isTransitioningPage is a ref, not needed in deps

    // Determine the prefetch prop for the Next.js Link component
    // If manual prefetching (hover or intersect) is enabled, disable Next.js Link's own prefetching.
    // Otherwise, Next.js Link will use its default (prefetch={true}).
    const nextLinkActualPrefetch = (prefetchOnHover || prefetchOnIntersect) ? false : undefined;

    return (
      <Link
        href={href}
        onClick={handleAnimatedClick}
        className={className}
        target={target}
        rel={rel}
        ref={combinedRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        prefetch={nextLinkActualPrefetch} // Controlled prefetch prop
        // @ts-expect-error TS(2322) - The 'priority' prop is valid for next/link but may not be in the current LinkProps type definition.
        priority={priority} // Forward priority prop
        {...otherProps} // Spread other LinkProps
      >
        {children}
      </Link>
    );
  }
);