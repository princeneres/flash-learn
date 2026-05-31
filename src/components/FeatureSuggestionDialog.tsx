import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lightbulb } from 'lucide-react';
import {
  FeatureSuggestionService,
  type SuggestionCategory,
} from '../services/FeatureSuggestionService';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useToast } from './ui/use-toast';

interface FeatureSuggestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORIES: SuggestionCategory[] = ['feature', 'improvement', 'bug', 'other'];
const MAX_LENGTH = 4000;

export const FeatureSuggestionDialog: React.FC<FeatureSuggestionDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [category, setCategory] = useState<SuggestionCategory>('feature');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setCategory('feature');
    setMessage('');
    setSubmitting(false);
  };

  const handleClose = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      await FeatureSuggestionService.submit({ message, category });
      toast({ title: t('suggestion.success') });
      handleClose(false);
    } catch (err) {
      console.error('Failed to submit suggestion', err);
      toast({ title: t('suggestion.error'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-warm" />
            {t('suggestion.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('suggestion.description')}</p>

          <div className="space-y-2">
            <Label htmlFor="suggestion-category">{t('suggestion.categoryLabel')}</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as SuggestionCategory)}>
              <SelectTrigger id="suggestion-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {t(`suggestion.category.${c}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="suggestion-message">{t('suggestion.messageLabel')}</Label>
            <Textarea
              id="suggestion-message"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MAX_LENGTH))}
              placeholder={t('suggestion.messagePlaceholder')}
              className="min-h-[140px]"
              autoFocus
            />
            <p className="text-right text-xs text-muted-foreground">
              {message.length}/{MAX_LENGTH}
            </p>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleClose(false)}
            disabled={submitting}
          >
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting || !message.trim()}>
            {submitting ? t('suggestion.sending') : t('suggestion.send')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
