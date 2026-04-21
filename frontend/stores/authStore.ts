import { create } from 'zustand';

export type UserRole = 'admin' | 'manager' | 'lager' | 'techniker' | 'viewer' | 'fahrer';

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  name?: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: AuthUser, token: string) => void;
  clearAuth: () => void;
  hasRole: (roles: UserRole[]) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  setAuth: (user, token) => set({ user, token, isAuthenticated: true }),

  clearAuth: () => set({ user: null, token: null, isAuthenticated: false }),

  // Returns true if the current user has at least one of the given roles.
  hasRole: (roles) => {
    const { user } = get();
    return user ? roles.includes(user.role) : false;
  },
}));
