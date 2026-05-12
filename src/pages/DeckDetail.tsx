import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Plus, Trash2, Search, Upload, Pencil, Download } from "lucide-react";
import { DeckService, type Deck } from "../services/DeckService";
import { CardService, type Card, DECK_CARD_LIMIT, DeckLimitError } from "../services/CardService";
import type { ParsedCard } from "../services/AnkiImportService";
import { PlayAudioButton } from "../components/PlayAudioButton";
import { CardEditor } from "../components/CardEditor";
import { RichContent } from "../components/RichContent";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { LoadingState } from "../components/LoadingState";
import { useToast } from "../components/ui/use-toast";
import { Input } from "../components/ui/input";
import { looksLikeHtml } from "../lib/sanitize";
import { collectCardMediaRefs } from "../lib/media";

const DeckDetail: React.FC = () => {
  const { deckId } = useParams<{ deckId: string }>();
  const { t } = useTranslation();
  const { currentUser } = useAuth();
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
  const [searchTerm, setSearchTerm] = useState("");
  const [exportingDeck, setExportingDeck] = useState(false);
  const { toast } = useToast();

  // Import state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importParsed, setImportParsed] = useState<ParsedCard[] | null>(null);
  const [importMedia, setImportMedia] = useState<Map<string, { blob: Blob; kind: 'audio' | 'image' }>>(new Map());
  const [importParsing, setImportParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [audioProgress, setAudioProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    if (currentUser && deckId) {
      loadData();
    }
  }, [currentUser, deckId]);

  const loadData = async () => {
    try {
      const [deckData, cardsData] = await Promise.all([
        DeckService.getDeck(deckId!),
        CardService.getDeckCards(deckId!)
      ]);
      
      if (!deckData) {
        toast({ title: t('deckDetail.notFound'), variant: 'destructive' });
        navigate('/');
        return;
      }
      
      setDeck(deckData);
      setCards(cardsData);
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

  const atLimit = !editingCard && cards.length >= DECK_CARD_LIMIT;

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasCardContent(front) || !hasCardContent(back)) return;
    if (atLimit) {
      toast({
        title: t('deckDetail.limitReached', { limit: DECK_CARD_LIMIT }),
        variant: 'destructive',
      });
      return;
    }

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
      }
      loadData();
    } catch (error) {
      console.error(error);
      toast({
        title: editingCard ? t('deckDetail.editError') : t('deckDetail.createError'),
        variant: 'destructive',
      });
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
    setImportParsed(null);
    setImportMedia(new Map());
    setImportParsing(false);
    setImporting(false);
    setAudioProgress(null);
  };

  const handleImportFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportParsed(null);
    setImportMedia(new Map());
    setImportParsing(true);
    try {
      const { AnkiImportService } = await import("../services/AnkiImportService");
      const { cards, mediaBlobs } = await AnkiImportService.parseFile(file);
      setImportParsed(cards);
      setImportMedia(mediaBlobs);
      if (cards.length === 0) {
        toast({ title: t('deckDetail.importEmpty'), variant: 'destructive' });
      }
    } catch (error) {
      console.error(error);
      toast({ title: t('deckDetail.importError'), variant: 'destructive' });
      setImportParsed(null);
    } finally {
      setImportParsing(false);
    }
  };

  const importRoom = Math.max(0, DECK_CARD_LIMIT - cards.length);
  const importWillTruncate = !!importParsed && importParsed.length > importRoom;
  const importBlocked = !!importParsed && importRoom <= 0;

  const handleImportConfirm = async () => {
    if (!importParsed || importParsed.length === 0) return;
    if (importBlocked) {
      toast({
        title: t('deckDetail.limitReached', { limit: DECK_CARD_LIMIT }),
        variant: 'destructive',
      });
      return;
    }
    setImporting(true);
    try {
      const keptParsed = importParsed.slice(0, importRoom);
      const cardsForInsert = keptParsed.map((c) => ({
        front: c.frontHtml ?? c.front,
        back: c.backHtml ?? c.back,
        frontAudio: c.frontAudioRef,
        backAudio: c.backAudioRef,
      }));

      const keptRefs = new Set<string>();
      for (const c of cardsForInsert) {
        for (const r of collectCardMediaRefs(c)) keptRefs.add(r.ref);
      }
      const mediaToUpload = Array.from(importMedia).filter(([ref]) =>
        keptRefs.has(ref)
      );
      if (mediaToUpload.length > 0) {
        const { MediaStorageService } = await import("../services/MediaStorageService");
        setAudioProgress({ done: 0, total: mediaToUpload.length });
        let done = 0;
        for (const [ref, { blob, kind }] of mediaToUpload) {
          await MediaStorageService.put(kind, ref, blob);
          done++;
          setAudioProgress({ done, total: mediaToUpload.length });
        }
      }

      const count = await CardService.bulkCreateCards(
        currentUser!.id,
        deckId!,
        cardsForInsert
      );
      if (count < importParsed.length) {
        toast({
          title: t('deckDetail.importTruncated', {
            count,
            total: importParsed.length,
            limit: DECK_CARD_LIMIT,
          }),
        });
      } else {
        toast({ title: t('deckDetail.importSuccess', { count }) });
      }
      setIsImportOpen(false);
      resetImport();
      loadData();
    } catch (error) {
      console.error(error);
      if (error instanceof DeckLimitError) {
        toast({
          title: t('deckDetail.limitReachedImport', {
            current: error.current,
            attempting: error.attempting,
            limit: error.limit,
          }),
          variant: 'destructive',
        });
      } else {
        toast({ title: t('deckDetail.importError'), variant: 'destructive' });
      }
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!window.confirm(t('deckDetail.confirmDelete'))) return;
    try {
      await CardService.deleteCard(deckId!, cardId);
      setCards((prev) => prev.filter((c) => c.id !== cardId));
      toast({ title: t('deckDetail.deleteSuccess') });
    } catch (error) {
      console.error(error);
      toast({ title: t('deckDetail.deleteError'), variant: 'destructive' });
    }
  };
  if (loading) return <LoadingState message={t('common.loading')} />;

  const stripForSearch = (s: string): string =>
    looksLikeHtml(s) ? s.replace(/<[^>]+>/g, ' ') : s;

  const filteredCards = cards.filter((card) =>
    [card.front, card.back].some((text) =>
      stripForSearch(text).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );
  if (!deck) return null;

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/')}
            className="rounded-full border border-border/60 text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
            <span className="sr-only">{t('common.back')}</span>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{deck.title}</h1>
            <p className="text-muted-foreground">
              {t('deckDetail.cardCountLimit', { count: cards.length, limit: DECK_CARD_LIMIT })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 self-start md:self-auto">
          <Button variant="outline" onClick={() => setIsImportOpen(true)}>
            <Upload className="w-5 h-5 mr-2" />
            {t('deckDetail.import')}
          </Button>
          <Button variant="outline" onClick={handleExportDeck} disabled={exportingDeck}>
            <Download className="w-5 h-5 mr-2" />
            {exportingDeck ? t('deckDetail.exporting') : t('deckDetail.exportDeck')}
          </Button>
          <Button onClick={openCreate} disabled={cards.length >= DECK_CARD_LIMIT}>
            <Plus className="w-5 h-5 mr-2" />
            {t('deckDetail.addCard')}
          </Button>
        </div>
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
              <div key={card.id} className="flex items-start justify-between gap-4 p-5 transition hover:bg-muted/30">
                <div className="grid flex-1 gap-4 md:grid-cols-2">
                  <div className="flex items-start gap-2">
                    {card.frontAudio && (
                      <PlayAudioButton audioRef={card.frontAudio} size="sm" />
                    )}
                    <RichContent
                      html={card.front}
                      className="rich-text text-base font-medium"
                    />
                  </div>
                  <div className="flex items-start gap-2">
                    {card.backAudio && (
                      <PlayAudioButton audioRef={card.backAudio} size="sm" />
                    )}
                    <RichContent
                      html={card.back}
                      className="rich-text text-muted-foreground"
                    />
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(card)} aria-label={t('deckDetail.editCard')}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteCard(card.id)} aria-label={t('common.delete')}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

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
            <p className="text-sm text-muted-foreground">
              {t('deckDetail.importDescription')}
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium block">
                {t('deckDetail.importChooseFile')}
              </label>
              <Input
                type="file"
                accept=".apkg,.colpkg,.txt,.csv,.tsv"
                onChange={handleImportFileSelect}
                disabled={importParsing || importing}
              />
              {!importFile && (
                <p className="text-xs text-muted-foreground">
                  {t('deckDetail.importNoFile')}
                </p>
              )}
            </div>

            {importParsing && (
              <p className="text-sm text-muted-foreground">
                {t('deckDetail.importParsing')}
              </p>
            )}

            {audioProgress && audioProgress.total > 0 && (
              <p className="text-sm text-muted-foreground">
                {t('dashboard.importAudioProgress', {
                  done: audioProgress.done,
                  total: audioProgress.total,
                })}
              </p>
            )}

            {importParsed && importParsed.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {t('deckDetail.importPreview', { count: importParsed.length })}
                  {importMedia.size > 0 && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      · {t('dashboard.importAudioCount', { count: importMedia.size })}
                    </span>
                  )}
                </p>
                {importBlocked ? (
                  <p className="text-xs font-medium text-red-500">
                    {t('deckDetail.limitReached', { limit: DECK_CARD_LIMIT })}
                  </p>
                ) : importWillTruncate ? (
                  <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                    {t('deckDetail.importWillTruncate', {
                      room: importRoom,
                      total: importParsed.length,
                      limit: DECK_CARD_LIMIT,
                    })}
                  </p>
                ) : null}
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border/60 divide-y divide-border/60">
                  {importParsed.slice(0, 5).map((c, i) => (
                    <div key={i} className="grid grid-cols-2 gap-2 p-2 text-xs">
                      <span className="truncate">{c.front}</span>
                      <span className="truncate text-muted-foreground">{c.back}</span>
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
                importing ||
                importParsing ||
                !importParsed ||
                importParsed.length === 0 ||
                importBlocked
              }
            >
              {importing
                ? t('deckDetail.importing')
                : t('deckDetail.importConfirm', {
                    count: Math.min(importParsed?.length ?? 0, importRoom),
                  })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                disabled={
                  saving ||
                  !hasCardContent(front) ||
                  !hasCardContent(back) ||
                  atLimit
                }
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
    </div>
  );
};

export default DeckDetail;
