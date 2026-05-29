import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { normalizeTags, parseTagInput } from '../lib/categories';
import { Input } from './ui/input';
import { Badge } from './ui/badge';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  id?: string;
  max?: number;
}

/** Chip-style tag editor: type and press Enter/comma to add, click × to remove. */
export const TagInput: React.FC<TagInputProps> = ({ tags, onChange, id, max = 10 }) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');

  const commit = () => {
    const next = normalizeTags([...tags, ...parseTagInput(draft)]).slice(0, max);
    onChange(next);
    setDraft('');
  };

  const remove = (tag: string) => onChange(tags.filter((x) => x !== tag));

  return (
    <div className="space-y-2">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="pr-1">
              {tag}
              <button
                type="button"
                onClick={() => remove(tag)}
                className="rounded-full p-0.5 transition hover:bg-foreground/10"
                aria-label={t('categories.removeTag', { tag })}
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
            remove(tags[tags.length - 1]);
          }
        }}
        onBlur={() => {
          if (draft.trim()) commit();
        }}
        placeholder={t('categories.tagsPlaceholder')}
        disabled={tags.length >= max}
      />
    </div>
  );
};
