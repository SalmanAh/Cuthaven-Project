// Shapes for auth-related API responses and internal use.

export interface AuthUser {
  id: string;          // Supabase auth.users UUID
  email: string;
  role: "customer" | "admin" | "store_manager" | "product_manager";
  firstName: string;
  lastName: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}
