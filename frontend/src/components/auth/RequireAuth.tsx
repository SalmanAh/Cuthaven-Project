import { Navigate, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import type { AuthUser } from "@/context/AuthContext";

interface Props {
  children: ReactNode;
  // If provided, user must have one of these roles — otherwise redirect to /
  roles?: AuthUser["role"][];
}

/**
 * Wrap any route component with this to enforce authentication.
 *
 * Usage:
 *   <RequireAuth>               — any logged-in user
 *   <RequireAuth roles={["admin"]}> — admin only
 *   <RequireAuth roles={["admin","store_manager"]}> — staff only
 */
export function RequireAuth({ children, roles }: Props) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  // Still hydrating from localStorage — render nothing to avoid flicker
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // Not logged in — send to login with a redirect param so they come back after
  if (!user) {
    return <Navigate to="/account/login" search={{ redirect: location.pathname }} replace />;
  }

  // Logged in but wrong role — send to home, not to login
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
