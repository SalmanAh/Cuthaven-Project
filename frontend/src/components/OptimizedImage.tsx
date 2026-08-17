import { ImgHTMLAttributes, useState } from "react";

interface OptimizedImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  className?: string;
}

/**
 * OptimizedImage component with lazy loading and blur placeholder
 * Improves LCP and reduces bandwidth usage
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
  className = "",
  ...props
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        onLoad={() => setIsLoaded(true)}
        className={`transition-opacity duration-300 ${isLoaded ? "opacity-100" : "opacity-0"}`}
        {...props}
      />
      {!isLoaded && <div className="absolute inset-0 bg-muted animate-pulse" aria-hidden="true" />}
    </div>
  );
}
