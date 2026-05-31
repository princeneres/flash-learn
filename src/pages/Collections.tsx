import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Layers, FolderOpen } from 'lucide-react';
import { CollectionService, type Collection } from '../services/CollectionService';
import { CategorySelect } from '../components/CategorySelect';
import { TagInput } from '../components/TagInput';
import { getDeckVisual } from '../lib/deckVisuals';
import { normalizeCategory } from '../lib/categories';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
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

const Collections: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (currentUser) void load();
  }, [currentUser]);

  const load = async () => {
    try {
      setCollections(await CollectionService.getUserCollections(currentUser!.id));
    } catch (error) {
      console.error(error);
      toast({ title: t('collections.loadError'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('');
    setTags([]);
    setIsPublic(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      await CollectionService.createCollection(currentUser!.id, {
        title,
        description,
        category: normalizeCategory(category),
        tags,
        isPublic,
      });
      toast({ title: t('collections.createSuccess') });
      setIsModalOpen(false);
      resetForm();
      await load();
    } catch (error) {
      console.error(error);
      toast({ title: t('collections.createError'), variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('collections.confirmDelete'))) return;
    try {
      await CollectionService.deleteCollection(id);
      setCollections((prev) => prev.filter((c) => c.id !== id));
      toast({ title: t('collections.deleteSuccess') });
    } catch (error) {
      console.error(error);
      toast({ title: t('collections.deleteError'), variant: 'destructive' });
    }
  };

  if (loading) return <LoadingState message={t('common.loading')} />;

  return (
    <div>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-[2.75rem]">
            {t('collections.title')}
          </h1>
          <p className="mt-2 text-muted-foreground">{t('collections.subtitle')}</p>
        </div>
        <Button variant="warm" className="shadow-lg" onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-5 w-5" />
          {t('collections.createCollection')}
        </Button>
      </div>

      {collections.length === 0 ? (
        <Card className="bg-mesh relative overflow-hidden border-dashed py-14 text-center">
          <CardHeader>
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-warm/15 text-warm shadow-inner">
              <Layers className="h-7 w-7" aria-hidden />
            </span>
            <CardTitle className="font-display mt-2 text-2xl">
              {t('collections.noCollections')}
            </CardTitle>
            <CardDescription className="mx-auto max-w-md">
              {t('collections.emptyHelper')}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="warm" onClick={() => setIsModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('collections.createCollection')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => {
            const category = normalizeCategory(c.category);
            const visual = getDeckVisual(category, c.title);
            return (
              <Card
                key={c.id}
                className="card-lift relative overflow-hidden border-border/50 bg-gradient-to-br from-background to-card/70 hover:border-warm/60 hover:shadow-elegant"
              >
                <span
                  className={cn(
                    'pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r to-transparent',
                    visual.accent,
                  )}
                  aria-hidden
                />
                <CardHeader className="flex flex-row items-start justify-between pt-8">
                  <div
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-2xl shadow-inner',
                      visual.tile,
                    )}
                  >
                    <FolderOpen className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <span>{c.isPublic ? t('visibility.public') : t('visibility.private')}</span>
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      className="rounded-full p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                      aria-label={t('common.delete')}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <CardTitle className="font-display text-2xl">{c.title}</CardTitle>
                    {c.description && (
                      <CardDescription className="line-clamp-2">{c.description}</CardDescription>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {t('collections.deckCount', { count: c.deckCount })}
                    </p>
                    {(category || c.tags.length > 0) && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {category && <Badge variant="warm">{category}</Badge>}
                        {c.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <Link to={`/collection/${c.id}`}>
                    <Button variant="outline" className="w-full">
                      {t('collections.open')}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('collections.createCollection')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="new-col-title">
                {t('deckDetail.renameLabel')}
              </label>
              <Input
                id="new-col-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('collections.titlePlaceholder')}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="new-col-desc">
                {t('collections.descriptionLabel')}
              </label>
              <Input
                id="new-col-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('collections.descriptionPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="new-col-category">
                {t('categories.fieldLabel')}
              </label>
              <CategorySelect id="new-col-category" value={category} onChange={setCategory} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="new-col-tags">
                {t('categories.tagsLabel')}
              </label>
              <TagInput id="new-col-tags" tags={tags} onChange={setTags} />
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{t('visibility.fieldLabel')}</p>
                  <p className="text-xs text-muted-foreground">{t('visibility.fieldHint')}</p>
                </div>
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={creating || !title.trim()}>
                {creating ? t('common.loading') : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Collections;
