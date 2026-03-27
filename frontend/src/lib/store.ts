import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  subscriptionTier: string;
  role: 'user' | 'admin';
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  login: (user, accessToken, refreshToken) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    set({ user: null, isAuthenticated: false });
  },
  loadFromStorage: () => {
    const userStr = localStorage.getItem('user');
    const token = localStorage.getItem('accessToken');
    if (userStr && token) {
      set({ user: JSON.parse(userStr), isAuthenticated: true });
    }
  },
}));
