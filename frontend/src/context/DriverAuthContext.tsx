import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from '../services/driverApi';
import { Driver } from '../types';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'dispatcher' | 'driver';
  driver_id: string | null;
}

interface DriverAuthContextValue {
  user: AuthUser | null;
  driverProfile: Driver | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<AuthUser>) => void;
  isDriver: boolean;
}

const DriverAuthContext = createContext<DriverAuthContextValue | null>(null);

// Uses osi_driver_token / osi_driver_user — completely separate from the
// dispatcher/admin session (osi_token / osi_user) so both portals can be
// open and logged in simultaneously without interfering with each other.
export function DriverAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [driverProfile, setDriverProfile] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('osi_driver_token');
    if (!token) { setLoading(false); return; }
    authApi.me()
      .then(({ data }) => {
        setUser(data.user);
        setDriverProfile(data.driverProfile || null);
      })
      .catch(() => {
        localStorage.removeItem('osi_driver_token');
        localStorage.removeItem('osi_driver_user');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await authApi.login(email, password);
    localStorage.setItem('osi_driver_token', data.token);
    localStorage.setItem('osi_driver_user', JSON.stringify(data.user));
    setUser(data.user);
    setDriverProfile(data.driverProfile || null);
  };

  const logout = async () => {
    try { await authApi.logout(); } catch {}
    localStorage.removeItem('osi_driver_token');
    localStorage.removeItem('osi_driver_user');
    setUser(null);
    setDriverProfile(null);
  };

  const updateUser = (updates: Partial<AuthUser>) => {
    setUser(u => u ? { ...u, ...updates } : u);
  };

  return (
    <DriverAuthContext.Provider value={{
      user, driverProfile, loading, login, logout, updateUser,
      isDriver: user?.role === 'driver',
    }}>
      {children}
    </DriverAuthContext.Provider>
  );
}

export function useDriverAuth(): DriverAuthContextValue {
  const ctx = useContext(DriverAuthContext);
  if (!ctx) throw new Error('useDriverAuth must be inside DriverAuthProvider');
  return ctx;
}
