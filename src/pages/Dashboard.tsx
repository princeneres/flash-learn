import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Plus,
  Book,
  Trash2,
  Edit2,
  PlayCircle,
  Upload,
  Download,
  Sparkles,
  Check,
  CheckSquare,
  Square,
  Search,
  Tag,
} from 'lucide-react';
import { DeckService, type Deck } from '../services/DeckService';
import { AiDeckDialog } from '../components/AiDeckDialog';
import { CategorySelect } from '../components/CategorySelect';
import { TagInput } from '../components/TagInput';
import { Badge } from '../components/ui/badge';
import { collectCategories, normalizeCategory } from '../lib/categories';
import { DECK_CARD_LIMIT } from '../services/CardService';
import type { ImportBundle } from '../services/DeckImportService';
import { useAuth } from '../context/AuthContext';
import { usePlan } from '../hooks/usePlan';
import { parsePlanError, planErrorTitle } from '../lib/planErrors';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { LoadingState } from '../components/LoadingState';
import { useToast } from '../components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import { cn } from '../lib/utils';
import type { ExportProgress } from '../services/DeckExportService';

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { limits, refresh: refreshLimits } = usePlan();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [newDeckTitle, setNewDeckTitle] = useState('');
  const [newDeckCategory, setNewDeckCategory] = useState('');
  const [newDeckTags, setNewDeckTags] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [isDeckPublic, setIsDeckPublic] = useState(false);
  const [visibilityLoading, setVisibilityLoading] = useState<string | null>(null);
  const { toast } = useToast();

  // Search + category filter
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Import state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importBundle, setImportBundle] = useState<ImportBundle | null>(null);
  const [importParsing, setImportParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [audioProgress, setAudioProgress] = useState<{ done: number; total: number } | null>(null);

  // Export state
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [selectedExportIds, setSelectedExportIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const exportAbortRef = useRef<AbortController | null>(null);

  const maxDecks = limits?.plan.maxDecks ?? Infinity;
  const maxTotalCards = limits?.plan.maxTotalCards ?? Infinity;
  const maxCardsPerDeck = limits?.plan.maxCardsPerDeck ?? DECK_CARD_LIMIT;
  const usageDecks = limits?.usage.decks ?? decks.length;
  const usageCards = limits?.usage.totalCards ?? 0;
  const totalRoom = Math.max(0, maxTotalCards - usageCards);
  const atDeckLimit = usageDecks >= maxDecks;

  const categories = useMemo(() => collectCategories(decks), [decks]);

  const filteredDecks = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return decks.filter((deck) => {
      if (activeCategory && normalizeCategory(deck.category) !== activeCategory) return false;
      if (!q) return true;
      return (
        deck.title.toLowerCase().includes(q) ||
        normalizeCategory(deck.category).toLowerCase().includes(q) ||
        deck.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [decks, searchTerm, activeCategory]);

  const handlePlanError = (err: unknown, fallbackTitleKey: string): boolean => {
    const plan = parsePlanError(err);
    if (plan) {
      toast({ title: planErrorTitle(plan, t), variant: 'destructive' });
      return true;
    }
    toast({ title: t(fallbackTitleKey), variant: 'destructive' });
    return false;
  };

  const resetImport = () => {
    setImportBundle(null);
    setImportParsing(false);
    setImporting(false);
    setAudioProgress(null);
  };

  const handleImportFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportBundle(null);
    setImportParsing(true);
    try {
      const { DeckImportService } = await import('../services/DeckImportService');
      const bundle = await DeckImportService.parseFile(file);
      setImportBundle(bundle);
      const totalCards = bundle.decks.reduce((s, d) => s + d.cards.length, 0);
      if (bundle.decks.length === 0 || totalCards === 0) {
        toast({ title: t('dashboard.importEmpty'), variant: 'destructive' });
      }
    } catch (error) {
      console.error(error);
      toast({ title: t('dashboard.importError'), variant: 'destructive' });
      setImportBundle(null);
    } finally {
      setImportParsing(false);
    }
  };

  const totalCardsInBundle = importBundle?.decks.reduce((s, d) => s + d.cards.length, 0) ?? 0;
  const decksOverPerDeckLimit =
    importBundle?.decks.filter((d) => d.cards.length > maxCardsPerDeck).length ?? 0;
  const willExceedTotal = totalCardsInBundle > totalRoom;

  const handleImportConfirm = async () => {
    if (!importBundle || importBundle.decks.length === 0) return;

    setImporting(true);
    try {
      const { DeckImportService } = await import('../services/DeckImportService');
      const { decksCreated, cardsCreated } = await DeckImportService.importBundle(
        currentUser!.id,
        (currentUser?.user_metadata?.full_name as string | undefined) ||
          currentUser?.email ||
          undefined,
        importBundle,
        maxCardsPerDeck,
        totalRoom,
        (done, total) => setAudioProgress({ done, total }),
      );
      const totalRequested = importBundle.decks.reduce((s, d) => s + d.cards.length, 0);
      if (cardsCreated < totalRequested) {
        toast({
          title: t('dashboard.importNativeTruncated', {
            decks: decksCreated,
            cards: cardsCreated,
            total: totalRequested,
            limit: maxCardsPerDeck,
          }),
        });
      } else {
        toast({
          title: t('dashboard.importNativeSuccess', {
            decks: decksCreated,
            cards: cardsCreated,
          }),
        });
      }
      setIsImportOpen(false);
      resetImport();
      await loadDecks();
      refreshLimits();
    } catch (error) {
      console.error(error);
      handlePlanError(error, 'dashboard.importError');
    } finally {
      setImporting(false);
      setAudioProgress(null);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadDecks();
    }
  }, [currentUser]);

  const loadDecks = async () => {
    try {
      const userDecks = await DeckService.getUserDecks(currentUser!.id);
      setDecks(userDecks);
    } catch (error) {
      console.error(error);
      toast({ title: t('dashboard.loadError'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeckTitle.trim()) return;

    setCreating(true);
    try {
      await DeckService.createDeck(currentUser!.id, {
        title: newDeckTitle,
        category: normalizeCategory(newDeckCategory),
        tags: newDeckTags,
        isPublic: isDeckPublic,
        ownerName:
          (currentUser?.user_metadata?.full_name as string | undefined) ||
          currentUser?.email ||
          undefined,
      });
      toast({ title: t('dashboard.createSuccess') });
      setNewDeckTitle('');
      setNewDeckCategory('');
      setNewDeckTags([]);
      setIsDeckPublic(false);
      setIsModalOpen(false);
      await loadDecks();
      refreshLimits();
    } catch (error) {
      console.error(error);
      handlePlanError(error, 'dashboard.createError');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteDeck = async (deckId: string) => {
    if (!window.confirm(t('dashboard.confirmDelete'))) return;
    try {
      await DeckService.deleteDeck(deckId);
      setDecks((prev) => prev.filter((d) => d.id !== deckId));
      toast({ title: t('dashboard.deleteSuccess') });
      refreshLimits();
    } catch (error) {
      console.error(error);
      toast({ title: t('dashboard.deleteError'), variant: 'destructive' });
    }
  };

  const openExportDialog = () => {
    setSelectedExportIds(new Set(decks.map((d) => d.id)));
    setExportProgress(null);
    setIsExportOpen(true);
  };

  const toggleExportDeck = (deckId: string) => {
    setSelectedExportIds((prev) => {
      const next = new Set(prev);
      if (next.has(deckId)) next.delete(deckId);
      else next.add(deckId);
      return next;
    });
  };

  const allSelected = decks.length > 0 && selectedExportIds.size === decks.length;

  const toggleSelectAll = () => {
    setSelectedExportIds(allSelected ? new Set() : new Set(decks.map((d) => d.id)));
  };

  const closeExportDialog = () => {
    if (exporting) return;
    setIsExportOpen(false);
    setExportProgress(null);
  };

  const cancelExport = () => {
    exportAbortRef.current?.abort();
  };

  const handleExportSelected = async () => {
    if (!currentUser || selectedExportIds.size === 0) return;
    const ids = decks.filter((d) => selectedExportIds.has(d.id)).map((d) => d.id);
    const controller = new AbortController();
    exportAbortRef.current = controller;
    setExporting(true);
    setExportProgress({ phase: 'collecting', done: 0, total: ids.length });
    try {
      const { DeckExportService } = await import('../services/DeckExportService');
      const { blob, filename, count } = await DeckExportService.exportDecks(ids, {
        signal: controller.signal,
        onProgress: setExportProgress,
      });
      if (count === 0) {
        toast({ title: t('dashboard.exportEmpty'), variant: 'destructive' });
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: t('dashboard.exportSuccess', { count }) });
      setIsExportOpen(false);
    } catch (error) {
      const { ExportCancelledError } = await import('../services/DeckExportService');
      if (error instanceof ExportCancelledError) {
        toast({ title: t('dashboard.exportCancelled') });
      } else {
        console.error(error);
        toast({ title: t('dashboard.exportError'), variant: 'destructive' });
      }
    } finally {
      exportAbortRef.current = null;
      setExporting(false);
      setExportProgress(null);
    }
  };

  const exportProgressLabel = (): string => {
    if (!exportProgress) return '';
    const { phase, done, total } = exportProgress;
    if (phase === 'collecting') return t('dashboard.exportProgressCollecting', { done, total });
    if (phase === 'media') return t('dashboard.exportProgressMedia', { done, total });
    return t('dashboard.exportProgressPackaging');
  };

  const exportProgressPct = (): number => {
    if (!exportProgress) return 0;
    if (exportProgress.phase === 'packaging') return 100;
    if (exportProgress.total === 0) return 0;
    return Math.round((exportProgress.done / exportProgress.total) * 100);
  };

  const handleToggleVisibility = async (deck: Deck) => {
    setVisibilityLoading(deck.id);
    try {
      await DeckService.updateDeck(deck.id, { isPublic: !deck.isPublic });
      setDecks((prev) =>
        prev.map((item) => (item.id === deck.id ? { ...item, isPublic: !deck.isPublic } : item)),
      );
      toast({
        title: deck.isPublic
          ? t('visibility.toggleSuccessPrivate')
          : t('visibility.toggleSuccessPublic'),
      });
    } catch (error) {
      console.error(error);
      toast({ title: t('visibility.toggleError'), variant: 'destructive' });
    } finally {
      setVisibilityLoading(null);
    }
  };

  if (loading) return <LoadingState message={t('common.loading')} />;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <p className="text-sm uppercase tracking-widest text-muted-foreground">
            {t('common.back')}
          </p>
          <h1 className="text-3xl font-bold">{t('dashboard.title')}</h1>
          {limits && (
            <p className="mt-2 text-xs text-muted-foreground tabular-nums">
              {t('dashboard.planUsage', {
                decks: usageDecks,
                maxDecks,
                cards: usageCards,
                maxCards: maxTotalCards,
              })}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setIsImportOpen(true)} disabled={atDeckLimit}>
            <Upload className="w-5 h-5 mr-2" />
            {t('dashboard.importGeneric')}
          </Button>
          <Button variant="outline" onClick={openExportDialog} disabled={decks.length === 0}>
            <Download className="w-5 h-5 mr-2" />
            {t('dashboard.exportAll')}
          </Button>
          <Button variant="outline" onClick={() => setIsAiOpen(true)} disabled={atDeckLimit}>
            <Sparkles className="w-5 h-5 mr-2" />
            {t('ai.generate.button')}
          </Button>
          <Button onClick={() => setIsModalOpen(true)} className="shadow-lg" disabled={atDeckLimit}>
            <Plus className="w-5 h-5 mr-2" />
            {t('dashboard.createDeck')}
          </Button>
        </div>
      </div>

      {decks.length === 0 ? (
        <Card className="glass-panel text-center py-12 border-dashed">
          <CardHeader>
            <Book className="w-12 h-12 mx-auto text-primary" />
            <CardTitle>{t('dashboard.noDecks')}</CardTitle>
            <CardDescription>{t('dashboard.emptyHelper')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => setIsModalOpen(true)} disabled={atDeckLimit}>
              {t('dashboard.createDeck')}
            </Button>
          </CardContent>
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
                placeholder={t('dashboard.searchPlaceholder')}
                className="pl-10"
                aria-label={t('dashboard.searchPlaceholder')}
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
                  {t('dashboard.filterAll')}
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
              {t('dashboard.noResults')}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDecks.map((deck) => (
                <Card
                  key={deck.id}
                  className="relative overflow-hidden border-border/50 bg-gradient-to-br from-background to-card/70 transition hover:-translate-y-1 hover:border-warm/60 hover:shadow-lg hover:shadow-warm/10"
                >
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary shadow-inner p-4">
                      <Book className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <span>
                          {deck.isPublic ? t('visibility.public') : t('visibility.private')}
                        </span>
                        <Switch
                          checked={deck.isPublic}
                          onCheckedChange={() => handleToggleVisibility(deck)}
                          disabled={visibilityLoading === deck.id}
                          aria-label={t('visibility.fieldLabel')}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteDeck(deck.id)}
                        className="rounded-full p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                        aria-label={t('dashboard.deleteDeckLabel', { title: deck.title })}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <CardTitle className="text-2xl">{deck.title}</CardTitle>
                      <CardDescription>
                        {t('dashboard.cardCount', { count: deck.cardCount })}
                      </CardDescription>
                      {(normalizeCategory(deck.category) || deck.tags.length > 0) && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {normalizeCategory(deck.category) && (
                            <Badge variant="warm">{normalizeCategory(deck.category)}</Badge>
                          )}
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
                    </div>
                    <div className="flex gap-3">
                      <Link to={`/deck/${deck.id}`} className="flex-1">
                        <Button variant="outline" className="w-full">
                          <Edit2 className="w-4 h-4 mr-2" />
                          {t('common.edit')}
                        </Button>
                      </Link>
                      <Link to={`/study/${deck.id}`} className="flex-1">
                        <Button className="w-full">
                          <PlayCircle className="w-4 h-4 mr-2" />
                          {t('dashboard.study')}
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog
        open={isImportOpen}
        onOpenChange={(open) => {
          setIsImportOpen(open);
          if (!open) resetImport();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dashboard.importTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('dashboard.importDescription')}</p>
            <Input
              type="file"
              accept=".fldeck.zip,.zip"
              onChange={handleImportFileSelect}
              disabled={importParsing || importing}
            />

            {importParsing && (
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            )}

            {audioProgress && audioProgress.total > 0 && (
              <p className="text-sm text-muted-foreground">
                {t('dashboard.importAudioProgress', {
                  done: audioProgress.done,
                  total: audioProgress.total,
                })}
              </p>
            )}

            {importBundle && (
              <>
                <p className="text-xs text-muted-foreground">
                  {t('dashboard.importNativeSummary', {
                    decks: importBundle.decks.length,
                    cards: totalCardsInBundle,
                    media: importBundle.mediaBlobs.size,
                  })}
                </p>
                {decksOverPerDeckLimit > 0 && (
                  <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                    {t('dashboard.importLimitWillTruncateNative', {
                      count: decksOverPerDeckLimit,
                      limit: maxCardsPerDeck,
                    })}
                  </p>
                )}
                {willExceedTotal && (
                  <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                    {t('dashboard.importLimitWillTruncate', {
                      total: totalCardsInBundle,
                      limit: totalRoom,
                    })}
                  </p>
                )}
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border/60 divide-y divide-border/60">
                  {importBundle.decks.slice(0, 10).map((d, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 p-2 text-xs">
                      <span className="truncate font-medium">{d.title}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {t('dashboard.cardCount', { count: d.cards.length })}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsImportOpen(false);
                resetImport();
              }}
              disabled={importing}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleImportConfirm}
              disabled={
                importing ||
                importParsing ||
                !importBundle ||
                importBundle.decks.length === 0 ||
                totalCardsInBundle === 0
              }
            >
              {importing
                ? t('dashboard.importing')
                : t('dashboard.importNativeConfirm', { count: importBundle?.decks.length ?? 0 })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isExportOpen}
        onOpenChange={(open) => {
          if (!open) closeExportDialog();
          else setIsExportOpen(true);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dashboard.exportTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('dashboard.exportDescription')}</p>

            {!exporting && (
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                  {allSelected ? (
                    <CheckSquare className="h-4 w-4" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  {allSelected ? t('dashboard.exportClearAll') : t('dashboard.exportSelectAll')}
                </button>
                <span className="text-xs text-muted-foreground">
                  {t('dashboard.exportSelectedCount', {
                    selected: selectedExportIds.size,
                    total: decks.length,
                  })}
                </span>
              </div>
            )}

            {!exporting && (
              <div className="max-h-64 overflow-y-auto rounded-lg border border-border/60 divide-y divide-border/60">
                {decks.map((deck) => {
                  const selected = selectedExportIds.has(deck.id);
                  return (
                    <button
                      type="button"
                      key={deck.id}
                      onClick={() => toggleExportDeck(deck.id)}
                      className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm transition hover:bg-muted/40"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span
                          className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded border transition',
                            selected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border',
                          )}
                        >
                          {selected && <Check className="h-3.5 w-3.5" />}
                        </span>
                        <span className="truncate font-medium">{deck.title}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {t('dashboard.cardCount', { count: deck.cardCount })}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {exporting && exportProgress && (
              <div className="space-y-2 rounded-lg border border-border/60 p-4">
                <p className="text-sm font-medium">{exportProgressLabel()}</p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-300"
                    style={{ width: `${exportProgressPct()}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            {exporting ? (
              <Button type="button" variant="ghost" onClick={cancelExport}>
                {t('dashboard.exportCancel')}
              </Button>
            ) : (
              <Button type="button" variant="ghost" onClick={closeExportDialog}>
                {t('common.cancel')}
              </Button>
            )}
            <Button
              type="button"
              onClick={handleExportSelected}
              disabled={exporting || selectedExportIds.size === 0}
            >
              {exporting
                ? t('dashboard.exporting')
                : t('dashboard.exportConfirm', { count: selectedExportIds.size })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AiDeckDialog
        open={isAiOpen}
        onOpenChange={setIsAiOpen}
        maxCardsPerDeck={maxCardsPerDeck}
        totalRoom={totalRoom}
        onCreated={() => {
          loadDecks();
          refreshLimits();
        }}
      />

      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) {
            setNewDeckCategory('');
            setNewDeckTags([]);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dashboard.createDeck')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateDeck} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="new-deck-title">
                {t('deckDetail.renameLabel')}
              </label>
              <Input
                id="new-deck-title"
                value={newDeckTitle}
                onChange={(e) => setNewDeckTitle(e.target.value)}
                placeholder={t('dashboard.titlePlaceholder')}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="new-deck-category">
                {t('categories.fieldLabel')}
              </label>
              <CategorySelect
                id="new-deck-category"
                value={newDeckCategory}
                onChange={setNewDeckCategory}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="new-deck-tags">
                {t('categories.tagsLabel')}
              </label>
              <TagInput id="new-deck-tags" tags={newDeckTags} onChange={setNewDeckTags} />
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{t('visibility.fieldLabel')}</p>
                  <p className="text-xs text-muted-foreground">{t('visibility.fieldHint')}</p>
                </div>
                <Switch checked={isDeckPublic} onCheckedChange={setIsDeckPublic} />
              </div>
              <p className="mt-3 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                {isDeckPublic ? t('visibility.public') : t('visibility.private')}
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={creating || !newDeckTitle.trim()}>
                {creating ? t('common.loading') : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
