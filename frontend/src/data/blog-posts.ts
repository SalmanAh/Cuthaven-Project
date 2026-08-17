export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  readTime: string;
  image: string;
  author: string;
  content?: string;
}

export const blogPosts: BlogPost[] = [
  {
    id: "1",
    slug: "best-garden-tools-for-beginners",
    title: "The Best Garden Tools for Beginners in 2025",
    excerpt:
      "Starting your garden journey? We cover the essential tools every beginner needs to get started on the right foot.",
    category: "Gardening Tips",
    date: "June 15, 2025",
    readTime: "5 min read",
    image: "https://placehold.co/1200x700/2D6A4F/FAFAF7?text=Garden+Tools+Guide",
    author: "CutHaven Team",
    content:
      "Starting a garden is one of the most rewarding hobbies you can pick up. But walking into a hardware store and staring at a wall of tools is intimidating. Here's what you actually need on day one — and what you can safely skip until you're deeper in.",
  },
  {
    id: "2",
    slug: "how-to-maintain-hand-tools",
    title: "How to Properly Maintain Your Hand Tools for Longevity",
    excerpt:
      "Proper maintenance extends the life of your tools significantly. Learn the simple steps to keep them in peak condition.",
    category: "Tool Maintenance",
    date: "June 8, 2025",
    readTime: "4 min read",
    image: "https://placehold.co/1200x700/1B4332/FAFAF7?text=Tool+Maintenance",
    author: "CutHaven Team",
    content:
      "A good hand tool should outlast you. Here's how to make sure it does — from wipe-downs after every use to seasonal blade honing.",
  },
  {
    id: "3",
    slug: "spring-garden-preparation-guide",
    title: "Complete Spring Garden Preparation Guide",
    excerpt:
      "Get your garden ready for spring with this step-by-step preparation guide for soil, tools, and planting.",
    category: "Gardening Tips",
    date: "May 28, 2025",
    readTime: "7 min read",
    image: "https://placehold.co/1200x700/52B788/FAFAF7?text=Spring+Prep",
    author: "CutHaven Team",
    content:
      "Spring is the make-or-break season for your garden. Do these five things now and you'll thank yourself all summer.",
  },
];

export const getPostBySlug = (slug: string) => blogPosts.find((p) => p.slug === slug);
