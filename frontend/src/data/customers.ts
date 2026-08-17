export interface Customer {
  id: string;
  name: string;
  email: string;
  role: "Customer" | "VIP";
  ordersCount: number;
  totalSpent: number;
  joinedDate: string;
}

export const customers: Customer[] = [
  {
    id: "c1",
    name: "Sarah Mitchell",
    email: "sarah@example.com",
    role: "VIP",
    ordersCount: 12,
    totalSpent: 4820.5,
    joinedDate: "2024-03-15",
  },
  {
    id: "c2",
    name: "Eric Thompson",
    email: "eric@example.com",
    role: "Customer",
    ordersCount: 3,
    totalSpent: 890.0,
    joinedDate: "2025-01-08",
  },
  {
    id: "c3",
    name: "Priya Patel",
    email: "priya@example.com",
    role: "Customer",
    ordersCount: 5,
    totalSpent: 1450.75,
    joinedDate: "2024-11-22",
  },
  {
    id: "c4",
    name: "Marcus Webb",
    email: "marcus@example.com",
    role: "VIP",
    ordersCount: 18,
    totalSpent: 7200.3,
    joinedDate: "2023-08-01",
  },
  {
    id: "c5",
    name: "Grace Lin",
    email: "grace@example.com",
    role: "Customer",
    ordersCount: 4,
    totalSpent: 1120.0,
    joinedDate: "2025-02-14",
  },
  {
    id: "c6",
    name: "Yusuf Ahmed",
    email: "yusuf@example.com",
    role: "Customer",
    ordersCount: 2,
    totalSpent: 520.2,
    joinedDate: "2025-04-30",
  },
  {
    id: "c7",
    name: "Sofia Rossi",
    email: "sofia@example.com",
    role: "Customer",
    ordersCount: 6,
    totalSpent: 1890.0,
    joinedDate: "2024-06-19",
  },
  {
    id: "c8",
    name: "Kai Nakamura",
    email: "kai@example.com",
    role: "VIP",
    ordersCount: 9,
    totalSpent: 3450.8,
    joinedDate: "2024-01-05",
  },
];
