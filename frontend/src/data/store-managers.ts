export interface StoreManager {
  id: string;
  name: string;
  email: string;
  active: boolean;
  addedDate: string;
}

export const storeManagers: StoreManager[] = [
  {
    id: "sm1",
    name: "Jasim Khan",
    email: "jasim@cuthaven.com",
    active: true,
    addedDate: "2024-09-01",
  },
  {
    id: "sm2",
    name: "Rachel Owens",
    email: "rachel@cuthaven.com",
    active: true,
    addedDate: "2025-03-12",
  },
];
