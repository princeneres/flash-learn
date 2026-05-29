import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { LogOut, User as UserIcon } from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { InstallAppButton } from '../components/InstallAppButton';

const MainLayout: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="app-shell min-h-screen">
        <nav className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
            <div className="flex items-center gap-6">
              <Link to="/dashboard" className="text-xl font-semibold tracking-tight">
                <img src="/logo.png" alt="Flash Learn Logo" className="inline h-8 w-8" />
              </Link>
              <div className="hidden items-center gap-3 text-sm font-medium text-muted-foreground md:flex">
                <Link
                  to="/dashboard"
                  className="rounded-full px-3 py-1.5 text-foreground transition hover:bg-accent hover:text-accent-foreground"
                >
                  {t('dashboard.title')}
                </Link>
                <Link
                  to="/stats"
                  className="rounded-full px-3 py-1.5 transition hover:bg-accent hover:text-accent-foreground"
                >
                  {t('stats.navLabel')}
                </Link>
                <Link
                  to="/leaderboard"
                  className="rounded-full px-3 py-1.5 transition hover:bg-accent hover:text-accent-foreground"
                >
                  {t('leaderboard.title')}
                </Link>
                <Link
                  to="/public"
                  className="rounded-full px-3 py-1.5 transition hover:bg-accent hover:text-accent-foreground"
                >
                  {t('publicDecks.title')}
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <InstallAppButton />
              {currentUser ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2 rounded-full bg-background/80">
                      <UserIcon className="h-4 w-4" />
                      <span className="hidden text-sm font-medium md:inline">
                        {(currentUser.user_metadata?.full_name as string | undefined) ||
                          currentUser.email}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>{t('auth.profile')}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/profile">{t('auth.profile')}</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/stats">{t('stats.navLabel')}</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/leaderboard">{t('leaderboard.title')}</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/public">{t('publicDecks.title')}</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                      <LogOut className="mr-2 h-4 w-4" />
                      {t('auth.logout')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button variant="outline" onClick={() => navigate('/login')}>
                  {t('auth.login')}
                </Button>
              )}
            </div>
          </div>
        </nav>
        <main className="mx-auto w-full max-w-6xl px-4 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
