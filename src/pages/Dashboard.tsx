import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Plus, Book, Trash2, Edit2, PlayCircle, Upload, Download } from "lucide-react";
import { DeckService, type Deck } from "../services/DeckService";
import { CardService, DECK_CARD_LIMIT } from "../services/CardService";
import type { ParsedCard } from "../services/AnkiImportService";
import type { NativeImport } from "../services/DeckImportService";
import { collectCardMediaRefs } from "../lib/media";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { LoadingState } from "../components/LoadingState";
import { useToast } from "../components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Switch } from "../components/ui/switch";

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newDeckTitle, setNewDeckTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [isDeckPublic, setIsDeckPublic] = useState(false);
  const [visibilityLoading, setVisibilityLoading] = useState<string | null>(null);
  const { toast } = useToast();

  // Import state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importDeckName, setImportDeckName] = useState('');
  const [importParsed, setImportParsed] = useState<ParsedCard[] | null>(null);
  const [importMedia, setImportMedia] = useState<Map<string, { blob: Blob; kind: 'audio' | 'image' }>>(new Map());
  const [importNative, setImportNative] = useState<NativeImport | null>(null);
  const [exportingAll, setExportingAll] = useState(false);
  const [importParsing, setImportParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importIsPublic, setImportIsPublic] = useState(false);
  const [audioProgress, setAudioProgress] = useState<{ done: number; total: number } | null>(null);

  const resetImport = () => {
    setImportDeckName('');
    setImportParsed(null);
    setImportMedia(new Map());
    setImportNative(null);
    setImportParsing(false);
    setImporting(false);
    setImportIsPublic(false);
    setAudioProgress(null);
  };

  const handleImportFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportParsed(null);
    setImportMedia(new Map());
    setImportNative(null);
    setImportParsing(true);
    try {
      const { DeckImportService } = await import("../services/DeckImportService");
      const result = await DeckImportService.parseFile(file);
      if (result.kind === 'native') {
        setImportNative(result);
        const totalCards = result.decks.reduce((sum, d) => sum + d.cards.length, 0);
        if (result.decks.length === 0 || totalCards === 0) {
          toast({ title: t('dashboard.importEmpty'), variant: 'destructive' });
        }
      } else {
        setImportParsed(result.cards);
        setImportMedia(result.mediaBlobs);
        if (!importDeckName.trim()) {
          setImportDeckName(result.deckName ?? file.name.replace(/\.[^.]+$/, ''));
        }
        if (result.cards.length === 0) {
          toast({ title: t('dashboard.importEmpty'), variant: 'destructive' });
        }
      }
    } catch (error) {
      console.error(error);
      toast({ title: t('dashboard.importError'), variant: 'destructive' });
      setImportParsed(null);
      setImportNative(null);
    } finally {
      setImportParsing(false);
    }
  };

  const nativeTruncated = importNative?.decks.filter(
    (d) => d.cards.length > DECK_CARD_LIMIT
  ) ?? [];
  const ankiWillTruncate =
    !importNative && !!importParsed && importParsed.length > DECK_CARD_LIMIT;

  const handleImportConfirm = async () => {
    if (importNative) {
      setImporting(true);
      try {
        const { DeckImportService } = await import("../services/DeckImportService");
        const { decksCreated, cardsCreated } = await DeckImportService.importNative(
          currentUser!.id,
          (currentUser?.user_metadata?.full_name as string | undefined) || currentUser?.email || undefined,
          importNative,
          (done, total) => setAudioProgress({ done, total })
        );
        const totalRequested = importNative.decks.reduce(
          (s, d) => s + d.cards.length,
          0
        );
        if (cardsCreated < totalRequested) {
          toast({
            title: t('dashboard.importNativeTruncated', {
              decks: decksCreated,
              cards: cardsCreated,
              total: totalRequested,
              limit: DECK_CARD_LIMIT,
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
        loadDecks();
      } catch (error) {
        console.error(error);
        toast({ title: t('dashboard.importError'), variant: 'destructive' });
      } finally {
        setImporting(false);
        setAudioProgress(null);
      }
      return;
    }

    if (!importParsed || importParsed.length === 0 || !importDeckName.trim()) return;
    setImporting(true);
    try {
      const deckId = await DeckService.createDeck(currentUser!.id, {
        title: importDeckName.trim(),
        category: 'General',
        tags: [],
        isPublic: importIsPublic,
        ownerName: (currentUser?.user_metadata?.full_name as string | undefined) || currentUser?.email || undefined,
      });

      const keptParsed = importParsed.slice(0, DECK_CARD_LIMIT);
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
      const mediaToUpload = Array.from(importMedia).filter(([ref]) => keptRefs.has(ref));
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
        deckId,
        cardsForInsert
      );
      if (count < importParsed.length) {
        toast({
          title: t('dashboard.importTruncated', {
            title: importDeckName.trim(),
            count,
            total: importParsed.length,
            limit: DECK_CARD_LIMIT,
          }),
        });
      } else {
        toast({
          title: t('dashboard.importSuccess', {
            title: importDeckName.trim(),
            count,
          }),
        });
      }
      setIsImportOpen(false);
      resetImport();
      loadDecks();
    } catch (error) {
      console.error(error);
      toast({ title: t('dashboard.importError'), variant: 'destructive' });
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
        category: 'General',
        tags: [],
        isPublic: isDeckPublic,
        ownerName: (currentUser?.user_metadata?.full_name as string | undefined) || currentUser?.email || undefined,
      });
      toast({ title: t('dashboard.createSuccess') });
      setNewDeckTitle('');
      setIsDeckPublic(false);
      setIsModalOpen(false);
      loadDecks();
    } catch (error) {
      console.error(error);
      toast({ title: t('dashboard.createError'), variant: 'destructive' });
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
    } catch (error) {
      console.error(error);
      toast({ title: t('dashboard.deleteError'), variant: 'destructive' });
    }
  };

  const handleExportAll = async () => {
    if (!currentUser) return;
    setExportingAll(true);
    try {
      const { DeckExportService } = await import('../services/DeckExportService');
      const { blob, filename, count } = await DeckExportService.exportAllDecks(currentUser.id);
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
    } catch (error) {
      console.error(error);
      toast({ title: t('dashboard.exportError'), variant: 'destructive' });
    } finally {
      setExportingAll(false);
    }
  };

  const handleToggleVisibility = async (deck: Deck) => {
    setVisibilityLoading(deck.id);
    try {
      await DeckService.updateDeck(deck.id, { isPublic: !deck.isPublic });
      setDecks((prev) => prev.map((item) => item.id === deck.id ? { ...item, isPublic: !deck.isPublic } : item));
      toast({ title: deck.isPublic ? t('visibility.toggleSuccessPrivate') : t('visibility.toggleSuccessPublic') });
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
          <p className="text-sm uppercase tracking-widest text-muted-foreground">{t('common.back')}</p>
          <h1 className="text-3xl font-bold">{t('dashboard.title')}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setIsImportOpen(true)}>
            <Upload className="w-5 h-5 mr-2" />
            {t('dashboard.importGeneric')}
          </Button>
          <Button variant="outline" onClick={handleExportAll} disabled={exportingAll || decks.length === 0}>
            <Download className="w-5 h-5 mr-2" />
            {exportingAll ? t('dashboard.exporting') : t('dashboard.exportAll')}
          </Button>
          <Button onClick={() => setIsModalOpen(true)} className="shadow-lg">
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
            <Button variant="outline" onClick={() => setIsModalOpen(true)}>
              {t('dashboard.createDeck')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {decks.map((deck) => (
            <Card 
              key={deck.id} 
              className="relative overflow-hidden border-border/50 bg-gradient-to-br from-background to-card/70 transition-all hover:-translate-y-1 hover:border-primary/50"
            >
              <CardHeader className="flex flex-row items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary shadow-inner p-4">
                  <Book className="h-5 w-5" aria-hidden />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <span>{deck.isPublic ? t('visibility.public') : t('visibility.private')}</span>
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
                <div>
                  <CardTitle className="text-2xl">{deck.title}</CardTitle>
                  <CardDescription>
                    {t('dashboard.cardCount', { count: deck.cardCount })}
                  </CardDescription>
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
            <p className="text-sm text-muted-foreground">
              {t('dashboard.importDescription')}
            </p>
            <Input
              type="file"
              accept=".apkg,.colpkg,.zip,.txt,.csv,.tsv"
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

            {importNative && (
              <>
                <p className="text-sm text-muted-foreground">
                  {t('dashboard.importNativeDetected')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('dashboard.importNativeSummary', {
                    decks: importNative.decks.length,
                    cards: importNative.decks.reduce((s, d) => s + d.cards.length, 0),
                    media: importNative.mediaBlobs.size,
                  })}
                </p>
                {nativeTruncated.length > 0 && (
                  <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                    {t('dashboard.importLimitWillTruncateNative', {
                      count: nativeTruncated.length,
                      limit: DECK_CARD_LIMIT,
                    })}
                  </p>
                )}
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border/60 divide-y divide-border/60">
                  {importNative.decks.slice(0, 10).map((d, i) => (
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

            {!importNative && importParsed && importParsed.length > 0 && importMedia.size > 0 && (
              <p className="text-xs text-muted-foreground">
                {t('dashboard.importAudioCount', { count: importMedia.size })}
              </p>
            )}

            {ankiWillTruncate && (
              <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                {t('dashboard.importLimitWillTruncate', {
                  total: importParsed?.length ?? 0,
                  limit: DECK_CARD_LIMIT,
                })}
              </p>
            )}

            {!importNative && importParsed && importParsed.length > 0 && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium block">
                    {t('dashboard.importDeckName')}
                  </label>
                  <Input
                    value={importDeckName}
                    onChange={(e) => setImportDeckName(e.target.value)}
                    placeholder={t('dashboard.importDeckNamePlaceholder')}
                    disabled={importing}
                  />
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{t('visibility.fieldLabel')}</p>
                      <p className="text-xs text-muted-foreground">{t('visibility.fieldHint')}</p>
                    </div>
                    <Switch
                      checked={importIsPublic}
                      onCheckedChange={setImportIsPublic}
                      disabled={importing}
                    />
                  </div>
                </div>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-border/60 divide-y divide-border/60">
                  {importParsed.slice(0, 5).map((c, i) => (
                    <div key={i} className="grid grid-cols-2 gap-2 p-2 text-xs">
                      <span className="truncate">{c.front}</span>
                      <span className="truncate text-muted-foreground">{c.back}</span>
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
                (importNative
                  ? importNative.decks.length === 0
                  : !importParsed || importParsed.length === 0 || !importDeckName.trim())
              }
            >
              {importing
                ? t('dashboard.importing')
                : importNative
                ? t('dashboard.importNativeConfirm', { count: importNative.decks.length })
                : t('dashboard.importConfirm', {
                    count: Math.min(importParsed?.length ?? 0, DECK_CARD_LIMIT),
                  })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dashboard.createDeck')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateDeck} className="space-y-4">
            <Input
              value={newDeckTitle}
              onChange={(e) => setNewDeckTitle(e.target.value)}
              placeholder={t('dashboard.titlePlaceholder')}
              autoFocus
            />
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
