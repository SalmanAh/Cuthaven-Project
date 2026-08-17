/**
 * SEO and meta tags utilities
 * Improves search engine visibility and social sharing
 */

export interface MetaTags {
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
  ogType?: "website" | "article" | "product";
  canonicalUrl?: string;
  noindex?: boolean;
}

/**
 * Generate meta tags for a page
 * Usage: Call this in route loaders or components
 */
export function generateMetaTags(meta: MetaTags) {
  const siteName = "CutHaven";
  const siteUrl = "https://www.cuthaven.com";

  const tags = {
    title: `${meta.title} | ${siteName}`,
    description: meta.description,
    keywords: meta.keywords || "lawn mower, garden tools, outdoor equipment",

    // Open Graph
    "og:title": meta.title,
    "og:description": meta.description,
    "og:image": meta.ogImage || `${siteUrl}/images/og-default.jpg`,
    "og:type": meta.ogType || "website",
    "og:site_name": siteName,
    "og:url": meta.canonicalUrl || siteUrl,

    // Twitter Card
    "twitter:card": "summary_large_image",
    "twitter:title": meta.title,
    "twitter:description": meta.description,
    "twitter:image": meta.ogImage || `${siteUrl}/images/og-default.jpg`,

    // Additional
    robots: meta.noindex ? "noindex, nofollow" : "index, follow",
    canonical: meta.canonicalUrl,
  };

  return tags;
}

/**
 * Generate structured data (JSON-LD) for products
 */
export function generateProductSchema(product: {
  name: string;
  description: string;
  image: string;
  price: number;
  currency: string;
  brand?: string;
  sku?: string;
  availability?: "InStock" | "OutOfStock" | "PreOrder";
  rating?: { value: number; count: number };
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.image,
    brand: {
      "@type": "Brand",
      name: product.brand || "CutHaven",
    },
    sku: product.sku,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: product.currency,
      availability: `https://schema.org/${product.availability || "InStock"}`,
      url: typeof window !== "undefined" ? window.location.href : "",
    },
    ...(product.rating && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: product.rating.value,
        reviewCount: product.rating.count,
      },
    }),
  };
}

/**
 * Generate breadcrumb structured data
 */
export function generateBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
