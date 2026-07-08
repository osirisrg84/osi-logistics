import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from '../services/api';
import { Driver } from '../types';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'dispatcher' | 'driver';
  driver_id: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  driverProfile: Driver | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<AuthUser>) => void;
  isAdmin: boolean;
  isDispatcher: boolean;
  isDriver: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [driverProfile, setDriverProfile] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('osi_token');
    if (!token) {
      setLoading(false);
      return;
    }
    authApi.me()
      .then(({ data }) => {
        setUser(data.user);
        setDriverProfile(data.driverProfile || null);
      })
      .catch(() => {
        localStorage.removeItem('osi_token');
        localStorage.removeItem('osi_user');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await authApi.login(email, password);
    localStorage.setItem('osi_token', data.token);
    localStorage.setItem('osi_user', JSON.stringify(data.user));
    sessionStorage.setItem('open_sidebar', '1');
    setUser(data.user);
    setDriverProfile(data.driverProfile || null);
  };

  const logout = async () => {
    try { await authApi.logout(); } catch {}
    localStorage.removeItem('osi_token');
    localStorage.removeItem('osi_user');
    setUser(null);
    setDriverProfile(null);
  };

  const updateUser = (updates: Partial<AuthUser>) => {
    setUser(u => u ? { ...u, ...updates } : u);
  };

  return (
    <AuthContext.Provider value={{
      user,
      driverProfile,
      loading,
      login,
      logout,
      updateUser,
      isAdmin: user?.role === 'admin',
      isDispatcher: user?.role === 'dispatcher' || user?.role === 'admin',
      isDriver: user?.role === 'driver',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
