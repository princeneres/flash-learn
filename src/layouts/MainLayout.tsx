import React from 'react';
import { Outlet, Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  BarChart3,
  Globe,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Moon,
  Settings,
  Sun,
  Trophy,
  User as UserIcon,
  Volume2,
  VolumeX,
} from 'lucide-react';
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
import { FeatureSuggestionDialog } from '../components/FeatureSuggestionDialog';
import { useTheme } from '../components/theme-provider';
import { useSound } from '../hooks/useSound';

const MainLayout: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { enabled: soundEnabled, toggle: toggleSound } = useSound();
  const navigate = useNavigate();
  const location = useLocation();
  const [suggestionOpen, setSuggestionOpen] = React.useState(false);

  const displayName =
    (currentUser?.user_metadata?.full_name as string | undefined) ||
    currentUser?.email?.split('@')[0] ||
    '';

  const navItems = [
    { to: '/dashboard', label: t('dashboard.title'), icon: LayoutDashboard },
    { to: '/public', label: t('publicDecks.title'), icon: Globe },
    { to: '/stats', label: t('stats.navLabel'), icon: BarChart3 },
    { to: '/leaderboard', label: t('leaderboard.title'), icon: Trophy },
  ];

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'rounded-full px-3 py-1.5 transition',
      isActive
        ? 'bg-warm/15 font-semibold text-warm-foreground dark:text-warm'
        : 'hover:bg-accent hover:text-accent-foreground',
    );

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
              <div className="hidden items-center gap-2 text-sm font-medium text-muted-foreground md:flex">
                {navItems.map((item) => (
                  <NavLink key={item.to} to={item.to} className={navLinkClass}>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <InstallAppButton />
              {currentUser ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2 rounded-full bg-background/80">
                      <UserIcon className="h-4 w-4" />
                      <span className="hidden max-w-[10rem] truncate text-sm font-medium md:inline">
                        {displayName}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    {/* Identity header — real user, no redundant label */}
                    <div className="flex items-center gap-3 px-2 py-2">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warm/15 text-warm-foreground dark:text-warm">
                        <UserIcon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold leading-tight">
                          {displayName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {currentUser.email}
                        </p>
                      </div>
                    </div>
                    <DropdownMenuSeparator />

                    {/* Navigation — only on mobile; the navbar already shows these on desktop */}
                    <div className="md:hidden">
                      <DropdownMenuLabel>{t('menu.navigation')}</DropdownMenuLabel>
                      {navItems.map((item) => (
                        <DropdownMenuItem key={item.to} asChild>
                          <Link to={item.to}>
                            <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                            {item.label}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                    </div>

                    {/* Preferences — toggles keep the menu open */}
                    <DropdownMenuLabel>{t('menu.preferences')}</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={toggleTheme}>
                      {theme === 'dark' ? (
                        <Sun className="mr-2 h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Moon className="mr-2 h-4 w-4 text-muted-foreground" />
                      )}
                      {theme === 'dark' ? t('profile.themeLight') : t('profile.themeDark')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={toggleSound}>
                      {soundEnabled ? (
                        <VolumeX className="mr-2 h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Volume2 className="mr-2 h-4 w-4 text-muted-foreground" />
                      )}
                      {soundEnabled ? t('study.muteSound') : t('study.unmuteSound')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />

                    {/* Account */}
                    <DropdownMenuItem asChild>
                      <Link to="/profile">
                        <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
                        {t('menu.account')}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSuggestionOpen(true)}>
                      <Lightbulb className="mr-2 h-4 w-4 text-muted-foreground" />
                      {t('suggestion.menuItem')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="text-destructive focus:text-destructive"
                    >
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
          <div key={location.pathname} className="animate-fade-up">
            <Outlet />
          </div>
        </main>
      </div>
      <FeatureSuggestionDialog open={suggestionOpen} onOpenChange={setSuggestionOpen} />
    </div>
  );
};

export default MainLayout;
