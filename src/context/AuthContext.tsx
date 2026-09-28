import React, { createContext, useContext, useState, useEffect } from 'react';
import type { AuthUser as User } from '../lib/neon';
import { neon } from '../lib/neon';
import { UserSettingsService } from '../services/UserSettingsService';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const { data } = await neon.auth.getSession();
      if (cancelled) return;
      const user = data.session?.user ?? null;
      setCurrentUser(user);
      if (user) {
        try {
          await UserSettingsService.init(user.id);
        } catch (err) {
          console.error('Failed to init user settings', err);
        }
      }
      setLoading(false);
    };

    bootstrap();

    const { data: sub } = neon.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setCurrentUser(user);
      if (user) {
        UserSettingsService.init(user.id).catch((err) =>
          console.error('Failed to init user settings', err)
        );
      } else {
        UserSettingsService.clear();
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = { currentUser, loading };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
