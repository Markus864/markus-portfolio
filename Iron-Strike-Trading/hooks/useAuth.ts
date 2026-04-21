import { useUser } from "@clerk/clerk-react";
import { useMemo } from "react";

interface AuthUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
}

function getDevAuthUser(): AuthUser | null {
  if (!import.meta.env.DEV) return null;
  
  try {
    const devToken = localStorage.getItem('devAuthToken');
    if (!devToken) return null;
    
    const decoded = JSON.parse(atob(devToken));
    if (decoded.exp && decoded.exp < Date.now()) {
      localStorage.removeItem('devAuthToken');
      return null;
    }
    
    return {
      id: decoded.userId,
      email: decoded.email,
      firstName: 'Dev',
      lastName: 'Test User',
      profileImageUrl: undefined,
    };
  } catch {
    return null;
  }
}

export function useAuth() {
  const { user, isLoaded, isSignedIn } = useUser();
  
  const devUser = useMemo(() => getDevAuthUser(), []);

  const authUser: AuthUser | null = user ? {
    id: user.id,
    email: user.primaryEmailAddress?.emailAddress,
    firstName: user.firstName || undefined,
    lastName: user.lastName || undefined,
    profileImageUrl: user.imageUrl || undefined,
  } : devUser;

  return {
    user: authUser,
    isLoading: !isLoaded,
    isAuthenticated: !!isSignedIn || !!devUser,
  };
}
