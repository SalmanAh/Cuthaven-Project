export interface Category {
  id: string;
  name: string;
  slug: string;
  count: number;
  image: string;
  description?: string;
}

export const categories: Category[] = [
  {
    id: "1",
    name: "Garden Tools",
    slug: "garden-tools",
    count: 6,
    image: "https://placehold.co/600x600/2D6A4F/FAFAF7?text=Garden",
  },
  {
    id: "2",
    name: "Hand Tools",
    slug: "hand-tools",
    count: 4,
    image: "https://placehold.co/600x600/1B4332/FAFAF7?text=Hand",
  },
  {
    id: "3",
    name: "Outdoor Accessories",
    slug: "outdoor-accessories",
    count: 3,
    image: "https://placehold.co/600x600/52B788/FAFAF7?text=Outdoor",
  },
  {
    id: "4",
    name: "Power Tools",
    slug: "power-tools",
    count: 2,
    image: "https://placehold.co/600x600/E07B1A/FAFAF7?text=Power",
  },
  {
    id: "5",
    name: "Storage & Organization",
    slug: "storage",
    count: 2,
    image: "https://placehold.co/600x600/C96A10/FAFAF7?text=Storage",
  },
];
