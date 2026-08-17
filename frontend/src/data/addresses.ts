export interface Address {
  id: string;
  label: string;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  isDefault: boolean;
}

export const mockAddresses: Address[] = [
  {
    id: "a1",
    label: "Home",
    firstName: "Sarah",
    lastName: "Mitchell",
    address: "245 Maple Ave",
    city: "Anchorage",
    state: "AK",
    zip: "99501",
    phone: "+1 907 555-0123",
    isDefault: true,
  },
  {
    id: "a2",
    label: "Office",
    firstName: "Sarah",
    lastName: "Mitchell",
    address: "1200 Business Park Dr, Suite 402",
    city: "Anchorage",
    state: "AK",
    zip: "99503",
    phone: "+1 907 555-0199",
    isDefault: false,
  },
];
