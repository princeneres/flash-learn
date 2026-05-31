import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, PlayCircle, Edit2, ListChecks, BookOpen, X } from 'lucide-react';
import {
  CollectionService,
  type Collection,
  type CollectionDeck,
} from '../services/CollectionService';
import { QuizService, type Quiz } from '../services/QuizService';
import { DeckService, type Deck } from '../services/DeckService';
import { getDeckVisual } from '../lib/deckVisuals';
import { normalizeCategory } from '../lib/categories';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { LoadingState } from '../components/LoadingState';
import { useToast } from '../components/ui/use-toast';
import { cn } from '../lib/utils';

const CollectionDetail: React.FC = () => {
  const { collectionId } = useParams<{ collectionId: string }>();
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [decks, setDecks] = useState<CollectionDeck[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [myDecks, setMyDecks] = useState<Deck[]>([]);
  const [adding, setAdding] = useState<string | null>(null);

  const [quizOpen, setQuizOpen] = useState(false);
  const [quizTitle, setQuizTitle] = useState('');
  const [creatingQuiz, setCreatingQuiz] = useState(false);

  const isOwner = !!collection && collection.ownerId === currentUser?.id;

  useEffect(() => {
    if (collectionId) void load();
  }, [collectionId]);

  const load = async () => {
    try {
      const [col, colDecks, colQuizzes] = await Promise.all([
        CollectionService.getCollectionDetail(collectionId!),
        CollectionService.getCollectionDecks(collectionId!),
        QuizService.getCollectionQuizzes(collectionId!),
      ]);
      if (!col) {
        toast({ title: t('collections.notFound'), variant: 'destructive' });
        navigate('/collections');
        return;
      }
      setCollection(col);
      setDecks(colDecks);
      setQuizzes(colQuizzes);
    } catch (error) {
      console.error(error);
      toast({ title: t('collections.loadError'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const inCollection = useMemo(() => new Set(decks.map((d) => d.id)), [decks]);
  const addableDecks = useMemo(
    () => myDecks.filter((d) => !inCollection.has(d.id)),
    [myDecks, inCollection],
  );

  const openAdd = async () => {
    setAddOpen(true);
    try {
      setMyDecks(await DeckService.getUserDecks(currentUser!.id));
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddDeck = async (deck: Deck) => {
    if (!currentUser || !collection) return;
    setAdding(deck.id);
    try {
      await CollectionService.addDeck(currentUser.id, collection.id, deck.id, decks.length);
      setDecks((prev) => [...prev, { ...deck, orderIndex: prev.length }]);
      setCollection((prev) => (prev ? { ...prev, deckCount: prev.deckCount + 1 } : prev));
    } catch (error) {
      console.error(error);
      toast({ title: t('collections.updateError'), variant: 'destructive' });
    } finally {
      setAdding(null);
    }
  };

  const handleRemoveDeck = async (deckId: string) => {
    if (!collection || !window.confirm(t('collections.removeDeckConfirm'))) return;
    try {
      await CollectionService.removeDeck(collection.id, deckId);
      setDecks((prev) => prev.filter((d) => d.id !== deckId));
      setCollection((prev) =>
        prev ? { ...prev, deckCount: Math.max(0, prev.deckCount - 1) } : prev,
      );
    } catch (error) {
      console.error(error);
      toast({ title: t('collections.updateError'), variant: 'destructive' });
    }
  };

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quizTitle.trim() || !collection) return;
    setCreatingQuiz(true);
    try {
      const id = await QuizService.createQuiz(currentUser!.id, {
        collectionId: collection.id,
        title: quizTitle,
        orderIndex: quizzes.length,
      });
      toast({ title: t('quiz.createSuccess') });
      setQuizOpen(false);
      setQuizTitle('');
      navigate(`/quiz/${id}/edit`);
    } catch (error) {
      console.error(error);
      toast({ title: t('quiz.createError'), variant: 'destructive' });
    } finally {
      setCreatingQuiz(false);
    }
  };

  const handleDeleteQuiz = async (quizId: string) => {
    if (!window.confirm(t('quiz.confirmDelete'))) return;
    try {
      await QuizService.deleteQuiz(quizId);
      setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
      toast({ title: t('quiz.deleteSuccess') });
    } catch (error) {
      console.error(error);
      toast({ title: t('quiz.deleteError'), variant: 'destructive' });
    }
  };

  if (loading) return <LoadingState message={t('common.loading')} />;
  if (!collection) return null;

  const category = normalizeCategory(collection.category);

  return (
    <div className="space-y-8">
      <div>
        <Button
          variant="ghost"
          onClick={() => navigate('/collections')}
          className="mb-4 gap-2 rounded-xl"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </Button>
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-4xl font-extrabold tracking-tight">
            {collection.title}
          </h1>
          {collection.description && (
            <p className="text-muted-foreground">{collection.description}</p>
          )}
          {!isOwner && collection.ownerName && (
            <p className="text-sm text-muted-foreground">
              {t('collections.owner', { name: collection.ownerName })}
            </p>
          )}
          {(category || collection.tags.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {category && <Badge variant="warm">{category}</Badge>}
              {collection.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Decks */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display flex items-center gap-2 text-2xl font-bold">
            <BookOpen className="h-5 w-5 text-warm" aria-hidden />
            {t('collections.decksTitle')}
          </h2>
          {isOwner && (
            <Button variant="outline" onClick={openAdd}>
              <Plus className="mr-2 h-4 w-4" />
              {t('collections.addDeck')}
            </Button>
          )}
        </div>
        {decks.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
            {t('collections.noDecksInCollection')}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {decks.map((deck) => {
              const cat = normalizeCategory(deck.category);
              const visual = getDeckVisual(cat, deck.title);
              return (
                <Card
                  key={deck.id}
                  className="card-lift relative overflow-hidden border-border/50 bg-gradient-to-br from-background to-card/70 hover:border-warm/60 hover:shadow-elegant"
                >
                  <span
                    className={cn(
                      'pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r to-transparent',
                      visual.accent,
                    )}
                    aria-hidden
                  />
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div
                      className={cn(
                        'flex h-11 w-11 items-center justify-center rounded-xl shadow-inner',
                        visual.tile,
                      )}
                    >
                      <visual.Icon className="h-5 w-5" aria-hidden />
                    </div>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => handleRemoveDeck(deck.id)}
                        className="rounded-full p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                        aria-label={t('collections.removeDeck')}
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1">
                      <CardTitle className="font-display text-xl">{deck.title}</CardTitle>
                      <CardDescription>
                        {t('dashboard.cardCount', { count: deck.cardCount })}
                      </CardDescription>
                    </div>
                    <div className="flex gap-3">
                      <Link to={`/deck/${deck.id}`} className="flex-1">
                        <Button variant="outline" className="w-full">
                          <Edit2 className="mr-2 h-4 w-4" />
                          {t('common.edit')}
                        </Button>
                      </Link>
                      <Link to={`/study/${deck.id}`} className="flex-1">
                        <Button variant="warm" className="w-full">
                          <PlayCircle className="mr-2 h-4 w-4" />
                          {t('dashboard.study')}
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Quizzes */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display flex items-center gap-2 text-2xl font-bold">
            <ListChecks className="h-5 w-5 text-warm" aria-hidden />
            {t('collections.quizzesTitle')}
          </h2>
          {isOwner && (
            <Button variant="outline" onClick={() => setQuizOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('quiz.createQuiz')}
            </Button>
          )}
        </div>
        {quizzes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
            {t('collections.noQuizzes')}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {quizzes.map((quiz) => (
              <Card
                key={quiz.id}
                className="card-lift relative overflow-hidden border-border/50 bg-card/80 hover:border-warm/60 hover:shadow-elegant"
              >
                <CardHeader className="flex flex-row items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-warm/15 text-warm shadow-inner">
                    <ListChecks className="h-5 w-5" aria-hidden />
                  </div>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => handleDeleteQuiz(quiz.id)}
                      className="rounded-full p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                      aria-label={t('common.delete')}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <CardTitle className="font-display text-xl">{quiz.title}</CardTitle>
                    <CardDescription>
                      {t('quiz.questionCount', { count: quiz.questionCount })}
                    </CardDescription>
                  </div>
                  <div className="flex gap-3">
                    {isOwner && (
                      <Link to={`/quiz/${quiz.id}/edit`} className="flex-1">
                        <Button variant="outline" className="w-full">
                          <Edit2 className="mr-2 h-4 w-4" />
                          {t('quiz.edit')}
                        </Button>
                      </Link>
                    )}
                    <Link to={`/quiz/${quiz.id}`} className="flex-1">
                      <Button variant="warm" className="w-full" disabled={quiz.questionCount === 0}>
                        <PlayCircle className="mr-2 h-4 w-4" />
                        {t('quiz.start')}
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Add deck dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('collections.addDeckTitle')}</DialogTitle>
          </DialogHeader>
          {addableDecks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('collections.addDeckEmpty')}
            </p>
          ) : (
            <div className="max-h-72 divide-y divide-border/60 overflow-y-auto rounded-lg border border-border/60">
              {addableDecks.map((deck) => (
                <div key={deck.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                  <span className="min-w-0 truncate font-medium">{deck.title}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={adding === deck.id}
                    onClick={() => handleAddDeck(deck)}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    {t('collections.addDeck')}
                  </Button>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              {t('common.ok')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create quiz dialog */}
      <Dialog
        open={quizOpen}
        onOpenChange={(open) => {
          setQuizOpen(open);
          if (!open) setQuizTitle('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('quiz.createQuizTitle')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateQuiz} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="new-quiz-title">
                {t('quiz.titleLabel')}
              </label>
              <Input
                id="new-quiz-title"
                value={quizTitle}
                onChange={(e) => setQuizTitle(e.target.value)}
                placeholder={t('quiz.titlePlaceholder')}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setQuizOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={creatingQuiz || !quizTitle.trim()}>
                {creatingQuiz ? t('common.loading') : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CollectionDetail;
