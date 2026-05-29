import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, Trash2, Search, Upload, Pencil, Download, Star } from 'lucide-react';
import { DeckService, type Deck } from '../services/DeckService';
import { FavoriteService } from '../services/FavoriteService';
import { CardService, type Card, DECK_CARD_LIMIT } from '../services/CardService';
import type { ImportBundle, NativeCard } from '../services/DeckImportService';
import { PlayAudioButton } from '../components/PlayAudioButton';
import { CardEditor } from '../components/CardEditor';
import { RichContent } from '../components/RichContent';
import { useAuth } from '../context/AuthContext';
import { usePlan } from '../hooks/usePlan';
import { parsePlanError, planErrorTitle } from '../lib/planErrors';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { LoadingState } from '../components/LoadingState';
import { useToast } from '../components/ui/use-toast';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { CategorySelect } from '../components/CategorySelect';
import { TagInput } from '../components/TagInput';
import { normalizeCategory } from '../lib/categories';
import { looksLikeHtml } from '../lib/sanitize';
import { collectCardMediaRefs } from '../lib/media';
import { cn } from '../lib/utils';
import { Tag } from 'lucide-react';

const DeckDetail: React.FC = () => {
  const { deckId } = useParams<{ deckId: string }>();
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { limits, refresh: refreshLimits } = usePlan();
  const navigate = useNavigate();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New / Edit Card State
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [exportingDeck, setExportingDeck] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoritePending, setFavoritePending] = useState(false);
  const { toast } = useToast();

  // Edit deck state (title + category + tags)
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [renaming, setRenaming] = useState(false);

  // Import state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBundle, setImportBundle] = useState<ImportBundle | null>(null);
  const [importParsing, setImportParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [audioProgress, setAudioProgress] = useState<{ done: number; total: number } | null>(null);

  const isOwner = !!deck && !!currentUser && deck.ownerId === currentUser.id;
  const maxCardsPerDeck = limits?.plan.maxCardsPerDeck ?? DECK_CARD_LIMIT;
  const totalRoom = limits
    ? Math.max(0, limits.plan.maxTotalCards - limits.usage.totalCards)
    : Infinity;
  const handlePlanError = (err: unknown, fallbackKey: string): void => {
    const plan = parsePlanError(err);
    if (plan) {
      toast({ title: planErrorTitle(plan, t), variant: 'destructive' });
    } else {
      toast({ title: t(fallbackKey), variant: 'destructive' });
    }
  };

  useEffect(() => {
    if (currentUser && deckId) {
      loadData();
    }
  }, [currentUser, deckId]);

  const loadData = async () => {
    try {
      const [deckData, cardsData, favIds] = await Promise.all([
        DeckService.getDeckDetail(deckId!),
        CardService.getDeckCards(deckId!),
        FavoriteService.listFavoriteIds().catch(() => [] as string[]),
      ]);

      if (!deckData) {
        toast({ title: t('deckDetail.notFound'), variant: 'destructive' });
        navigate('/');
        return;
      }

      setDeck(deckData);
      setCards(cardsData);
      setIsFavorite(favIds.includes(deckData.id));
    } catch (error) {
      console.error(error);
      toast({ title: t('deckDetail.loadError'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const hasCardContent = (s: string): boolean => {
    if (s.replace(/<[^>]+>/g, '').trim().length > 0) return true;
    return /<(img|audio)\b/i.test(s);
  };

  const atLimit = !editingCard && cards.length >= maxCardsPerDeck;

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasCardContent(front) || !hasCardContent(back)) return;

    setSaving(true);
    try {
      if (editingCard) {
        await CardService.updateCard(editingCard.id, { front, back });
        toast({ title: t('deckDetail.editSuccess') });
        setIsModalOpen(false);
        setEditingCard(null);
        setFront('');
        setBack('');
      } else {
        await CardService.createCard(currentUser!.id, deckId!, {
          front,
          back,
        });
        toast({ title: t('deckDetail.createSuccess') });
        setFront('');
        setBack('');
        refreshLimits();
      }
      loadData();
    } catch (error) {
      console.error(error);
      handlePlanError(error, editingCard ? 'deckDetail.editError' : 'deckDetail.createError');
    } finally {
      setSaving(false);
    }
  };

  const openCreate = () => {
    setEditingCard(null);
    setFront('');
    setBack('');
    setIsModalOpen(true);
  };

  const openEdit = (card: Card) => {
    setEditingCard(card);
    setFront(card.front);
    setBack(card.back);
    setIsModalOpen(true);
  };

  const openRename = () => {
    if (!deck) return;
    setRenameValue(deck.title);
    setEditCategory(normalizeCategory(deck.category));
    setEditTags(deck.tags);
    setIsRenameOpen(true);
  };

  const handleRenameDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = renameValue.trim();
    if (!deck || !title) {
      setIsRenameOpen(false);
      return;
    }
    const category = normalizeCategory(editCategory);
    const unchanged =
      title === deck.title &&
      category === normalizeCategory(deck.category) &&
      JSON.stringify(editTags) === JSON.stringify(deck.tags);
    if (unchanged) {
      setIsRenameOpen(false);
      return;
    }
    setRenaming(true);
    try {
      await DeckService.updateDeck(deck.id, { title, category, tags: editTags });
      setDeck({ ...deck, title, category, tags: editTags });
      toast({ title: t('deckDetail.renameSuccess') });
      setIsRenameOpen(false);
    } catch (error) {
      console.error(error);
      toast({ title: t('deckDetail.renameError'), variant: 'destructive' });
    } finally {
      setRenaming(false);
    }
  };

  const handleExportDeck = async () => {
    if (!deckId) return;
    setExportingDeck(true);
    try {
      const { DeckExportService } = await import('../services/DeckExportService');
      const { blob, filename } = await DeckExportService.exportDeck(deckId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: t('deckDetail.exportSuccess') });
    } catch (error) {
      console.error(error);
      toast({ title: t('deckDetail.exportError'), variant: 'destructive' });
    } finally {
      setExportingDeck(false);
    }
  };

  const resetImport = () => {
    setImportFile(null);
    setImportBundle(null);
    setImportParsing(false);
    setImporting(false);
    setAudioProgress(null);
  };

  const handleImportFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportBundle(null);
    setImportParsing(true);
    try {
      const { DeckImportService } = await import('../services/DeckImportService');
      const bundle = await DeckImportService.parseFile(file);
      setImportBundle(bundle);
      const total = bundle.decks.reduce((s, d) => s + d.cards.length, 0);
      if (total === 0) {
        toast({ title: t('deckDetail.importEmpty'), variant: 'destructive' });
      }
    } catch (error) {
      console.error(error);
      toast({ title: t('deckDetail.importError'), variant: 'destructive' });
      setImportBundle(null);
    } finally {
      setImportParsing(false);
    }
  };

  const flatImportCards: NativeCard[] = importBundle
    ? importBundle.decks.flatMap((d) => d.cards)
    : [];
  const importTotal = flatImportCards.length;
  const skippedDecks = importBundle ? Math.max(0, importBundle.decks.length - 1) : 0;
  const perDeckRoom = Math.max(0, maxCardsPerDeck - cards.length);
  const importRoom = Math.min(perDeckRoom, totalRoom);
  const importWillTruncate = importTotal > importRoom;
  const importBlocked = importTotal > 0 && importRoom <= 0;

  const handleImportConfirm = async () => {
    if (!importBundle || importTotal === 0) return;
    if (importBlocked) {
      toast({
        title: t('deckDetail.limitReached', { limit: maxCardsPerDeck }),
        variant: 'destructive',
      });
      return;
    }
    setImporting(true);
    try {
      const cardsForInsert = flatImportCards.slice(0, importRoom).map((c) => ({
        front: c.front,
        back: c.back,
        frontAudio: c.frontAudio,
        backAudio: c.backAudio,
        tags: c.tags,
      }));

      const keptRefs = new Set<string>();
      for (const c of cardsForInsert) {
        for (const r of collectCardMediaRefs(c)) keptRefs.add(r.ref);
      }
      const mediaToUpload = Array.from(importBundle.mediaBlobs).filter(([ref]) =>
        keptRefs.has(ref),
      );
      if (mediaToUpload.length > 0) {
        const { MediaStorageService } = await import('../services/MediaStorageService');
        setAudioProgress({ done: 0, total: mediaToUpload.length });
        let done = 0;
        for (const [ref, { blob, kind }] of mediaToUpload) {
          await MediaStorageService.put(kind, ref, blob);
          done++;
          setAudioProgress({ done, total: mediaToUpload.length });
        }
      }

      const count = await CardService.bulkCreateCards(currentUser!.id, deckId!, cardsForInsert);
      if (count < importTotal) {
        toast({
          title: t('deckDetail.importTruncated', {
            count,
            total: importTotal,
            limit: maxCardsPerDeck,
          }),
        });
      } else {
        toast({ title: t('deckDetail.importSuccess', { count }) });
      }
      setIsImportOpen(false);
      resetImport();
      await loadData();
      refreshLimits();
    } catch (error) {
      console.error(error);
      handlePlanError(error, 'deckDetail.importError');
    } finally {
      setImporting(false);
    }
  };

  const toggleFavorite = async () => {
    if (!currentUser || !deck || favoritePending) return;
    setFavoritePending(true);
    try {
      if (isFavorite) {
        await FavoriteService.remove(currentUser.id, deck.id);
        setIsFavorite(false);
        toast({ title: t('publicDecks.unfavoriteSuccess') });
      } else {
        await FavoriteService.add(currentUser.id, deck.id);
        setIsFavorite(true);
        toast({ title: t('publicDecks.favoriteSuccess') });
      }
    } catch (error) {
      console.error(error);
      toast({ title: t('publicDecks.favoriteError'), variant: 'destructive' });
    } finally {
      setFavoritePending(false);
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!window.confirm(t('deckDetail.confirmDelete'))) return;
    try {
      await CardService.deleteCard(deckId!, cardId);
      setCards((prev) => prev.filter((c) => c.id !== cardId));
      toast({ title: t('deckDetail.deleteSuccess') });
      refreshLimits();
    } catch (error) {
      console.error(error);
      toast({ title: t('deckDetail.deleteError'), variant: 'destructive' });
    }
  };
  if (loading) return <LoadingState message={t('common.loading')} />;

  const stripForSearch = (s: string): string => (looksLikeHtml(s) ? s.replace(/<[^>]+>/g, ' ') : s);

  const filteredCards = cards.filter((card) =>
    [card.front, card.back].some((text) =>
      stripForSearch(text).toLowerCase().includes(searchTerm.toLowerCase()),
    ),
  );
  if (!deck) return null;

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="rounded-full border border-border/60 text-muted-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="sr-only">{t('common.back')}</span>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">{deck.title}</h1>
              {isOwner && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={openRename}
                  aria-label={t('deckDetail.editTitle')}
                  className="text-muted-foreground"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              )}
            </div>
            {!isOwner && (
              <p className="text-sm font-medium text-muted-foreground">
                {t('deckDetail.byAuthor', {
                  name: deck.ownerName || t('leaderboard.anonymous'),
                })}
              </p>
            )}
            <p className="text-muted-foreground">
              {t('deckDetail.cardCountLimit', { count: cards.length, limit: maxCardsPerDeck })}
            </p>
            {(normalizeCategory(deck.category) || deck.tags.length > 0) && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {normalizeCategory(deck.category) && (
                  <Badge variant="warm">{normalizeCategory(deck.category)}</Badge>
                )}
                {deck.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    <Tag className="h-3 w-3" aria-hidden />
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            {!isOwner && (
              <p className="mt-1 text-xs text-muted-foreground">{t('deckDetail.readOnlyHint')}</p>
            )}
          </div>
        </div>
        {!isOwner && (
          <div className="self-start md:self-auto">
            <Button
              variant={isFavorite ? 'default' : 'outline'}
              onClick={toggleFavorite}
              disabled={favoritePending}
            >
              <Star className={cn('w-5 h-5 mr-2', isFavorite && 'fill-current')} aria-hidden />
              {t(isFavorite ? 'deckDetail.unfavorite' : 'deckDetail.favorite')}
            </Button>
          </div>
        )}
        {isOwner && (
          <div className="flex flex-wrap gap-2 self-start md:self-auto">
            <Button variant="outline" onClick={() => setIsImportOpen(true)}>
              <Upload className="w-5 h-5 mr-2" />
              {t('deckDetail.import')}
            </Button>
            <Button variant="outline" onClick={handleExportDeck} disabled={exportingDeck}>
              <Download className="w-5 h-5 mr-2" />
              {exportingDeck ? t('deckDetail.exporting') : t('deckDetail.exportDeck')}
            </Button>
            <Button onClick={openCreate} disabled={atLimit}>
              <Plus className="w-5 h-5 mr-2" />
              {t('deckDetail.addCard')}
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-border/60 bg-card/80 shadow-2xl">
        <div className="border-b border-border/70 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('deckDetail.searchPlaceholder')}
              className="pl-10"
            />
          </div>
        </div>

        <div className="divide-y divide-border/60">
          {filteredCards.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {t('deckDetail.emptyState')}
            </div>
          ) : (
            filteredCards.map((card) => (
              <div
                key={card.id}
                className="flex items-start justify-between gap-4 p-5 transition hover:bg-muted/30"
              >
                <div className="grid flex-1 gap-4 md:grid-cols-2">
                  <div className="flex items-start gap-2">
                    {card.frontAudio && (
                      <PlayAudioButton
                        audioRef={card.frontAudio}
                        ownerId={card.ownerId}
                        size="sm"
                      />
                    )}
                    <RichContent
                      html={card.front}
                      ownerId={card.ownerId}
                      className="rich-text text-base font-medium"
                    />
                  </div>
                  <div className="flex items-start gap-2">
                    {card.backAudio && (
                      <PlayAudioButton audioRef={card.backAudio} ownerId={card.ownerId} size="sm" />
                    )}
                    <RichContent
                      html={card.back}
                      ownerId={card.ownerId}
                      className="rich-text text-muted-foreground"
                    />
                  </div>
                </div>
                {isOwner && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(card)}
                      aria-label={t('deckDetail.editCard')}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteCard(card.id)}
                      aria-label={t('common.delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {isOwner && (
        <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('deckDetail.editTitle')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleRenameDeck} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="rename-deck">
                  {t('deckDetail.renameLabel')}
                </label>
                <Input
                  id="rename-deck"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  placeholder={t('deckDetail.renamePlaceholder')}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="edit-deck-category">
                  {t('categories.fieldLabel')}
                </label>
                <CategorySelect
                  id="edit-deck-category"
                  value={editCategory}
                  onChange={setEditCategory}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="edit-deck-tags">
                  {t('categories.tagsLabel')}
                </label>
                <TagInput id="edit-deck-tags" tags={editTags} onChange={setEditTags} />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsRenameOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={renaming || !renameValue.trim()}>
                  {renaming ? t('common.loading') : t('common.save')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {isOwner && (
        <Dialog
          open={isImportOpen}
          onOpenChange={(open) => {
            setIsImportOpen(open);
            if (!open) resetImport();
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('deckDetail.importTitle')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t('deckDetail.importDescription')}</p>
              <div className="space-y-2">
                <label className="text-sm font-medium block">
                  {t('deckDetail.importChooseFile')}
                </label>
                <Input
                  type="file"
                  accept=".fldeck.zip,.zip"
                  onChange={handleImportFileSelect}
                  disabled={importParsing || importing}
                />
                {!importFile && (
                  <p className="text-xs text-muted-foreground">{t('deckDetail.importNoFile')}</p>
                )}
              </div>

              {importParsing && (
                <p className="text-sm text-muted-foreground">{t('deckDetail.importParsing')}</p>
              )}

              {audioProgress && audioProgress.total > 0 && (
                <p className="text-sm text-muted-foreground">
                  {t('dashboard.importAudioProgress', {
                    done: audioProgress.done,
                    total: audioProgress.total,
                  })}
                </p>
              )}

              {importBundle && importTotal > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {t('deckDetail.importPreview', { count: importTotal })}
                    {importBundle.mediaBlobs.size > 0 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        · {t('dashboard.importAudioCount', { count: importBundle.mediaBlobs.size })}
                      </span>
                    )}
                  </p>
                  {skippedDecks > 0 && (
                    <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                      {t('deckDetail.importMultiDeckFlatten', { count: importBundle.decks.length })}
                    </p>
                  )}
                  {importBlocked ? (
                    <p className="text-xs font-medium text-red-500">
                      {t('deckDetail.limitReached', { limit: maxCardsPerDeck })}
                    </p>
                  ) : importWillTruncate ? (
                    <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                      {t('deckDetail.importWillTruncate', {
                        room: importRoom,
                        total: importTotal,
                        limit: maxCardsPerDeck,
                      })}
                    </p>
                  ) : null}
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-border/60 divide-y divide-border/60">
                    {flatImportCards.slice(0, 5).map((c, i) => (
                      <div key={i} className="grid grid-cols-2 gap-2 p-2 text-xs">
                        <span className="truncate">{c.front.replace(/<[^>]+>/g, ' ').trim()}</span>
                        <span className="truncate text-muted-foreground">
                          {c.back.replace(/<[^>]+>/g, ' ').trim()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
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
                  importing || importParsing || !importBundle || importTotal === 0 || importBlocked
                }
              >
                {importing
                  ? t('deckDetail.importing')
                  : t('deckDetail.importConfirm', {
                      count: Math.min(importTotal, importRoom),
                    })}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {isOwner && (
        <Dialog
          open={isModalOpen}
          onOpenChange={(open) => {
            setIsModalOpen(open);
            if (!open) {
              setEditingCard(null);
              setFront('');
              setBack('');
            }
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingCard ? t('deckDetail.editCard') : t('deckDetail.addCard')}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveCard} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('deckDetail.frontLabel')}</label>
                <CardEditor
                  value={front}
                  onChange={setFront}
                  placeholder={t('deckDetail.frontPlaceholder')}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('deckDetail.backLabel')}</label>
                <CardEditor
                  value={back}
                  onChange={setBack}
                  placeholder={t('deckDetail.backPlaceholder')}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={saving || !hasCardContent(front) || !hasCardContent(back) || atLimit}
                >
                  {saving
                    ? t('common.loading')
                    : editingCard
                      ? t('common.save')
                      : t('deckDetail.addCard')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default DeckDetail;
