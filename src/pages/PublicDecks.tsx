import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { BookOpen, Globe2, Search, Tag, Star } from 'lucide-react';
import { DeckService, type Deck } from '../services/DeckService';
import { FavoriteService } from '../services/FavoriteService';
import { collectCategories, normalizeCategory } from '../lib/categories';
import { useAuth } from '../context/AuthContext';
import { LoadingState } from '../components/LoadingState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { useToast } from '../components/ui/use-toast';
import { cn } from '../lib/utils';

const PublicDecks: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [pendingFavorite, setPendingFavorite] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [publicDecks, favIds] = await Promise.all([
          DeckService.getPublicDecks(),
          FavoriteService.listFavoriteIds().catch(() => [] as string[]),
        ]);
        setDecks(publicDecks);
        setFavoriteIds(new Set(favIds));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const categories = useMemo(() => collectCategories(decks), [decks]);

  const filteredDecks = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return decks.filter((deck) => {
      if (activeCategory && normalizeCategory(deck.category) !== activeCategory) return false;
      if (!q) return true;
      return (
        deck.title.toLowerCase().includes(q) ||
        normalizeCategory(deck.category).toLowerCase().includes(q) ||
        (deck.ownerName ?? '').toLowerCase().includes(q) ||
        deck.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [decks, searchTerm, activeCategory]);

  const toggleFavorite = async (deckId: string) => {
    if (!currentUser || pendingFavorite) return;
    const isFav = favoriteIds.has(deckId);
    setPendingFavorite(deckId);
    try {
      if (isFav) {
        await FavoriteService.remove(currentUser.id, deckId);
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          next.delete(deckId);
          return next;
        });
        toast({ title: t('publicDecks.unfavoriteSuccess') });
      } else {
        await FavoriteService.add(currentUser.id, deckId);
        setFavoriteIds((prev) => new Set(prev).add(deckId));
        toast({ title: t('publicDecks.favoriteSuccess') });
      }
    } catch (error) {
      console.error(error);
      toast({ title: t('publicDecks.favoriteError'), variant: 'destructive' });
    } finally {
      setPendingFavorite(null);
    }
  };

  if (loading) return <LoadingState message={t('common.loading')} />;

  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 px-4 py-1 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          <Globe2 className="h-3.5 w-3.5 text-primary" />
          {t('visibility.public')}
        </div>
        <div>
          <h1 className="text-3xl font-semibold">{t('publicDecks.title')}</h1>
          <p className="text-muted-foreground">{t('publicDecks.subtitle')}</p>
        </div>
      </div>

      {decks.length === 0 ? (
        <Card className="border-dashed text-center">
          <CardHeader>
            <BookOpen className="mx-auto h-12 w-12 text-primary" />
            <CardTitle>{t('publicDecks.title')}</CardTitle>
            <CardDescription>{t('publicDecks.emptyState')}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Search + category filter */}
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('publicDecks.searchPlaceholder')}
                className="pl-10"
                aria-label={t('publicDecks.searchPlaceholder')}
              />
            </div>
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveCategory(null)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition',
                    activeCategory === null
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-accent',
                  )}
                >
                  {t('publicDecks.filterAll')}
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition',
                      activeCategory === cat
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {filteredDecks.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
              {t('publicDecks.noResults')}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredDecks.map((deck) => {
                const isFav = favoriteIds.has(deck.id);
                const category = normalizeCategory(deck.category);
                return (
                  <Card key={deck.id} className="border-border/60 bg-card/80 p-1">
                    <CardHeader className="flex flex-row items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="truncate">{deck.title}</CardTitle>
                        <CardDescription>
                          {t('publicDecks.owner', {
                            name: deck.ownerName || t('leaderboard.anonymous'),
                          })}
                        </CardDescription>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleFavorite(deck.id)}
                        disabled={pendingFavorite === deck.id}
                        className={cn(
                          'shrink-0 rounded-full p-2 transition disabled:opacity-50',
                          isFav
                            ? 'text-warm hover:bg-warm/10'
                            : 'text-muted-foreground hover:bg-accent hover:text-warm',
                        )}
                        aria-label={t(isFav ? 'publicDecks.unfavorite' : 'publicDecks.favorite')}
                        aria-pressed={isFav}
                      >
                        <Star className={cn('h-5 w-5', isFav && 'fill-current')} aria-hidden />
                      </button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        {t('dashboard.cardCount', { count: deck.cardCount })}
                      </p>
                      {(category || deck.tags.length > 0) && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {category && <Badge variant="warm">{category}</Badge>}
                          {deck.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="secondary">
                              <Tag className="h-3 w-3" aria-hidden />
                              {tag}
                            </Badge>
                          ))}
                          {deck.tags.length > 3 && (
                            <Badge variant="outline">+{deck.tags.length - 3}</Badge>
                          )}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-3">
                        <Button asChild variant="outline" className="flex-1">
                          <Link to={`/deck/${deck.id}`}>{t('publicDecks.open')}</Link>
                        </Button>
                        <Button asChild className="flex-1">
                          <Link to={`/study/${deck.id}`}>{t('publicDecks.study')}</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PublicDecks;
