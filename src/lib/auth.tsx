import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { auth } from './api';

interface User {
  id: string;
  name: string;
  role: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  requiresSetup: boolean;
  setup: (name: string, pin: string) => Promise<void>;
  login: (name: string, pin: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  requiresSetup: false,
  setup: async () => {},
  login: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [requiresSetup, setRequiresSetup] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      try {
        const status = await auth.status();
        setRequiresSetup(status.requiresSetup);

        const token = localStorage.getItem('crm-token');
        if (!token || status.requiresSetup) return;
        const response = await auth.me();
        setUser(response.user);
      } catch {
        localStorage.removeItem('crm-token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    void initialize();
  }, []);

  const storeSession = (res: { user: User; token: string }) => {
    localStorage.setItem('crm-token', res.token);
    setUser(res.user);
  };

  const setup = async (name: string, pin: string) => {
    const res = await auth.setup(name, pin);
    storeSession(res);
    setRequiresSetup(false);
  };

  const login = async (name: string, pin: string) => {
    const res = await auth.login(name, pin);
    storeSession(res);
  };

  const logout = () => {
    localStorage.removeItem('crm-token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, requiresSetup, setup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
