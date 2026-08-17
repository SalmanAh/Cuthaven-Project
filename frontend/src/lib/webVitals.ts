import { onCLS, onFCP, onINP, onLCP, onTTFB, Metric } from "web-vitals";

/**
 * Web Vitals monitoring for performance tracking
 * Tracks Core Web Vitals and sends to analytics
 */

function sendToAnalytics(metric: Metric) {
  // Log to console in development
  if (import.meta.env.DEV) {
    console.log("[Web Vitals]", metric.name, metric.value, metric.rating);
  }

  // Send to your analytics endpoint
  // Example: Google Analytics 4
  if (typeof window !== "undefined" && "gtag" in window) {
    (window as any).gtag("event", metric.name, {
      value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value),
      metric_id: metric.id,
      metric_value: metric.value,
      metric_delta: metric.delta,
      metric_rating: metric.rating,
    });
  }

  // Or send to your own analytics API
  // fetch('/api/analytics/web-vitals', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     name: metric.name,
  //     value: metric.value,
  //     rating: metric.rating,
  //     id: metric.id,
  //     delta: metric.delta,
  //   }),
  // });
}

/**
 * Initialize web vitals tracking
 * Call this in your app entry point
 */
export function initWebVitals() {
  // Core Web Vitals (FID is deprecated, replaced by INP)
  onCLS(sendToAnalytics); // Cumulative Layout Shift
  onINP(sendToAnalytics); // Interaction to Next Paint (replaces FID)
  onLCP(sendToAnalytics); // Largest Contentful Paint

  // Additional metrics
  onFCP(sendToAnalytics); // First Contentful Paint
  onTTFB(sendToAnalytics); // Time to First Byte
}

/**
 * Performance marks for custom measurements
 */
export function markPerformance(name: string) {
  if (typeof window !== "undefined" && "performance" in window) {
    performance.mark(name);
  }
}

export function measurePerformance(name: string, startMark: string, endMark?: string) {
  if (typeof window !== "undefined" && "performance" in window) {
    try {
      const measure = endMark
        ? performance.measure(name, startMark, endMark)
        : performance.measure(name, startMark);

      if (import.meta.env.DEV) {
        console.log("[Performance]", name, measure.duration.toFixed(2), "ms");
      }

      return measure.duration;
    } catch (error) {
      console.error("Performance measurement failed:", error);
    }
  }
}
