export type Period = "today" | "7days" | "month" | "annual";

export interface PeriodStats {
  revenue: number;
  orders: number;
  customers: number;
  avgOrder: number;
  pending: number;
  processing: number;
  shipped: number;
  delivered: number;
  revTrend: number;
  ordTrend: number;
  custTrend: number;
  aovTrend: number;
}

export const periodStats: Record<Period, PeriodStats> = {
  today: {
    revenue: 4890,
    orders: 12,
    customers: 8,
    avgOrder: 407,
    pending: 2,
    processing: 4,
    shipped: 3,
    delivered: 3,
    revTrend: 12,
    ordTrend: 8,
    custTrend: 4,
    aovTrend: 3,
  },
  "7days": {
    revenue: 28420,
    orders: 68,
    customers: 42,
    avgOrder: 418,
    pending: 5,
    processing: 12,
    shipped: 18,
    delivered: 33,
    revTrend: 18,
    ordTrend: 14,
    custTrend: 9,
    aovTrend: 5,
  },
  month: {
    revenue: 112380,
    orders: 268,
    customers: 174,
    avgOrder: 419,
    pending: 12,
    processing: 34,
    shipped: 62,
    delivered: 160,
    revTrend: 22,
    ordTrend: 19,
    custTrend: 15,
    aovTrend: 6,
  },
  annual: {
    revenue: 1284900,
    orders: 3120,
    customers: 2140,
    avgOrder: 411,
    pending: 40,
    processing: 120,
    shipped: 380,
    delivered: 2580,
    revTrend: 34,
    ordTrend: 28,
    custTrend: 24,
    aovTrend: 8,
  },
};

export const revenueSeries: Record<Period, { label: string; revenue: number; orders: number }[]> = {
  today: [
    { label: "9am", revenue: 320, orders: 1 },
    { label: "11am", revenue: 780, orders: 2 },
    { label: "1pm", revenue: 1240, orders: 3 },
    { label: "3pm", revenue: 890, orders: 2 },
    { label: "5pm", revenue: 1120, orders: 3 },
    { label: "7pm", revenue: 540, orders: 1 },
  ],
  "7days": [
    { label: "Mon", revenue: 2400, orders: 6 },
    { label: "Tue", revenue: 3200, orders: 8 },
    { label: "Wed", revenue: 2780, orders: 7 },
    { label: "Thu", revenue: 4200, orders: 11 },
    { label: "Fri", revenue: 4890, orders: 12 },
    { label: "Sat", revenue: 5390, orders: 14 },
    { label: "Sun", revenue: 5560, orders: 10 },
  ],
  month: Array.from({ length: 30 }, (_, i) => ({
    label: `${i + 1}`,
    revenue: 2500 + Math.round(Math.sin(i / 3) * 1500) + i * 40,
    orders: 6 + (i % 8),
  })),
  annual: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map(
    (m, i) => ({ label: m, revenue: 80000 + i * 4200 + (i % 3) * 12000, orders: 220 + i * 15 }),
  ),
};

export const statusDistribution: Record<Period, { name: string; value: number; color: string }[]> =
  {
    today: [
      { name: "Pending", value: 2, color: "#E07B1A" },
      { name: "Processing", value: 4, color: "#2D6A4F" },
      { name: "Shipped", value: 3, color: "#4A90E2" },
      { name: "Delivered", value: 3, color: "#1B4332" },
    ],
    "7days": [
      { name: "Pending", value: 5, color: "#E07B1A" },
      { name: "Processing", value: 12, color: "#2D6A4F" },
      { name: "Shipped", value: 18, color: "#4A90E2" },
      { name: "Delivered", value: 33, color: "#1B4332" },
    ],
    month: [
      { name: "Pending", value: 12, color: "#E07B1A" },
      { name: "Processing", value: 34, color: "#2D6A4F" },
      { name: "Shipped", value: 62, color: "#4A90E2" },
      { name: "Delivered", value: 160, color: "#1B4332" },
    ],
    annual: [
      { name: "Pending", value: 40, color: "#E07B1A" },
      { name: "Processing", value: 120, color: "#2D6A4F" },
      { name: "Shipped", value: 380, color: "#4A90E2" },
      { name: "Delivered", value: 2580, color: "#1B4332" },
    ],
  };
