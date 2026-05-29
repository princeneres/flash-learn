import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CATEGORY_PRESET_KEYS, normalizeCategory } from '../lib/categories';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';

// Radix Select values cannot be empty strings, so use sentinels.
const NONE = '__none__';
const OTHER = '__other__';

interface CategorySelectProps {
  value: string;
  onChange: (value: string) => void;
  /** id for the trigger, to pair with an external <label>. */
  id?: string;
}

/**
 * One-category-per-deck picker: a Select of localized preset suggestions plus
 * an "Other…" option that reveals a free-text input. An existing custom value
 * (not among the presets) opens in free-text mode automatically.
 */
export const CategorySelect: React.FC<CategorySelectProps> = ({ value, onChange, id }) => {
  const { t } = useTranslation();
  const presets = CATEGORY_PRESET_KEYS.map((k) => t(`categories.presets.${k}`));
  const current = normalizeCategory(value);
  const isPreset = current.length > 0 && presets.includes(current);

  const [custom, setCustom] = useState(current.length > 0 && !isPreset);

  const selectValue = current.length === 0 ? NONE : custom ? OTHER : current;

  const handleSelect = (v: string) => {
    if (v === NONE) {
      setCustom(false);
      onChange('');
    } else if (v === OTHER) {
      setCustom(true);
      if (isPreset) onChange(''); // start the custom field empty
    } else {
      setCustom(false);
      onChange(v);
    }
  };

  return (
    <div className="space-y-2">
      <Select value={selectValue} onValueChange={handleSelect}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={t('categories.placeholder')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{t('categories.uncategorized')}</SelectItem>
          {presets.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
          <SelectItem value={OTHER}>{t('categories.other')}</SelectItem>
        </SelectContent>
      </Select>
      {custom && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('categories.customPlaceholder')}
          maxLength={40}
          autoFocus
        />
      )}
    </div>
  );
};
