import { lazy, type ComponentType, Suspense, type ReactNode } from "react";

interface LazyLoadOptions {
  fallback?: ReactNode;
  delay?: number;
}

/**
 * Lazy load a component with optional delay and fallback
 * Improves initial bundle size by code-splitting components
 *
 * @example
 * const LazyCheckout = lazyLoad(() => import('./CheckoutForm'))
 */
export function lazyLoad<Props extends object>(
  importFunc: () => Promise<{ default: ComponentType<Props> }>,
  options: LazyLoadOptions = {},
) {
  const { fallback = <LoadingFallback />, delay = 0 } = options;

  // Add artificial delay if specified (useful for preventing flash of loading state)
  const delayedImport =
    delay > 0
      ? () =>
          new Promise<{ default: ComponentType<Props> }>((resolve) => {
            setTimeout(() => importFunc().then(resolve), delay);
          })
      : importFunc;

  const LazyComponent = lazy(delayedImport);

  return function LazyLoadedComponent(props: Props) {
    return (
      <Suspense fallback={fallback}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

/**
 * Default loading fallback component
 */
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

/**
 * Preload a lazy component
 * Call this on hover or other user interactions to improve perceived performance
 */
export function preloadComponent<Result>(importFunc: () => Promise<Result>): Promise<Result> {
  return importFunc();
}
