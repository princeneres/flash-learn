import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Check, Edit2 } from 'lucide-react';
import {
  QuizService,
  type Quiz,
  type QuizQuestion,
  type QuizQuestionKind,
  type QuizOption,
} from '../services/QuizService';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { LoadingState } from '../components/LoadingState';
import { useToast } from '../components/ui/use-toast';
import { cn } from '../lib/utils';

const KINDS: QuizQuestionKind[] = ['single', 'multiple', 'boolean'];

// Stable-ish ids for option rows without Math.random (forbidden in some envs).
let optionSeq = 0;
const newOptionId = () => `opt-${optionSeq++}`;

const blankOptions = (kind: QuizQuestionKind): QuizOption[] =>
  kind === 'boolean'
    ? [
        { id: newOptionId(), text: 'true', correct: false },
        { id: newOptionId(), text: 'false', correct: false },
      ]
    : [
        { id: newOptionId(), text: '', correct: false },
        { id: newOptionId(), text: '', correct: false },
      ];

const QuizEditor: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<QuizQuestion | null>(null);
  const [prompt, setPrompt] = useState('');
  const [kind, setKind] = useState<QuizQuestionKind>('single');
  const [options, setOptions] = useState<QuizOption[]>([]);
  const [explanation, setExplanation] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (quizId) void load();
  }, [quizId]);

  const load = async () => {
    try {
      const [q, qs] = await Promise.all([
        QuizService.getQuiz(quizId!),
        QuizService.getQuizQuestions(quizId!),
      ]);
      if (!q) {
        toast({ title: t('quiz.notFound'), variant: 'destructive' });
        navigate('/collections');
        return;
      }
      setQuiz(q);
      setQuestions(qs);
    } catch (error) {
      console.error(error);
      toast({ title: t('quiz.loadError'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setPrompt('');
    setKind('single');
    setOptions(blankOptions('single'));
    setExplanation('');
    setEditorOpen(true);
  };

  const openEdit = (q: QuizQuestion) => {
    setEditing(q);
    setPrompt(q.prompt);
    setKind(q.kind);
    setOptions(q.options.map((o) => ({ ...o })));
    setExplanation(q.explanation ?? '');
    setEditorOpen(true);
  };

  const handleKindChange = (next: QuizQuestionKind) => {
    setKind(next);
    if (next === 'boolean') setOptions(blankOptions('boolean'));
  };

  const toggleCorrect = (id: string) => {
    setOptions((prev) =>
      prev.map((o) => {
        if (kind === 'single' || kind === 'boolean') {
          return { ...o, correct: o.id === id };
        }
        return o.id === id ? { ...o, correct: !o.correct } : o;
      }),
    );
  };

  const setOptionText = (id: string, text: string) =>
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, text } : o)));

  const addOption = () =>
    setOptions((prev) => [...prev, { id: newOptionId(), text: '', correct: false }]);

  const removeOption = (id: string) =>
    setOptions((prev) => (prev.length > 2 ? prev.filter((o) => o.id !== id) : prev));

  const handleSave = async () => {
    if (!prompt.trim()) {
      toast({ title: t('quiz.editor.needPrompt'), variant: 'destructive' });
      return;
    }
    const cleaned = options
      .map((o) => ({ ...o, text: o.text.trim() }))
      .filter((o) => o.text.length > 0);
    if (!cleaned.some((o) => o.correct)) {
      toast({ title: t('quiz.editor.needCorrect'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await QuizService.updateQuestion(editing.id, {
          prompt,
          kind,
          options: cleaned,
          explanation,
        });
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === editing.id ? { ...q, prompt, kind, options: cleaned, explanation } : q,
          ),
        );
      } else {
        const id = await QuizService.createQuestion(currentUser!.id, quizId!, {
          prompt,
          kind,
          options: cleaned,
          explanation,
          orderIndex: questions.length,
        });
        setQuestions((prev) => [
          ...prev,
          {
            id,
            quizId: quizId!,
            ownerId: currentUser!.id,
            prompt,
            kind,
            options: cleaned,
            explanation,
            orderIndex: prev.length,
            createdAt: '',
          },
        ]);
      }
      toast({ title: t('quiz.editor.saveSuccess') });
      setEditorOpen(false);
    } catch (error) {
      console.error(error);
      toast({ title: t('quiz.editor.saveError'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (q: QuizQuestion) => {
    if (!window.confirm(t('quiz.editor.deleteQuestion') + '?')) return;
    try {
      await QuizService.deleteQuestion(q.id);
      setQuestions((prev) => prev.filter((x) => x.id !== q.id));
    } catch (error) {
      console.error(error);
      toast({ title: t('quiz.editor.saveError'), variant: 'destructive' });
    }
  };

  if (loading) return <LoadingState message={t('common.loading')} />;
  if (!quiz) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Button
          variant="ghost"
          onClick={() => navigate(`/collection/${quiz.collectionId}`)}
          className="mb-4 gap-2 rounded-xl"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </Button>
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">{quiz.title}</h1>
          <Button variant="warm" onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" />
            {t('quiz.editor.addQuestion')}
          </Button>
        </div>
      </div>

      {questions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          {t('quiz.editor.noQuestions')}
        </p>
      ) : (
        <div className="space-y-4">
          {questions.map((q, i) => (
            <Card key={q.id} className="border-border/60">
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <CardTitle className="text-base font-semibold">
                  {i + 1}. {q.prompt}
                </CardTitle>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(q)}
                    className="rounded-full p-2 text-muted-foreground transition hover:bg-accent"
                    aria-label={t('common.edit')}
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(q)}
                    className="rounded-full p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    aria-label={t('quiz.editor.deleteQuestion')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <ul className="space-y-1.5">
                  {q.options.map((o) => (
                    <li
                      key={o.id}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm',
                        o.correct
                          ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                          : 'text-muted-foreground',
                      )}
                    >
                      {o.correct && <Check className="h-3.5 w-3.5 shrink-0" />}
                      <span>{o.text}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t('common.edit') : t('quiz.editor.addQuestion')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('quiz.editor.promptLabel')}</label>
              <Input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t('quiz.editor.promptPlaceholder')}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('quiz.editor.kindLabel')}</label>
              <div className="flex flex-wrap gap-2">
                {KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => handleKindChange(k)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition',
                      kind === k
                        ? 'border-warm/60 bg-warm/10 text-warm-foreground dark:text-warm'
                        : 'border-border text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {t(
                      k === 'single'
                        ? 'quiz.editor.kindSingle'
                        : k === 'multiple'
                          ? 'quiz.editor.kindMultiple'
                          : 'quiz.editor.kindBoolean',
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('quiz.editor.optionsLabel')}</label>
              <div className="space-y-2">
                {options.map((o) => (
                  <div key={o.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleCorrect(o.id)}
                      aria-label={t('quiz.editor.markCorrect')}
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition',
                        o.correct
                          ? 'border-green-500 bg-green-500 text-white'
                          : 'border-border text-transparent hover:border-green-500',
                      )}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <Input
                      value={o.text}
                      onChange={(e) => setOptionText(o.id, e.target.value)}
                      placeholder={t('quiz.editor.optionPlaceholder')}
                      disabled={kind === 'boolean'}
                    />
                    {kind !== 'boolean' && options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(o.id)}
                        className="rounded-full p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                        aria-label={t('common.delete')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {kind !== 'boolean' && (
                <Button type="button" variant="ghost" size="sm" onClick={addOption}>
                  <Plus className="mr-1 h-4 w-4" />
                  {t('quiz.editor.addOption')}
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('quiz.editor.explanationLabel')}</label>
              <Input
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder={t('quiz.editor.explanationPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setEditorOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? t('common.loading') : t('quiz.editor.saveQuestion')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuizEditor;
