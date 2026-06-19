import { useAppState } from '../app/AppStateContext';
import { descriptionTerms } from './i18n/descriptionTerms';
import { translations } from './i18n/messages';
import { specLabels } from './i18n/specLabels';
import { valueLabels } from './i18n/valueLabels';
import type { AppLocale, HardwareCategory, HardwareSpecKey, LabelElementKind } from '../types';

export const localeOptions: Array<{ locale: AppLocale; label: string }> = [
  { locale: 'en', label: '🇬🇧 English' },
  { locale: 'it', label: '🇮🇹 Italiano' },
  { locale: 'de', label: '🇩🇪 Deutsch' },
  { locale: 'fr', label: '🇫🇷 Français' },
  { locale: 'es', label: '🇪🇸 Español' }
];

export const isAppLocale = (value: unknown): value is AppLocale =>
  localeOptions.some((option) => option.locale === value);

export const normalizeLocale = (value: unknown): AppLocale => (isAppLocale(value) ? value : 'en');

type TranslationKey = keyof typeof translations.en;

export const translate = (locale: AppLocale, key: TranslationKey, values: Record<string, string | number> = {}): string => {
  const messages = translations[normalizeLocale(locale)];
  const message = String(messages[key] ?? translations.en[key]);
  return Object.entries(values).reduce((text, [name, value]) => text.split(`{${name}}`).join(String(value)), message);
};

const upperCaseValues = new Set(['abs', 'epdm', 'fr4', 'g10', 'mp35n', 'peek', 'pfa', 'pom', 'pps', 'ptfe', 'pvc', 'pvdf', 'tpi', 'unc', 'unf']);
const lowerCaseValues = new Set(['in', 'inch', 'inches', 'mm']);
const unitValues = new Set(['in', 'inch', 'inches', 'mm', 'mm approx', 'threads/inch', 'tpi']);

const titleCaseValue = (value: string) =>
  value.replace(/[A-Za-z0-9]+(?:[-/][A-Za-z0-9]+)*/g, (part) => {
    const lowerPart = part.toLowerCase();
    if (upperCaseValues.has(lowerPart)) return part.toUpperCase();
    if (lowerCaseValues.has(lowerPart)) return lowerPart;
    if (/^[A-Z0-9-/.]+$/.test(part)) return part;
    return part.charAt(0).toUpperCase() + part.slice(1);
  });

const capitalizeDisplay = (value: string) => (value ? value.charAt(0).toLocaleUpperCase() + value.slice(1) : value);

const escapedRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const catalogDescription = (locale: AppLocale, description: string) => {
  const normalizedLocale = normalizeLocale(locale);
  if (normalizedLocale === 'en') return description;
  return descriptionTerms[normalizedLocale]
    .sort(([left], [right]) => right.length - left.length)
    .reduce(
      (text, [source, replacement]) => text.replace(new RegExp(`\\b${escapedRegExp(source)}\\b`, 'gi'), replacement),
      description
    );
};

export const specLabel = (locale: AppLocale, key: HardwareSpecKey) => specLabels[normalizeLocale(locale)][key] ?? specLabels.en[key];

export const displayValue = (locale: AppLocale, value: string) => {
  const normalizedValue = value.trim().toLowerCase();
  if (!normalizedValue) return '';
  if (unitValues.has(normalizedValue)) return value.trim();
  return capitalizeDisplay(valueLabels[normalizeLocale(locale)][normalizedValue] ?? titleCaseValue(value.trim()));
};

export const displaySpecValue = (locale: AppLocale, key: HardwareSpecKey, value: string) => {
  if (['material', 'materialType', 'finish', 'threadPitchName'].includes(key)) return displayValue(locale, value);
  return value;
};

export const categoryLabel = (locale: AppLocale, category: HardwareCategory) =>
  translate(locale, `category_${category}` as TranslationKey);

export const elementKindLabel = (locale: AppLocale, kind: LabelElementKind) =>
  translate(locale, `kind_${kind}` as TranslationKey);

export function useI18n() {
  const { state } = useAppState();
  const locale = state.locale;
  return {
    locale,
    t: (key: TranslationKey, values?: Record<string, string | number>) => translate(locale, key, values),
    categoryLabel: (category: HardwareCategory) => categoryLabel(locale, category),
    elementKindLabel: (kind: LabelElementKind) => elementKindLabel(locale, kind),
    specLabel: (key: HardwareSpecKey) => specLabel(locale, key),
    displayValue: (value: string) => displayValue(locale, value),
    displaySpecValue: (key: HardwareSpecKey, value: string) => displaySpecValue(locale, key, value),
    catalogDescription: (description: string) => catalogDescription(locale, description)
  };
}
